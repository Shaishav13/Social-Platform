import { DatabaseConnection } from '../../config/database';
import { Pool } from 'pg';

export class ChatDatabase {
  private get db(): Pool {
    return DatabaseConnection.getPool();
  }

  static async initializeTables() {
    const query = `
      CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          is_group BOOLEAN DEFAULT FALSE,
          name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversation_participants (
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          read_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await DatabaseConnection.query(query);
  }

  async getOrCreateConversation(user1Id: string, user2Id: string) {
    const query = `
      SELECT c.id 
      FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
      WHERE c.is_group = false 
        AND cp1.user_id = $1 
        AND cp2.user_id = $2
    `;
    const result = await this.db.query(query, [user1Id, user2Id]);
    if (result.rows.length > 0) return result.rows[0].id;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const convResult = await client.query(
        'INSERT INTO conversations (is_group) VALUES (false) RETURNING id'
      );
      const convId = convResult.rows[0].id;
      
      await client.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [convId, user1Id, user2Id]
      );
      
      await client.query('COMMIT');
      return convId;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getConversations(userId: string) {
    const query = `
      SELECT c.*, 
             (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
             u.username as other_username, u.profile_picture as other_profile_picture, u.id as other_user_id,
             (SELECT COUNT(*) FROM messages m2 WHERE m2.conversation_id = c.id AND m2.sender_id = $1) as my_message_count
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != $1
      JOIN users u ON cp2.user_id = u.id
      WHERE cp.user_id = $1
      ORDER BY c.updated_at DESC
    `;
    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => ({
      ...row,
      is_request: parseInt(row.my_message_count) === 0
    }));
  }

  async getMessages(conversationId: string, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.db.query(query, [conversationId, limit, offset]);
    return result.rows;
  }

  async saveMessage(conversationId: string, senderId: string, content: string) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      let receiverId: string | null = null;
      let receiverEmail: string | null = null;
      let receiverSentCount = 0;
      
      const otherUserResult = await client.query(
        'SELECT cp.user_id, u.email FROM conversation_participants cp JOIN users u ON u.id = cp.user_id WHERE cp.conversation_id = $1 AND cp.user_id != $2',
        [conversationId, senderId]
      );
      if (otherUserResult.rows.length > 0) {
        receiverId = otherUserResult.rows[0].user_id;
        receiverEmail = otherUserResult.rows[0].email;
        
        // Check if receiver follows sender
        const followsCheck = await client.query(
          'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1 AND following_id = $2',
          [receiverId, senderId]
        );
        const theyFollowMe = parseInt(followsCheck.rows[0].count) > 0;
        
        if (!theyFollowMe) {
          const sentCountResult = await client.query(
            'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1 AND sender_id = $2',
            [conversationId, senderId]
          );
          if (parseInt(sentCountResult.rows[0].count) >= 1) {
            throw new Error('LIMIT_REACHED');
          }
        }
      }

      const query = `
        INSERT INTO messages (conversation_id, sender_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const result = await client.query(query, [conversationId, senderId, content]);
      
      await client.query(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [conversationId]);
      
      if (receiverId) {
        const receiverCountResult = await client.query(
          'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1 AND sender_id = $2',
          [conversationId, receiverId]
        );
        receiverSentCount = parseInt(receiverCountResult.rows[0].count);
      }
      
      await client.query('COMMIT');
      return { 
        message: result.rows[0], 
        receiverEmail, 
        receiverSentCount 
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

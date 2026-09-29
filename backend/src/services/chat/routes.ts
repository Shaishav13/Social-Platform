import { Router } from 'express';
import { authenticateToken } from '../auth/middleware';
import { ChatDatabase } from './database';

const router = Router();
const db = new ChatDatabase();

router.use(authenticateToken);

router.get('/conversations', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const conversations = await db.getConversations(userId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.post('/conversations', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    
    const convId = await db.getOrCreateConversation(userId, targetUserId);
    res.json({ id: convId });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const messages = await db.getMessages(id, limit, offset);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export const chatRoutes = router;

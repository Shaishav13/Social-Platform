import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function resetPassword() {
  const usernameOrEmail = process.argv[2];
  const newPassword = process.argv[3];

  if (!usernameOrEmail || !newPassword) {
    console.error('Usage: ts-node reset-password.ts <username_or_email> <new_password>');
    console.error('Example: ts-node reset-password.ts my_user NewPassword123!');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'social_media_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  });

  try {
    const client = await pool.connect();
    console.log(`Connected to database. Looking for user: ${usernameOrEmail}...`);

    // Check if user exists
    const userResult = await client.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $1',
      [usernameOrEmail]
    );

    if (userResult.rows.length === 0) {
      console.error('User not found.');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`Found user: ${user.username} (${user.email})`);

    // Hash the new password
    console.log('Hashing new password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update the database
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );

    console.log(`✅ Password successfully reset for ${user.username}!`);
    client.release();
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await pool.end();
  }
}

resetPassword();

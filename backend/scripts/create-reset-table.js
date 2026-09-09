const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost', port: 5432,
  database: 'social_media_platform',
  user: 'postgres', password: 'shaishau'
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)');
    console.log('OK: password_reset_tokens table ready');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
run();

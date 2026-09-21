const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function seedUser() {
  const hash = await bcrypt.hash('User@123456!', 12);
  const clientConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'social_media_platform',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'shaishau'
      };

  const client = new Client(clientConfig);

  try {
    await client.connect();
    const res = await client.query("SELECT id FROM users WHERE email = 'standard@udtabirdie.com'");
    if (res.rows.length === 0) {
      await client.query(
        "INSERT INTO users (username, email, password_hash, role, bio, is_verified, email_verified_at) VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP)",
        ['standard_author', 'standard@udtabirdie.com', hash, 'user', 'Standard Platform Writer']
      );
      console.log('✅ Standard user created: standard@udtabirdie.com / User@123456!');
    } else {
      await client.query(
        "UPDATE users SET password_hash = $1, role = 'user', is_verified = true, email_verified_at = CURRENT_TIMESTAMP WHERE id = $2",
        [hash, res.rows[0].id]
      );
      console.log('✅ Standard user password and verification updated successfully!');
    }
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await client.end();
  }
}

seedUser();

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function seed() {
  const hash = await bcrypt.hash('Admin@123456!', 12);
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'social_media_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'shaishau'
  });

  try {
    await client.connect();
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false;
    `);
    const res = await client.query("SELECT id FROM users WHERE email = 'admin@udtabirdie.com'");
    if (res.rows.length === 0) {
      await client.query(
        "INSERT INTO users (username, email, password_hash, role, bio) VALUES ($1, $2, $3, $4, $5)",
        ['admin', 'admin@udtabirdie.com', hash, 'admin', 'Platform Administrator & Chief Curator']
      );
      console.log('✅ Admin user created: admin@udtabirdie.com / Admin@123456!');
    } else {
      await client.query("UPDATE users SET password_hash = $1, role = 'admin' WHERE id = $2", [hash, res.rows[0].id]);
      console.log('✅ Admin user password and role updated successfully!');
    }
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await client.end();
  }
}

seed();

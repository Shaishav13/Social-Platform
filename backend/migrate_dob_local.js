const { Client } = require('pg'); 

const client = new Client({ 
  connectionString: 'postgresql://postgres:shaishau@localhost:5432/social_media_platform'
}); 

async function migrate() {
  try {
    await client.connect();
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;');
    await client.query("UPDATE users SET date_of_birth = '2003-10-11';");
    console.log('Local Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

migrate();

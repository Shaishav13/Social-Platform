const { Client } = require('pg'); 

const client = new Client({ 
  connectionString: 'postgresql://neondb_owner:npg_zMbekWxdSh94@ep-royal-sound-ay2auxiw-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require', 
  ssl: { rejectUnauthorized: false } 
}); 

async function migrate() {
  await client.connect();
  await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;');
  await client.query("UPDATE users SET date_of_birth = '2001-01-26' WHERE username = 'sangram';");
  await client.query("UPDATE users SET date_of_birth = '2003-10-11' WHERE username = 'riya';");
  await client.query("UPDATE users SET date_of_birth = '2000-01-01' WHERE username = 'admin';");
  console.log('Migration successful!');
  await client.end();
}
migrate().catch(console.error);

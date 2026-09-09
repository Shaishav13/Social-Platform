import { spawn } from 'child_process';
import { DatabaseConnection } from '../../config/database';
import { RedisConnection } from '../../config/redis';

async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  try {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DB_NAME = process.env.TEST_DB_NAME || 'social_media_test';
    process.env.REDIS_DB = '1'; // Use different Redis DB for tests
    
    // Initialize test database
    await DatabaseConnection.initialize();
    console.log('✅ Test database connected');
    
    // Initialize test Redis
    await RedisConnection.initialize();
    console.log('✅ Test Redis connected');
    
    // Clean up any existing test data
    await cleanupTestData();
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    process.exit(1);
  }
}

async function cleanupTestData() {
  const pool = DatabaseConnection.getPool();
  
  // Clean up test data in reverse dependency order
  const cleanupQueries = [
    'DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM likes WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM comments WHERE author_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM shares WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM follows WHERE follower_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\') OR following_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM blog_posts WHERE author_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM posts WHERE author_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%@test.com\')',
    'DELETE FROM users WHERE email LIKE \'%@test.com\'',
  ];
  
  for (const query of cleanupQueries) {
    try {
      await pool.query(query);
    } catch (error) {
      // Ignore errors for non-existent tables/data
      console.log(`Cleanup query skipped: ${query}`);
    }
  }
}

async function runIntegrationTests() {
  console.log('🧪 Running integration tests...');
  
  return new Promise<void>((resolve, reject) => {
    const testProcess = spawn('npx', ['jest', '--config', 'config/jest.config.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Integration tests completed successfully');
        resolve();
      } else {
        console.error(`❌ Integration tests failed with code ${code}`);
        reject(new Error(`Tests failed with code ${code}`));
      }
    });
    
    testProcess.on('error', (error) => {
      console.error('❌ Failed to run integration tests:', error);
      reject(error);
    });
  });
}

async function teardownTestEnvironment() {
  console.log('🧹 Tearing down test environment...');
  
  try {
    await cleanupTestData();
    await DatabaseConnection.close();
    await RedisConnection.close();
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.error('❌ Failed to teardown test environment:', error);
  }
}

async function main() {
  try {
    await setupTestEnvironment();
    await runIntegrationTests();
  } catch (error) {
    console.error('❌ Integration test run failed:', error);
    process.exit(1);
  } finally {
    await teardownTestEnvironment();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  await teardownTestEnvironment();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  await teardownTestEnvironment();
  process.exit(0);
});

if (require.main === module) {
  main();
}

export { setupTestEnvironment, runIntegrationTests, teardownTestEnvironment };
require('dotenv').config();
const { DatabaseConnection } = require('../dist/config/database');
const { ContentDatabase } = require('../dist/services/content/database');
const { PostModel } = require('../dist/services/content/models');
const { ShareModel } = require('../dist/services/social/models');
const { SocialDatabase } = require('../dist/services/social/database');
const { SearchDatabase } = require('../dist/services/search/database');

async function runVerification() {
  console.log('=== Starting Repost & Mention Verification ===');
  
  // 0. Initialize Database Pool
  console.log('\n[0] Connecting to database...');
  await DatabaseConnection.initialize();
  console.log('✓ Database connected successfully');

  // 1. Initialize Tables
  console.log('\n[1] Initializing tables to ensure allow_reposts exists...');
  await ContentDatabase.initializeTables();
  await SocialDatabase.initializeTables();
  console.log('✓ Tables initialized successfully');

  // Fetch two real test users from DB
  const client = await DatabaseConnection.getClient();
  let author, reposter;
  try {
    const usersRes = await client.query('SELECT id, username FROM users WHERE is_private = false LIMIT 2');
    if (usersRes.rows.length < 2) {
      console.error('Need at least 2 active users in DB to verify. Found:', usersRes.rows.length);
      process.exit(1);
    }
    author = usersRes.rows[0];
    reposter = usersRes.rows[1];
    console.log(`✓ Using Author: ${author.username} (${author.id}) and Reposter: ${reposter.username} (${reposter.id})`);
  } finally {
    client.release();
  }

  let testPostId = null;

  try {
    // 2. Create post with allowReposts: false
    console.log('\n[2] Testing Post Creation with allowReposts: false (default)...');
    const postDisallowed = await PostModel.createPost(author.id, {
      content: 'Verification Letter: Reposting Disallowed Test #1',
      allowReposts: false,
      isPublic: true,
    });
    testPostId = postDisallowed.id;
    console.log(`✓ Post created: ${testPostId}, allowReposts = ${postDisallowed.allowReposts}`);
    if (postDisallowed.allowReposts !== false) {
      throw new Error(`Expected allowReposts to be false, got ${postDisallowed.allowReposts}`);
    }

    // 3. Attempt to share/repost when allowReposts is false -> Must fail with REPOST_NOT_ALLOWED
    console.log('\n[3] Testing Repost Block when allowReposts is false...');
    let blocked = false;
    try {
      await ShareModel.sharePost(reposter.id, testPostId);
    } catch (err) {
      if (err.message === 'REPOST_NOT_ALLOWED') {
        blocked = true;
        console.log('✓ Share blocked correctly with error: REPOST_NOT_ALLOWED');
      } else {
        throw err;
      }
    }
    if (!blocked) {
      throw new Error('Expected sharePost to throw REPOST_NOT_ALLOWED, but it succeeded!');
    }

    // 4. Edit post to toggle allowReposts: true
    console.log('\n[4] Testing Post Editing to enable allowReposts: true...');
    const updatedPost = await PostModel.updatePost(testPostId, author.id, {
      content: 'Verification Letter: Reposting Enabled by Author #1',
      allowReposts: true,
    });
    console.log(`✓ Post updated: allowReposts = ${updatedPost.allowReposts}`);
    if (updatedPost.allowReposts !== true) {
      throw new Error(`Expected allowReposts to be true, got ${updatedPost.allowReposts}`);
    }

    // 5. Repost the post now that it is allowed -> Must succeed
    console.log('\n[5] Testing Reposting now that author enabled it...');
    const shareResult = await ShareModel.sharePost(reposter.id, testPostId);
    console.log(`✓ Repost succeeded: shared = ${shareResult.shared}, shareCount = ${shareResult.shareCount}`);
    if (!shareResult.shared || shareResult.shareCount < 1) {
      throw new Error(`Expected shared: true and shareCount >= 1, got ${JSON.stringify(shareResult)}`);
    }

    // 6. Verify feed returns repost with original author and reposter details
    console.log('\n[6] Testing Feed Query with reposts...');
    const feed = await ContentDatabase.getFeedWithLikes({
      limit: 20,
      offset: 0,
      userId: reposter.id,
    });
    console.log('Feed items count:', feed.length);
    feed.slice(0, 5).forEach(f => console.log('Item:', f.id, 'author:', f.author?.username, 'repostedBy:', f.repostedBy));

    const feedItem = feed.find(p => p.id === testPostId && p.repostedBy && p.repostedBy.id === reposter.id);
    if (!feedItem) {
      throw new Error('Could not find reposted post in feed with reposter info');
    }
    console.log('✓ Feed correctly returned reposted letter:');
    console.log(`  - Original Author: @${feedItem.author?.username} (${feedItem.authorId})`);
    console.log(`  - Reposted By: @${feedItem.repostedBy?.username} (${feedItem.repostedBy?.id})`);
    console.log(`  - Original Content: "${feedItem.content}"`);
    console.log(`  - Viewer isReposted: ${feedItem.isReposted}`);

    if (feedItem.author?.username !== author.username) {
      throw new Error(`Expected author to be ${author.username}, got ${feedItem.author?.username}`);
    }
    if (feedItem.repostedBy?.username !== reposter.username) {
      throw new Error(`Expected repostedBy to be ${reposter.username}, got ${feedItem.repostedBy?.username}`);
    }
    if (feedItem.isReposted !== true) {
      throw new Error(`Expected reposter viewer isReposted to be true, got ${feedItem.isReposted}`);
    }

    // 7. Un-reposting (toggle off)
    console.log('\n[7] Testing Repost Toggle Off (Un-repost)...');
    const unshareResult = await ShareModel.sharePost(reposter.id, testPostId);
    console.log(`✓ Toggle off succeeded: shared = ${unshareResult.shared}, shareCount = ${unshareResult.shareCount}`);
    if (unshareResult.shared !== false) {
      throw new Error(`Expected shared: false on un-repost, got ${unshareResult.shared}`);
    }

    // 8. Test Mention suggestions search query
    console.log('\n[8] Testing Mention / Tag suggestions user query...');
    const prefix = author.username.substring(0, 3);
    const searchResult = await SearchDatabase.searchUsers(prefix, 1, 5);
    console.log(`✓ Search for "${prefix}" returned ${searchResult.results.length} user(s):`);
    searchResult.results.forEach(u => console.log(`  - @${u.username} (${u.id})`));
    const foundAuthor = searchResult.results.some(u => u.username === author.username);
    if (!foundAuthor) {
      throw new Error(`Expected search results to include @${author.username}`);
    }

    console.log('\n========================================');
    console.log('🎉 ALL REPOST & MENTION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('========================================');

  } finally {
    // Clean up test post
    if (testPostId) {
      console.log('\nCleaning up test post...');
      await ContentDatabase.deletePost(testPostId, author.id, true);
      console.log('✓ Cleanup done');
    }
    await DatabaseConnection.close();
  }
}

runVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});

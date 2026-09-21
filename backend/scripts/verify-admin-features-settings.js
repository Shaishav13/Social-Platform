const BASE = 'http://localhost:3003/api/v1';

async function runVerification() {
  console.log('=== Step 1: Admin Login ===');
  const adminLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@udtabirdie.com',
      password: 'Admin@123456!',
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.data?.tokens?.accessToken || adminLoginData.tokens?.accessToken;
  if (!adminToken) {
    throw new Error('Admin login failed: ' + JSON.stringify(adminLoginData));
  }
  console.log('✅ Admin login succeeded. Role:', adminLoginData.data?.user?.role || adminLoginData.user?.role);

  console.log('\n=== Step 2: Login Standard User (role = user) ===');
  const userLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'standard@udtabirdie.com',
      password: 'User@123456!',
    }),
  });
  const userLoginData = await userLoginRes.json();
  const userToken = userLoginData.data?.tokens?.accessToken || userLoginData.tokens?.accessToken;
  if (!userToken) {
    throw new Error('Standard user login failed: ' + JSON.stringify(userLoginData));
  }
  console.log('✅ Standard user logged in successfully. Role:', userLoginData.data?.user?.role);

  console.log('\n=== Step 3: Test Public Config Endpoint ===');
  const configRes = await fetch(`${BASE}/config`);
  const configData = await configRes.json();
  console.log('Config initial state:', configData);
  if (!configData.success || !configData.features || !configData.settings) {
    throw new Error('Invalid config response structure');
  }
  console.log('✅ /config endpoint working properly.');

  console.log('\n=== Step 4: Test Updating Settings ===');
  const updateSettingsRes = await fetch(`${BASE}/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      siteName: 'UdtaBirdie Herald',
      announcementBanner: 'Scheduled archival maintenance this Friday.',
      defaultDensity: 'compact',
      maxPostLength: 1500,
      rateLimitMaxRequests: 250,
    }),
  });
  const updateSettingsData = await updateSettingsRes.json();
  console.log('Settings update response:', updateSettingsData);
  if (!updateSettingsData.success || updateSettingsData.data.siteName !== 'UdtaBirdie Herald') {
    throw new Error('Settings update failed');
  }

  // Verify /config reflects new settings
  const verifySettingsConfig = await (await fetch(`${BASE}/config`)).json();
  if (verifySettingsConfig.settings.siteName !== 'UdtaBirdie Herald') {
    throw new Error('Config did not update with new siteName');
  }
  if (verifySettingsConfig.settings.announcementBanner !== 'Scheduled archival maintenance this Friday.') {
    throw new Error('Config did not update with new announcementBanner');
  }
  console.log('✅ Settings successfully updated and verified in /config.');

  console.log('\n=== Step 5: Test Feature Toggle: publicRegistration ===');
  // Disable publicRegistration
  await fetch(`${BASE}/admin/features`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ publicRegistration: false }),
  });

  // Attempt to register a new user
  const blockedRegRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'blocked_' + Date.now(),
      email: `blocked_${Date.now()}@example.com`,
      password: 'Password@123456!',
    }),
  });
  console.log('Register status when disabled:', blockedRegRes.status);
  const blockedRegBody = await blockedRegRes.json();
  console.log('Register response:', blockedRegBody);
  if (blockedRegRes.status !== 403) {
    throw new Error('Expected 403 Forbidden for registration when disabled, got ' + blockedRegRes.status);
  }
  console.log('✅ publicRegistration=false correctly blocked registration with 403.');

  console.log('\n=== Step 6: Test Feature Toggle: commenting ===');
  // Disable commenting
  await fetch(`${BASE}/admin/features`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ commenting: false }),
  });

  const commentRes = await fetch(`${BASE}/social/posts/any-post-id/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ content: 'Test comment' }),
  });
  console.log('Comment status when disabled:', commentRes.status);
  const commentBody = await commentRes.json();
  console.log('Comment response:', commentBody);
  if (commentRes.status !== 403) {
    throw new Error('Expected 403 Forbidden for comment when disabled, got ' + commentRes.status);
  }
  console.log('✅ commenting=false correctly blocked standard user with 403.');

  console.log('\n=== Step 7: Test Feature Toggle: mediaUploads ===');
  // Disable mediaUploads
  await fetch(`${BASE}/admin/features`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ mediaUploads: false }),
  });

  const uploadRes = await fetch(`${BASE}/content/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });
  console.log('Upload status when disabled:', uploadRes.status);
  const uploadBody = await uploadRes.json();
  console.log('Upload response:', uploadBody);
  if (uploadRes.status !== 403) {
    throw new Error('Expected 403 Forbidden for upload when disabled, got ' + uploadRes.status);
  }
  console.log('✅ mediaUploads=false correctly blocked uploads with 403.');

  console.log('\n=== Step 8: Test Feature Toggle: followRequests ===');
  // Disable followRequests
  await fetch(`${BASE}/admin/features`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ followRequests: false }),
  });

  const followRes = await fetch(`${BASE}/social/users/any-user-id/follow`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  });
  console.log('Follow status when disabled:', followRes.status);
  const followBody = await followRes.json();
  console.log('Follow response:', followBody);
  if (followRes.status !== 403) {
    throw new Error('Expected 403 Forbidden for follow when disabled, got ' + followRes.status);
  }
  console.log('✅ followRequests=false correctly blocked follows with 403.');

  console.log('\n=== Step 9: Restore Default Settings & Features ===');
  await fetch(`${BASE}/admin/features`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      publicRegistration: true,
      mediaUploads: true,
      commenting: true,
      followRequests: true,
      maintenanceMode: false,
      trendingFeed: true,
    }),
  });

  await fetch(`${BASE}/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      siteName: 'UdtaBirdie',
      announcementBanner: '',
      defaultDensity: 'comfortable',
      maxPostLength: 2000,
      rateLimitMaxRequests: 100,
    }),
  });

  const finalConfig = await (await fetch(`${BASE}/config`)).json();
  console.log('Final restored config:', finalConfig);
  if (finalConfig.settings.siteName !== 'UdtaBirdie' || !finalConfig.features.publicRegistration) {
    throw new Error('Failed to restore defaults');
  }

  console.log('\n🎉 ALL ADMIN FEATURES & SETTINGS VERIFICATIONS PASSED SUCCESSFULLY! 🎉');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

import { useState } from 'react';
import api from '../services/api';

const TestFollowRequests: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testFollowRequestSystem = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      addResult('🔍 Testing follow request system...');
      
      // Test 1: Get current user info
      addResult('📋 Step 1: Getting current user info...');
      const userResponse = await api.get('/profile/me');
      const currentUser = userResponse.data.data;
      addResult(`✅ Current user: ${currentUser.username} (${currentUser.isPrivate ? 'Private' : 'Public'} account)`);
      
      // Test 2: Get all users to find someone to follow
      addResult('📋 Step 2: Finding users to test with...');
      const usersResponse = await api.get('/profile/search/users?q=test&limit=5');
      const users = usersResponse.data.data || [];
      addResult(`✅ Found ${users.length} users`);
      
      if (users.length === 0) {
        addResult('❌ No users found to test with');
        return;
      }
      
      // Find a user that's not the current user
      const targetUser = users.find((u: any) => u.id !== currentUser.id);
      if (!targetUser) {
        addResult('❌ No other users found to test with');
        return;
      }
      
      addResult(`🎯 Target user: ${targetUser.username} (${targetUser.isPrivate ? 'Private' : 'Public'} account)`);
      
      // Test 3: Check current follow status
      addResult('📋 Step 3: Checking current follow status...');
      const followStatusResponse = await api.get(`/social/users/${targetUser.id}/follow`);
      const followStatus = followStatusResponse.data.data;
      addResult(`✅ Follow status: Following=${followStatus.following}, Requested=${followStatus.requested || false}`);
      
      // Test 4: Send follow request
      if (!followStatus.following && !followStatus.requested) {
        addResult('📋 Step 4: Sending follow request...');
        const followResponse = await api.post(`/social/users/${targetUser.id}/follow`);
        const followResult = followResponse.data.data;
        addResult(`✅ Follow result: Following=${followResult.following}, Requested=${followResult.requested || false}`);
        
        if (followResult.requested) {
          addResult('🎉 Follow request sent successfully! Check notifications on the target account.');
        } else if (followResult.following) {
          addResult('🎉 Direct follow successful (public account)!');
        }
      } else {
        addResult('ℹ️ Already following or request already sent');
      }
      
      // Test 5: Get pending follow requests (if current user has any)
      addResult('📋 Step 5: Checking pending follow requests...');
      const requestsResponse = await api.get('/social/follow-requests');
      const requests = requestsResponse.data.data || [];
      addResult(`✅ Found ${requests.length} pending follow requests`);
      
      if (requests.length > 0) {
        requests.forEach((req: any, index: number) => {
          addResult(`   ${index + 1}. ${req.requester?.username || 'Unknown'} wants to follow you`);
        });
      }
      
      // Test 6: Get notifications
      addResult('📋 Step 6: Checking notifications...');
      const notificationsResponse = await api.get('/notifications');
      const notifications = notificationsResponse.data.notifications || [];
      const followRequestNotifications = notifications.filter((n: any) => n.type === 'follow_request');
      addResult(`✅ Found ${followRequestNotifications.length} follow request notifications`);
      
      addResult('🎉 Test completed successfully!');
      
    } catch (error: any) {
      addResult(`❌ Error: ${error.response?.data?.message || error.message}`);
      console.error('Test error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="test-page">
      <div className="test-header">
        <h1>Follow Request System Test</h1>
        <button 
          onClick={testFollowRequestSystem}
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Testing...' : 'Run Test'}
        </button>
      </div>
      
      <div className="test-results">
        <h2>Test Results:</h2>
        <div className="results-log">
          {testResults.map((result, index) => (
            <div key={index} className="log-entry">
              {result}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestFollowRequests;
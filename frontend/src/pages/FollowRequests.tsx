import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { FollowRequest } from '../types';
import api from '../services/api';

const FollowRequests: React.FC = () => {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFollowRequests();
  }, []);

  const loadFollowRequests = async () => {
    try {
      const response = await api.get('/social/follow-requests');
      console.log('Follow requests response:', response.data);
      setRequests(response.data.data || []);
    } catch (error) {
      console.error('Failed to load follow requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      await api.post(`/social/follow-requests/${requestId}/${action}`);
      
      // Remove the request from the list
      setRequests(prev => prev.filter(req => req.id !== requestId));
      
      console.log(`Follow request ${action}ed successfully`);
    } catch (error) {
      console.error(`Failed to ${action} follow request:`, error);
    }
  };

  if (isLoading) {
    return (
      <div className="follow-requests-page">
        <div className="loading-spinner">Loading follow requests...</div>
      </div>
    );
  }

  return (
    <div className="follow-requests-page">
      <div className="page-header">
        <h1>Follow Requests</h1>
        <Link to="/notifications" className="btn btn-secondary">
          Back to Notifications
        </Link>
      </div>

      <div className="follow-requests-list">
        {requests.length > 0 ? (
          requests.map(request => (
            <div key={request.id} className="follow-request-item">
              <div className="request-user">
                {request.requester?.profilePicture ? (
                  <img 
                    src={request.requester.profilePicture} 
                    alt={request.requester.username}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar-placeholder">
                    {request.requester?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="user-info">
                  <h3>{request.requester?.username || 'Unknown User'}</h3>
                  <p>wants to follow you</p>
                  <span className="request-time">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="request-actions">
                <button
                  onClick={() => handleRequest(request.id, 'accept')}
                  className="btn btn-primary"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleRequest(request.id, 'decline')}
                  className="btn btn-secondary"
                >
                  Decline
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="no-requests">
            <div className="no-requests-icon">👋</div>
            <h3>No follow requests</h3>
            <p>When someone wants to follow you, you'll see their requests here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowRequests;
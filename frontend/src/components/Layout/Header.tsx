import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import api from '../../services/api';

// Extend Window interface for global function
declare global {
  interface Window {
    updateHeaderUnreadCount?: (count: number) => void;
  }
}

const Header: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      loadUnreadCount();
      // Poll for unread count every 30 seconds
      const interval = setInterval(loadUnreadCount, 30000);
      
      // Set up global function for other components to update count
      window.updateHeaderUnreadCount = (count: number) => {
        setUnreadCount(count);
      };
      
      return () => {
        clearInterval(interval);
        delete window.updateHeaderUnreadCount;
      };
    }
  }, [isAuthenticated]);

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-icon">🐦</span>
        </Link>

        {/* Search Bar - only show when authenticated */}
        {/* Moved to Explore page for better UX */}

        <nav className="nav">
          {isAuthenticated ? (
            <>
              <Link to="/feed" className="nav-link">Feed</Link>
              <Link to="/explore" className="nav-link">Explore</Link>
              <Link to="/create-post" className="nav-link create-post-nav">
                <span className="create-icon">✏️</span>
                Create
              </Link>
              <Link to="/blogs" className="nav-link">Blogs</Link>
              <Link to="/notifications" className="nav-link notifications-link">
                Notifications
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </Link>
              
              <div className="user-menu">
                <Link to={`/profile/${user?.id}`} className="profile-link">
                  {user?.profilePicture ? (
                    <img 
                      src={user.profilePicture} 
                      alt={user.username}
                      className="profile-avatar"
                    />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{user?.username}</span>
                </Link>
                <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
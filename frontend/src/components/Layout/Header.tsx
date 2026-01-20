import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SearchBar from '../Search/SearchBar';

const Header: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

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
              <Link to="/notifications" className="nav-link">Notifications</Link>
              
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
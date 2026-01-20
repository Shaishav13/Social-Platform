import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <div className="welcome-section">
        <div className="welcome-hero">
          <div className="welcome-icon">🐦</div>
          <h1>Welcome back to UdtaBirdie</h1>
          <p>Share moments, connect with friends, and discover amazing content.</p>
          <div className="quick-actions">
            <Link to="/feed" className="btn btn-primary">
              View Feed
            </Link>
            <Link to="/create-post" className="btn btn-secondary">
              Create Post
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-icon">🐦</div>
          <h1>Welcome to UdtaBirdie</h1>
          <p className="hero-subtitle">
            Connect with friends and the world around you on UdtaBirdie.
          </p>
          <div className="cta-buttons">
            <Link to="/register" className="btn btn-primary btn-lg">
              Sign Up
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              Log In
            </Link>
          </div>
        </div>
      </div>
      
      <div className="features-section">
        <div className="features-header">
          <h2>Connect and Share</h2>
          <p>See photos and updates from friends in your feed.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📸</div>
            <h3>Share Photos</h3>
            <p>Upload and share your favorite moments with friends and followers.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Connect</h3>
            <p>Follow friends and discover new people with similar interests.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Engage</h3>
            <p>Like, comment, and share posts to stay connected with your community.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Discover</h3>
            <p>Explore trending content and find new accounts to follow.</p>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <div className="cta-content">
          <h2>Ready to get started?</h2>
          <p>Join millions of people sharing their stories on UdtaBirdie.</p>
          <Link to="/register" className="btn btn-primary btn-lg">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
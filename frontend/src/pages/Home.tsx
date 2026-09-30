import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/landing.css';

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const decorativeElements = (
    <>
      <div className="floating-element" style={{ width: 120, height: 160, top: '10%', left: '-5%', animationDuration: '20s' }}></div>
      <div className="floating-element" style={{ width: 80, height: 80, bottom: '20%', right: '5%', animationDuration: '15s', animationDelay: '2s' }}></div>
      <div className="floating-element" style={{ width: 150, height: 100, top: '40%', right: '-8%', animationDuration: '25s', animationDelay: '1s' }}></div>
    </>
  );

  if (isAuthenticated) {
    return (
      <div className="landing-container">
        {decorativeElements}
        <div className="landing-content">
          <h1 className="landing-title">
            Welcome Back to UdtaBirdie
          </h1>
          <p className="landing-subtitle">
            A social platform for people who write, not just post. Treat every thought like correspondence.
          </p>

          <div className="landing-buttons">
            <Link to="/feed" className="landing-btn landing-btn-primary">
              Open Feed
            </Link>
            <Link to="/create-post" className="landing-btn landing-btn-secondary">
              Write a Letter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-container">
      {decorativeElements}
      <div className="landing-content">
        <h1 className="landing-title">
          UdtaBirdie
        </h1>
        <p className="landing-subtitle">
          A platform for people who write, not just post. Letters, thoughts, and conversations treated like print on paper.
        </p>

        <div className="landing-buttons">
          <Link to="/register" className="landing-btn landing-btn-primary">
            Join the Correspondence
          </Link>
          <Link to="/login" className="landing-btn landing-btn-secondary">
            Sign In
          </Link>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <h2 className="feature-title">Written with Intent</h2>
          <p className="feature-desc">
            No endless feeds of noise. Thoughtful prose, essays, and notes read at a measured pace.
          </p>
        </div>

        <div className="feature-card">
          <h2 className="feature-title">Ink & Vellum Aesthetic</h2>
          <p className="feature-desc">
            Texture and hierarchy derived from typography, whitespace, and physical press states.
          </p>
        </div>

        <div className="feature-card">
          <h2 className="feature-title">Meaningful Dialogue</h2>
          <p className="feature-desc">
            Replies treated as margin notes and letters in a shared thread.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
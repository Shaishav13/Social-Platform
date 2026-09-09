import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <div style={{ padding: '40px 0' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 className="type-display-l" style={{ marginBottom: '12px' }}>
            Welcome to UdtaBirdie
          </h1>
          <p className="type-body-serif" style={{ color: 'var(--ink-600)', marginBottom: '24px' }}>
            A social platform for people who write, not just post. Treat every thought like correspondence.
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/feed" className="wren-btn wren-btn-primary">
              Open Feed
            </Link>
            <Link to="/create-post" className="wren-btn wren-btn-secondary">
              Write a Letter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 0' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 className="type-display-l" style={{ marginBottom: '14px' }}>
          UdtaBirdie
        </h1>
        <p className="type-body-serif" style={{ color: 'var(--ink-600)', marginBottom: '28px' }}>
          A platform for people who write, not just post. Letters, thoughts, and conversations treated like print on paper.
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/register" className="wren-btn wren-btn-primary">
            Join the Correspondence
          </Link>
          <Link to="/login" className="wren-btn wren-btn-secondary">
            Sign In
          </Link>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <div className="type-display-m" style={{ marginBottom: '20px', fontSize: '20px' }}>
          Guiding Principles
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ paddingBottom: '16px', borderBottom: '1px dashed var(--border)' }}>
            <h2 className="type-ui-l" style={{ marginBottom: '4px' }}>Written with Intent</h2>
            <p className="type-ui-m">
              No endless feeds of noise. Thoughtful prose, essays, and notes read at a measured pace.
            </p>
          </div>

          <div style={{ paddingBottom: '16px', borderBottom: '1px dashed var(--border)' }}>
            <h2 className="type-ui-l" style={{ marginBottom: '4px' }}>Ink & Vellum Aesthetic</h2>
            <p className="type-ui-m">
              Texture and hierarchy derived from typography, whitespace, and physical press states.
            </p>
          </div>

          <div>
            <h2 className="type-ui-l" style={{ marginBottom: '4px' }}>Meaningful Dialogue</h2>
            <p className="type-ui-m">
              Replies treated as margin notes and letters in a shared thread.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
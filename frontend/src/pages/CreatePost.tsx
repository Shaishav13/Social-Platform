import { useNavigate } from 'react-router-dom';
import { ComposeLetter } from '../components/wren';

const CreatePostPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePostCreated = () => {
    navigate('/feed');
  };

  return (
    <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h1 className="type-display-l" style={{ margin: 0 }}>Compose</h1>
        <button
          onClick={() => navigate(-1)}
          className="wren-btn wren-btn-ghost"
          style={{ padding: '8px 16px', fontSize: '14px', color: 'var(--ink-600)' }}
          title="Cancel"
        >
          Cancel
        </button>
      </div>

      <div className="wren-card" style={{ padding: '0', overflow: 'hidden' }}>
        <ComposeLetter
          onPostCreated={handlePostCreated}
          placeholder="Write your letter, essay, or thoughts here. Take your time..."
          isStandalone={true}
        />
      </div>
    </div>
  );
};

export default CreatePostPage;
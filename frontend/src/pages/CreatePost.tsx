import { useNavigate } from 'react-router-dom';
import { ComposeLetter } from '../components/wren';

const CreatePostPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePostCreated = () => {
    navigate('/feed');
  };

  return (
    <div className="wren-compose-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(-1)}
          className="wren-btn wren-btn-secondary"
          style={{ padding: '6px 12px', minHeight: '34px', fontSize: '13px' }}
          title="Go back"
        >
          ← Back
        </button>
        <h1 className="type-display-m">New Letter</h1>
      </div>

      <ComposeLetter
        onPostCreated={handlePostCreated}
        placeholder="Write a letter to your readers. Take your time..."
      />
    </div>
  );
};

export default CreatePostPage;
import { useNavigate } from 'react-router-dom';
import CreatePost from '../components/PostCreation/CreatePost';

const CreatePostPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePostCreated = () => {
    // Navigate to feed after successful post creation
    navigate('/feed');
  };

  return (
    <div className="create-post-page">
      <div className="create-post-page-container">
        <div className="page-header">
          <button 
            onClick={() => navigate(-1)} 
            className="back-btn"
            title="Go back"
          >
            ← Back
          </button>
          <h1>Create Post</h1>
          <div></div> {/* Spacer for flexbox */}
        </div>
        
        <div className="create-post-wrapper">
          <CreatePost onPostCreated={handlePostCreated} />
        </div>
      </div>
    </div>
  );
};

export default CreatePostPage;
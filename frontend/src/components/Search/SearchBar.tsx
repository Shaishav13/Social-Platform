import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = "Search posts, users, and blogs...",
  className = "",
  value: controlledValue,
  onChange: controlledOnChange
}) => {
  const [internalQuery, setInternalQuery] = useState('');
  const navigate = useNavigate();

  // Use controlled value if provided, otherwise use internal state
  const query = controlledValue !== undefined ? controlledValue : internalQuery;
  const setQuery = controlledOnChange || setInternalQuery;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    if (onSearch) {
      onSearch(query.trim());
    } else {
      // Navigate to search results page
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
  };

  return (
    <form onSubmit={handleSubmit} className={`search-bar ${className}`}>
      <div className="search-input-container">
        <div className="search-icon">🔍</div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="search-input"
          autoComplete="off"
        />
        {query.trim() && (
          <button 
            type="button"
            onClick={() => setQuery('')}
            className="search-clear"
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchBar;
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui';

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
    <form onSubmit={handleSubmit} className={`search-bar ${className}`} style={{ width: '100%', marginBottom: '24px' }}>
      <div className="search-input-container" style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--paper-100)', border: '1px solid var(--border)', borderRadius: '24px', padding: '8px 16px', transition: 'border-color 0.2s, box-shadow 0.2s', position: 'relative' }}>
        <div className="search-icon" style={{ opacity: 0.6, display: 'flex', alignItems: 'center', marginRight: '8px', color: 'var(--ink)' }}>
          <Icon name="search" size={16} />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="search-input"
          autoComplete="off"
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', color: 'var(--ink)' }}
        />
        {query.trim() && (
          <button 
            type="button"
            onClick={() => setQuery('')}
            className="search-clear"
            title="Clear search"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6, padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchBar;
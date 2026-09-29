import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { socketService, ChatEvent } from '../services/socket';
import api from '../services/api';
import SearchBar from '../components/Search/SearchBar';
import '../styles/wren.css';
import '../styles/messages.css';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  other_user_id: string;
  other_username: string;
  other_profile_picture: string;
  last_message: string | null;
  updated_at: string;
  is_request: boolean;
}

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const DoubleCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 6 7 17 2 12"></polyline>
    <polyline points="22 10 11 21 7 17"></polyline>
  </svg>
);

const Messages: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'primary' | 'requests'>('primary');
  const [sendError, setSendError] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const initialConvId = searchParams.get('convId');

  const activeConversationRef = useRef(activeConversation);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    socketService.connect();
    loadConversations();

    const handleReceiveMessage = (msg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        
        const currentActive = activeConversationRef.current;
        // Only append if it belongs to current active chat, or if it's our own confirmation
        if (currentActive && msg.sender_id !== user?.id) {
           // send read receipt
           socketService.send(ChatEvent.READ_RECEIPT, {
             messageId: msg.id,
             conversationId: currentActive.id,
             receiverId: msg.sender_id
           });
        }
        return [...prev, msg];
      });
      loadConversations(); // refresh last message
    };

    const handleTyping = (data: any) => {
      const currentActive = activeConversationRef.current;
      if (currentActive && data.conversationId === currentActive.id && data.userId !== user?.id) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
      }
    };

    const handleReadReceipt = (data: any) => {
      setMessages(prev => prev.map(m => 
        m.id === data.messageId ? { ...m, read_at: new Date().toISOString() } : m
      ));
    };

    const handleError = (data: any) => {
      setSendError(data.message);
      setTimeout(() => setSendError(null), 5000);
    };

    socketService.on(ChatEvent.RECEIVE_MESSAGE, handleReceiveMessage);
    socketService.on(ChatEvent.TYPING, handleTyping);
    socketService.on(ChatEvent.READ_RECEIPT, handleReadReceipt);
    socketService.on(ChatEvent.ERROR, handleError);

    return () => {
      socketService.off(ChatEvent.RECEIVE_MESSAGE, handleReceiveMessage);
      socketService.off(ChatEvent.TYPING, handleTyping);
      socketService.off(ChatEvent.READ_RECEIPT, handleReadReceipt);
      socketService.off(ChatEvent.ERROR, handleError);
      socketService.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id);
      setIsTyping(false);
    }
  }, [activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        try {
          const res = await api.get(`/profile/search/users?q=${encodeURIComponent(searchQuery.trim())}`);
          setSearchResults(res.data.data || []);
        } catch (error) {
          console.error('Failed to search users:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
      
      // If we have an initialConvId from URL, select it
      if (initialConvId) {
        const conv = res.data.find((c: Conversation) => c.id === initialConvId);
        if (conv && activeConversationRef.current?.id !== conv.id) {
          setActiveConversation(conv);
          setActiveTab(conv.is_request ? 'requests' : 'primary');
        }
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (activeConversation) {
      socketService.send(ChatEvent.TYPING, {
        conversationId: activeConversation.id,
        receiverId: activeConversation.other_user_id
      });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeConversation) return;

    socketService.send(ChatEvent.SEND_MESSAGE, {
      conversationId: activeConversation.id,
      content: inputValue,
      receiverId: activeConversation.other_user_id
    });
    setInputValue('');
  };

  const handleSearchResultClick = async (targetUser: any) => {
    try {
      const response = await api.post('/chat/conversations', { targetUserId: targetUser.id });
      const convId = response.data.id;
      
      const convRes = await api.get('/chat/conversations');
      setConversations(convRes.data);
      
      const newConv = convRes.data.find((c: Conversation) => c.id === convId);
      if (newConv) {
        setActiveConversation(newConv);
        setActiveTab(newConv.is_request ? 'requests' : 'primary');
      }
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert('Failed to start conversation');
    }
  };

  const primaryConversations = conversations.filter(c => !c.is_request);
  const requestConversations = conversations.filter(c => c.is_request);
  const displayConversations = activeTab === 'primary' ? primaryConversations : requestConversations;

  return (
    <div className="wren-messages-layout">
      {/* Sidebar */}
      <div className={`wren-messages-sidebar ${activeConversation ? 'mobile-hidden' : ''}`}>
        <div className="wren-messages-header">
          Messages
        </div>

        <div className="wren-messages-search" style={{ padding: '0 20px', margin: '16px 0 8px 0' }}>
          <SearchBar 
            placeholder="Search users to chat..." 
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        <div className="wren-messages-tabs">
          <div 
            className={`wren-messages-tab ${activeTab === 'primary' ? 'active' : ''}`}
            onClick={() => setActiveTab('primary')}
          >
            Primary
          </div>
          <div 
            className={`wren-messages-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests {requestConversations.length > 0 && `(${requestConversations.length})`}
          </div>
        </div>
        
        <div className="wren-conversation-list">
          {searchQuery.trim().length > 0 ? (
            isSearching ? (
              <div className="wren-chat-empty">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="wren-chat-empty">No users found.</div>
            ) : (
              searchResults.map(u => (
                <div 
                  key={u.id} 
                  onClick={() => handleSearchResultClick(u)}
                  className="wren-conversation-item"
                >
                  <div className="wren-avatar">
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt="" />
                    ) : (
                      <span>{u.username.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="wren-conversation-info">
                    <div className="wren-conversation-name">
                      {u.username}
                    </div>
                    <p className="wren-conversation-last-message">Start a conversation</p>
                  </div>
                </div>
              ))
            )
          ) : displayConversations.length === 0 ? (
            <div className="wren-chat-empty">No conversations here.</div>
          ) : (
            displayConversations.map(conv => (
              <div 
                key={conv.id} 
                onClick={() => setActiveConversation(conv)}
                className={`wren-conversation-item ${activeConversation?.id === conv.id ? 'active' : ''}`}
              >
                <div className="wren-avatar">
                  {conv.other_profile_picture ? (
                    <img src={conv.other_profile_picture} alt="" />
                  ) : (
                    <span>{conv.other_username.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="wren-conversation-info">
                  <div className="wren-conversation-name">
                    {conv.other_username}
                    <span className="wren-conversation-date">
                      {new Date(conv.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="wren-conversation-last-message">{conv.last_message || 'Start chatting'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`wren-chat-area ${!activeConversation ? 'mobile-hidden' : ''}`}>
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="wren-chat-header">
              <button 
                className="wren-chat-back-btn" 
                onClick={() => setActiveConversation(null)}
                aria-label="Back to conversations"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <div className="wren-avatar">
                {activeConversation.other_profile_picture ? (
                  <img src={activeConversation.other_profile_picture} alt="" />
                ) : (
                  <span>{activeConversation.other_username.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="wren-chat-header-info">
                <div className="wren-conversation-name" style={{ fontSize: '1.1rem' }}>{activeConversation.other_username}</div>
                {isTyping && <span className="wren-chat-typing">Typing...</span>}
              </div>
            </div>

            {/* Messages */}
            <div className="wren-chat-messages">
              {messages.map((msg, idx) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div key={msg.id || idx} className={`wren-message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
                    <div className="wren-message-bubble">
                      <p>{msg.content}</p>
                      <div className="wren-message-meta">
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && (
                          <span>
                            {msg.read_at ? <DoubleCheckIcon /> : <CheckIcon />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="wren-chat-input-area">
              {sendError && (
                <div style={{ color: 'var(--rust-alert)', marginBottom: '8px', fontSize: '0.85rem' }}>
                  {sendError}
                </div>
              )}
              <form onSubmit={handleSendMessage} className="wren-chat-form">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  className="wren-chat-input"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="wren-chat-send-btn"
                >
                  <SendIcon />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="wren-chat-empty">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, LoginCredentials, RegisterData, VerifyEmailCredentials, RegisterResult } from '../types';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<RegisterResult>;
  verifyEmail: (credentials: VerifyEmailCredentials) => Promise<void>;
  resendVerificationOtp: (email: string) => Promise<string>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {}
  },
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check for existing token on mount
  useEffect(() => {
    const token = safeStorage.getItem('authToken');
    if (token) {
      // Verify token and get user data
      api.get('/auth/me')
        .then(response => {
          setUser(response.data.data);
        })
        .catch(() => {
          // Token is invalid, clear it
          safeStorage.removeItem('authToken');
          safeStorage.removeItem('refreshToken');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { user, tokens } = response.data.data;
      
      safeStorage.setItem('authToken', tokens.accessToken);
      safeStorage.setItem('refreshToken', tokens.refreshToken);
      setUser(user);
    } catch (error) {
      throw error;
    }
  };

  const register = async (data: RegisterData): Promise<RegisterResult> => {
    try {
      // Remove confirmPassword before sending to backend
      const { confirmPassword, ...registerData } = data;
      const response = await api.post('/auth/register', registerData);
      
      if (response.data.requiresVerification) {
        return {
          requiresVerification: true,
          email: response.data.data?.email || registerData.email,
          username: response.data.data?.username || registerData.username,
        };
      }

      if (response.data.data?.tokens) {
        const { user, tokens } = response.data.data;
        safeStorage.setItem('authToken', tokens.accessToken);
        safeStorage.setItem('refreshToken', tokens.refreshToken);
        setUser(user);
      }

      return {
        requiresVerification: false,
        email: registerData.email,
      };
    } catch (error) {
      throw error;
    }
  };

  const verifyEmail = async (credentials: VerifyEmailCredentials): Promise<void> => {
    try {
      const response = await api.post('/auth/verify-email', credentials);
      if (response.data.data?.tokens) {
        const { user, tokens } = response.data.data;
        safeStorage.setItem('authToken', tokens.accessToken);
        safeStorage.setItem('refreshToken', tokens.refreshToken);
        setUser(user);
      }
    } catch (error) {
      throw error;
    }
  };

  const resendVerificationOtp = async (email: string): Promise<string> => {
    try {
      const response = await api.post('/auth/resend-verification-otp', { email });
      return response.data.message || 'Verification code dispatched';
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    const refreshToken = safeStorage.getItem('refreshToken');
    
    safeStorage.removeItem('authToken');
    safeStorage.removeItem('refreshToken');
    setUser(null);
    
    // Call logout endpoint to invalidate server-side session
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {
        // Ignore errors on logout
      });
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    verifyEmail,
    resendVerificationOtp,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
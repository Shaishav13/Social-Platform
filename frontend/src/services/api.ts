import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      const isAuthPath = ['/login', '/register', '/forgot-password', '/reset-password'].some(path =>
        window.location.pathname.startsWith(path)
      );
      if (!isAuthPath) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
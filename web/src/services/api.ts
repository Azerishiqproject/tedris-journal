import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500/api';


// Check token format validity
const isValidToken = (token: string): boolean => {
  // Basic check: JWT tokens are typically in format: xxx.yyy.zzz
  const isValidFormat = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*$/.test(token);
  
  if (!isValidFormat) {
    console.error('Invalid token format detected');
    return false;
  }
  
  // Check token expiration
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000; // Convert to milliseconds
    
    if (expiry < Date.now()) {
      console.warn('Token has expired, expiry:', new Date(expiry).toISOString());
      return false;
    }
  } catch (e) {
    console.error('Error parsing token payload:', e);
    return false;
  }
  
  return true;
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define queue item type
interface QueueItem {
  resolve: (value: string | null) => void;
  reject: (reason?: unknown) => void;
}

// State variables for token refresh handling
let isRefreshing = false;
let failedQueue: QueueItem[] = [];

// Process the queue of failed requests
const processQueue = (error: unknown | null, token: string | null = null): void => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor for adding the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    if (token) {
      // Validate token before using
      if (isValidToken(token)) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn('Invalid or expired token detected, clearing token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // We'll let the request proceed without a token
        // The response interceptor will handle unauthorized responses
      }
    }
    
    return config;
  },
  (error) => {
    console.error('API Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized errors (token expired or invalid)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      
      // Check if we're already refreshing to prevent multiple refresh attempts
      if (isRefreshing) {
        // Queue this request to be retried after token refresh
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // Try to refresh the token (if your API supports this)
        // const refreshResponse = await api.post('/auth/refresh');
        // const newToken = refreshResponse.data.token;
        
        // For now, we'll just clear the token and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login page if we're in the browser
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        // Process failed queue with error
        processQueue(error);
        
        return Promise.reject(error);
      } catch (refreshError) {
        // If token refresh fails, clear tokens and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        // Process failed queue with error
        processQueue(refreshError);
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 
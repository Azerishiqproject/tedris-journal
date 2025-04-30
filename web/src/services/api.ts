import axios from 'axios';

const baseURL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500/api') 
  : (process.env.API_URL || 'http://localhost:3500/api');

// Create axios instance with base URL
const api = axios.create({
  baseURL,
  timeout: 15000, // 15 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Keep track of token refresh process to prevent multiple refresh attempts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Function to subscribe to token refresh
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// Function to notify subscribers with new token
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

// Add request interceptor to set authorization header
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage when in browser
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common error cases or refresh token
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Special handling for the leaves check endpoint to prevent blocking workflows
    if (error.config.url?.includes('/leaves/check') && (error.response?.status === 500 || error.response?.status === 404)) {
      console.warn('Leave check API error handled gracefully:', error.message);
      // Return a mock success response to prevent breaking the workflow
      return Promise.resolve({
        data: {
          hasLeave: false,
          message: 'Leave check unavailable'
        }
      });
    }
    
    // Handle token refresh on 401 (only if not already retrying)
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise(resolve => {
          subscribeTokenRefresh(token => {
            // Replace the expired token and retry
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axios(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // Get refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          // No refresh token, redirect to login
          console.error('No refresh token available');
          throw new Error('No refresh token');
        }
        
        // Attempt to refresh the token
        const response = await axios.post(`${baseURL}/auth/refresh-token`, {
          refreshToken,
        });
        
        // If successful, update localStorage and retry original request
        if (response.data.token) {
          // Store new tokens
          localStorage.setItem('token', response.data.token);
          
          if (response.data.refreshToken) {
            localStorage.setItem('refreshToken', response.data.refreshToken);
          }
          
          // Update user data if it was returned
          if (response.data.user) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
          
          // Update Authorization header for the original request
          originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
          
          // Notify subscribers about the new token
          onTokenRefreshed(response.data.token);
          isRefreshing = false;
          
          // Resume the original request
          return api(originalRequest);
        } else {
          throw new Error('Token refresh response did not contain a token');
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Clear tokens and redirect to login on refresh failure
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        isRefreshing = false;
        refreshSubscribers = [];
        
        if (typeof window !== 'undefined') {
          window.location.href = '/login?session=expired';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    // Special handling for 500 errors (server errors)
    if (error.response?.status === 500) {
      console.error('Server error encountered:', error.message);
      
      // Retry server errors once before giving up
      if (!originalRequest._serverRetry && !error.config.url?.includes('/leaves/check')) {
        originalRequest._serverRetry = true;
        console.log('Retrying 500 error request...');
        
        // Add a small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          return await api(originalRequest);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Function to check token validity periodically
export const setupTokenRefreshInterval = () => {
  if (typeof window !== 'undefined') {
    // Check and refresh token every 30 minutes
    const interval = setInterval(async () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!token || !refreshToken) {
        clearInterval(interval);
        return;
      }
      
      try {
        // Try to decode token to check expiration
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        
        // If token is about to expire (less than 5 minutes left), refresh it
        if (expirationTime - currentTime < 5 * 60 * 1000) {
          console.log('Token is about to expire, refreshing...');
          const response = await axios.post(`${baseURL}/auth/refresh-token`, {
            refreshToken,
          });
          
          if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.refreshToken) {
              localStorage.setItem('refreshToken', response.data.refreshToken);
            }
            console.log('Token refreshed successfully');
          }
        }
      } catch (error) {
        console.error('Token refresh interval error:', error);
        
        // If there's an error decoding the token, don't clear it as it might still be valid
        // We'll let the interceptor handle token expiration when it actually happens
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    // Return the interval so it can be cleared if needed
    return interval;
  }
  
  return null;
};

export default api; 
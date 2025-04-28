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
      originalRequest._retry = true;
      
      try {
        // Get refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (refreshToken) {
          // Attempt to refresh the token
          const response = await axios.post(`${baseURL}/auth/refresh-token`, {
            refreshToken,
          });
          
          // If successful, update localStorage and retry original request
          if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.refreshToken) {
              localStorage.setItem('refreshToken', response.data.refreshToken);
            }
            
            // Update Authorization header and retry
            originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // Clear tokens and redirect to login on refresh failure
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
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

export default api; 
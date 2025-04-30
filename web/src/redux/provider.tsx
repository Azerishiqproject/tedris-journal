'use client';

import { Provider } from 'react-redux';
import { store } from './store';
import { ReactNode, useEffect } from 'react';
import { setCredentials } from './slices/authSlice';
import { usePathname, useRouter } from 'next/navigation';
import api, { setupTokenRefreshInterval } from '@/services/api';
import { User } from '@/redux/types';

export function ReduxProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Check localStorage for existing token and restore session
  useEffect(() => {
    let tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;
    
    try {
      // Get token and user from localStorage
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const userStr = localStorage.getItem('user');
      
      // If token exists, restore the session
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          
          // Validate token by decoding it
          const isTokenValid = validateToken(token);
          
          if (isTokenValid) {
            // Dispatch action to set credentials in Redux state
            store.dispatch(setCredentials({ user, token }));
            
            // Start the token refresh mechanism
            tokenRefreshInterval = setupTokenRefreshInterval();
            
            // Redirect to appropriate dashboard if on login page
            if (pathname === '/login') {
              setTimeout(() => {
                if (user.role === 'admin') {
                  router.push('/admin/dashboard');
                } else if (user.role === 'teacher') {
                  router.push('/teacher/dashboard');
                }
              }, 0);
            }
          } else if (refreshToken) {
            // Token is invalid but we have a refresh token
            console.log('Token is invalid, attempting to refresh...');
            refreshTokenAndRestoreSession(refreshToken, user);
          } else {
            // Token is invalid and no refresh token
            handleInvalidSession();
          }
        } catch (e) {
          console.error('Failed to parse user data from localStorage:', e);
          // Clear invalid data
          handleInvalidSession();
        }
      } else {
        // If not authenticated and not on login page, redirect to login
        if (pathname !== '/login' && !pathname.startsWith('/api/')) {
          router.push('/login');
        }
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      handleInvalidSession();
    }
    
    // Cleanup function
    return () => {
      if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
      }
    };
  }, [pathname, router]);
  
  // Function to validate token by decoding it
  const validateToken = (token: string): boolean => {
    try {
      // Decode the JWT token to get the payload
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Check if token is expired
      const currentTime = Date.now() / 1000;
      if (payload.exp && payload.exp < currentTime) {
        console.log('Token has expired');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  };
  
  // Function to handle refreshing token and restoring session
  const refreshTokenAndRestoreSession = async (refreshToken: string, user: User) => {
    try {
      // Try to refresh the token
      const response = await api.post('/auth/refresh-token', { refreshToken });
      
      if (response.data.token) {
        // Store new tokens
        localStorage.setItem('token', response.data.token);
        
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        
        // Update user data if it was returned, otherwise use existing
        const userData: User = response.data.user || user;
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Update Redux state
        store.dispatch(setCredentials({ user: userData, token: response.data.token }));
        
        console.log('Session restored with refreshed token');
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      handleInvalidSession();
    }
  };
  
  // Function to handle invalid session
  const handleInvalidSession = () => {
    // Clear all auth data
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Redirect to login if not already there
    if (pathname !== '/login') {
      router.push('/login');
    }
  };
  
  return <Provider store={store}>{children}</Provider>;
} 
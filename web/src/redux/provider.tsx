'use client';

import { Provider } from 'react-redux';
import { store } from './store';
import { ReactNode, useEffect } from 'react';
import { setCredentials } from './slices/authSlice';
import { usePathname, useRouter } from 'next/navigation';

export function ReduxProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Check localStorage for existing token and restore session
  useEffect(() => {
    
    try {
      // Get token and user from localStorage
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      // If token exists, restore the session
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          
          // Dispatch action to set credentials in Redux state
          store.dispatch(setCredentials({ user, token }));
          
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
        } catch (e) {
          console.error('Failed to parse user data from localStorage:', e);
          // Clear invalid data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } else {
        
        // If not authenticated and not on login page, redirect to login
        if (pathname !== '/login' && !pathname.startsWith('/api/')) {
          router.push('/login');
        }
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    }
  }, [pathname, router]);
  
  return <Provider store={store}>{children}</Provider>;
} 
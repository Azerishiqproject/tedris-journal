'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { setCredentials } from '@/redux/slices/authSlice';
import api from '@/services/api';

// API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500/api';

export default function Login() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('API URL:', API_URL);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Attempting login with API for:', email);
      
      // Use the configured API client instead of fetch
      const response = await api.post('/auth/login', { email, password });
      
      // API client automatically parses JSON
      const data = response.data;
      
      // Extract user data and token
      const { user, token } = data;
      
      if (!user || !token) {
        throw new Error('Invalid response from server');
      }
      
      console.log('Login successful, user:', user.role);
      
      // Update Redux store
      dispatch(setCredentials({ user, token }));
      
      // Store in localStorage for persistence
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      
      // Redirect based on role
      if (user.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/teacher/dashboard');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const error = err as Error;
      setError(error.message || 'Giriş sırasında bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Tedris Jurnal</h1>
          <p className="text-gray-600 mt-2">Tədris jurnal sisteminə xoş gəldiniz</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md mb-6 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-poçt ünvanı
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-black"
                placeholder="Mail adresinizi daxil edin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Parol
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-black"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          
          
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Giriş Yapılıyor...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={20} />
                  Giriş Ele
                </span>
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Giriş edərkən <a href="#" className="text-blue-600 hover:underline">İstifadə Şərtləri</a> və 
            <a href="#" className="text-blue-600 hover:underline"> Gizlilik Politikası</a>&apos;nı qəbul etmiş olursunuz.
          </p>
        </div>
      </div>
    </div>
  );
} 
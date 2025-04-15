import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import { User, AuthState, LoginCredentials } from '../types';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
}

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null
};

// Login thunk
export const login = createAsyncThunk<
  { user: User; token: string },
  LoginCredentials,
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Giriş başarısız');
  }
});

// Check auth status
export const checkAuthStatus = createAsyncThunk<
  { user: User; token: string },
  void,
  { rejectValue: string }
>('auth/checkStatus', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Oturum doğrulanamadı');
  }
});

// Logout thunk
export const logout = createAsyncThunk<
  { message: string },
  void,
  { rejectValue: string }
>('auth/logout', async (_, { rejectWithValue }) => {
  try {
    // Clear localStorage items regardless of API response
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      console.log('Cleared localStorage token and user data during logout');
    }
    
    // Call the API to inform the server
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (error: unknown) {
    // Even if the API fails, we still want to clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      console.log('Cleared localStorage despite API error during logout');
    }
    
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Çıxış ederkən xəta baş verdi');
  }
});

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthError: (state) => {
      state.error = null;
    },
    setCredentials: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Check auth status
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      
      // Logout
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetAuthError, setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer; 
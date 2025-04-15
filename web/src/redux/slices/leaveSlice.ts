import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import {
  Leave,
  LeaveState,
  CreateLeaveRequest,
  UpdateLeaveRequest
} from '../types';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
}

// Initial state
const initialState: LeaveState = {
  leaves: [],
  isLoading: false,
  error: null,
  currentLeave: null
};

// Async thunks
export const fetchLeaves = createAsyncThunk<
  { leaves: Leave[] },
  void,
  { rejectValue: string }
>('leaves/fetchLeaves', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/leaves');
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Mezuniyet kayıtları yüklenirken bir hata oluştu');
  }
});

export const fetchLeaveById = createAsyncThunk<
  { leave: Leave },
  string,
  { rejectValue: string }
>('leaves/fetchLeaveById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/leaves/${id}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Mezuniyet kaydı detayları yüklenirken bir hata oluştu');
  }
});

export const createLeave = createAsyncThunk<
  { leave: Leave },
  CreateLeaveRequest,
  { rejectValue: string }
>('leaves/createLeave', async (leaveData, { rejectWithValue }) => {
  try {
    // Format dates as ISO strings for API
    const formattedData = {
      ...leaveData,
      startDate: leaveData.startDate.toISOString(),
      endDate: leaveData.endDate.toISOString()
    };
    
    const response = await api.post('/leaves', formattedData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Mezuniyet kaydı oluşturulurken bir hata oluştu');
  }
});

export const updateLeave = createAsyncThunk<
  { leave: Leave },
  UpdateLeaveRequest,
  { rejectValue: string }
>('leaves/updateLeave', async ({ id, leaveData }, { rejectWithValue }) => {
  try {
    // Format dates as ISO strings for API
    const formattedData = {
      ...leaveData,
      startDate: leaveData.startDate.toISOString(),
      endDate: leaveData.endDate.toISOString()
    };
    
    const response = await api.put(`/leaves/${id}`, formattedData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Mezuniyet kaydı güncellenirken bir hata oluştu');
  }
});

export const deleteLeave = createAsyncThunk<
  { message: string; id: string },
  string,
  { rejectValue: string }
>('leaves/deleteLeave', async (id, { rejectWithValue }) => {
  try {
    const response = await api.delete(`/leaves/${id}`);
    return { ...response.data, id };
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Mezuniyet kaydı silinirken bir hata oluştu');
  }
});

// Slice
const leaveSlice = createSlice({
  name: 'leaves',
  initialState,
  reducers: {
    resetLeaveError: (state) => {
      state.error = null;
    },
    setCurrentLeave: (state, action: PayloadAction<Leave | null>) => {
      state.currentLeave = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch leaves
      .addCase(fetchLeaves.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLeaves.fulfilled, (state, action) => {
        state.isLoading = false;
        state.leaves = action.payload.leaves;
      })
      .addCase(fetchLeaves.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch leave by id
      .addCase(fetchLeaveById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLeaveById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentLeave = action.payload.leave;
      })
      .addCase(fetchLeaveById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create leave
      .addCase(createLeave.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createLeave.fulfilled, (state, action) => {
        state.isLoading = false;
        state.leaves.push(action.payload.leave);
      })
      .addCase(createLeave.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update leave
      .addCase(updateLeave.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateLeave.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.leaves.findIndex(
          leave => leave.id === action.payload.leave.id
        );
        if (index !== -1) {
          state.leaves[index] = action.payload.leave;
        }
        state.currentLeave = action.payload.leave;
      })
      .addCase(updateLeave.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Delete leave
      .addCase(deleteLeave.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteLeave.fulfilled, (state, action) => {
        state.isLoading = false;
        state.leaves = state.leaves.filter(
          leave => leave.id !== action.payload.id
        );
        if (state.currentLeave?.id === action.payload.id) {
          state.currentLeave = null;
        }
      })
      .addCase(deleteLeave.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetLeaveError, setCurrentLeave } = leaveSlice.actions;
export default leaveSlice.reducer; 
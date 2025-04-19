import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import { 
  Schedule, 
  ScheduleState, 
  CreateScheduleRequest, 

} from '../types';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
  conflictType?: string;
  conflictingId?: string;
}

// Initial state
const initialState: ScheduleState = {
  schedules: [],
  isLoading: false,
  error: null,
  currentSchedule: null,
  conflict: null
};

// Async thunks
export const fetchSchedules = createAsyncThunk<
  { schedules: Schedule[] },
  { startDate?: string; endDate?: string } | void,
  { rejectValue: string }
>('schedules/fetchSchedules', async (dateParams, { rejectWithValue }) => {
  try {
    
    let url = '/schedules';
    if (dateParams) {
      const queryParams = new URLSearchParams();
      if (dateParams.startDate) queryParams.append('startDate', dateParams.startDate);
      if (dateParams.endDate) queryParams.append('endDate', dateParams.endDate);
      
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    }
    
    const response = await api.get(url);
    return response.data;
  } catch (error: unknown) {
    console.error('Error fetching schedules:', error);
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders programı yüklenirken bir hata oluştu');
  }
});

export const fetchScheduleById = createAsyncThunk<
  { schedule: Schedule },
  string,
  { rejectValue: string }
>('schedules/fetchScheduleById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/schedules/${id}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders programı detayları yüklenirken bir hata oluştu');
  }
});

export const createSchedule = createAsyncThunk<
  { schedule: Schedule; message: string },
  CreateScheduleRequest,
  { rejectValue: string }
>('schedules/createSchedule', async (scheduleData, { rejectWithValue }) => {
  try {
    const response = await api.post('/schedules', scheduleData);
    return response.data;
  } catch (error: unknown) {
    console.error('Error creating schedule:', error);
    const axiosError = error as AxiosError<ErrorResponse>;
    
    // Çakışma hatası kontrolü (409 status code)
    if (axiosError.response?.status === 409) {
      return rejectWithValue(JSON.stringify({
        message: axiosError.response.data.message,
        conflictType: axiosError.response.data.conflictType,
        conflictingId: axiosError.response.data.conflictingId
      }));
    }
    
    return rejectWithValue(axiosError.response?.data?.message || 'Ders programı oluşturulurken bir hata oluştu');
  }
});

export const updateSchedule = createAsyncThunk<
  { schedule: Schedule; message: string },
  { id: string; scheduleData: Omit<CreateScheduleRequest, "id"> },
  { rejectValue: string }
>('schedules/updateSchedule', async ({ id, scheduleData }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/schedules/${id}`, scheduleData);
    return response.data;
  } catch (error: unknown) {
    console.error('Error updating schedule:', error);
    const axiosError = error as AxiosError<ErrorResponse>;
    
    // Çakışma hatası kontrolü (409 status code)
    if (axiosError.response?.status === 409) {
      return rejectWithValue(JSON.stringify({
        message: axiosError.response.data.message,
        conflictType: axiosError.response.data.conflictType,
        conflictingId: axiosError.response.data.conflictingId
      }));
    }
    
    return rejectWithValue(axiosError.response?.data?.message || 'Ders programı güncellenirken bir hata oluştu');
  }
});

export const deleteSchedule = createAsyncThunk<
  { message: string; id: string },
  string,
  { rejectValue: string }
>('schedules/deleteSchedule', async (id, { rejectWithValue }) => {
  try {
    const response = await api.delete(`/schedules/${id}`);
    return response.data;
  } catch (error: unknown) {
    console.error('Error deleting schedule:', error);
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders programı silinirken bir hata oluştu');
  }
});

// Check for teacher conflicts
export const checkTeacherConflict = createAsyncThunk<
  { hasConflict: boolean; conflictingLesson?: Schedule; message?: string },
  { teacherId: string; date: string; startTime: string; endTime: string; excludeLessonId?: string },
  { rejectValue: string }
>('schedules/checkTeacherConflict', async (params, { rejectWithValue }) => {
  try {
    
    const response = await api.post('/schedules/check-teacher-conflict', params);
    return response.data;
  } catch (error: unknown) {
    console.error('Error checking teacher conflict:', error);
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen çakışması kontrolü sırasında bir hata oluştu');
  }
});

// Check for teacher leave
export const checkTeacherLeave = createAsyncThunk<
  { hasLeave: boolean; message?: string },
  { teacherId: string; date: string },
  { rejectValue: string }
>('schedules/checkTeacherLeave', async (params, { rejectWithValue }) => {
  try {
    
    // API endpoint to check if teacher is on leave
    const response = await api.post('/schedules/check-teacher-leave', params);
    return response.data;
  } catch (error: unknown) {
    console.error('Error checking teacher leave:', error);
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen izin kontrolü sırasında bir hata oluştu');
  }
});

// Add toggleCheckStatus thunk after checkTeacherLeave
export const toggleCheckStatus = createAsyncThunk<
  { schedule: Schedule; message: string },
  string,
  { rejectValue: string }
>('schedules/toggleCheckStatus', async (id, { rejectWithValue }) => {
  try {
    const response = await api.patch(`/schedules/${id}/toggle-check`);
    return response.data;
  } catch (error: unknown) {
    console.error('Error toggling check status:', error);
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders kontrolü değiştirilirken bir hata oluştu');
  }
});

// Slice
const scheduleSlice = createSlice({
  name: 'schedules',
  initialState,
  reducers: {
    resetScheduleError: (state) => {
      state.error = null;
      state.conflict = null;
    },
    setCurrentSchedule: (state, action: PayloadAction<Schedule | null>) => {
      state.currentSchedule = action.payload;
    },
    resetConflict: (state) => {
      state.conflict = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch schedules
      .addCase(fetchSchedules.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.isLoading = false;
        state.schedules = action.payload.schedules;
      })
      .addCase(fetchSchedules.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch schedule by id
      .addCase(fetchScheduleById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchScheduleById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSchedule = action.payload.schedule;
      })
      .addCase(fetchScheduleById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create schedule
      .addCase(createSchedule.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.conflict = null;
      })
      .addCase(createSchedule.fulfilled, (state, action) => {
        state.isLoading = false;
        state.schedules.push(action.payload.schedule);
      })
      .addCase(createSchedule.rejected, (state, action) => {
        state.isLoading = false;
        
        try {
          // Çakışma hatası kontrolü ve ayrıştırma
          const errorData = JSON.parse(action.payload as string);
          if (errorData.conflictType) {
            state.conflict = {
              hasConflict: true,
              type: errorData.conflictType,
              conflictingId: errorData.conflictingId,
              message: errorData.message
            };
            state.error = errorData.message;
          } else {
            state.error = action.payload as string;
          }
        } catch {
          state.error = action.payload as string;
        }
      })
      
      // Update schedule
      .addCase(updateSchedule.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.conflict = null;
      })
      .addCase(updateSchedule.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.schedules.findIndex(
          schedule => schedule.id === action.payload.schedule.id
        );
        if (index !== -1) {
          state.schedules[index] = action.payload.schedule;
        }
        state.currentSchedule = action.payload.schedule;
      })
      .addCase(updateSchedule.rejected, (state, action) => {
        state.isLoading = false;
        
        try {
          // Çakışma hatası kontrolü ve ayrıştırma
          const errorData = JSON.parse(action.payload as string);
          if (errorData.conflictType) {
            state.conflict = {
              hasConflict: true,
              type: errorData.conflictType,
              conflictingId: errorData.conflictingId,
              message: errorData.message
            };
            state.error = errorData.message;
          } else {
            state.error = action.payload as string;
          }
        } catch {
          state.error = action.payload as string;
        }
      })
      
      // Delete schedule
      .addCase(deleteSchedule.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteSchedule.fulfilled, (state, action) => {
        state.isLoading = false;
        state.schedules = state.schedules.filter(
          schedule => schedule.id !== action.payload.id
        );
        if (state.currentSchedule?.id === action.payload.id) {
          state.currentSchedule = null;
        }
      })
      .addCase(deleteSchedule.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Check teacher conflict
      .addCase(checkTeacherConflict.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.conflict = null;
      })
      .addCase(checkTeacherConflict.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.hasConflict) {
          state.conflict = {
            hasConflict: true,
            type: 'teacher',
            message: action.payload.message,
            conflictingId: action.payload.conflictingLesson?.id
          };
        }
      })
      .addCase(checkTeacherConflict.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Check teacher leave
      .addCase(checkTeacherLeave.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.conflict = null;
      })
      .addCase(checkTeacherLeave.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.hasLeave) {
          state.conflict = {
            hasConflict: true,
            type: 'leave',
            message: action.payload.message,
            conflictingId: undefined
          };
        }
      })
      .addCase(checkTeacherLeave.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Toggle check status
      .addCase(toggleCheckStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.conflict = null;
      })
      .addCase(toggleCheckStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSchedule = action.payload.schedule;
      })
      .addCase(toggleCheckStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetScheduleError, setCurrentSchedule, resetConflict } = scheduleSlice.actions;
export default scheduleSlice.reducer;

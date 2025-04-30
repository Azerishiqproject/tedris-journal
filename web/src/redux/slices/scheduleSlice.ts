import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import { 
  Schedule, 
  ScheduleState, 
} from '../types';
import axios from 'axios';

// Update the CreateScheduleRequest interface in the correct location
interface CreateScheduleRequest {
  teacherIds: string[];
  primaryTeacherId: string;
  locationId: string;
  courseTypeId: string;
  seasonId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacherId?: string; // Make teacherId optional as we're using teacherIds array
}

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
>('schedules/fetchSchedules', async (dateParams) => {
  try {
    
    let url = '/schedules';
    if (dateParams) {
      const queryParams = new URLSearchParams();
      if (dateParams.startDate) queryParams.append('startDate', dateParams.startDate);
      if (dateParams.endDate) queryParams.append('endDate', dateParams.endDate);
      
      // Add a limit parameter to prevent potential large data issues
      queryParams.append('limit', '100');
      
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    }
    
    console.log('Fetching schedules with URL:', url);
    
    try {
      // Try with a reasonable timeout
      const response = await api.get(url, { timeout: 15000 }); // 15 second timeout
    return response.data;
    } catch (fetchError) {
      const axiosError = fetchError as AxiosError<ErrorResponse>;
      
      // Log detailed information about the error
      console.error('Status:', axiosError.response?.status);
      console.error('Status text:', axiosError.response?.statusText);
      console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
      console.error('URL:', axiosError.config?.url);
      
      // For 500 errors or network issues, return empty schedules
      if (axiosError.response?.status === 500 || !axiosError.response) {
        console.warn('Server error or network issue occurred, returning empty schedules list');
        return { schedules: [] };
      }
      
      throw fetchError; // Re-throw other errors
    }
  } catch (error: unknown) {
    console.error('Error fetching schedules:', error);
    
    // Handle axios error formatting
    if (axios.isAxiosError(error)) {
      // Return empty schedules and let the UI handle the error state
      return { schedules: [] };
    }
    
    // For non-axios errors
    return { schedules: [] };
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
    // Log the schedule data being sent to API for debugging
    console.log('Creating schedule with data:', JSON.stringify(scheduleData, null, 2));
    
    // Make sure teacherIds is properly formatted
    const dataToSend = {
      ...scheduleData,
      // Ensure teacherIds is an array of strings
      teacherIds: Array.isArray(scheduleData.teacherIds) 
        ? scheduleData.teacherIds.filter(id => typeof id === 'string' && id.trim() !== '')
        : [],
      // Ensure primaryTeacherId is set correctly
      primaryTeacherId: scheduleData.primaryTeacherId || 
        (Array.isArray(scheduleData.teacherIds) && scheduleData.teacherIds.length > 0 
          ? scheduleData.teacherIds[0] 
          : '')
    };
    
    // Make sure the data structure matches what backend expects
    const response = await api.post('/schedules', dataToSend);
    
    // Log the response for debugging
    console.log('Schedule created successfully:', response.data);
    
    // Return the response first to update the UI quickly
    return response.data;
  } catch (error: unknown) {
    console.error('Error creating schedule:', error);
    
    // Extract more detailed error information
    const axiosError = error as AxiosError<ErrorResponse>;
    console.error('Status:', axiosError.response?.status);
    console.error('Status text:', axiosError.response?.statusText);
    console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
    
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
    console.log('Updating schedule with data:', JSON.stringify(scheduleData, null, 2));
    
    // Make sure teacherIds is properly formatted
    const dataToSend = {
      ...scheduleData,
      // Ensure teacherIds is an array of strings
      teacherIds: Array.isArray(scheduleData.teacherIds) 
        ? scheduleData.teacherIds.filter(id => typeof id === 'string' && id.trim() !== '')
        : [],
      // Ensure primaryTeacherId is set correctly
      primaryTeacherId: scheduleData.primaryTeacherId || 
        (Array.isArray(scheduleData.teacherIds) && scheduleData.teacherIds.length > 0 
          ? scheduleData.teacherIds[0] 
          : '')
    };
    
    const response = await api.put(`/schedules/${id}`, dataToSend);
    console.log('Schedule updated successfully:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('Error updating schedule:', error);
    
    // Extract more detailed error information
    const axiosError = error as AxiosError<ErrorResponse>;
    console.error('Status:', axiosError.response?.status);
    console.error('Status text:', axiosError.response?.statusText);
    console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
    
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
  { teacherIds: string[]; date: string; startTime: string; endTime: string; excludeLessonId?: string },
  { rejectValue: string }
>('schedules/checkTeacherConflict', async (params, { rejectWithValue }) => {
  try {
    console.log('Sending teacher conflict check with params:', JSON.stringify(params, null, 2));
    
    // Validate params before sending
    if (!params.teacherIds || params.teacherIds.length === 0) {
      return { hasConflict: false, message: 'No teachers selected' };
    }
    
    if (!params.date || !params.startTime || !params.endTime) {
      return { hasConflict: false, message: 'Missing date or time information' };
    }
    
    // Ensure teacherIds is an array of strings
    const validatedParams = {
      ...params,
      teacherIds: params.teacherIds.filter(id => typeof id === 'string' && id.trim() !== '')
    };
    
    if (validatedParams.teacherIds.length === 0) {
      return { hasConflict: false, message: 'No valid teacher IDs' };
    }
    
    const response = await api.post('/schedules/check-teacher-conflict', validatedParams);
    console.log('Teacher conflict check response:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('Error checking teacher conflict:', error);
    
    // Extract more detailed error information
    const axiosError = error as AxiosError<ErrorResponse>;
    console.error('Status:', axiosError.response?.status);
    console.error('Status text:', axiosError.response?.statusText);
    console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
    
    if (axiosError.response?.status === 500) {
      // For server errors, we'll return false conflict to allow the form to proceed
      // This is a temporary solution - the server issue should be fixed
      console.warn('Server error occurred, bypassing conflict check');
      return { hasConflict: false, message: 'Conflict check unavailable (server error)' };
    }
    
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen çakışması kontrolü sırasında bir hata oluştu');
  }
});

// Check for teacher leaves
export const checkTeacherLeave = createAsyncThunk<
  { hasLeave: boolean; message?: string; teachersOnLeave?: string[] },
  { teacherIds: string[]; date: string },
  { rejectValue: string }
>('schedules/checkTeacherLeave', async (params) => {
  try {
    console.log('Checking teacher leaves with params:', JSON.stringify(params, null, 2));
    
    // Validate params before sending
    if (!params.teacherIds || params.teacherIds.length === 0) {
      return { hasLeave: false, message: 'No teachers selected' };
    }
    
    try {
      // Make API request to check if any teachers are on leave for this date
      const response = await api.post('/leaves/check', params);
      console.log('Teacher leave check response:', response.data);
      
      // If there's a leave conflict, return it with a message
      if (response.data.hasLeave) {
        return {
          hasLeave: true,
          message: `Bu tarixdə bəzi müəllimlər məzuniyyətdədir: ${response.data.teachersOnLeave.join(', ')}`,
          teachersOnLeave: response.data.teachersOnLeave
        };
      }
    } catch (apiError) {
      console.warn('Leave check API error:', apiError);
      // If server error occurs, don't block the form submission
      // We'll still allow lesson creation even if leave check fails
      return { hasLeave: false, message: 'Məzuniyyət yoxlanışı uğursuz oldu, amma davam edə bilərsiniz' };
    }
    
    // No conflict
    return { hasLeave: false };
  } catch (error: unknown) {
    console.error('Error checking teacher leaves:', error);
    
    // If this is a 404, it might mean the leave check endpoint isn't implemented yet
    // In that case, don't treat it as a blocking error
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404 || axiosError.response?.status === 500) {
      console.warn('Leave check API endpoint failed, continuing...');
      return { hasLeave: false };
    }
    
    // We still return success even if there's an error, to prevent blocking lesson creation
    return { hasLeave: false, message: 'Müəllim məzuniyyət durumu yoxlanarkən xəta baş verdi' };
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
        
        // Ensure we're not adding duplicates
        const existingIndex = state.schedules.findIndex(schedule => 
          schedule.id === action.payload.schedule.id
        );
        
        if (existingIndex >= 0) {
          // Update existing schedule if it's already in the array
          state.schedules[existingIndex] = action.payload.schedule;
        } else {
          // Add the new schedule to the array
          state.schedules.push(action.payload.schedule);
        }
        
        // Update current schedule reference
        state.currentSchedule = action.payload.schedule;
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
        
        if (action.payload && action.payload.schedule && action.payload.schedule.id) {
          const index = state.schedules.findIndex(
            schedule => schedule.id === action.payload.schedule.id
          );
          
          if (index !== -1) {
            // Update existing schedule
            state.schedules[index] = {
              ...state.schedules[index],
              ...action.payload.schedule
            };
          } else {
            // If not found, add it to the array
            state.schedules.push(action.payload.schedule);
          }
          
          // Update current schedule reference
          state.currentSchedule = action.payload.schedule;
        }
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
        
        // Safely filter out the deleted schedule
        if (action.payload && action.payload.id) {
          state.schedules = state.schedules.filter(
            schedule => schedule.id !== action.payload.id
          );
          
          // Clear currentSchedule if it was the deleted one
          if (state.currentSchedule?.id === action.payload.id) {
            state.currentSchedule = null;
          }
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

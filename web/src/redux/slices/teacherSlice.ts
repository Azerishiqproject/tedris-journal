import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { Teacher, TeacherState, CreateTeacherRequest, UpdateTeacherRequest } from '../types';
import { AxiosError } from 'axios';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
}

// Initial state
const initialState: TeacherState = {
  teachers: [],
  isLoading: false,
  error: null,
  currentTeacher: null
};

// Async thunks
export const fetchTeachers = createAsyncThunk<
  { teachers: Teacher[] },
  string | undefined,
  { rejectValue: string }
>('teachers/fetchTeachers', async (status, { rejectWithValue }) => {
  try {
    // Status parametresi varsa query parametresi olarak ekle
    const queryParams = status ? `?status=${status}` : '';
    const response = await api.get(`/teachers${queryParams}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen listesi yüklenirken bir hata oluştu');
  }
});

export const fetchTeacherById = createAsyncThunk<
  { teacher: Teacher },
  string,
  { rejectValue: string }
>('teachers/fetchTeacherById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/teachers/${id}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen detayları yüklenirken bir hata oluştu');
  }
});

export const createTeacher = createAsyncThunk<
  { teacher: Teacher; message: string },
  CreateTeacherRequest,
  { rejectValue: string }
>('teachers/createTeacher', async (teacherData, { rejectWithValue }) => {
  try {
    const response = await api.post('/teachers', teacherData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen oluşturulurken bir hata oluştu');
  }
});

export const updateTeacher = createAsyncThunk<
  { teacher: Teacher; message: string },
  UpdateTeacherRequest,
  { rejectValue: string }
>('teachers/updateTeacher', async ({ id, teacherData }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/teachers/${id}`, teacherData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen güncellenirken bir hata oluştu');
  }
});

export const deleteTeacher = createAsyncThunk<
  { message: string; id: string },
  string,
  { rejectValue: string }
>('teachers/deleteTeacher', async (id, { rejectWithValue }) => {
  try {
    const response = await api.delete(`/teachers/${id}`);
    return { ...response.data, id };
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen silinirken bir hata oluştu');
  }
});

export const toggleTeacherStatus = createAsyncThunk<
  { teacher: Teacher; message: string },
  string,
  { rejectValue: string }
>('teachers/toggleTeacherStatus', async (id, { rejectWithValue }) => {
  try {
    const response = await api.patch(`/teachers/${id}/toggle-status`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Öğretmen durumu değiştirilirken bir hata oluştu');
  }
});

// Slice
const teacherSlice = createSlice({
  name: 'teachers',
  initialState,
  reducers: {
    resetTeacherError: (state) => {
      state.error = null;
    },
    setCurrentTeacher: (state, action: PayloadAction<Teacher | null>) => {
      state.currentTeacher = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all teachers
      .addCase(fetchTeachers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeachers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teachers = action.payload.teachers;
      })
      .addCase(fetchTeachers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch single teacher
      .addCase(fetchTeacherById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTeacherById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTeacher = action.payload.teacher;
      })
      .addCase(fetchTeacherById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create teacher
      .addCase(createTeacher.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTeacher.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teachers.push(action.payload.teacher);
      })
      .addCase(createTeacher.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update teacher
      .addCase(updateTeacher.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateTeacher.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.teachers.findIndex(
          teacher => teacher.id === action.payload.teacher.id
        );
        if (index !== -1) {
          state.teachers[index] = action.payload.teacher;
        }
        state.currentTeacher = action.payload.teacher;
      })
      .addCase(updateTeacher.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Delete teacher
      .addCase(deleteTeacher.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteTeacher.fulfilled, (state, action) => {
        state.isLoading = false;
        state.teachers = state.teachers.filter(
          teacher => teacher.id !== action.payload.id
        );
        if (state.currentTeacher?.id === action.payload.id) {
          state.currentTeacher = null;
        }
      })
      .addCase(deleteTeacher.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Toggle teacher status
      .addCase(toggleTeacherStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(toggleTeacherStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.teachers.findIndex(
          teacher => teacher.id === action.payload.teacher.id || teacher._id === action.payload.teacher.id
        );
        if (index !== -1) {
          state.teachers[index] = action.payload.teacher;
        }
        if (state.currentTeacher?.id === action.payload.teacher.id) {
          state.currentTeacher = action.payload.teacher;
        }
      })
      .addCase(toggleTeacherStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetTeacherError, setCurrentTeacher } = teacherSlice.actions;
export default teacherSlice.reducer; 
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import { Course, CourseState, CreateCourseRequest, UpdateCourseRequest } from '../types';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
}

// Initial state
const initialState: CourseState = {
  courses: [],
  isLoading: false,
  error: null,
  currentCourse: null
};

// Async thunks
export const fetchCourses = createAsyncThunk<
  { courses: Course[] },
  string | undefined,
  { rejectValue: string }
>('courses/fetchCourses', async (status, { rejectWithValue }) => {
  try {
    // Status parametresi varsa query parametresi olarak ekle
    const queryParams = status ? `?status=${status}` : '';
    const response = await api.get(`/courses${queryParams}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Dersler yüklenirken bir hata oluştu');
  }
});

export const fetchCourseById = createAsyncThunk<
  { course: Course },
  string,
  { rejectValue: string }
>('courses/fetchCourseById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/courses/${id}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders detayları yüklenirken bir hata oluştu');
  }
});

export const createCourse = createAsyncThunk<
  { course: Course; message: string },
  CreateCourseRequest,
  { rejectValue: string }
>('courses/createCourse', async (courseData, { rejectWithValue }) => {
  try {
    const response = await api.post('/courses', courseData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders oluşturulurken bir hata oluştu');
  }
});

export const updateCourse = createAsyncThunk<
  { course: Course; message: string },
  UpdateCourseRequest,
  { rejectValue: string }
>('courses/updateCourse', async ({ id, courseData }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/courses/${id}`, courseData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders güncellenirken bir hata oluştu');
  }
});

export const deleteCourse = createAsyncThunk<
  { message: string; id: string },
  string,
  { rejectValue: string }
>('courses/deleteCourse', async (id, { rejectWithValue }) => {
  try {
    const response = await api.delete(`/courses/${id}`);
    return { ...response.data, id };
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders silinirken bir hata oluştu');
  }
});

export const toggleCourseStatus = createAsyncThunk<
  { course: Course; message: string },
  string,
  { rejectValue: string }
>('courses/toggleCourseStatus', async (id, { rejectWithValue }) => {
  try {
    const response = await api.patch(`/courses/${id}/toggle-status`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders durumu değiştirilirken bir hata oluştu');
  }
});

// Slice
const courseSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    resetCourseError: (state) => {
      state.error = null;
    },
    setCurrentCourse: (state, action: PayloadAction<Course | null>) => {
      state.currentCourse = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all courses
      .addCase(fetchCourses.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCourses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.courses = action.payload.courses;
      })
      .addCase(fetchCourses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch single course
      .addCase(fetchCourseById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCourseById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentCourse = action.payload.course;
      })
      .addCase(fetchCourseById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create course
      .addCase(createCourse.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCourse.fulfilled, (state, action) => {
        state.isLoading = false;
        state.courses.push(action.payload.course);
      })
      .addCase(createCourse.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update course
      .addCase(updateCourse.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCourse.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.courses.findIndex(
          course => course.id === action.payload.course.id
        );
        if (index !== -1) {
          state.courses[index] = action.payload.course;
        }
        state.currentCourse = action.payload.course;
      })
      .addCase(updateCourse.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Delete course
      .addCase(deleteCourse.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteCourse.fulfilled, (state, action) => {
        state.isLoading = false;
        state.courses = state.courses.filter(
          course => course.id !== action.payload.id
        );
        if (state.currentCourse?.id === action.payload.id) {
          state.currentCourse = null;
        }
      })
      .addCase(deleteCourse.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Toggle course status
      .addCase(toggleCourseStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(toggleCourseStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.courses.findIndex(
          course => course.id === action.payload.course.id || course._id === action.payload.course.id
        );
        if (index !== -1) {
          state.courses[index] = action.payload.course;
        }
        if (state.currentCourse?.id === action.payload.course.id) {
          state.currentCourse = action.payload.course;
        }
      })
      .addCase(toggleCourseStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetCourseError, setCurrentCourse } = courseSlice.actions;
export default courseSlice.reducer; 
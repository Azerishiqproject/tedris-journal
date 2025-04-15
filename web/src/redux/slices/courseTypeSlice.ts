import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import { CourseType, CourseTypeState, CreateCourseTypeRequest, UpdateCourseTypeRequest } from '../types';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
}

// Initial state
const initialState: CourseTypeState = {
  courseTypes: [],
  isLoading: false,
  error: null,
  currentCourseType: null
};

// Async thunks
export const fetchCourseTypes = createAsyncThunk<
  { courseTypes: CourseType[] },
  string | undefined,
  { rejectValue: string }
>('courseTypes/fetchCourseTypes', async (status, { rejectWithValue }) => {
  try {
    // Status parametresi varsa query parametresi olarak ekle
    const queryParams = status ? `?status=${status}` : '';
    const response = await api.get(`/course-types${queryParams}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders tipleri yüklenirken bir hata oluştu');
  }
});

export const fetchCourseTypeById = createAsyncThunk<
  { courseType: CourseType },
  string,
  { rejectValue: string }
>('courseTypes/fetchCourseTypeById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/course-types/${id}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders tipi detayları yüklenirken bir hata oluştu');
  }
});

export const createCourseType = createAsyncThunk<
  { courseType: CourseType; message: string },
  CreateCourseTypeRequest,
  { rejectValue: string }
>('courseTypes/createCourseType', async (courseTypeData, { rejectWithValue }) => {
  try {
    const response = await api.post('/course-types', courseTypeData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders tipi oluşturulurken bir hata oluştu');
  }
});

export const updateCourseType = createAsyncThunk<
  { courseType: CourseType; message: string },
  UpdateCourseTypeRequest,
  { rejectValue: string }
>('courseTypes/updateCourseType', async ({ id, courseTypeData }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/course-types/${id}`, courseTypeData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders tipi güncellenirken bir hata oluştu');
  }
});

export const deleteCourseType = createAsyncThunk<
  { message: string; id: string },
  string,
  { rejectValue: string }
>('courseTypes/deleteCourseType', async (id, { rejectWithValue }) => {
  try {
    const response = await api.delete(`/course-types/${id}`);
    return { ...response.data, id };
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders tipi silinirken bir hata oluştu');
  }
});

export const toggleCourseTypeStatus = createAsyncThunk<
  { courseType: CourseType; message: string },
  string,
  { rejectValue: string }
>('courseTypes/toggleCourseTypeStatus', async (id, { rejectWithValue }) => {
  try {
    const response = await api.patch(`/course-types/${id}/toggle-status`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders tipi durumu değiştirilirken bir hata oluştu');
  }
});

// Slice
const courseTypeSlice = createSlice({
  name: 'courseTypes',
  initialState,
  reducers: {
    resetCourseTypeError: (state) => {
      state.error = null;
    },
    setCurrentCourseType: (state, action: PayloadAction<CourseType | null>) => {
      state.currentCourseType = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all course types
      .addCase(fetchCourseTypes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCourseTypes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.courseTypes = action.payload.courseTypes;
      })
      .addCase(fetchCourseTypes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch single course type
      .addCase(fetchCourseTypeById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCourseTypeById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentCourseType = action.payload.courseType;
      })
      .addCase(fetchCourseTypeById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create course type
      .addCase(createCourseType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCourseType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.courseTypes.push(action.payload.courseType);
      })
      .addCase(createCourseType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update course type
      .addCase(updateCourseType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCourseType.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.courseTypes.findIndex(
          courseType => courseType.id === action.payload.courseType.id
        );
        if (index !== -1) {
          state.courseTypes[index] = action.payload.courseType;
        }
        state.currentCourseType = action.payload.courseType;
      })
      .addCase(updateCourseType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Delete course type
      .addCase(deleteCourseType.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteCourseType.fulfilled, (state, action) => {
        state.isLoading = false;
        state.courseTypes = state.courseTypes.filter(
          courseType => courseType.id !== action.payload.id
        );
        if (state.currentCourseType?.id === action.payload.id) {
          state.currentCourseType = null;
        }
      })
      .addCase(deleteCourseType.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Toggle course type status
      .addCase(toggleCourseTypeStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(toggleCourseTypeStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.courseTypes.findIndex(
          courseType => courseType.id === action.payload.courseType.id || courseType._id === action.payload.courseType.id
        );
        if (index !== -1) {
          state.courseTypes[index] = action.payload.courseType;
        }
        if (state.currentCourseType?.id === action.payload.courseType.id) {
          state.currentCourseType = action.payload.courseType;
        }
      })
      .addCase(toggleCourseTypeStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetCourseTypeError, setCurrentCourseType } = courseTypeSlice.actions;
export default courseTypeSlice.reducer; 
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import { Season, SeasonState, CreateSeasonRequest, UpdateSeasonRequest } from '../types';
// Import the action creator type to avoid circular imports
import type { AsyncThunkAction } from '@reduxjs/toolkit';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
}

// Define schedule response type for fetchSchedules
interface Schedule {
  id: string;
  teacherId: string;
  locationId: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  type: string;
  seasonId?: string;
  [key: string]: unknown; // For any additional properties
}

interface ScheduleResponse {
  schedules: Schedule[];
}

// Type for the fetchSchedules action with proper typing
type FetchSchedulesAction = AsyncThunkAction<
  ScheduleResponse, 
  { startDate?: string; endDate?: string } | undefined, 
  { rejectValue: string }
>;

// Store the fetchSchedules action creator reference
let fetchSchedulesAction: (() => FetchSchedulesAction) | null = null;

// Function to register the fetchSchedules action creator to avoid circular dependencies
export const registerFetchSchedules = (action: () => FetchSchedulesAction): void => {
  fetchSchedulesAction = action;
};

// Initial state
const initialState: SeasonState = {
  seasons: [],
  isLoading: false,
  error: null,
  currentSeason: null
};

// Async thunks
export const fetchSeasons = createAsyncThunk<
  { seasons: Season[] },
  string | undefined,
  { rejectValue: string }
>('seasons/fetchSeasons', async (status, { rejectWithValue }) => {
  try {
    // Status parametresi varsa query parametresi olarak ekle
    const queryParams = status ? `?status=${status}` : '';
    const response = await api.get(`/seasons${queryParams}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Kurslar yüklenirken bir hata oluştu');
  }
});

export const fetchSeasonById = createAsyncThunk<
  { season: Season },
  string,
  { rejectValue: string }
>('seasons/fetchSeasonById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/seasons/${id}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Kurs detalları yüklənərkən bir xəta baş verdi');
  }
});

export const createSeason = createAsyncThunk<
  { season: Season; message: string },
  CreateSeasonRequest,
  { rejectValue: string }
>('seasons/createSeason', async (seasonData, { rejectWithValue }) => {
  try {
    const response = await api.post('/seasons', seasonData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Kurs yaratma prosesi sırasında bir xəta baş verdi');
  }
});

export const updateSeason = createAsyncThunk<
  { season: Season; message: string },
  UpdateSeasonRequest,
  { rejectValue: string }
>('seasons/updateSeason', async ({ id, seasonData }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/seasons/${id}`, seasonData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Kurs güncellenirken bir xəta baş verdi');
  }
});

export const deleteSeason = createAsyncThunk<
  { message: string; id: string },
  string,
  { rejectValue: string }
>('seasons/deleteSeason', async (id, { rejectWithValue }) => {
  try {
    const response = await api.delete(`/seasons/${id}`);
    return { ...response.data, id };
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Kurs silinərkən bir xəta baş verdi');
  }
});

// Define extended response type
interface ToggleSeasonStatusResponse {
  season: Season;
  message: string;
  lessonsAffected?: boolean;
  lessonsCount?: number;
  shouldRefreshLessons?: boolean;
}

export const toggleSeasonStatus = createAsyncThunk<
  ToggleSeasonStatusResponse,
  string,
  { rejectValue: string }
>('seasons/toggleSeasonStatus', async (id, { rejectWithValue, dispatch }) => {
  try {
    const response = await api.patch(`/seasons/${id}/toggle-status`);
    // If lessons need to be refreshed due to season status change, trigger the fetch
    if (response.data.shouldRefreshLessons && fetchSchedulesAction) {
      // Use setTimeout to ensure this runs after the current action completes
      setTimeout(() => {
        if (fetchSchedulesAction) {
          dispatch(fetchSchedulesAction());
        }
      }, 0);
    }
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Kurs statusu dəyişdirmə əməliyyatı sırasında bir xəta baş verdi');
  }
});

// Slice
const seasonSlice = createSlice({
  name: 'seasons',
  initialState,
  reducers: {
    resetSeasonError: (state) => {
      state.error = null;
    },
    setCurrentSeason: (state, action: PayloadAction<Season | null>) => {
      state.currentSeason = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all seasons
      .addCase(fetchSeasons.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSeasons.fulfilled, (state, action) => {
        state.isLoading = false;
        state.seasons = action.payload.seasons;
      })
      .addCase(fetchSeasons.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch single season
      .addCase(fetchSeasonById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSeasonById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSeason = action.payload.season;
      })
      .addCase(fetchSeasonById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create season
      .addCase(createSeason.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createSeason.fulfilled, (state, action) => {
        state.isLoading = false;
        state.seasons.push(action.payload.season);
      })
      .addCase(createSeason.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update season
      .addCase(updateSeason.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateSeason.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.seasons.findIndex(
          season => season.id === action.payload.season.id
        );
        if (index !== -1) {
          state.seasons[index] = action.payload.season;
        }
        state.currentSeason = action.payload.season;
      })
      .addCase(updateSeason.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Delete season
      .addCase(deleteSeason.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteSeason.fulfilled, (state, action) => {
        state.isLoading = false;
        state.seasons = state.seasons.filter(
          season => season.id !== action.payload.id
        );
        if (state.currentSeason?.id === action.payload.id) {
          state.currentSeason = null;
        }
      })
      .addCase(deleteSeason.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Toggle season status
      .addCase(toggleSeasonStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(toggleSeasonStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.seasons.findIndex(
          season => season.id === action.payload.season.id || season._id === action.payload.season.id
        );
        if (index !== -1) {
          state.seasons[index] = action.payload.season;
        }
        if (state.currentSeason?.id === action.payload.season.id) {
          state.currentSeason = action.payload.season;
        }
      })
      .addCase(toggleSeasonStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetSeasonError, setCurrentSeason } = seasonSlice.actions;
export default seasonSlice.reducer; 
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { AxiosError } from 'axios';
import { Location, LocationState, CreateLocationRequest, UpdateLocationRequest } from '../types';

// Error interface to handle axios errors
interface ErrorResponse {
  message: string;
}

// Initial state
const initialState: LocationState = {
  locations: [],
  isLoading: false,
  error: null,
  currentLocation: null
};

// Async thunks
export const fetchLocations = createAsyncThunk<
  { locations: Location[] },
  string | undefined,
  { rejectValue: string }
>('locations/fetchLocations', async (status, { rejectWithValue }) => {
  try {
    // Status parametresi varsa query parametresi olarak ekle
    const queryParams = status ? `?status=${status}` : '';
    const response = await api.get(`/locations${queryParams}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders yerleri yüklenirken bir hata oluştu');
  }
});

export const fetchLocationById = createAsyncThunk<
  { location: Location },
  string,
  { rejectValue: string }
>('locations/fetchLocationById', async (id, { rejectWithValue }) => {
  try {
    const response = await api.get(`/locations/${id}`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders yeri detayları yüklenirken bir hata oluştu');
  }
});

export const createLocation = createAsyncThunk<
  { location: Location; message: string },
  CreateLocationRequest,
  { rejectValue: string }
>('locations/createLocation', async (locationData, { rejectWithValue }) => {
  try {
    const response = await api.post('/locations', locationData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders yeri oluşturulurken bir hata oluştu');
  }
});

export const updateLocation = createAsyncThunk<
  { location: Location; message: string },
  UpdateLocationRequest,
  { rejectValue: string }
>('locations/updateLocation', async ({ id, locationData }, { rejectWithValue }) => {
  try {
    const response = await api.put(`/locations/${id}`, locationData);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders yeri güncellenirken bir hata oluştu');
  }
});

export const deleteLocation = createAsyncThunk<
  { message: string; id: string },
  string,
  { rejectValue: string }
>('locations/deleteLocation', async (id, { rejectWithValue }) => {
  try {
    const response = await api.delete(`/locations/${id}`);
    return { ...response.data, id };
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders yeri silinirken bir hata oluştu');
  }
});

export const toggleLocationStatus = createAsyncThunk<
  { location: Location; message: string },
  string,
  { rejectValue: string }
>('locations/toggleLocationStatus', async (id, { rejectWithValue }) => {
  try {
    const response = await api.patch(`/locations/${id}/toggle-status`);
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ErrorResponse>;
    return rejectWithValue(axiosError.response?.data?.message || 'Ders yeri durumu değiştirilirken bir hata oluştu');
  }
});

// Slice
const locationSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    resetLocationError: (state) => {
      state.error = null;
    },
    setCurrentLocation: (state, action: PayloadAction<Location | null>) => {
      state.currentLocation = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all locations
      .addCase(fetchLocations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.locations = action.payload.locations;
      })
      .addCase(fetchLocations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch single location
      .addCase(fetchLocationById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLocationById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentLocation = action.payload.location;
      })
      .addCase(fetchLocationById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Create location
      .addCase(createLocation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createLocation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.locations.push(action.payload.location);
      })
      .addCase(createLocation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Update location
      .addCase(updateLocation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateLocation.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.locations.findIndex(
          location => location.id === action.payload.location.id
        );
        if (index !== -1) {
          state.locations[index] = action.payload.location;
        }
        state.currentLocation = action.payload.location;
      })
      .addCase(updateLocation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Delete location
      .addCase(deleteLocation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteLocation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.locations = state.locations.filter(
          location => location.id !== action.payload.id
        );
        if (state.currentLocation?.id === action.payload.id) {
          state.currentLocation = null;
        }
      })
      .addCase(deleteLocation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Toggle location status
      .addCase(toggleLocationStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(toggleLocationStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.locations.findIndex(
          location => location.id === action.payload.location.id || location._id === action.payload.location.id
        );
        if (index !== -1) {
          state.locations[index] = action.payload.location;
        }
        if (state.currentLocation?.id === action.payload.location.id) {
          state.currentLocation = action.payload.location;
        }
      })
      .addCase(toggleLocationStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetLocationError, setCurrentLocation } = locationSlice.actions;
export default locationSlice.reducer;

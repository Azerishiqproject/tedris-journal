import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from '@/redux/slices/authSlice';
import teacherReducer from '@/redux/slices/teacherSlice';
import courseTypeReducer from '@/redux/slices/courseTypeSlice';
import locationReducer from '@/redux/slices/locationSlice';
import scheduleReducer from '@/redux/slices/scheduleSlice';
import leaveReducer from './slices/leaveSlice';
import seasonReducer from './slices/seasonSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    teachers: teacherReducer,
    courseTypes: courseTypeReducer,
    locations: locationReducer,
    schedules: scheduleReducer,
    leaves: leaveReducer,
    seasons: seasonReducer,
    // Add other reducers here
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      // Add any RTK Query API middleware here
    ),
});

setupListeners(store.dispatch);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 
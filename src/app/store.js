import { configureStore } from '@reduxjs/toolkit';
import deviceReducer from '../features/device/deviceSlice';

export default configureStore({
  reducer: {
    device: deviceReducer,
  },
});

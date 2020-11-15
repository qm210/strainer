import { configureStore } from '@reduxjs/toolkit';
import deviceReducer from '../features/device/deviceSlice';
import paramReducer from '../features/engine/paramSlice';

export default configureStore({
  reducer: {
    device: deviceReducer,
    param: paramReducer,
  },
});

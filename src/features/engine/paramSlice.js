import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    pw: .75,
    bitcrushRate: 1,
};

export const paramSlice = createSlice({
  name: 'params',
  initialState,
  reducers: {
    update: (state, action) => ({
        ...state,
        ...action.payload
    }),
  },
});

export const { update } = paramSlice.actions;

export default paramSlice.reducer;

import { createSlice } from '@reduxjs/toolkit';

export const paramSlice = createSlice({
  name: 'params',
  initialState: {},
  reducers: {
    update: (state, action) => ({
        ...state,
        ...action.payload,
    }),
    updateSingle: (state, {payload: {name, key, value}}) => ({
        ...state,
        [name]: {
            ...state[name],
            [key]: {
                ...state[name][key],
                value
            }
        }
    })
  },
});

export default paramSlice.reducer;

export const { update, updateSingle } = paramSlice.actions;

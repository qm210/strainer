import { createSlice } from '@reduxjs/toolkit';
import { STATUS } from '../../app/constants';

const initialState = {
    all: [],
    current: null,
    status: STATUS.NOT_INITIALIZED,
    error: null,
  };

export const deviceSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    set: (state, action) => {
        state.all = action.payload.all || state.all;
        state.current = action.payload.current || state.current;
        if (state.current) {
            state.error = null;
            state.status = STATUS.OK;
        }
    },
    setError: (state, action) => {
        if (!action.payload) {
            state.status = state.current ? STATUS.OK : STATUS.NOT_INITIALIZED;
            return;
        }
        state.error = action.payload;
        state.status = STATUS.ERROR;
    },
    reset: (state) => {
        state = initialState;
    },
    setCurrentByName: (state, action) => {
        state.current = state.all.find(it => it.name === action.payload);
    },
    setStatusRefresh: (state, action) => {
        if (state.status === STATUS.OK && action.payload !== false) {
            state.status = STATUS.NEED_REFRESH;
        }
        else if (state.status === STATUS.REFRESH && action.payload === false) {
            state.status = STATUS.OK;
        }
    }
  },
});

export const { set, setError, reset, setCurrentByName, setStatusRefresh } = deviceSlice.actions;

export default deviceSlice.reducer;

import { configureStore } from '@reduxjs/toolkit'
import clientsReducer from './clientSlice'
import suppliersReducer from './supplierSlice'

export const store = configureStore({
  reducer: {
    clients: clientsReducer,
    suppliers: suppliersReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

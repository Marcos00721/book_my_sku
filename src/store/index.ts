import { configureStore } from '@reduxjs/toolkit'
import clientsReducer from './clientSlice'
import customProductsReducer from './customProductSlice'
import suppliersReducer from './supplierSlice'

export const store = configureStore({
  reducer: {
    clients: clientsReducer,
    suppliers: suppliersReducer,
    customProducts: customProductsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

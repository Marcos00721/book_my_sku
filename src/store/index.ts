import { configureStore } from '@reduxjs/toolkit'
import clientsReducer from './clientSlice'
import customProductsReducer from './customProductSlice'
import suppliersReducer from './supplierSlice'

export const createWorkspaceStore = () => configureStore({
  reducer: {
    clients: clientsReducer,
    suppliers: suppliersReducer,
    customProducts: customProductsReducer,
  },
})

export type RootState = ReturnType<ReturnType<typeof createWorkspaceStore>['getState']>
export type AppDispatch = ReturnType<typeof createWorkspaceStore>['dispatch']

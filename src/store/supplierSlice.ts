import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { queryPath, readData } from '../services/workspace'
import type { Supplier, SupplierListResponse } from '../types/supplier'

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

export interface SuppliersState {
  suppliers: Supplier[]
  loading: boolean
  error: string | null
  organizationId: string | null
  loaded: boolean
}

const initialState: SuppliersState = {
  suppliers: [],
  loading: false,
  error: null,
  organizationId: null,
  loaded: false,
}

function organizationIdFromBase(base: string): string {
  const match = base.match(/\/organizations\/([^/]+)/)
  return match?.[1] ?? base
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return FALLBACK_ERROR
}

export type FetchSuppliersArg = {
  base: string
  force?: boolean
}

async function fetchAllSupplierPages(
  base: string,
  signal?: AbortSignal,
): Promise<Supplier[]> {
  const suppliers: Supplier[] = []
  let after: string | undefined
  do {
    const data = (await readData(
      queryPath(`${base}/suppliers`, {
        status: 'all',
        limit: 50,
        after,
      }),
      { signal },
    )) as SupplierListResponse
    suppliers.push(...(data.items || []))
    after = data.next || undefined
  } while (after)
  return suppliers
}

export const fetchSuppliers = createAsyncThunk<
  { suppliers: Supplier[]; organizationId: string },
  FetchSuppliersArg,
  { rejectValue: string; state: { suppliers: SuppliersState } }
>(
  'suppliers/fetchSuppliers',
  async ({ base }, { rejectWithValue, signal }) => {
    try {
      const suppliers = await fetchAllSupplierPages(base, signal)
      return {
        suppliers,
        organizationId: organizationIdFromBase(base),
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error as { name?: string }).name === 'CanceledError'
      ) {
        throw error
      }
      if (signal?.aborted) throw error
      return rejectWithValue(errorMessage(error))
    }
  },
  {
    condition: ({ base, force }, { getState }) => {
      if (force) return true
      const state = getState().suppliers
      if (state.loading) return false
      const organizationId = organizationIdFromBase(base)
      if (state.loaded && state.organizationId === organizationId) return false
      return true
    },
  },
)

const supplierSlice = createSlice({
  name: 'suppliers',
  initialState,
  reducers: {
    clearSuppliers(state) {
      state.suppliers = []
      state.loading = false
      state.error = null
      state.organizationId = null
      state.loaded = false
    },
    upsertSupplier(state, action: PayloadAction<Supplier>) {
      const index = state.suppliers.findIndex(
        (supplier) => supplier._id === action.payload._id,
      )
      if (index >= 0) state.suppliers[index] = action.payload
      else state.suppliers.unshift(action.payload)
      state.loaded = true
      if (!state.organizationId && action.payload.organizationId) {
        state.organizationId = action.payload.organizationId
      }
    },
    removeSupplier(state, action: PayloadAction<string>) {
      state.suppliers = state.suppliers.filter(
        (supplier) => supplier._id !== action.payload,
      )
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuppliers.pending, (state, action) => {
        state.loading = true
        state.error = null
        const nextOrg = organizationIdFromBase(action.meta.arg.base)
        if (state.organizationId && state.organizationId !== nextOrg) {
          state.suppliers = []
          state.loaded = false
        }
        state.organizationId = nextOrg
      })
      .addCase(fetchSuppliers.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        state.suppliers = action.payload.suppliers
        state.organizationId = action.payload.organizationId
        state.loaded = true
      })
      .addCase(fetchSuppliers.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.loading = false
          return
        }
        state.loading = false
        state.error = action.payload || FALLBACK_ERROR
      })
  },
})

export const { clearSuppliers, upsertSupplier, removeSupplier } =
  supplierSlice.actions

export const selectSuppliers = (state: { suppliers: SuppliersState }) =>
  state.suppliers.suppliers
export const selectSuppliersLoading = (state: { suppliers: SuppliersState }) =>
  state.suppliers.loading
export const selectSuppliersError = (state: { suppliers: SuppliersState }) =>
  state.suppliers.error
export const selectSuppliersLoaded = (state: { suppliers: SuppliersState }) =>
  state.suppliers.loaded
export const selectSuppliersOrganizationId = (state: {
  suppliers: SuppliersState
}) => state.suppliers.organizationId

export default supplierSlice.reducer

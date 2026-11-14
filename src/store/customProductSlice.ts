import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { fetchAllCustomProducts } from '../services/customProductApi'
import type { CustomProduct } from '../types/customProduct'

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

interface CustomProductsState {
  products: CustomProduct[]
  loading: boolean
  error: string | null
  organizationId: string | null
  loaded: boolean
}

const initialState: CustomProductsState = {
  products: [],
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

type FetchCustomProductsArg = {
  base: string
  force?: boolean
}

export const fetchCustomProducts = createAsyncThunk<
  { products: CustomProduct[]; organizationId: string },
  FetchCustomProductsArg,
  { rejectValue: string; state: { customProducts: CustomProductsState } }
>(
  'customProducts/fetchCustomProducts',
  async ({ base }, { rejectWithValue, signal }) => {
    try {
      const products = await fetchAllCustomProducts(base, signal)
      return {
        products,
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
      const state = getState().customProducts
      if (state.loading) return false
      const organizationId = organizationIdFromBase(base)
      if (state.loaded && state.organizationId === organizationId) return false
      return true
    },
  },
)

const customProductSlice = createSlice({
  name: 'customProducts',
  initialState,
  reducers: {
    clearCustomProducts(state) {
      state.products = []
      state.loading = false
      state.error = null
      state.organizationId = null
      state.loaded = false
    },
    upsertCustomProduct(state, action: PayloadAction<CustomProduct>) {
      const index = state.products.findIndex(
        (product) => product.id === action.payload.id,
      )
      if (index >= 0) state.products[index] = action.payload
      else state.products.unshift(action.payload)
      state.loaded = true
      if (!state.organizationId && action.payload.organizationId) {
        state.organizationId = action.payload.organizationId
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomProducts.pending, (state, action) => {
        state.loading = true
        state.error = null
        const nextOrg = organizationIdFromBase(action.meta.arg.base)
        if (state.organizationId && state.organizationId !== nextOrg) {
          state.products = []
          state.loaded = false
        }
        state.organizationId = nextOrg
      })
      .addCase(fetchCustomProducts.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        state.products = action.payload.products
        state.organizationId = action.payload.organizationId
        state.loaded = true
      })
      .addCase(fetchCustomProducts.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.loading = false
          return
        }
        state.loading = false
        state.error = action.payload || FALLBACK_ERROR
      })
  },
})

export const { clearCustomProducts, upsertCustomProduct } =
  customProductSlice.actions

export const selectCustomProducts = (state: {
  customProducts: CustomProductsState
}) => state.customProducts.products
export const selectCustomProductsLoading = (state: {
  customProducts: CustomProductsState
}) => state.customProducts.loading
export const selectCustomProductsError = (state: {
  customProducts: CustomProductsState
}) => state.customProducts.error
export const selectCustomProductsLoaded = (state: {
  customProducts: CustomProductsState
}) => state.customProducts.loaded
export const selectCustomProductsOrganizationId = (state: {
  customProducts: CustomProductsState
}) => state.customProducts.organizationId

export default customProductSlice.reducer

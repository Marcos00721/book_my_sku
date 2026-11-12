import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'
import { queryPath, readData } from '../services/workspace'
import type { Client, ClientListResponse } from '../types/client'

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

export interface ClientsState {
  clients: Client[]
  loading: boolean
  error: string | null
  organizationId: string | null
  loaded: boolean
}

const initialState: ClientsState = {
  clients: [],
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

export type FetchClientsArg = {
  base: string
  force?: boolean
}

async function fetchAllClientPages(
  base: string,
  signal?: AbortSignal,
): Promise<Client[]> {
  const clients: Client[] = []
  let after: string | undefined
  do {
    const data = (await readData(
      queryPath(`${base}/clients`, {
        state: 'all',
        limit: 50,
        after,
      }),
      { signal },
    )) as ClientListResponse
    clients.push(...(data.items || []))
    after = data.next || undefined
  } while (after)
  return clients
}

export const fetchClients = createAsyncThunk<
  { clients: Client[]; organizationId: string },
  FetchClientsArg,
  { rejectValue: string; state: { clients: ClientsState } }
>(
  'clients/fetchClients',
  async ({ base }, { rejectWithValue, signal }) => {
    try {
      const clients = await fetchAllClientPages(base, signal)
      return {
        clients,
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
      const state = getState().clients
      if (state.loading) return false
      const organizationId = organizationIdFromBase(base)
      if (state.loaded && state.organizationId === organizationId) return false
      return true
    },
  },
)

const clientSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    clearClients(state) {
      state.clients = []
      state.loading = false
      state.error = null
      state.organizationId = null
      state.loaded = false
    },
    upsertClient(state, action: PayloadAction<Client>) {
      const index = state.clients.findIndex(
        (client) => client._id === action.payload._id,
      )
      if (index >= 0) state.clients[index] = action.payload
      else state.clients.unshift(action.payload)
      state.loaded = true
      if (!state.organizationId && action.payload.organizationId) {
        state.organizationId = action.payload.organizationId
      }
    },
    removeClient(state, action: PayloadAction<string>) {
      state.clients = state.clients.filter(
        (client) => client._id !== action.payload,
      )
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClients.pending, (state, action) => {
        state.loading = true
        state.error = null
        const nextOrg = organizationIdFromBase(action.meta.arg.base)
        if (state.organizationId && state.organizationId !== nextOrg) {
          state.clients = []
          state.loaded = false
        }
        state.organizationId = nextOrg
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        state.clients = action.payload.clients
        state.organizationId = action.payload.organizationId
        state.loaded = true
      })
      .addCase(fetchClients.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.loading = false
          return
        }
        state.loading = false
        state.error = action.payload || FALLBACK_ERROR
      })
  },
})

export const { clearClients, upsertClient, removeClient } = clientSlice.actions

export const selectClients = (state: { clients: ClientsState }) =>
  state.clients.clients
export const selectClientsLoading = (state: { clients: ClientsState }) =>
  state.clients.loading
export const selectClientsError = (state: { clients: ClientsState }) =>
  state.clients.error
export const selectClientsLoaded = (state: { clients: ClientsState }) =>
  state.clients.loaded
export const selectClientsOrganizationId = (state: {
  clients: ClientsState
}) => state.clients.organizationId

export default clientSlice.reducer

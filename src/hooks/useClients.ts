import { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch } from '../store'
import {
  clearClients,
  fetchClients,
  removeClient,
  selectClients,
  selectClientsError,
  selectClientsLoaded,
  selectClientsLoading,
  selectClientsOrganizationId,
  upsertClient,
} from '../store/clientSlice'
import type { Client } from '../types/client'
import { useWorkspace } from './WorkspaceContext'

function organizationIdFromBase(base: string | null | undefined): string | null {
  if (!base) return null
  const match = base.match(/\/organizations\/([^/]+)/)
  return match?.[1] ?? null
}

export function useClients(options: { autoFetch?: boolean } = {}) {
  const { autoFetch = true } = options
  const workspace = useWorkspace()
  const dispatch = useDispatch<AppDispatch>()
  const clients = useSelector(selectClients)
  const loading = useSelector(selectClientsLoading)
  const error = useSelector(selectClientsError)
  const loaded = useSelector(selectClientsLoaded)
  const storedOrganizationId = useSelector(selectClientsOrganizationId)
  const base = workspace.base
  const organizationId = organizationIdFromBase(base)

  useEffect(() => {
    if (!autoFetch || !base || !organizationId) return
    if (storedOrganizationId && storedOrganizationId !== organizationId) {
      dispatch(clearClients())
    }
    void dispatch(fetchClients({ base }))
  }, [autoFetch, base, dispatch, organizationId, storedOrganizationId])

  const refetch = useCallback(() => {
    if (!base) return Promise.resolve()
    return dispatch(fetchClients({ base, force: true }))
  }, [base, dispatch])

  const saveClient = useCallback(
    (client: Client) => {
      dispatch(upsertClient(client))
    },
    [dispatch],
  )

  const deleteClient = useCallback(
    (clientId: string) => {
      dispatch(removeClient(clientId))
    },
    [dispatch],
  )

  return {
    clients,
    loading,
    error,
    loaded,
    refetch,
    saveClient,
    deleteClient,
  }
}

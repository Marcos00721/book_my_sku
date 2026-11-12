import { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch } from '../store'
import {
  clearSuppliers,
  fetchSuppliers,
  removeSupplier,
  selectSuppliers,
  selectSuppliersError,
  selectSuppliersLoaded,
  selectSuppliersLoading,
  selectSuppliersOrganizationId,
  upsertSupplier,
} from '../store/supplierSlice'
import type { Supplier } from '../types/supplier'
import { useWorkspace } from './WorkspaceContext'

function organizationIdFromBase(base: string | null | undefined): string | null {
  if (!base) return null
  const match = base.match(/\/organizations\/([^/]+)/)
  return match?.[1] ?? null
}

export function useSuppliers(options: { autoFetch?: boolean } = {}) {
  const { autoFetch = true } = options
  const workspace = useWorkspace()
  const dispatch = useDispatch<AppDispatch>()
  const suppliers = useSelector(selectSuppliers)
  const loading = useSelector(selectSuppliersLoading)
  const error = useSelector(selectSuppliersError)
  const loaded = useSelector(selectSuppliersLoaded)
  const storedOrganizationId = useSelector(selectSuppliersOrganizationId)
  const base = workspace.base
  const organizationId = organizationIdFromBase(base)

  useEffect(() => {
    if (!autoFetch || !base || !organizationId) return
    if (storedOrganizationId && storedOrganizationId !== organizationId) {
      dispatch(clearSuppliers())
    }
    void dispatch(fetchSuppliers({ base }))
  }, [autoFetch, base, dispatch, organizationId, storedOrganizationId])

  const refetch = useCallback(() => {
    if (!base) return Promise.resolve()
    return dispatch(fetchSuppliers({ base, force: true }))
  }, [base, dispatch])

  const saveSupplier = useCallback(
    (supplier: Supplier) => {
      dispatch(upsertSupplier(supplier))
    },
    [dispatch],
  )

  const deleteSupplier = useCallback(
    (supplierId: string) => {
      dispatch(removeSupplier(supplierId))
    },
    [dispatch],
  )

  return {
    suppliers,
    loading,
    error,
    loaded,
    refetch,
    saveSupplier,
    deleteSupplier,
  }
}

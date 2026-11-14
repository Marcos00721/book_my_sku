import { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch } from '../store'
import {
  clearCustomProducts,
  fetchCustomProducts,
  selectCustomProducts,
  selectCustomProductsError,
  selectCustomProductsLoaded,
  selectCustomProductsLoading,
  selectCustomProductsOrganizationId,
  upsertCustomProduct,
} from '../store/customProductSlice'
import type { CustomProduct } from '../types/customProduct'
import { useWorkspace } from './WorkspaceContext'

function organizationIdFromBase(
  base: string | null | undefined,
): string | null {
  if (!base) return null
  const match = base.match(/\/organizations\/([^/]+)/)
  return match?.[1] ?? null
}

export function useCustomProducts(options: { autoFetch?: boolean } = {}) {
  const { autoFetch = true } = options
  const workspace = useWorkspace()
  const dispatch = useDispatch<AppDispatch>()
  const products = useSelector(selectCustomProducts)
  const loading = useSelector(selectCustomProductsLoading)
  const error = useSelector(selectCustomProductsError)
  const loaded = useSelector(selectCustomProductsLoaded)
  const storedOrganizationId = useSelector(selectCustomProductsOrganizationId)
  const base = workspace.base
  const organizationId = organizationIdFromBase(base)

  useEffect(() => {
    if (!autoFetch || !base || !organizationId) return
    if (storedOrganizationId && storedOrganizationId !== organizationId) {
      dispatch(clearCustomProducts())
    }
    void dispatch(fetchCustomProducts({ base }))
  }, [autoFetch, base, dispatch, organizationId, storedOrganizationId])

  const refetch = useCallback(() => {
    if (!base) return Promise.resolve()
    return dispatch(fetchCustomProducts({ base, force: true }))
  }, [base, dispatch])

  const saveProduct = useCallback(
    (product: CustomProduct) => {
      dispatch(upsertCustomProduct(product))
    },
    [dispatch],
  )

  return {
    products,
    loading,
    error,
    loaded,
    refetch,
    saveProduct,
  }
}

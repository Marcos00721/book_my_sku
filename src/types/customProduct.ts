export type CustomProductStatus = 'draft' | 'active' | 'archived' | string

export interface CustomProductSupplierRef {
  id: string
  name: string
  supplierCode?: string | null
  status?: string
  eligible?: boolean
}

export interface CustomProductCategoryRef {
  id: string
  label: string
  status?: string
  revision?: number
}

export interface CustomProductReadiness {
  status?: string
  activationBlockers?: string[]
  restoreBlockers?: Array<{ code: string; field?: string }>
  warnings?: string[]
}

export interface CustomProductConfiguration {
  mode: 'unresolved' | 'single' | 'variants'
  dimensions: Array<{
    id: string
    label: string
    values: Array<{ id: string; label: string }>
  }>
  customIdentification?: string | null
}

export interface CustomProductUnits {
  baseUnit?: 'item'
  salesUnit: string
  procurementUnit: string
  salesUnitsPerProcurementUnit: number
  procurementMinimum?: number | null
  procurementMultiple?: number | null
}

export interface CustomProductVariant {
  id: string
  status: 'selectable' | 'archived'
  selections: Array<{
    dimensionId: string
    valueId: string
    dimensionLabel: string
    valueLabel: string
  }>
  partCode: string | null
  units: CustomProductUnits | null
}

export interface CustomProduct {
  id: string
  productCode: string
  supplierId: string
  name: string
  supplierItemCode?: string | null
  categoryId?: string | null
  description?: string | null
  privateNotes?: string | null
  status: CustomProductStatus
  revision: number
  createdAt?: string | null
  updatedAt?: string | null
  organizationId?: string
  supplier?: CustomProductSupplierRef | null
  category?: CustomProductCategoryRef | null
  readiness?: CustomProductReadiness | null
  configuration?: CustomProductConfiguration
  selectableVariantCount?: number
  catalogSelectable?: boolean
}

export interface CustomProductListResponse {
  items: CustomProduct[]
  next?: string | null
}

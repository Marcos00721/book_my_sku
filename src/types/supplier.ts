export type SupplierStatus = 'active' | 'archived' | string

export type SupplierCapability = 'supplier' | 'decorator' | 'fulfillment'

export interface Supplier {
  _id: string
  organizationId?: string
  createdBy?: string
  name: string
  status: SupplierStatus
  revision: number
  createdAt: string | null
  updatedAt?: string | null
  supplierCode?: string | null
  capabilities: SupplierCapability[] | string[]
  website?: string | null
  email?: string | null
  phone?: string | null
  accountNumber?: string | null
  normalizedName?: string
}

export interface SupplierListResponse {
  items: Supplier[]
  next?: string | null
}

export type SupplierListStatusFilter = 'active' | 'archived' | 'all'

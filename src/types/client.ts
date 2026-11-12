export type ClientStatus = 'active' | 'archived' | string

export interface Client {
  _id: string
  organizationId: string
  createdBy?: string
  name: string
  status: ClientStatus
  __v: number
  createdAt: string | null
  updatedAt?: string | null
  clientCode?: string | null
  website?: string | null
  accountLabel?: string | null
  industryId?: string | null
  defaultBillingAddressId?: string | null
  defaultShippingAddressId?: string | null
  normalizedName?: string
  searchVersion?: number
}

export interface ClientListResponse {
  items: Client[]
  next?: string | null
}

export type ClientListStateFilter = 'active' | 'archived' | 'all'

/** Values for add/edit client forms (RHF). */
export interface ClientFormValues {
  name: string
  accountLabel: string
  website: string
  industryId: string
}

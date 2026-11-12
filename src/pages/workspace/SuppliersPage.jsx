import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useSuppliers } from '../../hooks/useSuppliers'
import { SupplierEditor } from '../../components/suppliers/SupplierEditor'
import { SupplierSearch } from '../../components/suppliers/SupplierSearch'
import { SupplierTable } from '../../components/suppliers/SupplierTable'
import { OffsetPager } from '../../components/workspace/OffsetPager'
import {
  Action,
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  PermissionDenied,
} from '../../components/workspace/Elements'

const PAGE_SIZE = 25

function matchesSearch(supplier, search, searchBy) {
  if (!search) return true
  const needle = search.trim()
  if (!needle) return true
  if (searchBy === 'code') {
    return (
      String(supplier.supplierCode || '').toUpperCase() === needle.toUpperCase()
    )
  }
  return String(supplier.name || '')
    .toLowerCase()
    .startsWith(needle.toLowerCase())
}

export function SuppliersPage() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const canView = workspace.can('suppliers.view')
  const { suppliers, loading, error, refetch, saveSupplier } = useSuppliers({
    autoFetch: canView,
  })
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState('active')
  const [capability, setCapability] = useState('')
  const [searchBy, setSearchBy] = useState('name')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    return suppliers.filter((supplier) => {
      const statusOk =
        status === 'all' ? true : (supplier.status || 'active') === status
      const capabilityOk = capability
        ? (supplier.capabilities || []).includes(capability)
        : true
      return (
        statusOk && capabilityOk && matchesSearch(supplier, search, searchBy)
      )
    })
  }, [suppliers, search, searchBy, status, capability])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  if (!canView) return <PermissionDenied />

  const create = workspace.can('suppliers.create') &&
    workspace.writesAllowed && (
      <Action onClick={() => setCreating(true)}>
        <Plus size={16} />
        Add supplier
      </Action>
    )

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Keep supplier and decorator details together, with the people and places behind each relationship."
        actions={create}
      />
      <section className="panel">
        <SupplierSearch
          draft={draft}
          onDraftChange={setDraft}
          activeSearch={Boolean(search)}
          searchBy={searchBy}
          onSearchByChange={(value) => {
            setSearchBy(value)
            setPage(0)
          }}
          status={status}
          capability={capability}
          refreshing={loading}
          onRefresh={() => refetch()}
          onStatusChange={(value) => {
            setStatus(value)
            setPage(0)
          }}
          onCapabilityChange={(value) => {
            setCapability(value)
            setPage(0)
          }}
          onSubmit={() => {
            setSearch(draft.trim())
            setPage(0)
          }}
          onClear={() => {
            setDraft('')
            setSearch('')
            setPage(0)
          }}
        />
        <ErrorNotice
          error={
            error
              ? { message: error || 'Something went wrong. Please try again.' }
              : null
          }
          retry={() => refetch()}
        />
        {loading && !suppliers.length ? (
          <Loading label="Loading suppliers…" />
        ) : pageItems.length ? (
          <>
            <SupplierTable suppliers={pageItems} />
            <OffsetPager
              total={filtered.length}
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
              label="supplier"
              matchingLabel={search ? ' matching search' : ''}
            />
          </>
        ) : (
          !error && (
            <Empty
              title={
                search || status !== 'active' || capability
                  ? 'No matching suppliers'
                  : 'No suppliers yet'
              }
              action={
                search || status !== 'active' || capability ? null : create
              }
            >
              {search || status !== 'active' || capability
                ? 'Try another name, code, status, or business type.'
                : 'Add a supplier or decorator to start your directory.'}
            </Empty>
          )
        )}
      </section>
      {creating && (
        <SupplierEditor
          close={() => setCreating(false)}
          saved={(supplier) => {
            saveSupplier(supplier)
            setCreating(false)
            navigate(`/app/suppliers/${supplier._id}`)
          }}
          path={`${workspace.base}/suppliers`}
        />
      )}
    </>
  )
}

export { SupplierEditor } from '../../components/suppliers/SupplierEditor'

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { CustomProductForm } from '../../components/customProducts/CustomProductForm'
import { CustomProductSearch } from '../../components/customProducts/CustomProductSearch'
import { CustomProductTable } from '../../components/customProducts/CustomProductTable'
import { OffsetPager } from '../../components/workspace/OffsetPager'
import {
  Action,
  Empty,
  ErrorNotice,
  ListSkeleton,
  PageHeader,
  PermissionDenied,
} from '../../components/workspace/Elements'
import { useCustomProducts } from '../../hooks/useCustomProducts'
import { useWorkspace } from '../../hooks/WorkspaceContext'

const PAGE_SIZE = 25

function matchesSearch(product, search) {
  if (!search) return true
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return (
    product.name?.toLowerCase().startsWith(needle) ||
    product.productCode?.toLowerCase().includes(needle) ||
    product.supplierItemCode?.toLowerCase().includes(needle)
  )
}

export function CustomProductsPage() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const canView = workspace.can('products.view')
  const { products, loading, loaded, error, refetch, saveProduct } = useCustomProducts({
    autoFetch: canView,
  })
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState('all')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const statusOk =
        status === 'all' ? true : (product.status || 'draft') === status
      return statusOk && matchesSearch(product, search)
    })
  }, [products, search, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  if (!canView) return <PermissionDenied />

  const create = workspace.can('products.create') &&
    workspace.writesAllowed && (
      <Action onClick={() => setCreating(true)}>
        <Plus size={17} />
        Create
      </Action>
    )

  return (
    <>
      <PageHeader
        title="Products"
        description="Supplier-linked products, configurations and saved commercial terms."
        actions={create}
      />
      <section className="panel">
        <CustomProductSearch
          draft={draft}
          onDraftChange={setDraft}
          activeSearch={Boolean(search)}
          status={status}
          refreshing={loading}
          onRefresh={() => refetch()}
          onStatusChange={(value) => {
            setStatus(value)
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
        {loading || (!loaded && !error) ? (
          <ListSkeleton label="Loading products…" columns={['Product', 'Supplier', 'Supplier SKU', 'Category', 'Status', 'Added', '']} thumbnail />
        ) : pageItems.length ? (
          <>
            <CustomProductTable products={pageItems} />
            <OffsetPager
              total={filtered.length}
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
              label="product"
              matchingLabel={search ? ' matching search' : ''}
            />
          </>
        ) : (
          !error && (
            <Empty
              title={
                search || status !== 'all'
                  ? 'No matching products'
                  : 'No custom products yet'
              }
              action={search || status !== 'all' ? null : create}
            >
              {search || status !== 'all'
                ? 'Try another name, code, or status filter.'
                : 'Add the first product draft linked to a supplier.'}
            </Empty>
          )
        )}
      </section>
      {creating && workspace.base ? (
        <CustomProductForm
          productsBase={`${workspace.base}`}
          close={() => setCreating(false)}
          saved={(product) => {
            saveProduct(product)
            setCreating(false)
            navigate(`/app/products/${product.id}`, {
              state: { flash: 'Product draft saved.' },
            })
          }}
        />
      ) : null}
    </>
  )
}

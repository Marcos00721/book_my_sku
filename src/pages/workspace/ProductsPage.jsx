import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  PermissionDenied,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'
import {
  ActivityHistory,
  ConflictReview,
  Pager,
  ReferenceSelect,
  MutationRetry,
} from '../../components/workspace/RecordTools'
import { SupplierEditor } from './SuppliersPage'

export function ProductsPage() {
  const workspace = useWorkspace()
  if (!workspace.can('products.view')) return <PermissionDenied />
  return <ProductDirectory />
}

function ProductDirectory() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const base = `${workspace.base}/products`
  const [filters, setFilters] = useState({
    search: '',
    searchBy: 'name',
    status: 'draft',
    supplierId: '',
    categoryId: '',
  })
  const [pages, setPages] = useState([])
  const [creating, setCreating] = useState(false)
  const resource = useResource(
    queryPath(base, { ...filters, limit: 25, after: pages.at(-1) }),
  )
  const set = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPages([])
  }
  return (
    <>
      <PageHeader
        title="Products"
        description="Supplier-linked product drafts for your workspace."
        actions={
          workspace.can('products.create') &&
          workspace.writesAllowed && (
            <Action onClick={() => setCreating(true)}>Add product</Action>
          )
        }
      />
      <p className="notice">
        Products are drafts. Pricing, variants, media, stock and order use are
        not available yet.
      </p>
      <section className="panel">
        <div className="toolbar">
          <Field
            label="Find products"
            maxLength={80}
            value={filters.search}
            onChange={(event) => set('search', event.target.value)}
          />
          <Field
            label="Search by"
            value={filters.searchBy}
            onChange={(event) => set('searchBy', event.target.value)}
          >
            <option value="name">Name prefix</option>
            <option value="code">Exact product code</option>
            <option value="supplierItemCode">Exact supplier item code</option>
          </Field>
          <Field
            label="Product status"
            value={filters.status}
            onChange={(event) => set('status', event.target.value)}
          >
            {['draft', 'archived', 'all'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Field>
          <Action variant="secondary" onClick={resource.reload}>
            Refresh
          </Action>
        </div>
        <details>
          <summary>Filter by supplier or category</summary>
          <div className="form-grid">
            <ReferenceSelect
              path={`${base}/supplier-options`}
              label="Supplier filter"
              value={filters.supplierId}
              onChange={(value) => set('supplierId', value)}
            />
            <ReferenceSelect
              path={`${base}/category-options`}
              label="Category filter"
              value={filters.categoryId}
              onChange={(value) => set('categoryId', value)}
            />
          </div>
        </details>
        <ErrorNotice
          error={resource.error}
          retry={() => {
            if (resource.error?.code === 'INVALID_CURSOR') setPages([])
            resource.reload()
          }}
        />
        {resource.loading ? (
          <Loading label="Loading products…" />
        ) : resource.data?.items?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Supplier</th>
                  <th>Supplier item code</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link
                        className="entity-link"
                        to={`/app/products/${product.id}`}
                      >
                        {product.name}
                      </Link>
                      <small>{product.productCode}</small>
                    </td>
                    <td>{product.supplier?.name || 'Supplier unavailable'}</td>
                    <td>{product.supplierItemCode || '—'}</td>
                    <td>{product.category?.label || '—'}</td>
                    <td>
                      <Status value={product.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !resource.error && (
            <Empty title="No products found">
              Add a supplier-linked draft or change the filters.
            </Empty>
          )
        )}
        <Pager
          resource={resource}
          pages={pages}
          setPages={setPages}
          label="products"
        />
      </section>
      {creating && (
        <ProductEditor
          base={base}
          close={() => setCreating(false)}
          saved={(product) => navigate(`/app/products/${product.id}`)}
        />
      )}
    </>
  )
}

export function ProductDetailPage() {
  const workspace = useWorkspace()
  const { productId } = useParams()
  if (!workspace.can('products.view')) return <PermissionDenied />
  return (
    <ProductRecord
      key={productId}
      base={`${workspace.base}/products`}
      id={productId}
    />
  )
}

function ProductRecord({ base, id }) {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const resource = useResource(`${base}/${encodeURIComponent(id)}`)
  const [editing, setEditing] = useState(false)
  const [copying, setCopying] = useState(false)
  const [tab, setTab] = useState('details')
  const mutation = useMutation()
  if (resource.loading) return <Loading label="Loading product…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const product = resource.data
  const isArchived = product.status === 'archived'
  async function lifecycle() {
    const action = isArchived ? 'restore' : 'archive'
    if (
      !window.confirm(
        `${isArchived ? 'Restore' : 'Archive'} ${product.name}? History and identifiers are retained.`,
      )
    )
      return
    if (
      await mutation.run('post', `${base}/${id}/${action}`, {
        expectedRevision: product.revision,
      })
    )
      resource.reload()
  }
  return (
    <>
      <Link className="back-link" to="/app/products">
        ← Back to products
      </Link>
      <PageHeader
        title={product.name}
        description={`${product.productCode} · Draft product`}
        actions={
          <div className="actions">
            {workspace.writesAllowed && (
              <>
                {!isArchived && workspace.can('products.edit') && (
                  <Action variant="secondary" onClick={() => setEditing(true)}>
                    Edit product
                  </Action>
                )}
                {workspace.can('products.create') && (
                  <Action variant="secondary" onClick={() => setCopying(true)}>
                    Copy product
                  </Action>
                )}
                {workspace.can(
                  isArchived ? 'products.restore' : 'products.archive',
                ) && (
                  <Action
                    variant="secondary"
                    disabled={
                      mutation.pending ||
                      mutation.uncertain ||
                      (isArchived &&
                        product.readiness?.restoreBlockers?.length > 0)
                    }
                    onClick={lifecycle}
                  >
                    {isArchived ? 'Restore product' : 'Archive product'}
                  </Action>
                )}
              </>
            )}
          </div>
        }
      />
      <ErrorNotice error={mutation.error} retry={resource.reload} />
      <MutationRetry mutation={mutation} saved={resource.reload} />
      <Status value={product.status} />
      {product.readiness?.restoreBlockers?.map((blocker) => (
        <p className="notice" key={blocker.code}>
          {blocker.code === 'SUPPLIER_NOT_SELECTABLE'
            ? 'The supplier must be active and supply products before restoring this draft.'
            : 'The category must be active before restoring this draft.'}
        </p>
      ))}
      <div className="tabs" role="tablist" aria-label="Product information">
        <button
          role="tab"
          aria-selected={tab === 'details'}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        {workspace.can('products.history.view') && (
          <button
            role="tab"
            aria-selected={tab === 'activity'}
            onClick={() => setTab('activity')}
          >
            Activity
          </button>
        )}
      </div>
      <section className="panel" role="tabpanel">
        {tab === 'activity' ? (
          workspace.can('products.history.view') ? (
            <ActivityHistory path={`${base}/${id}/activity`} />
          ) : (
            <PermissionDenied />
          )
        ) : (
          <>
            <h2>Product details</h2>
            <dl className="detail-list">
              {[
                ['Supplier', product.supplier?.name],
                ['Supplier item code', product.supplierItemCode],
                ['Category', product.category?.label],
                ['Description', product.description],
                ['Private notes', product.privateNotes],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <p className="notice">
              This draft is not ready for orders. Private notes are visible only
              to authorized workspace product users.
            </p>
          </>
        )}
      </section>
      {editing && (
        <ProductEditor
          base={base}
          product={product}
          close={() => setEditing(false)}
          saved={() => {
            setEditing(false)
            resource.reload()
          }}
        />
      )}
      {copying && (
        <ProductCopy
          base={base}
          product={product}
          close={() => setCopying(false)}
          saved={(copy) => navigate(`/app/products/${copy.id}`)}
        />
      )}
    </>
  )
}

function ProductEditor({ base, product, close, saved }) {
  const workspace = useWorkspace()
  const [values, setValues] = useState({
    name: product?.name || '',
    supplierId: product?.supplierId || '',
    supplierItemCode: product?.supplierItemCode || '',
    categoryId: product?.categoryId || '',
    description: product?.description || '',
    privateNotes: product?.privateNotes || '',
  })
  const [revision, setRevision] = useState(product?.revision)
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState(null)
  const mutation = useMutation()
  const set = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }))
  async function save(event) {
    event.preventDefault()
    const fields = Object.fromEntries(
      Object.entries(values)
        .filter(([key]) => key !== 'supplierId')
        .map(([key, value]) => [key, value.trim() || null]),
    )
    const body = product
      ? {
          ...Object.fromEntries(
            Object.entries(fields).filter(
              ([key, value]) => value !== product[key],
            ),
          ),
          expectedRevision: revision,
        }
      : { ...fields, supplierId: values.supplierId }
    const result = await mutation.run(
      product ? 'patch' : 'post',
      `${base}${product ? `/${product.id}` : ''}`,
      body,
    )
    if (result) saved(result.data)
  }
  return (
    <Dialog
      title={product ? 'Edit product draft' : 'Add product draft'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={save}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <Field
            label="Product name"
            required
            maxLength={160}
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
          />
          {product ? (
            <p>
              Supplier: {product.supplier?.name}. To change supplier, copy this
              draft.
            </p>
          ) : (
            <>
              <ReferenceSelect
                key={newSupplier?._id || 'suppliers'}
                path={`${base}/supplier-options`}
                label="Supplier"
                required
                value={values.supplierId}
                selectedLabel={newSupplier?.name}
                onChange={(value) => set('supplierId', value)}
              />
              {workspace.can('suppliers.create') && (
                <Action
                  variant="text-button"
                  onClick={() => setAddingSupplier(true)}
                >
                  Add supplier without losing this draft
                </Action>
              )}
            </>
          )}
          <Field
            label="Supplier item code (optional)"
            maxLength={120}
            value={values.supplierItemCode}
            onChange={(event) => set('supplierItemCode', event.target.value)}
          />
          <p className="muted">
            Leading zeros and capitalization are preserved. Used supplier item
            codes remain reserved.
          </p>
          <ReferenceSelect
            path={`${base}/category-options`}
            label="Product category"
            value={values.categoryId}
            selectedLabel={product?.category?.label}
            onChange={(value) => set('categoryId', value)}
          />
          {[
            ['description', 'Description'],
            ['privateNotes', 'Private notes'],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={`${label} (optional)`}
              maxLength={4000}
              value={values[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          ))}
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={product ? `${base}/${product.id}` : null}
          values={values}
          onReview={(current) => setRevision(current.revision)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!values.supplierId}
          label="Save draft"
        />
      </form>
      {addingSupplier && (
        <SupplierEditor
          requiredCapability="supplier"
          path={`${workspace.base}/suppliers`}
          close={() => setAddingSupplier(false)}
          saved={(supplier) => {
            setNewSupplier(supplier)
            set('supplierId', supplier._id)
            setAddingSupplier(false)
          }}
        />
      )}
    </Dialog>
  )
}

function ProductCopy({ base, product, close, saved }) {
  const [supplierId, setSupplier] = useState(
    product.supplier?.eligible ? product.supplierId : '',
  )
  const [sku, setSku] = useState('')
  const [revision, setRevision] = useState(product.revision)
  const mutation = useMutation()
  async function copy(event) {
    event.preventDefault()
    const result = await mutation.run('post', `${base}/${product.id}/copy`, {
      expectedRevision: revision,
      supplierId,
      supplierItemCode: sku.trim() || null,
    })
    if (result) saved(result.data)
  }
  return (
    <Dialog
      title="Copy product draft"
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <p>
        The original stays unchanged. The copy receives a new product code and
        history. Private notes are copied.
      </p>
      <form onSubmit={copy}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <ReferenceSelect
            path={`${base}/supplier-options`}
            label="Destination supplier"
            value={supplierId}
            required
            selectedLabel={product.supplier?.name}
            onChange={setSupplier}
          />
          <Field
            label="New supplier item code (optional)"
            maxLength={120}
            value={sku}
            onChange={(event) => setSku(event.target.value)}
          />
        </fieldset>
        <ConflictReview
          error={mutation.error}
          path={`${base}/${product.id}`}
          values={{ supplierId, supplierItemCode: sku }}
          onReview={(current) => setRevision(current.revision)}
        />
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={!supplierId}
          label="Create copy"
        />
      </form>
    </Dialog>
  )
}

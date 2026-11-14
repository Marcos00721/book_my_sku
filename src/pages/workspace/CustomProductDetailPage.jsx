import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CustomProductCopy } from '../../components/customProducts/CustomProductCopy'
import { CustomProductForm } from '../../components/customProducts/CustomProductForm'
import { TextLink } from '../../components/common/TextLink'
import { askConfirm } from '../../components/common/confirm'
import {
  Action,
  ErrorNotice,
  Loading,
  PermissionDenied,
  Status,
  StickyPageChrome,
} from '../../components/workspace/Elements'
import {
  ActivityHistory,
  MutationRetry,
} from '../../components/workspace/RecordTools'
import { useCustomProducts } from '../../hooks/useCustomProducts'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { customProductPaths } from '../../services/customProductApi'
import { ProductConfiguration } from './ProductConfiguration'
import { ProductMedia } from './ProductMedia'
import { ProductPricing } from '../../components/productPricing/ProductPricing'

export function CustomProductDetailPage() {
  const workspace = useWorkspace()
  const { productId } = useParams()
  if (!workspace.can('products.view')) return <PermissionDenied />
  return <ProductRecord key={productId} id={productId} />
}

function ProductRecord({ id }) {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const productsBase = workspace.base
  const path = customProductPaths.detail(productsBase, id)
  const resource = useResource(path)
  const { saveProduct } = useCustomProducts({ autoFetch: false })
  const [flash, setFlash] = useState(location.state?.flash || '')
  const [tab, setTab] = useState('details')
  const [editing, setEditing] = useState(false)
  const [copying, setCopying] = useState(false)
  const mutation = useMutation()

  useEffect(() => {
    if (!location.state?.flash) return
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (resource.data?.id) saveProduct(resource.data)
  }, [resource.data, saveProduct])

  if (resource.loading) return <Loading label="Loading product…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />

  const product = resource.data
  const isArchived = product.status === 'archived'
  const pricingAllowed = ['edit', 'publish', 'preview'].some((action) =>
    workspace.can(`products.pricing.${action}`),
  )
  const activationBlockers = product.readiness?.activationBlockers || []

  async function lifecycle() {
    const action = isArchived ? 'restore' : 'archive'
    const ok = await askConfirm({
      title: isArchived ? 'Restore product?' : 'Archive product?',
      message: `${isArchived ? 'Restore' : 'Archive'} ${product.name}? History and identifiers are retained.`,
      confirmLabel: isArchived ? 'Restore' : 'Archive',
      cancelLabel: 'Cancel',
      tone: isArchived ? 'primary' : 'danger',
    })
    if (!ok) return
    const result = await mutation.run(
      'post',
      customProductPaths[action](productsBase, product.id),
      { expectedRevision: product.revision },
    )
    if (result?.data) {
      saveProduct(result.data)
      resource.reload()
      setFlash(isArchived ? 'Product restored as draft.' : 'Product archived.')
    }
  }

  const tabItems = [
    { value: 'details', label: 'Details' },
    { value: 'configuration', label: 'Variants' },
    { value: 'images', label: 'Images' },
    ...(pricingAllowed ? [{ value: 'pricing', label: 'Pricing' }] : []),
    ...(workspace.can('products.history.view')
      ? [{ value: 'activity', label: 'Activity' }]
      : []),
  ]

  return (
    <>
      <StickyPageChrome
        before={
          <>
            <TextLink to="/app/products" className="back-link">
              <ArrowLeft size={16} />
              Back to products
            </TextLink>
            {flash ? (
              <p className="client-flash notice" role="status">
                {flash}
              </p>
            ) : null}
          </>
        }
        title={product.name}
        description={`${product.productCode} · ${product.status} product`}
        actions={
          <div className="actions">
            {workspace.writesAllowed && (
              <>
                {workspace.owner &&
                  workspace.can('products.edit') &&
                  product.status === 'draft' && (
                    <Action
                      disabled={
                        mutation.pending ||
                        mutation.uncertain ||
                        activationBlockers.length > 0
                      }
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: 'Activate product?',
                          message:
                            'Activate this reviewed catalog product? This does not place an order or establish pricing.',
                          confirmLabel: 'Activate',
                          cancelLabel: 'Cancel',
                        })
                        if (!ok) return
                        if (
                          await mutation.run('post', `${path}/activate`, {
                            expectedRevision: product.revision,
                          })
                        )
                          resource.reload()
                      }}
                    >
                      Activate product
                    </Action>
                  )}
                {!isArchived && workspace.can('products.edit') && (
                  <Action variant="secondary" onClick={() => setEditing(true)}>
                    Edit
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
        meta={
          <>
            <ErrorNotice error={mutation.error} retry={resource.reload} />
            <MutationRetry mutation={mutation} saved={resource.reload} />
            <Status value={product.status} />
            {activationBlockers.length > 0 && (
              <p className="notice">
                Catalog activation needs:{' '}
                {activationBlockers
                  .map((code) => code.replaceAll('_', ' ').toLowerCase())
                  .join(', ')}
                .
              </p>
            )}
            {product.status === 'active' &&
              product.catalogSelectable === false && (
                <p className="notice">
                  This product is active but its current source references or
                  variants prevent catalog selection.
                </p>
              )}
            {product.readiness?.restoreBlockers?.map((blocker) => (
              <p className="notice" key={blocker.code}>
                {blocker.code === 'SUPPLIER_NOT_SELECTABLE'
                  ? 'The supplier must be active and supply products before restoring this draft.'
                  : 'The category must be active before restoring this draft.'}
              </p>
            ))}
          </>
        }
        tabs={{
          label: 'Product information',
          value: tab,
          onChange: setTab,
          items: tabItems,
        }}
      >
        <section className="panel" role="tabpanel">
          {tab === 'configuration' ? (
            <ProductConfiguration
              path={path}
              product={product}
              changed={resource.reload}
            />
          ) : tab === 'images' ? (
            <ProductMedia
              path={path}
              product={product}
              changed={resource.reload}
            />
          ) : tab === 'pricing' ? (
            pricingAllowed ? (
              <ProductPricing path={path} product={product} />
            ) : (
              <PermissionDenied />
            )
          ) : tab === 'activity' ? (
            workspace.can('products.history.view') ? (
              <ActivityHistory
                path={customProductPaths.activity(productsBase, product.id)}
              />
            ) : (
              <PermissionDenied />
            )
          ) : (
            <ProductOverview product={product} />
          )}
        </section>
      </StickyPageChrome>
      {editing ? (
        <CustomProductForm
          productsBase={productsBase}
          product={product}
          close={() => setEditing(false)}
          saved={(updated) => {
            saveProduct(updated)
            setEditing(false)
            resource.reload()
            setFlash('Product updated successfully.')
          }}
        />
      ) : null}
      {copying ? (
        <CustomProductCopy
          productsBase={productsBase}
          product={product}
          close={() => setCopying(false)}
          saved={(copy) => {
            saveProduct(copy)
            navigate(`/app/products/${copy.id}`, {
              state: { flash: 'Product copy created.' },
            })
          }}
        />
      ) : null}
    </>
  )
}

function ProductOverview({ product }) {
  return (
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
        Catalog selection does not establish a price or authorize an order.
        Private notes are visible to authorized workspace product users.
      </p>
    </>
  )
}

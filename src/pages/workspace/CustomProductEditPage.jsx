import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useWatch } from 'react-hook-form'
import { CustomProductFormFields } from '../../components/customProducts/CustomProductFormFields'
import { Button } from '../../components/common/Button'
import { ButtonLink } from '../../components/common/ButtonLink'
import { Card } from '../../components/common/Card'
import { TextLink } from '../../components/common/TextLink'
import { FormApiAlert } from '../../components/forms/FormApiAlert'
import { AppFormProvider } from '../../components/forms/AppFormProvider'
import { ClearFormButton } from '../../components/forms/ClearFormButton'
import { useAppForm } from '../../components/forms/useAppForm'
import { ConflictReview } from '../../components/workspace/RecordTools'
import {
  Loading,
  ErrorNotice,
  PageHeader,
  PermissionDenied,
} from '../../components/workspace/Elements'
import { useCustomProducts } from '../../hooks/useCustomProducts'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { customProductPaths } from '../../services/customProductApi'
import {
  buildCustomProductPayload,
  customProductFormSchema,
  productToFormValues,
} from '../../schemas/customProductFormSchema'

const FIELD_NAMES = [
  'name',
  'supplierItemCode',
  'categoryId',
  'description',
  'privateNotes',
]

function ProductConflictReview({ error, path, onReview }) {
  const watched = useWatch({ name: FIELD_NAMES })
  const values = Object.fromEntries(
    FIELD_NAMES.map((name, index) => [name, watched?.[index] || '']),
  )
  return (
    <ConflictReview
      error={error}
      path={path}
      values={values}
      onReview={onReview}
    />
  )
}

function applyServerFieldErrors(form, error) {
  const fields = error?.fields
  if (!Array.isArray(fields)) return
  for (const field of fields) {
    const name = field?.field
    if (
      name &&
      [...FIELD_NAMES, 'supplierId'].includes(name) &&
      typeof field.message === 'string' &&
      field.message.trim()
    ) {
      form.setError(name, {
        type: 'server',
        message: field.message.trim(),
      })
    }
  }
}

export function CustomProductEditPage() {
  const workspace = useWorkspace()
  const { productId } = useParams()
  const navigate = useNavigate()
  const canView = workspace.can('products.view')
  const canEdit = workspace.can('products.edit') && workspace.writesAllowed

  const { products, loading: listLoading, loaded, error: listError, refetch, saveProduct } =
    useCustomProducts({ autoFetch: canView })

  const fromStore = products.find((item) => item.id === productId) || null
  const detailPath = customProductPaths.detail(workspace.base || '', productId)
  const shouldFetchDetail = Boolean(workspace.base && loaded && !fromStore)
  const detail = useResource(shouldFetchDetail ? detailPath : null)
  const product = fromStore || detail.data || null
  const waiting =
    !canView ||
    listLoading ||
    (!loaded && !fromStore && !listError) ||
    (shouldFetchDetail && detail.loading)

  if (!canView || !canEdit) return <PermissionDenied />
  if (waiting) return <Loading variant="form" label="Loading product…" backTo="/app/products" backLabel="Back to products" />
  if (listError && !product) return (
    <section className="client-edit-page">
      <TextLink to="/app/products" className="back-link"><ArrowLeft size={16} />Back to products</TextLink>
      <ErrorNotice error={{ message: listError }} retry={refetch} />
    </section>
  )

  const notFound =
    !product ||
    detail.error?.status === 404 ||
    (shouldFetchDetail && detail.error && !detail.data)

  if (notFound) {
    return (
      <section className="client-edit-page">
        <TextLink to="/app/products" className="back-link">
          <ArrowLeft size={16} />
          Back to products
        </TextLink>
        <PageHeader title="Product not found" />
        <Card className="client-edit-card">
          <p className="muted">
            This product is missing or you no longer have access to it.
          </p>
          <div className="client-edit-footer">
            <ButtonLink to="/app/products" variant="secondary">
              Back to products
            </ButtonLink>
          </div>
        </Card>
      </section>
    )
  }

  if (product.status === 'archived') {
    return (
      <section className="client-edit-page">
        <TextLink to={`/app/products/${product.id}`} className="back-link">
          <ArrowLeft size={16} />
          Back to product
        </TextLink>
        <PageHeader
          title="Product is archived"
          description="Restore this product before editing its profile."
        />
        <Card className="client-edit-card">
          <div className="client-edit-footer">
            <ButtonLink
              to={`/app/products/${product.id}`}
              variant="secondary"
            >
              Back to product
            </ButtonLink>
          </div>
        </Card>
      </section>
    )
  }

  return (
    <ProductEditForm
      key={`${product.id}:${product.revision}`}
      product={product}
      productsBase={workspace.base}
      path={detailPath}
      onCancel={() => navigate(`/app/products/${product.id}`)}
      onSaved={(updated) => {
        saveProduct(updated)
        navigate(`/app/products/${updated.id}`, {
          state: { flash: 'Product updated successfully.' },
        })
      }}
    />
  )
}

function ProductEditForm({ product, productsBase, path, onCancel, onSaved }) {
  const mutation = useMutation()
  const [revision, setRevision] = useState(product.revision)
  const [apiError, setApiError] = useState(null)
  const locked = mutation.pending || mutation.uncertain

  const form = useAppForm(customProductFormSchema, {
    defaultValues: productToFormValues(product),
  })

  useEffect(() => {
    form.reset(productToFormValues(product))
    setRevision(product.revision)
    setApiError(null)
  }, [product, form])

  useEffect(() => {
    if (!mutation.error) return
    setApiError(mutation.error)
    applyServerFieldErrors(form, mutation.error)
  }, [form, mutation.error])

  async function onSubmit(values) {
    setApiError(null)
    const payload = buildCustomProductPayload(values, {
      product: { ...product, revision },
      dirtyFields: form.formState.dirtyFields,
    })

    if (!Object.keys(payload).length) {
      form.setError('name', {
        type: 'manual',
        message: 'Change at least one field before saving.',
      })
      return
    }

    const result = await mutation.run('patch', path, {
      ...payload,
      expectedRevision: revision,
    })

    if (result?.data) onSaved(result.data)
  }

  const { isDirty, isSubmitting } = form.formState
  const saving = locked || isSubmitting
  const alertError =
    apiError?.status === 409
      ? null
      : apiError
        ? {
            ...apiError,
            message:
              apiError.message || 'Something went wrong. Please try again.',
          }
        : null

  return (
    <section className="client-edit-page">
      <TextLink to={`/app/products/${product.id}`} className="back-link">
        <ArrowLeft size={16} />
        Back to product
      </TextLink>
      <PageHeader
        title="Edit"
        description="Update the product profile used across your workspace."
      />
      <Card className="client-edit-card">
        <AppFormProvider
          form={form}
          onSubmit={onSubmit}
          animated={false}
          className="client-edit-form"
        >
          <FormApiAlert error={alertError} />
          <CustomProductFormFields
            productsBase={productsBase}
            product={product}
            disabled={saving}
            autoFocusName
            categorySelectedLabel={product.category?.label}
          />
          <ProductConflictReview
            error={mutation.error}
            path={path}
            onReview={(current) => {
              setRevision(current.revision)
            }}
          />
          <div className="client-edit-footer">
            <ClearFormButton disabled={saving || mutation.uncertain} onClear={() => {
              mutation.reset()
              setApiError(null)
            }} />
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !isDirty}>
              {saving
                ? 'Saving…'
                : mutation.uncertain
                  ? 'Retry same request'
                  : 'Save'}
            </Button>
          </div>
        </AppFormProvider>
      </Card>
    </section>
  )
}

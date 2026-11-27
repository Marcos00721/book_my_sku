import { useEffect, useRef, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { useMutation } from '../../hooks/useMutation'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { customProductPaths } from '../../services/customProductApi'
import { uploadBytes } from '../../services/api'
import { mutate } from '../../services/workspace'
import {
  buildCustomProductPayload,
  customProductFormSchema,
  productToFormValues,
} from '../../schemas/customProductFormSchema'
import { AppFormProvider } from '../forms/AppFormProvider'
import { ClearFormButton } from '../forms/ClearFormButton'
import { FormApiAlert } from '../forms/FormApiAlert'
import { useAppForm } from '../forms/useAppForm'
import { SupplierEditor } from '../suppliers/SupplierEditor'
import { ConflictReview } from '../workspace/RecordTools'
import { Action, Dialog, ErrorNotice } from '../workspace/Elements'
import { askConfirm } from '../common/confirm'
import { CustomProductFormFields } from './CustomProductFormFields'
import { CustomProductImageField } from './CustomProductImageField'

const FIELD_NAMES = [
  'name',
  'supplierId',
  'supplierItemCode',
  'categoryId',
  'description',
  'privateNotes',
]

function ProductConflictReview({ error, path, onReview }) {
  const values = useWatch({ name: FIELD_NAMES })
  const mapped = Object.fromEntries(
    FIELD_NAMES.map((name, index) => [name, values?.[index] || '']),
  )
  return (
    <ConflictReview
      error={error}
      path={path}
      values={mapped}
      onReview={onReview}
    />
  )
}

async function allowDirtyClose(event, close) {
  const dirty =
    event.currentTarget.closest('dialog')?.dataset.dirty === 'true'
  if (!dirty) {
    close()
    return
  }
  if (
    await askConfirm({
      title: 'Discard changes?',
      message: 'Discard unsaved changes? Choose Cancel to keep editing.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    })
  ) {
    close()
  }
}

/** Shared create/edit dialog. Edit page also reuses CustomProductFormFields. */
export function CustomProductForm({
  productsBase,
  product = null,
  close,
  saved,
}) {
  const workspace = useWorkspace()
  const mutation = useMutation()
  const [revisionDraft, setRevision] = useState(null)
  const revision = revisionDraft ?? product?.revision
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imageResetKey, setImageResetKey] = useState(0)
  const [createdProduct, setCreatedProduct] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageProgress, setImageProgress] = useState(0)
  const [imageError, setImageError] = useState(null)
  const imageUpload = useRef(null)
  const uploadController = useRef(null)
  const locked = mutation.pending || mutation.uncertain || uploadingImage
  const isEdit = Boolean(product)

  useEffect(() => () => uploadController.current?.abort(), [])

  const form = useAppForm(customProductFormSchema, {
    defaultValues: productToFormValues(product),
  })

  useEffect(() => {
    form.reset(productToFormValues(product))
  }, [product, form])

  useEffect(() => {
    const fields = mutation.error?.fields
    if (!Array.isArray(fields)) return
    for (const field of fields) {
      const name = field?.field
      if (
        name &&
        FIELD_NAMES.includes(name) &&
        typeof field.message === 'string' &&
        field.message.trim()
      ) {
        form.setError(name, {
          type: 'server',
          message: field.message.trim(),
        })
      }
    }
  }, [form, mutation.error])

  async function saveImage(created) {
    // The product already exists: retries only resume its image operation.
    if (uploadController.current) return
    const controller = new AbortController()
    uploadController.current = controller
    setUploadingImage(true)
    setImageError(null)
    setImageProgress(0)
    const path = customProductPaths.detail(productsBase, created.id)
    try {
      if (!imageUpload.current) {
        const bytes = await imageFile.arrayBuffer()
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        imageUpload.current = {
          bytes,
          sha256: [...new Uint8Array(digest)]
            .map((value) => value.toString(16).padStart(2, '0'))
            .join(''),
          type: imageFile.type,
        }
      }
      const upload = imageUpload.current
      if (controller.signal.aborted) return
      if (!upload.assetId) {
        const asset = await mutate('post', `${path}/media/intents`, {
          expectedRevision: created.revision,
          sha256: upload.sha256,
          type: upload.type,
        })
        upload.assetId = asset.id
      }
      if (controller.signal.aborted) return
      if (!upload.uploaded) {
        await uploadBytes(
          `${path}/media/${upload.assetId}/content`,
          upload.bytes,
          upload.type,
          controller.signal,
          setImageProgress,
        )
        upload.uploaded = true
      }
      if (controller.signal.aborted) return
      const association = await mutate('post', `${path}/media/association`, {
        expectedRevision: created.revision,
        assetId: upload.assetId,
      })
      if (!controller.signal.aborted) {
        saved({ ...created, revision: association?.revision ?? created.revision })
      }
    } catch (error) {
      if (!controller.signal.aborted) setImageError(error)
    } finally {
      uploadController.current = null
      if (!controller.signal.aborted) setUploadingImage(false)
    }
  }

  async function onSubmit() {
    if (createdProduct) return saveImage(createdProduct)
    // Disabled fields (pending/uncertain) are omitted from RHF submit values;
    // read the full draft so retries keep the same payload.
    const values = form.getValues()
    const payload = buildCustomProductPayload(values, {
      product: isEdit ? { ...product, revision } : null,
      dirtyFields: isEdit ? form.formState.dirtyFields : null,
    })

    if (isEdit && !Object.keys(payload).length) {
      form.setError('name', {
        type: 'manual',
        message: 'Change at least one field before saving.',
      })
      return
    }

    const result = await mutation.run(
      isEdit ? 'patch' : 'post',
      isEdit
        ? customProductPaths.detail(productsBase, product.id)
        : customProductPaths.collection(productsBase),
      isEdit ? { ...payload, expectedRevision: revision } : payload,
    )
    if (!result) return
    if (!isEdit && imageFile) {
      setCreatedProduct(result.data)
      await saveImage(result.data)
    } else {
      saved(result.data)
    }
  }

  const submitLabel = (() => {
    if (uploadingImage) return 'Uploading image…'
    if (createdProduct) return 'Retry image upload'
    if (mutation.pending) return isEdit ? 'Saving…' : 'Creating…'
    if (mutation.uncertain) return 'Retry same request'
    return isEdit ? 'Save changes' : 'Create Product'
  })()

  return (
    <Dialog
      size="xl"
      title={isEdit ? 'Edit custom product' : 'Create custom product'}
      description={
        isEdit
          ? 'Update the draft profile. Supplier stays fixed — copy the product to change it.'
          : createdProduct
            ? 'Your product is saved. Retry the image upload or continue to the product.'
            : 'Add product details and an optional cover image. Variants and pricing can come later.'
      }
      close={createdProduct ? () => saved(createdProduct) : close}
      locked={locked}
      hasUnsavedChanges={Boolean(imageFile)}
      className="product-form-dialog custom-product-form-dialog"
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="product-form custom-product-form"
      >
        <div className="product-form-body">
          <FormApiAlert error={mutation.error} />
          <ErrorNotice error={imageError} />
          {mutation.uncertain ? (
            <p className="notice">
              The outcome is uncertain. Retry the same request to recover it
              safely.
            </p>
          ) : null}
          <CustomProductFormFields
            productsBase={productsBase}
            product={product}
            disabled={locked || Boolean(createdProduct)}
            autoFocusName
            supplierSelectedLabel={newSupplier?.name}
            categorySelectedLabel={product?.category?.label}
            imageField={!isEdit && workspace.can('products.edit') ? (
              <CustomProductImageField
                key={imageResetKey}
                file={imageFile}
                onChange={setImageFile}
                disabled={locked || Boolean(createdProduct)}
                uploading={uploadingImage}
                progress={imageProgress}
                canUpload={workspace.can('products.edit')}
              />
            ) : null}
            onAddSupplier={
              !isEdit && !createdProduct && workspace.can('suppliers.add')
                ? () => setAddingSupplier(true)
                : null
            }
          />
          <ProductConflictReview
            error={mutation.error}
            path={
              isEdit
                ? customProductPaths.detail(productsBase, product.id)
                : null
            }
            onReview={(current) => {
              setRevision(current.revision)
            }}
          />
          <ConflictReview
            error={imageError}
            path={createdProduct
              ? customProductPaths.detail(productsBase, createdProduct.id)
              : null}
            values={{ revision: createdProduct?.revision }}
            onReview={(current) => {
              setCreatedProduct(current)
              setImageError(null)
            }}
          />
        </div>
        <div className="dialog-footer custom-product-form-footer">
          {!createdProduct ? (
            <ClearFormButton
              disabled={locked}
              onClear={() => {
                mutation.reset()
                setImageFile(null)
                setImageResetKey((value) => value + 1)
                setImageError(null)
                setImageProgress(0)
                imageUpload.current = null
                setNewSupplier(null)
              }}
            />
          ) : null}
          <Action
            variant="secondary"
            disabled={locked}
            onClick={(event) => createdProduct
              ? saved(createdProduct)
              : allowDirtyClose(event, close)}
          >
            {createdProduct ? 'Continue to product' : 'Cancel'}
          </Action>
          <Action
            type={createdProduct || mutation.uncertain ? 'button' : 'submit'}
            disabled={mutation.pending || uploadingImage || form.formState.isSubmitting}
            onClick={createdProduct
              ? () => saveImage(createdProduct)
              : mutation.uncertain ? onSubmit : undefined}
          >
            {submitLabel}
          </Action>
        </div>
      </AppFormProvider>

      {addingSupplier ? (
        <SupplierEditor
          requiredCapability="supplier"
          path={`${workspace.base}/suppliers`}
          close={() => setAddingSupplier(false)}
          saved={(supplier) => {
            setNewSupplier(supplier)
            form.setValue('supplierId', supplier._id, {
              shouldValidate: true,
              shouldDirty: true,
            })
            setAddingSupplier(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}

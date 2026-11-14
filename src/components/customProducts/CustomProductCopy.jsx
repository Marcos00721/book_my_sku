import { useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import { customProductPaths } from '../../services/customProductApi'
import { ConflictReview, ReferenceSelect } from '../workspace/RecordTools'
import { Dialog, Field, SaveFooter } from '../workspace/Elements'

export function CustomProductCopy({ productsBase, product, close, saved }) {
  const [supplierId, setSupplierId] = useState(
    product.supplier?.eligible ? product.supplierId : '',
  )
  const [sku, setSku] = useState('')
  const [revision, setRevision] = useState(product.revision)
  const mutation = useMutation()

  async function onSubmit(event) {
    event.preventDefault()
    const result = await mutation.run(
      'post',
      customProductPaths.copy(productsBase, product.id),
      {
        expectedRevision: revision,
        supplierId,
        supplierItemCode: sku.trim() || null,
      },
    )
    if (result) saved(result.data)
  }

  return (
    <Dialog
      title="Copy product draft"
      description="The original stays unchanged. The copy gets a new product code and history. Private notes are copied."
      close={close}
      locked={mutation.pending || mutation.uncertain}
      className="product-form-dialog"
    >
      <form className="product-form" onSubmit={onSubmit}>
        <div className="product-form-body">
          <fieldset disabled={mutation.pending || mutation.uncertain}>
            <div className="product-form-fields">
              <ReferenceSelect
                path={customProductPaths.supplierOptions(productsBase)}
                label="Destination supplier"
                value={supplierId}
                required
                selectedLabel={product.supplier?.name}
                onChange={setSupplierId}
              />
              <Field
                label="New supplier item code (optional)"
                maxLength={120}
                value={sku}
                onChange={(event) => setSku(event.target.value)}
              />
            </div>
          </fieldset>
          <ConflictReview
            error={mutation.error}
            path={customProductPaths.detail(productsBase, product.id)}
            values={{ supplierId, supplierItemCode: sku }}
            onReview={(current) => setRevision(current.revision)}
          />
        </div>
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

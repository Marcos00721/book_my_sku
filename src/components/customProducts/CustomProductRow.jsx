import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dateLabel } from '../../utils/format'
import { ButtonLink } from '../common/ButtonLink'
import { Status } from '../workspace/Elements'
import { CustomProductThumbnail } from './CustomProductThumbnail'

export function CustomProductRow({ product }) {
  return (
    <tr>
      <td>
        <Link className="entity-link" to={`/app/products/${product.id}`}>
          <CustomProductThumbnail product={product} />
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
      <td className="muted">{dateLabel(product.createdAt)}</td>
      <td>
        <ButtonLink
          variant="icon"
          aria-label={`Open ${product.name}`}
          to={`/app/products/${product.id}`}
        >
          <ArrowUpRight size={17} />
        </ButtonLink>
      </td>
    </tr>
  )
}

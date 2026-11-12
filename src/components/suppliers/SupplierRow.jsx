import { ArrowUpRight, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dateLabel } from '../../utils/format'
import { ButtonLink } from '../common/ButtonLink'
import { Status } from '../workspace/Elements'

export function SupplierRow({ supplier }) {
  return (
    <tr>
      <td>
        <Link className="entity-link" to={`/app/suppliers/${supplier._id}`}>
          <span className="entity-icon">
            <Truck size={17} />
          </span>
          {supplier.name}
        </Link>
        <small>{supplier.supplierCode}</small>
      </td>
      <td>
        {(supplier.capabilities || [])
          .map((item) => String(item).replaceAll('_', ' '))
          .join(', ') || '—'}
      </td>
      <td>
        <Status value={supplier.status} />
      </td>
      <td className="muted">{dateLabel(supplier.createdAt)}</td>
      <td>
        <ButtonLink
          variant="icon"
          aria-label={`Open ${supplier.name}`}
          to={`/app/suppliers/${supplier._id}`}
        >
          <ArrowUpRight size={17} />
        </ButtonLink>
      </td>
    </tr>
  )
}

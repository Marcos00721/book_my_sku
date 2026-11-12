import { ArrowUpRight, Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dateLabel } from '../../utils/format'
import { ButtonLink } from '../common/ButtonLink'
import { Status } from '../workspace/Elements'

export function ClientRow({ client }) {
  return (
    <tr>
      <td>
        <Link className="entity-link" to={`/app/clients/${client._id}`}>
          <span className="entity-icon">
            <Building2 size={17} />
          </span>
          {client.name}
        </Link>
        <small>
          {[client.clientCode, client.accountLabel].filter(Boolean).join(' · ')}
        </small>
      </td>
      <td>
        <Status value={client.status} />
      </td>
      <td className="muted">{dateLabel(client.createdAt)}</td>
      <td>
        <ButtonLink
          variant="icon"
          aria-label={`Open ${client.name}`}
          to={`/app/clients/${client._id}`}
        >
          <ArrowUpRight size={17} />
        </ButtonLink>
      </td>
    </tr>
  )
}

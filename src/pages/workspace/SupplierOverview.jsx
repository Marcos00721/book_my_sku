import { SectionHeading } from '../../components/workspace/SectionHeading'
import { Status } from '../../components/workspace/Elements'
import { formatNumber } from '../../utils/phone'

export function SupplierOverview({ supplier }) {
  return (
    <>
      <SectionHeading
        title="Supplier overview"
        description="Core profile details for this supplier or decorator."
        actions={<Status value={supplier.status} />}
      />
      <dl className="detail-list">
        {[
          ['Supplier code', supplier.supplierCode],
          [
            'Capabilities',
            (supplier.capabilities || [])
              .map((item) => String(item).replaceAll('_', ' '))
              .join(', '),
          ],
          ['Website', supplier.website],
          ['General email', supplier.email],
          ['Phone', supplier.phone ? formatNumber(supplier.phone) : ''],
          ['Our account number', supplier.accountNumber],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

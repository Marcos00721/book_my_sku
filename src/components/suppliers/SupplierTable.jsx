import { SupplierRow } from './SupplierRow'

export function SupplierTable({ suppliers }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Business</th>
            <th scope="col">Capabilities</th>
            <th scope="col">Status</th>
            <th scope="col">Added</th>
            <th scope="col">
              <span className="sr-only">Open supplier</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <SupplierRow key={supplier._id} supplier={supplier} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

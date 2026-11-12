import { ClientRow } from './ClientRow'

export function ClientTable({ clients }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Client name</th>
            <th scope="col">Status</th>
            <th scope="col">Added</th>
            <th scope="col">
              <span className="sr-only">Open client</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <ClientRow key={client._id} client={client} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

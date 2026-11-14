import { CustomProductRow } from './CustomProductRow'

export function CustomProductTable({ products }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Supplier</th>
            <th scope="col">Supplier SKU</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Added</th>
            <th scope="col">
              <span className="sr-only">Open product</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <CustomProductRow key={product.id} product={product} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

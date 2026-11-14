import { RefreshCw, Search } from 'lucide-react'
import { Action, Field } from '../workspace/Elements'

export function CustomProductSearch({
  draft,
  onDraftChange,
  onSubmit,
  onClear,
  onRefresh,
  refreshing,
  activeSearch,
  status,
  onStatusChange,
}) {
  return (
    <div className="toolbar client-toolbar">
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label>
          Find products
          <input
            className="search-input"
            aria-label="Search products"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            maxLength={80}
            placeholder="Search by name or code…"
          />
        </label>
        <Action type="submit" variant="secondary" aria-label="Search">
          <Search size={16} />
        </Action>
        {activeSearch ? (
          <Action variant="text-button" type="button" onClick={onClear}>
            Clear
          </Action>
        ) : null}
      </form>
      <div className="client-toolbar-side">
        <Field
          label="Product status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Field>
        <Action
          variant="secondary"
          onClick={onRefresh}
          aria-label="Refresh products"
          disabled={refreshing}
        >
          <RefreshCw size={15} />
          Refresh
        </Action>
      </div>
    </div>
  )
}

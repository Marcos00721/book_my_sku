import { RefreshCw, Search } from 'lucide-react'
import { Action, Field } from '../workspace/Elements'

export function SupplierSearch({
  draft,
  onDraftChange,
  onSubmit,
  onClear,
  onRefresh,
  refreshing,
  activeSearch,
  searchBy,
  onSearchByChange,
  status,
  onStatusChange,
  capability,
  onCapabilityChange,
}) {
  return (
    <div className="toolbar client-toolbar">
      <Field
        label="Search by"
        value={searchBy}
        onChange={(event) => onSearchByChange(event.target.value)}
      >
        <option value="name">Name prefix</option>
        <option value="code">Exact supplier code</option>
      </Field>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label>
          Find suppliers
          <input
            className="search-input"
            aria-label="Search suppliers"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            maxLength={80}
            placeholder={
              searchBy === 'code' ? 'Exact supplier code…' : 'Search by name…'
            }
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
          label="Status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Field>
        <Field
          label="Business type"
          value={capability}
          onChange={(event) => onCapabilityChange(event.target.value)}
        >
          <option value="">All types</option>
          <option value="supplier">Supplier</option>
          <option value="decorator">Decorator</option>
          <option value="fulfillment">Fulfillment</option>
        </Field>
        <Action
          variant="secondary"
          onClick={onRefresh}
          aria-label="Refresh suppliers"
          disabled={refreshing}
        >
          <RefreshCw size={15} />
          Refresh
        </Action>
      </div>
    </div>
  )
}

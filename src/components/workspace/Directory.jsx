import { useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { Action, Empty, ErrorNotice, Loading } from './Elements'

export function Directory({ path, label, filters, children, emptyAction }) {
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState([])
  const resource = useResource(
    queryPath(path, { limit: 25, search, after: history.at(-1), ...filters }),
  )
  return (
    <>
      <div className="toolbar">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(draft.trim())
            setHistory([])
          }}
        >
          <label>
            Find {label.toLowerCase()}
            <input
              className="search-input"
              aria-label={`Search ${label.toLowerCase()}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={80}
              placeholder="Search by name prefix…"
            />
          </label>
          <Action type="submit" variant="secondary" aria-label="Search">
            <Search size={16} />
          </Action>
          {search && (
            <Action
              variant="text-button"
              onClick={() => {
                setSearch('')
                setDraft('')
                setHistory([])
              }}
            >
              Clear
            </Action>
          )}
        </form>
        <Action
          variant="secondary"
          onClick={resource.reload}
          aria-label={`Refresh ${label.toLowerCase()}`}
        >
          <RefreshCw size={15} />
          Refresh
        </Action>
      </div>
      <p className="muted" style={{ fontSize: '.7rem', marginBottom: '1rem' }}>
        Name search matches the start of the name and is case-sensitive.
      </p>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading label={`Loading ${label.toLowerCase()}…`} />
      ) : resource.data?.items?.length ? (
        children(resource.data.items, resource.reload)
      ) : (
        !resource.error && (
          <Empty
            title={
              search
                ? 'No matching results'
                : `Your ${label.toLowerCase()} start here`
            }
            action={emptyAction}
          >
            {search
              ? 'Try the first few letters of the name, including its capitalization.'
              : 'Add the first record to keep everything close at hand.'}
          </Empty>
        )
      )}
      {resource.data && (
        <div className="table-bottom">
          <span>
            {resource.data.items?.length || 0} {label.toLowerCase()} on this
            page
          </span>
          <div className="actions">
            <Action
              variant="secondary"
              disabled={!history.length}
              onClick={() => setHistory((value) => value.slice(0, -1))}
            >
              Previous
            </Action>
            <Action
              variant="secondary"
              disabled={!resource.data.next}
              onClick={() =>
                setHistory((value) => [...value, resource.data.next])
              }
            >
              Next
            </Action>
          </div>
        </div>
      )}
    </>
  )
}

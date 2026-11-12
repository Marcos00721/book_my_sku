import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useClients } from '../../hooks/useClients'
import { ClientForm } from '../../components/clients/ClientForm'
import { ClientSearch } from '../../components/clients/ClientSearch'
import { ClientTable } from '../../components/clients/ClientTable'
import { OffsetPager } from '../../components/workspace/OffsetPager'
import {
  Action,
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  PermissionDenied,
} from '../../components/workspace/Elements'

const PAGE_SIZE = 25

function matchesSearch(client, search) {
  if (!search) return true
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return (
    client.name?.toLowerCase().startsWith(needle) ||
    client.clientCode?.toLowerCase().includes(needle) ||
    client.accountLabel?.toLowerCase().includes(needle)
  )
}

export function ClientsPage() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const canView = workspace.can('clients.view')
  const { clients, loading, error, refetch, saveClient } = useClients({
    autoFetch: canView,
  })
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState('active')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    return clients.filter((client) => {
      const statusOk =
        status === 'all' ? true : (client.status || 'active') === status
      return statusOk && matchesSearch(client, search)
    })
  }, [clients, search, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  if (!canView) return <PermissionDenied />

  const create = workspace.can('clients.create') && workspace.writesAllowed && (
    <Action onClick={() => setCreating(true)}>
      <Plus size={17} />
      Create
    </Action>
  )

  return (
    <>
      <PageHeader
        title="Clients"
        description="Companies you work with, and the people behind them."
        actions={create}
      />
      <section className="panel">
        <ClientSearch
          draft={draft}
          onDraftChange={setDraft}
          activeSearch={Boolean(search)}
          status={status}
          refreshing={loading}
          onRefresh={() => refetch()}
          onStatusChange={(value) => {
            setStatus(value)
            setPage(0)
          }}
          onSubmit={() => {
            setSearch(draft.trim())
            setPage(0)
          }}
          onClear={() => {
            setDraft('')
            setSearch('')
            setPage(0)
          }}
        />
        <ErrorNotice
          error={
            error
              ? { message: error || 'Something went wrong. Please try again.' }
              : null
          }
          retry={() => refetch()}
        />
        {loading && !clients.length ? (
          <Loading label="Loading clients…" />
        ) : pageItems.length ? (
          <>
            <ClientTable clients={pageItems} />
            <OffsetPager
              total={filtered.length}
              page={safePage}
              pageCount={pageCount}
              onPageChange={setPage}
              label="client"
              matchingLabel={search ? ' matching search' : ''}
            />
          </>
        ) : (
          !error && (
            <Empty
              title={
                search || status !== 'active'
                  ? 'No matching clients'
                  : 'No clients yet'
              }
              action={search || status !== 'active' ? null : create}
            >
              {search || status !== 'active'
                ? 'Try another name prefix or status filter.'
                : 'Add the first client to keep relationships in one place.'}
            </Empty>
          )
        )}
      </section>
      {creating && (
        <ClientForm
          path={`${workspace.base}/clients`}
          close={() => setCreating(false)}
          saved={(client) => {
            saveClient(client)
            setCreating(false)
            navigate(`/app/clients/${client._id}`)
          }}
        />
      )}
    </>
  )
}

export { ClientForm as ClientNameDialog } from '../../components/clients/ClientForm'

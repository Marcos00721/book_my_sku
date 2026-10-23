import { useState } from 'react'
import { useResource } from '../../hooks/useResource'
import { queryPath, readData } from '../../services/workspace'
import { Action, ErrorNotice, Field } from './Elements'

export function RoleSelector({ base, value, onChange, disabled }) {
  const resource = useResource(`${base}/roles?limit=50`)
  const [extra, setExtra] = useState([])
  const [next, setNext] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const cursor = next === null ? resource.data?.next : next
  const roles = [...(resource.data?.items || []), ...extra].filter(
    (role) => !role.archived,
  )
  async function loadMore() {
    setBusy(true)
    setError(null)
    try {
      const page = await readData(
        queryPath(`${base}/roles`, { limit: 50, after: cursor }),
      )
      setExtra((current) => [...current, ...page.items])
      setNext(page.next || '')
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Field
        label="Role"
        required
        value={value}
        onChange={onChange}
        disabled={disabled || resource.loading}
      >
        <option value="">
          {resource.loading ? 'Loading roles…' : 'Choose a role'}
        </option>
        {value && !roles.some((role) => role.id === value) && (
          <option value={value}>Current role</option>
        )}
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </Field>
      {cursor && (
        <Action
          variant="text-button"
          disabled={disabled || busy}
          onClick={loadMore}
        >
          Load more roles
        </Action>
      )}
      <ErrorNotice error={resource.error || error} retry={resource.reload} />
    </>
  )
}

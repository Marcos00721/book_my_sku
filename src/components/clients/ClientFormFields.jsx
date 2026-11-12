import { Link } from 'react-router-dom'
import { useWatch } from 'react-hook-form'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useResource } from '../../hooks/useResource'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { queryPath } from '../../services/workspace'
import { FormSelectField } from '../forms/FormSelectField'
import { FormTextField } from '../forms/FormTextField'
import { ErrorNotice, Loading } from '../workspace/Elements'

function IndustryField({ path, disabled }) {
  const resource = useResource(queryPath(path, { limit: 50 }))
  const items = resource.data?.items || []
  const industryId = useWatch({ name: 'industryId' }) || ''

  return (
    <>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !items.length ? (
        <Loading label="Loading industries…" />
      ) : (
        <FormSelectField
          name="industryId"
          label="Industry"
          hint="Optional"
          disabled={disabled || Boolean(resource.error)}
        >
          <option value="">Not set</option>
          {industryId &&
            !items.some(
              (item) => String(item.id || item._id) === String(industryId),
            ) && <option value={industryId}>Current selection</option>}
          {items.map((item) => (
            <option key={item.id || item._id} value={item.id || item._id}>
              {item.label || item.name}
            </option>
          ))}
        </FormSelectField>
      )}
    </>
  )
}

function ClientDuplicateHints() {
  const workspace = useWorkspace()
  const name = useWatch({ name: 'name' }) || ''
  const trimmed = name.trim()
  const debouncedName = useDebouncedValue(trimmed, 400)
  const waiting = Boolean(trimmed) && trimmed !== debouncedName
  const resource = useResource(
    debouncedName
      ? queryPath(`${workspace.base}/clients/duplicate-candidates`, {
          name: debouncedName,
        })
      : null,
  )
  const matches = resource.data?.items || []
  if (!trimmed) return null
  if (waiting || resource.loading) {
    return (
      <p className="client-form-hint muted">Checking for similar clients…</p>
    )
  }
  if (resource.error) {
    return (
      <p className="client-form-hint muted">
        Could not check for duplicates. You can still save.
      </p>
    )
  }
  if (!matches.length) return null
  return (
    <aside className="client-form-duplicates" aria-label="Possible duplicates">
      <p className="client-form-duplicates-title">Similar clients found</p>
      <ul>
        {matches.map((item) => {
          const id = item.id || item._id
          const label = [item.name, item.clientCode, item.accountLabel]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={id}>
              <Link className="app-link" to={`/app/clients/${id}`}>
                {label || 'Open client'}
              </Link>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

/** Shared add/edit fields — must render inside AppFormProvider / FormProvider. */
export function ClientFormFields({ disabled = false, autoFocusName = false }) {
  const workspace = useWorkspace()

  return (
    <div className="client-form-fields">
      <FormTextField
        name="name"
        label="Client name"
        required
        maxLength={160}
        autoFocus={autoFocusName}
        disabled={disabled}
      />

      <ClientDuplicateHints />

      <div className="form-grid">
        <FormTextField
          name="accountLabel"
          label="Account label"
          hint="Optional short label for this account."
          maxLength={120}
          disabled={disabled}
        />
        <FormTextField
          name="website"
          label="Website"
          hint="Optional. Include https://"
          type="url"
          maxLength={300}
          disabled={disabled}
          placeholder="https://"
        />
      </div>

      <IndustryField
        path={`${workspace.base}/clients/industry-options`}
        disabled={disabled}
      />
    </div>
  )
}

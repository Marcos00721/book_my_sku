import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useWatch } from 'react-hook-form'
import { useClients } from '../../hooks/useClients'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { ClientFormFields } from '../../components/clients/ClientFormFields'
import { Button } from '../../components/common/Button'
import { ButtonLink } from '../../components/common/ButtonLink'
import { Card } from '../../components/common/Card'
import { TextLink } from '../../components/common/TextLink'
import { FormApiAlert } from '../../components/forms/FormApiAlert'
import { AppFormProvider } from '../../components/forms/AppFormProvider'
import { ClearFormButton } from '../../components/forms/ClearFormButton'
import { useAppForm } from '../../components/forms/useAppForm'
import {
  buildClientPayload,
  clientFormSchema,
  clientToFormValues,
} from '../../schemas/clientFormSchema'
import { ConflictReview } from '../../components/workspace/RecordTools'
import {
  Loading,
  ErrorNotice,
  PageHeader,
  PermissionDenied,
} from '../../components/workspace/Elements'

const FIELD_NAMES = ['name', 'website', 'accountLabel', 'industryId', 'notes']

function ClientConflictReview({ error, path, onReview }) {
  const [name, website, accountLabel, industryId, notes] = useWatch({
    name: FIELD_NAMES,
  })
  return (
    <ConflictReview
      error={error}
      path={path}
      values={{
        name: name || '',
        website: website || '',
        accountLabel: accountLabel || '',
        industryId: industryId || '',
        notes: notes || '',
      }}
      onReview={onReview}
    />
  )
}

function applyServerFieldErrors(form, error) {
  const fields = error?.fields
  if (!Array.isArray(fields)) return
  for (const field of fields) {
    const name = field?.field
    if (
      name &&
      FIELD_NAMES.includes(name) &&
      typeof field.message === 'string' &&
      field.message.trim()
    ) {
      form.setError(name, {
        type: 'server',
        message: field.message.trim(),
      })
    }
  }
}

export function ClientEditPage() {
  const workspace = useWorkspace()
  const { clientId } = useParams()
  const navigate = useNavigate()
  const canView = workspace.can('clients.view')
  const canEdit = workspace.can('clients.edit') && workspace.writesAllowed

  const { clients, loading: listLoading, loaded, error: listError, refetch, saveClient } = useClients({
    autoFetch: canView,
  })

  const fromStore = clients.find((item) => item._id === clientId) || null
  const detailPath = `${workspace.base}/clients/${encodeURIComponent(clientId)}`
  const shouldFetchDetail = Boolean(workspace.base && loaded && !fromStore)
  const detail = useResource(shouldFetchDetail ? detailPath : null)
  const client = fromStore || detail.data || null
  const waiting =
    !canView ||
    listLoading ||
    (!loaded && !fromStore && !listError) ||
    (shouldFetchDetail && detail.loading)

  if (!canView || !canEdit) return <PermissionDenied />
  if (waiting) return <Loading variant="form" label="Loading client…" backTo="/app/clients" backLabel="Back to clients" />
  if (listError && !client) return (
    <section className="client-edit-page">
      <TextLink to="/app/clients" className="back-link"><ArrowLeft size={16} />Back to clients</TextLink>
      <ErrorNotice error={{ message: listError }} retry={refetch} />
    </section>
  )

  const notFound =
    !client ||
    detail.error?.status === 404 ||
    (shouldFetchDetail && detail.error && !detail.data)

  if (notFound) {
    return (
      <section className="client-edit-page">
        <TextLink to="/app/clients" className="back-link">
          <ArrowLeft size={16} />
          Back to clients
        </TextLink>
        <PageHeader title="Client not found" />
        <Card className="client-edit-card">
          <p className="muted">
            This client is missing or you no longer have access to it.
          </p>
          <div className="client-edit-footer">
            <ButtonLink to="/app/clients" variant="secondary">
              Back to clients
            </ButtonLink>
          </div>
        </Card>
      </section>
    )
  }

  if (client.status === 'archived') {
    return (
      <section className="client-edit-page">
        <TextLink to={`/app/clients/${client._id}`} className="back-link">
          <ArrowLeft size={16} />
          Back to client
        </TextLink>
        <PageHeader
          title="Client is archived"
          description="Restore this client before editing its profile."
        />
        <Card className="client-edit-card">
          <div className="client-edit-footer">
            <ButtonLink to={`/app/clients/${client._id}`} variant="secondary">
              Back to client
            </ButtonLink>
          </div>
        </Card>
      </section>
    )
  }

  return (
    <ClientEditForm
      key={`${client._id}:${client.__v}`}
      client={client}
      path={detailPath}
      onCancel={() => navigate(`/app/clients/${client._id}`)}
      onSaved={(updated) => {
        saveClient(updated)
        navigate(`/app/clients/${updated._id}`, {
          state: { flash: 'Client updated successfully.' },
        })
      }}
    />
  )
}

function ClientEditForm({ client, path, onCancel, onSaved }) {
  const [version, setVersion] = useState(client.__v)
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain

  const form = useAppForm(clientFormSchema, {
    defaultValues: clientToFormValues(client),
  })

  useEffect(() => {
    if (!mutation.error) return
    applyServerFieldErrors(form, mutation.error)
  }, [form, mutation.error])

  async function onSubmit(values) {
    const payload = buildClientPayload(values, {
      client: { ...client, __v: version },
      dirtyFields: form.formState.dirtyFields,
    })

    if (!Object.keys(payload).length) {
      form.setError('name', {
        type: 'manual',
        message: 'Change at least one field before saving.',
      })
      return
    }

    const result = await mutation.run('patch', path, {
      ...payload,
      expectedVersion: version,
    })
    if (result?.data) onSaved(result.data)
  }

  const { isDirty, isSubmitting } = form.formState
  const saving = locked || isSubmitting
  const apiError = mutation.error
  const alertError =
    apiError?.status === 409
      ? null
      : apiError
        ? {
            ...apiError,
            message:
              apiError.message || 'Something went wrong. Please try again.',
          }
        : null

  return (
    <section className="client-edit-page">
      <TextLink to={`/app/clients/${client._id}`} className="back-link">
        <ArrowLeft size={16} />
        Back to client
      </TextLink>
      <PageHeader
        title="Edit"
        description="Update the company profile used across your workspace."
      />
      <Card className="client-edit-card">
        <AppFormProvider
          form={form}
          onSubmit={onSubmit}
          animated={false}
          className="client-edit-form"
        >
          <FormApiAlert error={alertError} />
          <ClientFormFields disabled={saving} autoFocusName />
          <ClientConflictReview
            error={mutation.error}
            path={path}
            onReview={(current) => {
              setVersion(current.__v)
              form.reset(clientToFormValues(current))
            }}
          />
          <div className="client-edit-footer">
            <ClearFormButton disabled={saving || mutation.uncertain} onClear={() => {
              mutation.reset()
            }} />
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.pending || isSubmitting || (!isDirty && !mutation.uncertain)}>
              {mutation.pending || isSubmitting
                ? 'Saving…'
                : mutation.uncertain
                  ? 'Retry same request'
                  : 'Save'}
            </Button>
          </div>
        </AppFormProvider>
      </Card>
    </section>
  )
}

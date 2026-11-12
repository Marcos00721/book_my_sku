import { useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import {
  archiveRestoreFormSchema,
  managementFormSchema,
} from '../../schemas/clientTabFormSchemas'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormSelectField } from '../forms/FormSelectField'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { ConflictReview, ReferenceSelect } from '../workspace/RecordTools'
import { Dialog, SaveFooter } from '../workspace/Elements'

export function ManagementEditor({
  command,
  path,
  client,
  management,
  close,
  saved,
}) {
  const mutation = useMutation()
  const [version, setVersion] = useState(management.clientVersion)
  const [accountManagerId, setManager] = useState(
    management.accountManagerId || '',
  )
  const locked = mutation.pending || mutation.uncertain
  const isManagement = command === 'management'
  const form = useAppForm(
    isManagement ? managementFormSchema : archiveRestoreFormSchema,
    {
      defaultValues: isManagement
        ? {
            relationshipStatus: management.relationshipStatus || 'prospect',
            accountManagerId: management.accountManagerId || '',
            reason: '',
          }
        : { reason: '' },
    },
  )

  async function onSubmit(values) {
    const result = await mutation.run(
      isManagement ? 'patch' : 'post',
      `${path}/${command}`,
      {
        expectedVersion: version,
        reason: values.reason.trim(),
        ...(isManagement
          ? {
              relationshipStatus: values.relationshipStatus,
              accountManagerId: accountManagerId || null,
            }
          : {}),
      },
    )
    if (!result) return
    const updated = result.data
    if (updated && typeof updated === 'object' && updated._id) {
      saved(updated)
      return
    }
    if (command === 'archive' || command === 'restore') {
      saved({
        ...client,
        status: command === 'archive' ? 'archived' : 'active',
        __v: (client.__v || 0) + 1,
      })
      return
    }
    saved(null)
  }

  return (
    <Dialog
      className="client-form-dialog"
      title={
        isManagement
          ? 'Edit relationship'
          : `${command === 'archive' ? 'Archive' : 'Restore'} client`
      }
      close={close}
      locked={locked}
    >
      <p className="muted">
        History and existing obligations remain. Archiving clears defaults;
        restoring does not reinstate them.
      </p>
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="client-form"
      >
        <div className="client-form-fields">
          {isManagement ? (
            <>
              <FormSelectField
                name="relationshipStatus"
                label="Relationship"
                disabled={locked}
              >
                {['prospect', 'customer', 'dormant'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </FormSelectField>
              <ReferenceSelect
                path={`${path}/manager-options`}
                label="Account manager"
                value={accountManagerId}
                selectedLabel={management.accountManager?.label}
                labelFor={(item) => item.actor?.label || 'Member unavailable'}
                disabled={locked}
                onChange={(value) => {
                  setManager(value)
                  form.setValue('accountManagerId', value, {
                    shouldDirty: true,
                  })
                }}
              />
            </>
          ) : null}
          <FormTextField
            name="reason"
            label="Reason"
            required
            maxLength={250}
            disabled={locked}
          />
        </div>
        <ConflictReview
          error={mutation.error}
          path={`${path}/management`}
          values={{
            relationshipStatus: form.getValues('relationshipStatus'),
            accountManagerId,
          }}
          onReview={(current) => setVersion(current.clientVersion)}
        />
        <SaveFooter mutation={mutation} close={close} label="Confirm change" />
      </AppFormProvider>
    </Dialog>
  )
}

import { useMutation } from '../../hooks/useMutation'
import { noteFormSchema } from '../../schemas/clientTabFormSchemas'
import { toEditorHtml } from '../../utils/richText'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormTextEditor } from '../forms/FormTextEditor'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { Dialog, SaveFooter } from '../workspace/Elements'

export function NoteEditor({ path, note, close, saved }) {
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain
  const isEdit = Boolean(note.id)
  const form = useAppForm(noteFormSchema, {
    defaultValues: {
      text: toEditorHtml(note.text),
      reason: '',
      isEdit,
    },
  })

  async function onSubmit(values) {
    if (
      await mutation.run(
        isEdit ? 'patch' : 'post',
        `${path}/notes${isEdit ? `/${note.id}` : ''}`,
        {
          text: values.text.trim(),
          ...(isEdit
            ? {
                expectedVersion: note.revision,
                reason: values.reason.trim(),
              }
            : {}),
        },
      )
    )
      saved()
  }

  return (
    <Dialog
      size="md"
      className="client-form-dialog"
      title={isEdit ? 'Edit note' : 'Add note'}
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="client-form"
      >
        <div className="client-form-fields">
          <FormTextEditor
            name="text"
            label="Note"
            required
            maxLength={2000}
            rows={5}
            placeholder="Write a note…"
            disabled={locked}
          />
          {isEdit ? (
            <FormTextField
              name="reason"
              label="Correction reason"
              required
              maxLength={250}
              disabled={locked}
            />
          ) : null}
        </div>
        <SaveFooter mutation={mutation} close={close} label="Save" />
      </AppFormProvider>
    </Dialog>
  )
}

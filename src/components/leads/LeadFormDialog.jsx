import { Building2, ChevronDown, Settings2 } from 'lucide-react'
import { Badge } from '../common/Badge'
import { AppFormProvider } from '../forms/AppFormProvider'
import { Dialog } from '../workspace/Elements'
import { leadStages } from '../../services/leads'
import { LeadCaptureFields } from './LeadCaptureFields'
import '../../styles/leads.css'

export function LeadFormDialog({
  title, description, stage = 'new', form, onSubmit, close, locked,
  hasUnsavedChanges, captureDisabled, setup, clientPicker, clientOpen = false,
  clientHint = 'Link an existing client, or add one now.', clientLabel = 'Optional',
  notices, feedback, footer,
}) {
  return (
    <Dialog size="xl" className="lead-create-dialog" title={title} description={description}
      headerAction={<Badge tone={leadStages[stage]?.tone} className="lead-create-stage">{leadStages[stage]?.label || 'Unknown'}</Badge>}
      close={close} locked={locked} hasUnsavedChanges={hasUnsavedChanges}>
      <AppFormProvider form={form} onSubmit={onSubmit} animated={false} className="lead-create-form">
        <div className="lead-create-body">
          <div className="lead-create-main">
            {notices}
            <LeadCaptureFields disabled={captureDisabled} layout="capture" />
            {feedback}
          </div>
          <aside className="lead-create-sidebar" aria-label="Lead setup">
            <header className="lead-create-section-heading">
              <span className="lead-create-section-icon"><Settings2 size={17} aria-hidden="true" /></span>
              <div><h3>Lead setup</h3><p>A little context for your team.</p></div>
            </header>
            <div className="lead-create-setup-fields">{setup}</div>
            {clientPicker && <details className="lead-create-client" open={clientOpen}>
              <summary>
                <Building2 size={17} aria-hidden="true" />
                <span>Client & contact{clientLabel && <small>{clientLabel}</small>}</span>
                <ChevronDown size={16} className="lead-create-client-chevron" aria-hidden="true" />
              </summary>
              <div className="lead-create-client-body">
                <p className="lead-create-help">{clientHint}</p>
                {clientPicker}
              </div>
            </details>}
          </aside>
        </div>
        <footer className="lead-create-footer">
          <p className="lead-create-required">Fields marked <span className="required-mark" aria-hidden="true" /><span className="sr-only">with an asterisk</span> are required.</p>
          <div className="lead-create-actions">{footer}</div>
        </footer>
      </AppFormProvider>
    </Dialog>
  )
}

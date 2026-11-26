import { FileText, UsersRound } from 'lucide-react'
import { FormTextField } from '../forms/FormTextField'
import { FormTextEditor } from '../forms/FormTextEditor'

export function LeadCaptureFields({ disabled = false, layout = 'default' }) {
  const capture = layout === 'capture'
  return (
    <fieldset className={`lead-form-fields${capture ? ' lead-capture-fields' : ''}`} disabled={disabled}>
      {capture && <header className="lead-create-section-heading">
        <span className="lead-create-section-icon"><UsersRound size={17} aria-hidden="true" /></span>
        <div><h3>Company & contact</h3><p>Who should we get in touch with?</p></div>
      </header>}
      <div className="lead-form-grid">
        <FormTextField name="companyName" label="Company name" required maxLength={160} placeholder={capture ? 'e.g. Acme Studio' : undefined} />
        <FormTextField name="contactName" label="Contact name" required maxLength={160} placeholder={capture ? 'Full name' : undefined} />
        <FormTextField name="email" label="Email address" type="email" required maxLength={254} placeholder={capture ? 'name@company.com' : undefined} />
        <FormTextField name="phone" label="Phone" type="tel" maxLength={40} placeholder={capture ? 'Include country code' : undefined} />
      </div>
      {!capture && <FormTextField name="requestedInHandsDate" label="Requested in-hands date" type="date" />}
      <div className={capture ? 'lead-capture-requirement' : undefined}>
        {capture && <div className="lead-create-brief-heading"><FileText size={17} aria-hidden="true" /><h3>Requirement<span className="required-mark" aria-hidden="true" /></h3></div>}
        <FormTextEditor name="requirement" label="Requirement" required maxLength={2000}
          className={capture ? 'lead-capture-editor' : undefined} compactToolbar={capture} rows={capture ? 6 : 5}
          placeholder={capture ? 'Tell us about the products, quantities, branding and delivery…' : undefined}
          disabled={disabled} hint={capture ? undefined : 'Describe the products, quantity, and delivery requirements.'} />
      </div>
    </fieldset>
  )
}

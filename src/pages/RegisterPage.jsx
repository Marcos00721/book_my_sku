import { Building2, Mail, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { AppFormProvider } from '../components/forms/AppFormProvider'
import { FormPhoneField } from '../components/forms/FormPhoneField'
import { FormSubmitButton } from '../components/forms/FormSubmitButton'
import { FormTextField } from '../components/forms/FormTextField'
import { useAppForm } from '../components/forms/useAppForm'
import { registerFormSchema } from '../schemas/authSchemas'
import { formatUSPhoneNumber, stripPhoneFormatting } from '../utils/phone'

export function RegisterPage() {
  const registerForm = useAppForm(registerFormSchema, {
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      organizationName: '',
    },
  })

  function handleRegisterSubmit(values) {
    console.log({
      ...values,
      phone: formatUSPhoneNumber(values.phone),
      phoneDigits: stripPhoneFormatting(values.phone),
    })
  }

  return (
    <AuthLayout variant="register">
      <AuthPageContent
        id="register-title"
        eyebrow="Make room for what's next"
        title="Start something great."
        description="Create your account. Get your business in sync."
      >
        <AppFormProvider
          form={registerForm}
          onSubmit={handleRegisterSubmit}
          aria-labelledby="register-title"
          className="space-y-lg"
        >
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
            <FormTextField
              name="firstName"
              label="First name"
              autoComplete="given-name"
              placeholder="Alex"
              icon={<UserRound />}
              required
            />
            <FormTextField
              name="lastName"
              label="Last name"
              autoComplete="family-name"
              placeholder="Morgan"
              icon={<UserRound />}
              required
            />
          </div>
          <FormTextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@company.com"
            icon={<Mail />}
            required
          />
          <FormPhoneField name="phone" label="Phone number" hint="US number · 10 digits" required />
          <FormTextField
            name="organizationName"
            label="Organization name"
            autoComplete="organization"
            placeholder="Your company or team"
            icon={<Building2 />}
            required
          />
          <FormSubmitButton pendingLabel="Creating account…">Create account</FormSubmitButton>
        </AppFormProvider>
        <p className="mt-lg text-center text-sm leading-relaxed text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="app-link inline-flex min-h-touch items-center">Sign in</Link>
        </p>
      </AuthPageContent>
    </AuthLayout>
  )
}

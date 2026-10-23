import { useState } from "react";
import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { AppFormProvider } from "../forms/AppFormProvider";
import { FormPasswordField } from "../forms/FormPasswordField";
import { FormSubmitButton } from "../forms/FormSubmitButton";
import { FormTextField } from "../forms/FormTextField";
import { useAppForm } from "../forms/useAppForm";
import { signupFormSchema } from "../../schemas/authSchemas";
import { authConfigured, getAuthClient } from "../../services/auth";

export function RegistrationIdentity({ session }) {
  const form = useAppForm(signupFormSchema, {
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });
  const [emailSent, setEmailSent] = useState(null);
  const [error, setError] = useState(null);

  async function createLogin({ email, password }) {
    setError(null);
    try {
      const { error } = await getAuthClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      form.reset({ email, password: "", confirmPassword: "" });
      setEmailSent(email);
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (emailSent || session) {
    return (
      <section
        role="status"
        className="space-y-md rounded-card border border-border-subtle bg-surface-muted p-lg"
      >
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="wrap-break-words text-sm">
          Open the confirmation link sent to {emailSent || session.user.email}{" "}
          in this browser, then continue with your company details.
        </p>
        <p className="text-sm text-text-muted">
          If you already confirmed your email,{" "}
          <Link className="app-link" to="/login">
            sign in to continue
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <AppFormProvider
      form={form}
      onSubmit={createLogin}
      animated={false}
      aria-labelledby="register-title"
      className="space-y-lg"
    >
      <p className="text-sm text-text-muted">
        First create your sign-in and confirm your email. Then submit your
        company application for review.
      </p>
      {!authConfigured && (
        <p role="alert" className="text-sm text-danger">
          Sign-in is not configured. Please contact support.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <FormTextField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        icon={<Mail />}
        maxLength={254}
        required
      />
      <FormPasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        hint="Use at least 8 characters."
        required
      />
      <FormPasswordField
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        required
      />
      <FormSubmitButton
        disabled={!authConfigured}
        pendingLabel="Creating sign-in..."
      >
        Create account
      </FormSubmitButton>
    </AppFormProvider>
  );
}

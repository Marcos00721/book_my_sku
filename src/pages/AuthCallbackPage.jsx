import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthPageContent } from "../components/auth/AuthPageContent";
import { exchangeAuthCode, getAuthClient } from "../services/auth";

const verificationMessages = {
  otp_expired:
    "This email link is invalid, has expired, or has already been used. Sign in if your email is already confirmed, or request a new confirmation email.",
  flow_state_expired:
    "The sign-in step has expired. Your email may already be confirmed. Sign in with your email and password to continue.",
  flow_state_not_found:
    "This sign-in step is no longer available. Your email may already be confirmed. Sign in with your email and password to continue.",
  pkce_code_verifier_not_found:
    "The signup information needed to finish signing in is missing from this browser. Sign in with your email and password to continue.",
  bad_code_verifier:
    "This link does not match the signup started in this browser. A newer signup attempt may have replaced it. Sign in with your email and password to continue.",
  email_not_confirmed:
    "Your email is still waiting for confirmation. Request a new confirmation email.",
  missing_auth_code:
    "The confirmation page did not receive a sign-in code. If your email is already confirmed, sign in to continue.",
  verification_failed:
    "Email confirmation could not be completed. Sign in or request a new confirmation email.",
};

function verificationFailure(providerCode) {
  const code = Object.hasOwn(verificationMessages, providerCode)
    ? providerCode
    : "verification_failed";
  const failure = new Error(verificationMessages[code]);
  failure.code = code;
  return failure;
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [parameters] = useState(() => ({
    query: new URLSearchParams(window.location.search),
    fragment: new URLSearchParams(window.location.hash.slice(1)),
  }));
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const code = parameters.query.get("code");
    // Remove authentication parameters even when verification fails.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    async function confirmEmail() {
      try {
        // Supabase redirects verification errors in the fragment as well as
        // the query. Use known codes, never raw descriptions or token values.
        const providerError =
          parameters.query.get("error_code") ||
          parameters.fragment.get("error_code") ||
          parameters.query.get("error") ||
          parameters.fragment.get("error");
        if (providerError) throw verificationFailure(providerError);
        if (!code) {
          // Reloading this page removes the one-use code. A session already
          // established by the SDK can still continue safely.
          const { data, error } = await getAuthClient().auth.getSession();
          if (!error && data.session?.user?.email_confirmed_at) {
            if (active) navigate("/register", { replace: true });
            return;
          }
          throw verificationFailure("missing_auth_code");
        }
        const { data, error } = await exchangeAuthCode(code);
        if (error) throw verificationFailure(error.code);
        if (!data.session) throw verificationFailure("verification_failed");
        if (active) navigate("/register", { replace: true });
      } catch (failure) {
        if (active) setError(failure);
      }
    }
    void confirmEmail();
    return () => {
      active = false;
    };
  }, [navigate, parameters]);

  return (
    <AuthLayout variant="register">
      <AuthPageContent
        id="callback-title"
        eyebrow="Your account"
        title="Confirming your email"
        description="Your company application is the next step."
      >
        {error ? (
          <div className="space-y-md">
            <div role="alert" className="space-y-xs text-sm text-danger">
              <p>{error.message}</p>
              {error.code && (
                <p className="text-xs">Verification issue: {error.code}</p>
              )}
            </div>
            <Link className="app-link" to="/login">
              Back to sign in
            </Link>
          </div>
        ) : (
          <p role="status">Confirming your email...</p>
        )}
      </AuthPageContent>
    </AuthLayout>
  );
}

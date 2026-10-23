import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PageSpinner } from './components/ui/Spinner'


import { WorkspaceProvider } from './components/workspace/WorkspaceProvider'
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout'
import { SignedIn } from './components/workspace/SignedIn'

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((page) => ({ default: page.LoginPage })),
)
const ContinuePage = lazy(() =>
  import('./pages/ContinuePage').then((page) => ({ default: page.ContinuePage })),
)
const AssistedPage = lazy(() =>
  import('./pages/AssistedPage').then((page) => ({ default: page.AssistedWorkspacePage })),
)
const AssistedAcceptPage = lazy(() =>
  import('./pages/AssistedPage').then((page) => ({ default: page.AssistedAcceptPage })),
)
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((page) => ({
    default: page.RegisterPage,
  })),
)
const AccountHelpPage = lazy(() =>
  import('./pages/AccountHelpPage').then((page) => ({
    default: page.AccountHelpPage,
  })),
)
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((page) => ({
    default: page.ResetPasswordPage,
  })),
)
const AuthCallbackPage = lazy(() =>
  import('./pages/AuthCallbackPage').then((page) => ({
    default: page.AuthCallbackPage,
  })),
)
const SetupPage = lazy(() =>
  import('./pages/SetupPage').then((page) => ({ default: page.SetupPage })),
)
const InvitationPage = lazy(() =>
  import('./pages/InvitationPage').then((page) => ({
    default: page.InvitationPage,
  })),
)
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((page) => ({ default: page.AdminPage })),
)
const OverviewPage = lazy(() =>
  import('./pages/workspace/OverviewPage').then((page) => ({
    default: page.OverviewPage,
  })),
)
const ClientsPage = lazy(() =>
  import('./pages/workspace/ClientsPage').then((page) => ({
    default: page.ClientsPage,
  })),
)
const ClientDetailPage = lazy(() =>
  import('./pages/workspace/ClientDetailPage').then((page) => ({
    default: page.ClientDetailPage,
  })),
)
const TeamPage = lazy(() =>
  import('./pages/workspace/TeamPage').then((page) => ({
    default: page.TeamPage,
  })),
)
const RolesPage = lazy(() =>
  import('./pages/workspace/RolesPage').then((page) => ({
    default: page.RolesPage,
  })),
)
const BillingPage = lazy(() =>
  import('./pages/workspace/BillingPage').then((page) => ({
    default: page.BillingPage,
  })),
)
const SuppliersPage = lazy(() =>
  import('./pages/workspace/SuppliersPage').then((page) => ({
    default: page.SuppliersPage,
  })),
)
const SupplierDetailPage = lazy(() =>
  import('./pages/workspace/SupplierDetailPage').then((page) => ({
    default: page.SupplierDetailPage,
  })),
)
const MasterDataPage = lazy(() =>
  import('./pages/workspace/MasterDataPage').then((page) => ({
    default: page.MasterDataPage,
  })),
)

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/continue" element={<SignedIn><ContinuePage /></SignedIn>} />
        <Route path="/assisted/accept" element={<AssistedAcceptPage />} />
        <Route path="/assisted" element={<SignedIn><AssistedPage /></SignedIn>} />
        <Route path="/forgot-password" element={<AccountHelpPage />} />
        <Route
          path="/setup"
          element={
            <SignedIn>
              <SetupPage />
            </SignedIn>
          }
        />
        <Route path="/onboarding" element={<Navigate to="/setup" replace />} />
        <Route
          path="/billing/return"
          element={<Navigate to="/setup" replace />}
        />
        <Route path="/team/accept" element={<InvitationPage />} />
        <Route
          path="/admin"
          element={
            <SignedIn>
              <AdminPage />
            </SignedIn>
          }
        />
        <Route
          path="/app"
          element={
            <WorkspaceProvider>
              <WorkspaceLayout />
            </WorkspaceProvider>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:clientId" element={<ClientDetailPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="suppliers/:supplierId" element={<SupplierDetailPage />} />
          <Route path="master-data" element={<MasterDataPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

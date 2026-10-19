import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PageSpinner } from './components/ui/Spinner'

const LoginPage = lazy(() => import('./pages/LoginPage').then((page) => ({ default: page.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((page) => ({ default: page.RegisterPage })))
const AccountHelpPage = lazy(() => import('./pages/AccountHelpPage').then((page) => ({ default: page.AccountHelpPage })))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((page) => ({ default: page.AuthCallbackPage })))

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/forgot-password" element={<AccountHelpPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

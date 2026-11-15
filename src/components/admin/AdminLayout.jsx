import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { GlassSidebar } from '../common/GlassSidebar'
import { ErrorNotice, PageHeader } from '../workspace/Elements'
import { AppTopbar } from '../common/AppTopbar'
import { useAuthSession } from '../../hooks/useAuthSession'
import { getAuthClient } from '../../services/auth'
import { adminSections, adminSectionPath } from './adminSections'

export function AdminLayout({ section, children }) {
  const drawer = useRef(null)
  const menuButton = useRef(null)
  const content = useRef(null)
  const navigate = useNavigate()
  const auth = useAuthSession()
  const [error, setError] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const current = adminSections.find((item) => item.id === section)
  const email = auth.session?.user?.email || ''
  async function signOut() {
    setSigningOut(true)
    setError(null)
    try {
      const { error } = await getAuthClient().auth.signOut()
      if (error) throw error
      navigate('/login', { replace: true })
    } catch (failure) {
      setError(failure)
    } finally {
      setSigningOut(false)
    }
  }
  const groups = ['Platform', 'Onboarding', 'Configuration'].map((label) => ({
    label,
    items: adminSections.filter((item) => item.group === label).map((item) => ({
      ...item,
      to: adminSectionPath(item.id),
      active: section === item.id,
    })),
  }))
  return (
    <div className="workspace-shell admin-shell admin-lagoon has-glass-sidebar">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <GlassSidebar
        variant="admin"
        groups={groups}
        brandTo="/admin"
        scope={{ label: 'Platform administration', subtitle: 'Super administrator', Icon: ShieldCheck }}
        email={email}
        role="Super administrator"
        signOut={signOut}
        signingOut={signingOut}
        drawerRef={drawer}
        menuButtonRef={menuButton}
        mainRef={content}
      />
      <div className="workspace-body admin-body">
        <AppTopbar
          admin
          scope="Platform administration"
          rootLabel="Administration"
          rootTo="/admin"
          pageLabel={current.label}
          Icon={current.Icon}
          menuButtonRef={menuButton}
          onOpenNavigation={() => drawer.current.showModal()}
        />
        <main
          id="admin-main"
          ref={content}
          tabIndex={-1}
          className="workspace-main admin-main"
        >
          <PageHeader
            eyebrow="PLATFORM ADMINISTRATION"
            title={
              section === 'overview'
                ? 'A clearer view of your platform.'
                : current.label
            }
            description={
              section === 'overview'
                ? 'Welcome back. Keep new businesses moving and your platform in good shape.'
                : current.description
            }
          />
          <ErrorNotice error={error} />
          <div className="admin-content" key={section}>{children}</div>
        </main>
        <footer className="workspace-footer">
          <span>BookMySku · Administration</span>
          <span>One place to keep things moving.</span>
        </footer>
      </div>
    </div>
  )
}

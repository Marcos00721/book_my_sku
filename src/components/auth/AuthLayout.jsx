import {
  ArrowUpRight,
  Building2,
  Check,
  CircleHelp,
  ContactRound,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { BrandMark } from './BrandMark'

const workspaceRows = [
  { initials: 'AM', name: 'Avery Morgan', detail: 'Northstar Studio', status: 'On track' },
  { initials: 'JL', name: 'Jordan Lee', detail: 'Juniper Supply', status: 'Follow up' },
]

export function AuthLayout({ variant, children }) {
  return (
    <div className={`auth-shell auth-${variant}`}>
      <aside className="auth-story">
        <div className="auth-story-top">
          <BrandMark />
          <span className="auth-product-label">THE BUSINESS WORKSPACE</span>
        </div>

        <div className="auth-story-content">
          <p className="auth-kicker">
            <span className="auth-kicker-dot" />
            SPACE TO FOCUS. ROOM TO GROW.
          </p>
          <h2>
            Good work runs better when everything’s <span>in reach.</span>
          </h2>
          <p className="auth-story-description">
            Keep your people, relationships, and everyday details together in one
            calmer workspace.
          </p>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-topline">
              <span className="auth-preview-mark"><Building2 size={16} /></span>
              <span>YOUR WORKSPACE</span>
              <ArrowUpRight size={16} />
            </div>
            <div className="auth-preview-heading">
              <div>
                <small>RELATIONSHIP PULSE</small>
                <strong>All in rhythm</strong>
              </div>
              <div className="auth-preview-check"><Check size={17} /></div>
            </div>
            <div className="auth-preview-stats">
              <div><strong>24</strong><span>active clients</span></div>
              <div><strong>08</strong><span>to follow up</span></div>
              <div className="auth-preview-chart" aria-hidden="true">
                {[30, 47, 38, 66, 51, 78, 61, 92, 72, 100, 84, 112].map((height, index) => (
                  <span key={index} style={{ '--bar-height': `${height}%`, '--bar-index': index }} />
                ))}
              </div>
            </div>
            <div className="auth-preview-list">
              {workspaceRows.map((row) => (
                <div className="auth-preview-row" key={row.initials}>
                  <span className="auth-preview-avatar">{row.initials}</span>
                  <span className="auth-preview-person">
                    <strong>{row.name}</strong>
                    <small>{row.detail}</small>
                  </span>
                  <span className={`auth-preview-status ${row.status === 'Follow up' ? 'is-pending' : ''}`}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="auth-preview-float">
              <span><Users size={15} /></span>
              <strong>Your team, together</strong>
              <small>4 members</small>
            </div>
          </div>

          <div className="auth-story-points">
            <span><ContactRound size={15} /> Relationships, clearly organized</span>
            <span><ShieldCheck size={15} /> Your workspace stays yours</span>
          </div>
        </div>

        <div className="auth-story-bottom">
          <span>Built around the people behind your business.</span>
          <span className="auth-story-help"><CircleHelp size={14} /> A calmer way to work</span>
        </div>
      </aside>

      <main className="auth-main">
        <header className="auth-top">
          <div className="auth-mobile-brand"><BrandMark /></div>
          <ThemeToggle />
        </header>
        <div className="auth-form-wrap">
          <div className="auth-form" key={variant}>
            {children}
          </div>
        </div>
        <footer className="auth-footer">
          <ShieldCheck size={14} />
          <span>Secure access to your business workspace</span>
        </footer>
      </main>
    </div>
  )
}

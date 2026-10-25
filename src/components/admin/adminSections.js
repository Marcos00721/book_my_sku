import {
  Boxes,
  CreditCard,
  Handshake,
  Inbox,
  LayoutDashboard,
  MailCheck,
  ShieldCheck,
} from 'lucide-react'

export const adminSections = [
  {
    id: 'overview',
    label: 'Overview',
    group: 'Platform',
    Icon: LayoutDashboard,
    description: 'Your starting point for platform operations.',
  },
  {
    id: 'applications',
    label: 'Applications',
    group: 'Onboarding',
    Icon: Inbox,
    description: 'Review company requests and prepare their commercial offers.',
  },
  {
    id: 'registrations',
    label: 'Email verification',
    group: 'Onboarding',
    Icon: MailCheck,
    description: 'Follow registrations waiting for email confirmation.',
  },
  {
    id: 'assisted',
    label: 'Assisted onboarding',
    group: 'Onboarding',
    Icon: Handshake,
    description: 'Manage reviewed invitations and future billing agreements.',
  },
  {
    id: 'plan',
    label: 'Standard plan',
    group: 'Configuration',
    Icon: CreditCard,
    description: 'Manage pricing and version history for future offers.',
  },
  {
    id: 'masterData',
    label: 'Master data',
    group: 'Configuration',
    Icon: Boxes,
    description: 'Prepare and publish the starter lists for new workspaces.',
  },
  {
    id: 'catalog',
    label: 'Permission catalog',
    group: 'Configuration',
    Icon: ShieldCheck,
    description: 'Manage the permissions available to workspace roles.',
  },
]

export const adminSectionPath = (id) =>
  id === 'overview' ? '/admin' : `/admin?section=${id}`

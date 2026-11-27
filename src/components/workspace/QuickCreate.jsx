import { useEffect, useId, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Boxes, Building2, Plus, Truck, UserRoundSearch } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { fetchClients } from '../../store/clientSlice'
import { fetchSuppliers } from '../../store/supplierSlice'
import { fetchCustomProducts } from '../../store/customProductSlice'
import { Button } from '../common/Button'
import { Dialog, ErrorNotice, Loading } from './Elements'
import '../../styles/quick-create.css'

const formLoaders = {
  lead: () => import('../leads/LeadForm').then((module) => module.LeadForm),
  client: () => import('../clients/ClientForm').then((module) => module.ClientForm),
  supplier: () => import('../suppliers/SupplierEditor').then((module) => module.SupplierEditor),
  product: () => import('../customProducts/CustomProductForm').then((module) => module.CustomProductForm),
}

const options = [
  { key: 'lead', label: 'Add lead', description: 'Capture a new inquiry', area: 'inquiries', route: 'leads', Icon: UserRoundSearch },
  { key: 'client', label: 'Add client', description: 'Create a client relationship', area: 'clients', route: 'clients', Icon: Building2, refresh: fetchClients },
  { key: 'supplier', label: 'Add supplier', description: 'Add a supplier or decorator', area: 'suppliers', route: 'suppliers', Icon: Truck, refresh: fetchSuppliers },
  { key: 'product', label: 'Add product', description: 'Create a supplier-linked product', area: 'products', route: 'products', Icon: Boxes, refresh: fetchCustomProducts },
]

function CreationDialog({ option, base, close, saved }) {
  const [loaded, setLoaded] = useState({ Form: null, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    formLoaders[option.key]().then(
      (Form) => { if (!cancelled) setLoaded({ Form, error: null }) },
      (error) => { if (!cancelled) setLoaded({ Form: null, error }) },
    )
    return () => { cancelled = true }
  }, [option.key, attempt])

  const { Form, error } = loaded
  if (!Form) {
    return (
      <Dialog title={option.label} close={close}>
        {error
          ? <ErrorNotice error={error} retry={() => setAttempt((value) => value + 1)} />
          : <Loading variant="form" />}
      </Dialog>
    )
  }
  return <Form path={`${base}/${option.area}`} productsBase={base} close={close} saved={saved} />
}

export function QuickCreate() {
  const workspace = useWorkspace()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const root = useRef(null)
  const trigger = useRef(null)
  const menu = useRef(null)
  const menuId = useId()
  const available = options.filter((option) => workspace.canWrite(`${option.area}.add`))

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('[role="menuitem"]')?.focus()
    function outside(event) {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function close() {
    setSelected(null)
    requestAnimationFrame(() => trigger.current?.focus())
  }

  function saved(record) {
    close()
    if (!workspace.can(`${selected.area}.view`)) return
    if (selected.refresh) dispatch(selected.refresh({ base: workspace.base, force: true }))
    if (selected.key === 'lead') {
      navigate('/app/leads', { state: { createdLead: record.targetId || record._id || record.id || crypto.randomUUID() } })
    } else {
      navigate(`/app/${selected.route}/${record._id || record.id}`)
    }
  }

  if (!workspace.writesAllowed || !available.length) return null
  const active = available.find((option) => option.key === selected?.key)

  return (
    <>
      <div
        className="quick-create"
        ref={root}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
            trigger.current?.focus()
          }
        }}
      >
        <Button
          ref={trigger}
          variant="icon"
          className="quick-create-trigger"
          aria-label="Quick create"
          title={open || selected ? undefined : 'Quick create'}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
            }
          }}
        >
          <Plus size={21} aria-hidden="true" />
        </Button>
        {open && (
          <div
            ref={menu}
            id={menuId}
            className="quick-create-menu"
            role="menu"
            aria-label="Quick create"
            onKeyDown={(event) => {
              const items = [...menu.current.querySelectorAll('[role="menuitem"]')]
              const index = items.indexOf(document.activeElement)
              let next
              if (event.key === 'ArrowDown') next = (index + 1) % items.length
              if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
              if (event.key === 'Home') next = 0
              if (event.key === 'End') next = items.length - 1
              if (next !== undefined) {
                event.preventDefault()
                items[next].focus()
              }
            }}
          >
            <p className="quick-create-heading" role="presentation">Create new</p>
            {available.map((option) => {
              const { key, label, description, Icon } = option
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="quick-create-option"
                  aria-label={label}
                  onClick={() => {
                    setOpen(false)
                    setSelected(option)
                  }}
                >
                  <span className="quick-create-icon"><Icon size={19} aria-hidden="true" /></span>
                  <span><strong>{label}</strong><span className="quick-create-description">{description}</span></span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {active && (
        <CreationDialog key={active.key} option={active} base={workspace.base} close={close} saved={saved} />
      )}
    </>
  )
}

import { ArrowUpRight, Check, ChevronRight, Coffee, Package, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { BrandMark } from './BrandMark'

const inventoryProducts = [
  { name: 'Studio desk lamp', sku: 'SKU-LMP-042', stock: '128 in stock', Icon: Package },
  { name: 'Everyday tote', sku: 'SKU-BAG-018', stock: '256 in stock', Icon: ShoppingBag },
  { name: 'Ceramic coffee mug', sku: 'SKU-MUG-063', stock: '384 in stock', Icon: Coffee },
]

function InventoryIllustration() {
  return (
    <div aria-hidden="true" className="relative mx-auto mb-xl mt-2xl w-full max-w-illustration pb-xl">
      <div className="glass overflow-hidden rounded-card shadow-card">
        <div className="flex items-center justify-between gap-sm border-b border-border-subtle p-lg">
          <div className="flex items-center gap-sm">
            <span className="flex h-touch w-touch items-center justify-center rounded-control bg-primary-soft text-primary">
              <Package className="h-icon w-icon" />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-base">Inventory overview</p>
              <p className="mt-micro text-xs text-text-muted">Everything in its right place.</p>
            </div>
          </div>
          <span className="rounded-pill bg-success-muted px-xs py-micro text-xs font-medium text-success">Live</span>
        </div>
        <div className="grid grid-cols-2 gap-md border-b border-border-subtle px-lg py-md">
          <div>
            <p className="text-xs text-text-muted">Total products</p>
            <p className="mt-xs font-display text-2xl font-semibold tracking-tight text-text-base">1,284</p>
          </div>
          <div className="border-l border-border-subtle pl-lg">
            <p className="text-xs text-text-muted">Inventory accuracy</p>
            <p className="mt-xs font-display text-2xl font-semibold tracking-tight text-text-base">99.8<span className="text-lg">%</span></p>
          </div>
        </div>
        <div className="divide-y divide-border-subtle px-lg">
          {inventoryProducts.map(({ name, sku, stock, Icon }) => (
            <div key={sku} className="flex items-center gap-sm py-md">
              <span className="flex h-touch w-touch shrink-0 items-center justify-center rounded-control border border-border-subtle bg-surface-muted text-text-muted">
                <Icon className="h-icon w-icon" />
              </span>
              <div className="min-w-none flex-1">
                <p className="truncate text-xs font-medium text-text-base">{name}</p>
                <p className="mt-micro text-xs text-text-muted">{sku}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-success">{stock}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-muted px-lg py-sm text-xs text-text-muted">
          <span>One clear view. More control.</span>
          <ChevronRight className="h-icon-sm w-icon-sm" />
        </div>
      </div>
      <div className="absolute bottom-none right-md flex items-center gap-sm rounded-card border border-border-subtle bg-surface px-lg py-md shadow-float">
        <span className="flex h-touch w-touch items-center justify-center rounded-pill bg-success-muted text-success">
          <Check className="h-icon w-icon" />
        </span>
        <div>
          <p className="text-sm font-semibold text-text-base">Another order, sorted.</p>
          <p className="mt-micro flex items-center gap-micro text-xs text-text-muted">
            Ready for what comes next <ArrowUpRight className="h-icon-sm w-icon-sm" />
          </p>
        </div>
      </div>
    </div>
  )
}

export function AuthLayout({ variant, children }) {
  return (
    <div className="min-h-screen bg-surface font-sans text-text-base lg:grid lg:grid-cols-auth">
      <aside className="relative hidden min-h-screen flex-col overflow-hidden border-r border-brand-line bg-brand-panel px-2xl py-xl lg:flex xl:px-3xl">
        <BrandMark />
        <div className="my-xl flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-illustration">
            <p className="mb-lg inline-flex items-center gap-xs rounded-pill border border-brand-line bg-brand-surface px-sm py-xs text-xs font-medium text-brand-deep">
              <Sparkles className="h-icon-sm w-icon-sm" aria-hidden="true" />
              A little more organized. A lot more possible.
            </p>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-text-base xl:text-5xl">
              Less busywork.<br /><span className="text-primary">More business.</span>
            </h2>
            <p className="mt-lg text-base leading-relaxed text-text-muted">
              Your products, orders, and next big idea.<br />One place to keep it all moving.
            </p>
          </div>
          <InventoryIllustration />
          <p className="mx-auto flex w-full max-w-illustration items-center gap-xs text-xs text-brand-deep">
            <ShieldCheck className="h-icon-sm w-icon-sm shrink-0" aria-hidden="true" />
            A calmer workspace for a growing business.
          </p>
        </div>
        <p className="text-xs text-text-muted">Built for the way your business grows.</p>
      </aside>

      <main className="flex min-h-screen min-w-none flex-col px-lg py-lg sm:px-xl lg:px-2xl lg:py-xl xl:px-3xl">
        <div className="mb-xl flex items-center justify-between lg:justify-end">
          <div className="lg:hidden"><BrandMark /></div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-lg lg:py-xl">
          <div className="w-full max-w-form" key={variant}>{children}</div>
        </div>
        <footer className="mt-xl flex flex-wrap items-center justify-center gap-xs text-center text-xs leading-relaxed text-text-muted">
          <ShieldCheck className="h-icon-sm w-icon-sm shrink-0" aria-hidden="true" />
          <span>Your business starts with a little peace of mind.</span>
        </footer>
      </main>
    </div>
  )
}

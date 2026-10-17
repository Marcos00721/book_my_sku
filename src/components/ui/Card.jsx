/**
 * Flexible card container with theme-driven surface, border, shadow, and radius.
 *
 * @example
 *   <Card>Plain content</Card>
 *   <Card header="Section title" footer={<Button>Save</Button>}>Body</Card>
 *   <Card glass>Frosted glass card</Card>
 */
export function Card({
  header,
  footer,
  glass = false,
  className = '',
  children,
  ...props
}) {
  const base = glass
    ? 'glass rounded-card shadow-card'
    : 'rounded-card border border-border-subtle bg-surface shadow-subtle'

  return (
    <div
      className={[
        base,
        'motion-safe:transition-shadow hover:shadow-card',
        className,
      ].join(' ')}
      {...props}
    >
      {header && (
        <div className="border-b border-border-subtle px-lg py-md">
          {typeof header === 'string' ? (
            <h3 className="text-sm font-semibold text-text-base">{header}</h3>
          ) : (
            header
          )}
        </div>
      )}
      <div className="px-lg py-lg">{children}</div>
      {footer && (
        <div className="border-t border-border-subtle px-lg py-md">
          {footer}
        </div>
      )}
    </div>
  )
}

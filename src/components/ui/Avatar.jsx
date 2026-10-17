/**
 * User avatar with initials fallback.
 *
 * @example
 *   <Avatar name="Alex Morgan" />
 *   <Avatar name="Alex Morgan" src="/img/alex.jpg" size="lg" />
 */
export function Avatar({
  name = '',
  src,
  size = 'md',
  className = '',
  ...props
}) {
  const sizeClasses = {
    sm: 'size-icon text-xs',
    md: 'size-touch text-sm',
    lg: 'size-control text-base',
  }

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <span
      role="img"
      aria-label={name || 'Avatar'}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-pill font-semibold',
        'bg-primary-soft text-primary',
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="size-full rounded-pill object-cover"
        />
      ) : (
        initials || '?'
      )}
    </span>
  )
}

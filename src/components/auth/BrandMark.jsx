import { Link } from 'react-router-dom'

export function BrandMark() {
  return (
    <Link
      to="/login"
      aria-label="BookMySku home"
      className="inline-flex w-fit items-center rounded-control outline-none motion-safe:transition-transform hover:scale-105 focus-visible:ring-focus focus-visible:ring-primary focus-visible:ring-offset-focus focus-visible:ring-offset-brand-surface"
    >
      <span className="brand-mark-logo" aria-hidden="true">
        <img
          className="brand-mark-logo-light"
          src="/logos/bookmysku-logo-on-light.png"
          alt=""
          width="1800"
          height="600"
        />
        <img
          className="brand-mark-logo-dark"
          src="/logos/bookmysku-logo-on-dark.png"
          alt=""
          width="1800"
          height="600"
        />
      </span>
    </Link>
  )
}

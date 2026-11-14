import { theme } from '@/crm-theme'

export function ProgressBar({ value = 0, label }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className="file-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label || `Upload ${clamped}%`}
    >
      <div className="file-progress-track">
        <div
          className="file-progress-fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={theme.cx('file-progress-label', 'muted')}>
        {clamped}%
      </span>
    </div>
  )
}

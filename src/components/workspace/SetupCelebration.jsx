import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'

const BURSTS = [
  { x: -72, y: -48, delay: 0.05 },
  { x: 78, y: -36, delay: 0.1 },
  { x: -54, y: 42, delay: 0.14 },
  { x: 62, y: 50, delay: 0.08 },
  { x: 0, y: -70, delay: 0.12 },
  { x: -90, y: 8, delay: 0.16 },
  { x: 94, y: 12, delay: 0.18 },
]

export function SetupCelebration({
  title,
  description,
  onContinue,
  continueLabel = 'Continue',
  autoAdvanceMs = 2200,
}) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!onContinue || !autoAdvanceMs) return undefined
    // Still auto-advance with reduced motion — just skip the long delay.
    const timer = setTimeout(onContinue, reduceMotion ? 0 : autoAdvanceMs)
    return () => clearTimeout(timer)
  }, [onContinue, reduceMotion, autoAdvanceMs])

  return (
    <section
      className="setup-celebration"
      aria-live="polite"
      aria-label={title}
    >
      <div className="setup-celebration-stage">
        {!reduceMotion &&
          BURSTS.map((burst, index) => (
            <motion.span
              key={index}
              className="setup-celebration-burst"
              initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.2, 1, 0.6],
                x: burst.x,
                y: burst.y,
              }}
              transition={{
                duration: 0.9,
                delay: burst.delay,
                ease: 'easeOut',
              }}
            />
          ))}
        <motion.div
          className="setup-celebration-badge"
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 320, damping: 16 }
          }
        >
          <Check size={28} strokeWidth={2.5} aria-hidden="true" />
        </motion.div>
      </div>
      <motion.div
        className="setup-celebration-copy"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.15 }}
      >
        <h2>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
        {onContinue ? (
          <button type="button" className="button" onClick={onContinue}>
            {continueLabel}
          </button>
        ) : null}
      </motion.div>
    </section>
  )
}

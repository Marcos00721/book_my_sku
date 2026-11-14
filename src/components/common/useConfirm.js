import { useContext } from 'react'
import { ConfirmContext } from './ConfirmContext'

/** Hook: `const confirm = useConfirm()` → `await confirm({ message })`. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return confirm
}

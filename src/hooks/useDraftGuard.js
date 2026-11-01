import { useEffect } from 'react'

export function useDraftGuard(dirty) {
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const navigation = (event) => {
      if (
        !window.confirm(
          'Discard unsaved changes? Choose Cancel to stay and save.',
        )
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const link = (event) => {
      if (event.target.closest('a[href]')) navigation(event)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('workspace-before-switch', navigation)
    document.addEventListener('click', link, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('workspace-before-switch', navigation)
      document.removeEventListener('click', link, true)
    }
  }, [dirty])
}

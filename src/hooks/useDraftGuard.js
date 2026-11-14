import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { askConfirm } from '../components/common/confirm'

const DISCARD_MESSAGE =
  'Discard unsaved changes? Choose Cancel to stay and save.'

export function useDraftGuard(dirty) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!dirty) return

    const beforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const askDiscard = () =>
      askConfirm({
        title: 'Discard changes?',
        message: DISCARD_MESSAGE,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      })

    const navigation = (event) => {
      event.preventDefault()
      event.stopPropagation()
      void askDiscard().then((ok) => {
        if (ok) event.detail?.proceed?.()
        else event.detail?.cancel?.()
      })
    }

    const link = (event) => {
      const anchor = event.target.closest('a[href]')
      if (!anchor || anchor.target === '_blank') return
      event.preventDefault()
      event.stopPropagation()
      void askDiscard().then((ok) => {
        if (!ok) return
        const url = new URL(anchor.href, window.location.origin)
        if (url.origin === window.location.origin) {
          navigate(url.pathname + url.search + url.hash)
        } else {
          window.location.assign(anchor.href)
        }
      })
    }

    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('workspace-before-switch', navigation)
    document.addEventListener('click', link, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('workspace-before-switch', navigation)
      document.removeEventListener('click', link, true)
    }
  }, [dirty, navigate])
}

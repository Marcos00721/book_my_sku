import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { ConfirmContext } from './ConfirmContext'
import { registerConfirm } from './confirm'

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setRequest({
        title: options.title || 'Please confirm',
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        tone: options.tone || 'primary',
        resolve,
      })
    })
  }, [])

  useEffect(() => {
    registerConfirm(confirm)
    return () => registerConfirm(null)
  }, [confirm])

  function settle(value) {
    request?.resolve(value)
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={Boolean(request)}
        title={request?.title}
        message={request?.message}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        tone={request?.tone}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  )
}

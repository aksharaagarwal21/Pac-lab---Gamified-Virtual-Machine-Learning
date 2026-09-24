import { useCallback, useEffect, useRef, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef()

  useEffect(() => () => clearTimeout(timer.current), [])

  const notify = useCallback((text, tone = 'warn') => {
    clearTimeout(timer.current)
    setToast({ id: Date.now(), text, tone })
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  return { toast, notify }
}

export function Toast({ toast }) {
  return (
    <div className="mz-toast-wrap" role="status" aria-live="polite">
      {toast && (
        <p key={toast.id} className={`mz-toast${toast.tone === 'good' ? ' is-good' : ''}`}>
          {toast.text}
        </p>
      )}
    </div>
  )
}

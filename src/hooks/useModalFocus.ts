import { useEffect, useRef } from 'react'

/** Move focus into an open dialog and restore it to the trigger on close. */
export function useModalFocus(isOpen: boolean) {
  const initialFocusRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    initialFocusRef.current?.focus()
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isOpen])

  return initialFocusRef
}

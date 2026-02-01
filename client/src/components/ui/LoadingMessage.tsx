import React from 'react'

const WRAPPER_CLASS = 'p-4 text-center text-slate-500 text-sm'

type LoadingMessageProps = {
  children?: React.ReactNode
}

/**
 * Reusable loading state message (centered, muted text).
 */
export default function LoadingMessage({
  children = 'Loading…',
}: LoadingMessageProps) {
  return (
    <div className={WRAPPER_CLASS} role="status" aria-live="polite">
      {children}
    </div>
  )
}

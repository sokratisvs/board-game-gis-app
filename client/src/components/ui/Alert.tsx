import React from 'react'

const VARIANTS = {
  error: 'px-4 py-3 bg-red-50 text-red-700 rounded mb-4 text-sm',
  success: 'px-4 py-3 bg-green-50 text-green-700 rounded mb-4 text-sm',
} as const

type AlertProps = {
  variant?: keyof typeof VARIANTS
  children: React.ReactNode
  /** Accessible role; default 'alert' for error/success */
  role?: 'alert' | 'status'
  className?: string
}

/**
 * Reusable alert message (error, success).
 */
export default function Alert({
  variant = 'error',
  children,
  role = 'alert',
  className = '',
}: AlertProps) {
  return (
    <div className={`${VARIANTS[variant]} ${className}`.trim()} role={role}>
      {children}
    </div>
  )
}

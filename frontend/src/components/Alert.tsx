import type { ReactNode } from 'react'

const TONES = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
} as const

interface AlertProps {
  tone?: keyof typeof TONES
  children: ReactNode
  className?: string
}

/** Announced by screen readers as soon as it appears. */
export function Alert({
  tone = 'error',
  children,
  className = '',
}: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  )
}

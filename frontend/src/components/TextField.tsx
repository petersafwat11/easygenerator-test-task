import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  /** Extra content under the input (e.g. a checklist), linked via aria-describedby. */
  description?: ReactNode
  /** Rendered inside the input's box, at the end (e.g. a show/hide toggle). */
  trailing?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function TextField({
  label,
  error,
  description,
  trailing,
  id,
  className = '',
  ref,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const descriptionId = `${inputId}-description`
  const describedBy =
    [error ? errorId : null, description ? descriptionId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-900"
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:outline-none sm:text-sm ${
            error
              ? 'ring-red-400 focus:ring-red-600'
              : 'ring-slate-300 focus:ring-indigo-600'
          } ${trailing ? 'pr-20' : ''}`}
          {...inputProps}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
            {trailing}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {description && (
        <div id={descriptionId} className="mt-2">
          {description}
        </div>
      )}
    </div>
  )
}

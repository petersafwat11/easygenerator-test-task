import { useId, useState } from 'react'
import { TextField } from './TextField'
import type { TextFieldProps } from './TextField'

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'trailing'>

/** A password input with a labelled show/hide toggle. */
export function PasswordField({ id, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <TextField
      {...props}
      id={inputId}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={inputId}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  )
}

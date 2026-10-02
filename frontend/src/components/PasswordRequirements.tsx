import { PASSWORD_RULES } from '../features/auth/schemas'

/** Live checklist: each rule ticks as soon as the typed password satisfies it. */
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul aria-label="Password requirements" className="space-y-1 text-sm">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li
            key={rule.id}
            data-rule={rule.id}
            data-met={met}
            className={`flex items-center gap-2 ${met ? 'text-emerald-700' : 'text-slate-500'}`}
          >
            <span aria-hidden="true" className="w-4 text-center">
              {met ? '✓' : '○'}
            </span>
            {rule.label}
            <span className="sr-only">{met ? '(met)' : '(not met yet)'}</span>
          </li>
        )
      })}
    </ul>
  )
}

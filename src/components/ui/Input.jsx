function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Input({
  as = 'input',
  label,
  id,
  error,
  helperText,
  options = [],
  className = '',
  ...props
}) {
  const fieldClasses = joinClasses(
    'input-field',
    error ? 'input-field-error' : '',
    className,
  )

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-secondary-700">
          {label}
        </label>
      )}

      {as === 'select' ? (
        <select id={id} className={fieldClasses} aria-invalid={Boolean(error)} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : as === 'textarea' ? (
        <textarea id={id} className={fieldClasses} aria-invalid={Boolean(error)} {...props} />
      ) : (
        <input id={id} className={fieldClasses} aria-invalid={Boolean(error)} {...props} />
      )}

      {error ? (
        <p className="text-xs text-danger-600">{error}</p>
      ) : (
        helperText && <p className="text-xs text-secondary-500">{helperText}</p>
      )}
    </div>
  )
}

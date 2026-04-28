function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ')
}

const VARIANT_CLASSES = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
}

const SIZE_CLASSES = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  isLoading = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  const isDisabled = disabled || isLoading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={joinClasses(
        'btn',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        className,
      )}
      {...props}
    >
      {isLoading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}

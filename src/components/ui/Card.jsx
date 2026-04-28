function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Card({
  title,
  subtitle,
  actions,
  children,
  footer,
  className = '',
}) {
  return (
    <section className={joinClasses('card', className)}>
      {(title || subtitle || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <h3 className="text-subheading text-secondary-900">{title}</h3>}
            {subtitle && <p className="text-small">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}

      <div>{children}</div>

      {footer && <footer className="mt-5 border-t border-secondary-200 pt-4">{footer}</footer>}
    </section>
  )
}

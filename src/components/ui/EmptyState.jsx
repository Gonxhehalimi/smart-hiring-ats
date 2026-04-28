function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  className = '',
}) {
  return (
    <div
      className={joinClasses(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary-200 bg-secondary-50/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && <Icon className="h-10 w-10 text-secondary-300" />}
      <h3 className="mt-4 text-subheading text-secondary-700">{title}</h3>
      {description && <p className="mt-1 max-w-md text-small">{description}</p>}
    </div>
  )
}

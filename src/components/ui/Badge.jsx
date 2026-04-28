function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ')
}

const VARIANT_CLASSES = {
  shortlisted: 'badge-shortlisted',
  rejected: 'badge-rejected',
  review: 'badge-review',
}

export default function Badge({ variant = 'review', children, className = '' }) {
  return (
    <span
      className={joinClasses(
        'badge',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.review,
        className,
      )}
    >
      {children}
    </span>
  )
}

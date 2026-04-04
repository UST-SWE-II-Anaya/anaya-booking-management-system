// src/components/common/Badge.jsx
import clsx from 'clsx'

const variants = {
  upcoming: 'bg-blue-100 text-blue-700',
  finished: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-orange-100 text-orange-700',
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  verified: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  banned: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  unread: 'bg-blue-100 text-blue-700',
  read: 'bg-gray-100 text-gray-600',
  archived: 'bg-gray-100 text-gray-400',
}

/** @param {{ variant: string, label: string, className?: string }} props */
const Badge = ({ variant, label, className }) => (
  <span
    className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant] ?? 'bg-gray-100 text-gray-600',
      className
    )}
  >
    {label}
  </span>
)

export default Badge

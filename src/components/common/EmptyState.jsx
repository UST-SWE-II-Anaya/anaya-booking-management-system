// src/components/common/EmptyState.jsx
import { Inbox } from 'lucide-react'

/** @param {{ title?: string, message?: string, icon?: React.ElementType }} props */
const EmptyState = ({
  title = 'Nothing here yet',
  message = 'No records found.',
  icon: Icon = Inbox,
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="p-4 bg-gray-100 rounded-full mb-4">
      <Icon size={24} className="text-gray-400" />
    </div>
    <p className="font-medium text-[#4A4A4A]">{title}</p>
    <p className="text-sm text-gray-400 mt-1">{message}</p>
  </div>
)

export default EmptyState

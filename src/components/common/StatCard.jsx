// src/components/common/StatCard.jsx
import clsx from 'clsx'

const colorMap = {
  green: 'bg-[#8A956D]/10 text-[#8A956D]',
  rust: 'bg-[#CE845D]/10 text-[#CE845D]',
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
}

// eslint-disable-next-line no-unused-vars
const StatCard = ({ label, value, icon: Icon, color = 'green', sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 flex
    items-start gap-4 shadow-sm">
    <div className={clsx('p-2.5 rounded-lg', colorMap[color])}>
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-[#2C2C2C] mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

export default StatCard

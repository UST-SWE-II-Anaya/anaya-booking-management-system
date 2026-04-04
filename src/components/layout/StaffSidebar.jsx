import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  UserCircle,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { label: 'Dashboard', to: '/staff', icon: LayoutDashboard, end: true },
  { label: 'Appointments', to: '/staff/appointments', icon: CalendarDays },
  { label: 'Leave Request', to: '/staff/leave', icon: ClipboardList },
  { label: 'Profile', to: '/staff/profile', icon: UserCircle },
]

const StaffSidebar = () => (
  <aside className="w-60 min-h-screen bg-[#2C2C2C] flex flex-col">
    <div className="px-6 py-6 border-b border-white/10">
      <span className="text-white font-serif text-xl font-semibold tracking-wide">
        Anaya
      </span>
      <p className="text-white/40 text-xs mt-0.5">Staff Portal</p>
    </div>

    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm',
              'transition-colors duration-150',
              isActive
                ? 'bg-[#8A956D] text-white font-medium'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            )
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  </aside>
)

export default StaffSidebar

// src/components/layout/AdminSidebar.jsx
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Briefcase,
  Scissors,
  Mail,
  Settings,
  ClipboardList,
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarDays },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Staff', to: '/admin/staff', icon: Briefcase, end: true },
  { label: 'Leave Requests', to: '/admin/staff/leave-requests', icon: ClipboardList },
  { label: 'Services', to: '/admin/services', icon: Scissors },
  { label: 'Inquiries', to: '/admin/inquiries', icon: Mail },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]

const AdminSidebar = () => (
  <aside className="w-60 min-h-screen bg-[#2C2C2C] flex flex-col">
    <div className="px-6 py-6 border-b border-white/10">
      <span className="text-white font-serif text-xl font-semibold tracking-wide">
        Anaya
      </span>
      <p className="text-white/40 text-xs mt-0.5">Admin Portal</p>
    </div>

    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ label, to, icon: Icon, end }) => ( // eslint-disable-line no-unused-vars
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

export default AdminSidebar

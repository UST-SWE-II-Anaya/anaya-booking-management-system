import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import StaffSidebar from './StaffSidebar'
import { signOut } from '../../services/authService'
import useAuthStore from '../../store/authStore'

const StaffLayout = () => {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : 'Staff'

  return (
    <div className="flex min-h-screen bg-[#F9F8F5]">
      <StaffSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center
          justify-between px-6 flex-shrink-0">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#4A4A4A] font-medium">{displayName}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500
                hover:text-[#CE845D] transition-colors"
              aria-label="Logout"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default StaffLayout

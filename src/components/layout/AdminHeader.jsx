// src/components/layout/AdminHeader.jsx
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { signOut } from '../../services/authService'
import useAuthStore from '../../store/authStore'

const AdminHeader = () => {
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
    : 'Admin'

  return (
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
  )
}

export default AdminHeader

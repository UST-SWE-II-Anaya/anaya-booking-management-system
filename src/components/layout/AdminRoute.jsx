// src/components/layout/AdminRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import Spinner from '../common/Spinner'

const AdminRoute = () => {
  const { loading, profile } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  if (profile.account_status !== 'active') {
    return <Navigate to="/account-inactive" replace />
  }

  return <Outlet />
}

export default AdminRoute

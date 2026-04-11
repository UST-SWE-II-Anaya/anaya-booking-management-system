import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import Spinner from '../common/Spinner'

const CustomerRoute = () => {
  const { loading, profile } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!profile || profile.role !== 'customer') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default CustomerRoute

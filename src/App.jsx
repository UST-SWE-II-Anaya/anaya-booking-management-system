// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthUser from './hooks/useAuthUser'
import AdminRoute from './components/layout/AdminRoute'
import AdminLayout from './components/layout/AdminLayout'
import StaffRoute from './components/layout/StaffRoute'
import StaffLayout from './components/layout/StaffLayout'
import LoginPage from './pages/auth/LoginPage'

// Admin pages
import DashboardPage from './pages/admin/DashboardPage'
import BookingsPage from './pages/admin/bookings/BookingsPage'
import BookingDetailPage from './pages/admin/bookings/BookingDetailPage'
import CustomersPage from './pages/admin/customers/CustomersPage'
import CustomerDetailPage from './pages/admin/customers/CustomerDetailPage'
import StaffPage from './pages/admin/staff/StaffPage'
import LeaveRequestsPage from './pages/admin/staff/LeaveRequestsPage'
import CategoriesPage from './pages/admin/services/CategoriesPage'
import ServicesPage from './pages/admin/services/ServicesPage'
import InquiriesPage from './pages/admin/inquiries/InquiriesPage'
import SettingsPage from './pages/admin/settings/SettingsPage'

// Staff pages
import StaffDashboardPage from './pages/staff/DashboardPage'
import StaffAppointmentsPage from './pages/staff/AppointmentsPage'
import StaffLeaveRequestPage from './pages/staff/LeaveRequestPage'
import StaffProfileSettingsPage from './pages/staff/ProfileSettingsPage'

const App = () => {
  useAuthUser()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Admin routes */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/bookings" element={<BookingsPage />} />
          <Route path="/admin/bookings/:id" element={<BookingDetailPage />} />
          <Route path="/admin/customers" element={<CustomersPage />} />
          <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/admin/staff" element={<StaffPage />} />
          <Route path="/admin/staff/leave-requests" element={<LeaveRequestsPage />} />
          <Route path="/admin/services" element={<CategoriesPage />} />
          <Route path="/admin/services/:categoryId" element={<ServicesPage />} />
          <Route path="/admin/inquiries" element={<InquiriesPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Staff routes */}
      <Route element={<StaffRoute />}>
        <Route element={<StaffLayout />}>
          <Route path="/staff" element={<StaffDashboardPage />} />
          <Route path="/staff/appointments" element={<StaffAppointmentsPage />} />
          <Route path="/staff/leave" element={<StaffLeaveRequestPage />} />
          <Route path="/staff/profile" element={<StaffProfileSettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App

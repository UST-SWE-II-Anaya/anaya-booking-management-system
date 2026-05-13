// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
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
import StaffDetailPage from './pages/admin/staff/StaffDetailPage'
import LeaveRequestsPage from './pages/admin/staff/LeaveRequestsPage'
import AdminCategoriesPage from './pages/admin/services/CategoriesPage'
import AdminServicesPage from './pages/admin/services/ServicesPage'
import InquiriesPage from './pages/admin/inquiries/InquiriesPage'
import SettingsPage from './pages/admin/settings/SettingsPage'
import QRPaymentPage from './pages/admin/qr-payment/QRPaymentPage'

// Staff pages
import StaffDashboardPage from './pages/staff/DashboardPage'
import StaffAppointmentsPage from './pages/staff/AppointmentsPage'
import StaffLeaveRequestPage from './pages/staff/LeaveRequestPage'
import StaffProfileSettingsPage from './pages/staff/ProfileSettingsPage'

// Customer pages
import CustomerRoute from './components/layout/CustomerRoute'
import ServicesStep from './pages/customer/ServicesStep'
import StaffStep from './pages/customer/StaffStep'
import DateTimeStep from './pages/customer/DateTimeStep'
import ReviewStep from './pages/customer/ReviewStep'
import PaymentStep from './pages/customer/PaymentStep'
import SuccessPage from './pages/customer/SuccessPage'
import Dashboard from './pages/customer/Dashboard'
import AppointmentsHistory from './pages/customer/AppointmentsHistory'
import Profile from './pages/customer/Profile'
import ProfileEdit from './pages/customer/ProfileEdit'

// Public pages
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PublicCategoriesPage from './pages/CategoriesPage'
import CategoryDetailPage from './pages/CategoryDetailPage'
import PublicServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'
import LocationPage from './pages/LocationPage'
import AccountInactivePage from './pages/AccountInactivePage'
import AccountBannedPage from './pages/AccountBannedPage'

const App = () => {
  useAuthUser()

  return (
    <>
      <Toaster />
      <Routes>
      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/categories" element={<PublicCategoriesPage />} />
      <Route path="/category/:slug" element={<CategoryDetailPage />} />
      <Route path="/services" element={<PublicServicesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/location" element={<LocationPage />} />
      <Route path="/account-inactive" element={<AccountInactivePage />} />
      <Route path="/account-banned" element={<AccountBannedPage />} />

      {/* Admin routes */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/bookings" element={<BookingsPage />} />
          <Route path="/admin/bookings/:id" element={<BookingDetailPage />} />
          <Route path="/admin/customers" element={<CustomersPage />} />
          <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/admin/staff" element={<StaffPage />} />
          <Route path="/admin/staff/:id" element={<StaffDetailPage />} />
          <Route path="/admin/staff/leave-requests" element={<LeaveRequestsPage />} />
          <Route path="/admin/services" element={<AdminCategoriesPage />} />
          <Route path="/admin/services/:categoryId" element={<AdminServicesPage />} />
          <Route path="/admin/inquiries" element={<InquiriesPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/qr-payment" element={<QRPaymentPage />} />
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

      {/* Customer routes */}
      <Route element={<CustomerRoute />}>
        <Route path="/booking/services" element={<ServicesStep />} />
        <Route path="/booking/staff" element={<StaffStep />} />
        <Route path="/booking/datetime" element={<DateTimeStep />} />
        <Route path="/booking/review" element={<ReviewStep />} />
        <Route path="/booking/payment/:bookingId" element={<PaymentStep />} />
        <Route path="/booking/success/:bookingId" element={<SuccessPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/appointments/history" element={<AppointmentsHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

export default App

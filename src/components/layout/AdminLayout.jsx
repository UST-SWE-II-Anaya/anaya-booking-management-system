// src/components/layout/AdminLayout.jsx
import { Outlet } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'

const AdminLayout = () => (
  <div className="flex min-h-screen bg-[#F9F8F5]">
    <AdminSidebar />
    <div className="flex-1 flex flex-col overflow-hidden">
      <AdminHeader />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  </div>
)

export default AdminLayout

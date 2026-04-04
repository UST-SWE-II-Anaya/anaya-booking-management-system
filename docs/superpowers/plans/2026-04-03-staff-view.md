# Staff View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Staff View in `src/` (Vite+React) — a role-gated dashboard
for clinic staff members to view their own appointments, verify GCash payments,
submit leave requests, and manage their profile.

**Architecture:** Reuses the foundation from the Admin View plan (auth store, common
components, services, Vitest setup). Staff routes live under `/staff` and are gated
by a `StaffRoute` guard that checks `profiles.role === 'staff'`. `LoginPage` is
updated to redirect to `/staff` or `/admin` based on role. All staff data queries
filter by the logged-in user's `id` via dedicated service functions.

**Tech Stack:** React 19, React Router DOM v7, Zustand 5, Tailwind CSS v4,
@supabase/supabase-js v2, clsx, lucide-react, Vitest, @testing-library/react

---

## Prerequisite

**This plan assumes the Admin View plan (`2026-04-03-admin-view.md`) has been
executed first.** The following must already exist:

- `vitest.config.js` and `src/test/setup.js`
- `src/test/mocks/supabaseMock.js` (`createQueryBuilder` factory)
- `src/store/authStore.js` and `src/hooks/useAuthUser.js`
- `src/services/supabaseClient.js`, `src/services/authService.js`,
  `src/services/paymentService.js`
- `src/components/common/` — Spinner, Badge, Modal, ConfirmDialog,
  SearchInput, EmptyState
- `src/components/admin/payments/PaymentVerificationModal.jsx`
- `src/components/layout/AdminRoute.jsx` (pattern to follow)

---

## Staff View Spec Reference

| Page | Key features |
|---|---|
| **Dashboard** | 3 metric cards (upcoming count, today count, today's total duration) + today's appointment list |
| **Appointments** | List view (default) + Calendar view toggle; sort by ID/date; filter by status/service type; search by customer name or appointment ID; appointment cards with payment verification |
| **Leave Request** | Type selector (Vacation/Sick/Emergency/Others); start date; end date; reason textarea; submit |
| **Profile Settings** | Avatar URL, name, password; contact number, email, social media links |

---

## Database Schema Reference (relevant subset)

| Table | Columns used |
|---|---|
| `profiles` | id, role, first_name, last_name, email, phone_number, avatar_url, account_status |
| `staff_details` | id (fk→profiles), contact_number, social_media_links (jsonb), job_title |
| `bookings` | id, reference_id, staff_id, customer_id, appointment_date, start_time, total_duration_minutes, subtotal, downpayment_amount, remaining_balance, booking_status, downpayment_status, payment_deadline |
| `booking_services` | booking_id, service_id, price_at_booking, duration_at_booking + services(name) |
| `payments` | id, booking_id, reference_number, account_name, receipt_url, amount, status |
| `leave_requests` | id, staff_id, leave_type (vacation\|sick\|emergency\|other), start_date, end_date, reason, status (pending\|approved\|denied) |
| `service_categories` | id, name |

---

## File Structure

**New Files:**
- `src/components/layout/StaffRoute.jsx` — role guard: redirects non-staff to `/login`
- `src/components/layout/StaffLayout.jsx` — left sidebar + header shell for staff
- `src/components/layout/StaffSidebar.jsx` — left navigation (4 items)
- `src/components/staff/MonthCalendar.jsx` — monthly appointment calendar grid
- `src/services/staffAppointmentService.js` — bookings queries scoped to logged-in staff
- `src/services/staffLeaveService.js` — create and read own leave requests
- `src/services/staffProfileService.js` — update own profile, staff details, password
- `src/pages/staff/DashboardPage.jsx` — metrics + today's itinerary
- `src/pages/staff/AppointmentsPage.jsx` — list/calendar view with sort/filter/search
- `src/pages/staff/LeaveRequestPage.jsx` — submit leave request form
- `src/pages/staff/ProfileSettingsPage.jsx` — edit profile info + password

**Modified Files:**
- `src/App.jsx` — add staff routes under `/staff/*`
- `src/pages/auth/LoginPage.jsx` — role-based redirect (admin → `/admin`, staff → `/staff`)

---

## Task 1: StaffRoute Guard + Staff Layout

**Files:**
- Create: `src/components/layout/StaffRoute.jsx`
- Create: `src/components/layout/StaffSidebar.jsx`
- Create: `src/components/layout/StaffLayout.jsx`
- Create: `src/components/layout/StaffRoute.test.jsx`

- [x] **Step 1: Write failing test**

```jsx
// src/components/layout/StaffRoute.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(),
}))

import useAuthStore from '../../store/authStore'
import StaffRoute from './StaffRoute'

const renderWithRouter = (storeState) => {
  useAuthStore.mockReturnValue(storeState)
  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/staff" element={<div>Staff Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StaffRoute', () => {
  it('shows spinner while loading', () => {
    renderWithRouter({ loading: true, profile: null })
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })

  it('redirects to /login when no profile', () => {
    renderWithRouter({ loading: false, profile: null })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('redirects to /login when role is admin (not staff)', () => {
    renderWithRouter({ loading: false, profile: { role: 'admin' } })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when role is staff', () => {
    renderWithRouter({ loading: false, profile: { role: 'staff' } })
    expect(screen.getByText('Staff Page')).toBeInTheDocument()
  })
})
```

Run: `npm test src/components/layout/StaffRoute.test.jsx`
Expected: FAIL — StaffRoute not found

- [x] **Step 2: Create StaffRoute**

```jsx
// src/components/layout/StaffRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import Spinner from '../common/Spinner'

const StaffRoute = () => {
  const { loading, profile } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!profile || profile.role !== 'staff') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default StaffRoute
```

- [x] **Step 3: Run test**

Run: `npm test src/components/layout/StaffRoute.test.jsx`
Expected: PASS (4 tests)

- [x] **Step 4: Create StaffSidebar**

```jsx
// src/components/layout/StaffSidebar.jsx
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
```

- [x] **Step 5: Create StaffLayout**

```jsx
// src/components/layout/StaffLayout.jsx
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
```

- [x] **Step 6: Commit**

```bash
git add src/components/layout/StaffRoute.jsx \
  src/components/layout/StaffRoute.test.jsx \
  src/components/layout/StaffSidebar.jsx \
  src/components/layout/StaffLayout.jsx
git commit -m "feat: add StaffRoute guard and staff layout shell"
```

---

## Task 2: Update App.jsx and LoginPage for Role-Based Redirect

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/auth/LoginPage.jsx`
- Create stubs: `src/pages/staff/DashboardPage.jsx`, `AppointmentsPage.jsx`,
  `LeaveRequestPage.jsx`, `ProfileSettingsPage.jsx`

**Why:** `LoginPage` currently navigates all users to `/admin`. Staff must land on
`/staff`. We fix this by fetching the profile inline after login and branching on
`role`.

- [x] **Step 1: Write failing test for LoginPage role-based redirect**

```jsx
// src/pages/auth/LoginPage.test.jsx  (replace the existing file)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../services/authService', () => ({
  signIn: vi.fn(),
  getProfile: vi.fn(),
}))

import { signIn, getProfile } from '../../services/authService'
import LoginPage from './LoginPage'

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

describe('LoginPage', () => {
  it('redirects admin role to /admin', async () => {
    signIn.mockResolvedValue({ user: { id: 'u1' } })
    getProfile.mockResolvedValue({ role: 'admin' })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/admin')
    )
  })

  it('redirects staff role to /staff', async () => {
    signIn.mockResolvedValue({ user: { id: 'u2' } })
    getProfile.mockResolvedValue({ role: 'staff' })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'staff@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/staff')
    )
  })

  it('shows error on failed login', async () => {
    signIn.mockRejectedValue(new Error('Invalid login credentials'))
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    )
  })
})
```

Run: `npm test src/pages/auth/LoginPage.test.jsx`
Expected: FAIL — redirect goes to `/admin` for both roles

- [x] **Step 2: Update LoginPage**

Replace the `handleSubmit` function in `src/pages/auth/LoginPage.jsx`:

```jsx
// src/pages/auth/LoginPage.jsx  (full file)
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { signIn, getProfile } from '../../services/authService'

const LoginPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await signIn(email, password)
      const profile = await getProfile(user.id)
      navigate(profile.role === 'admin' ? '/admin' : '/staff')
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border
        border-gray-100 p-8">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-[#2C2C2C]">
            Anaya
          </h1>
          <p className="text-sm text-gray-500 mt-1">Staff &amp; Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[#4A4A4A] mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg
                text-sm focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
                focus:border-[#8A956D]"
              placeholder="you@anaya.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#4A4A4A] mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg
                  text-sm focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
                  focus:border-[#8A956D]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                  hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100
              rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#8A956D] hover:bg-[#7a8560] text-white
              text-sm font-medium rounded-lg transition-colors disabled:opacity-60
              disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
```

- [x] **Step 3: Run test**

Run: `npm test src/pages/auth/LoginPage.test.jsx`
Expected: PASS (3 tests)

- [x] **Step 4: Create staff page stubs**

Create a minimal stub for each staff page (replaced in later tasks):

```jsx
// src/pages/staff/DashboardPage.jsx
const StaffDashboardPage = () => <div>Staff Dashboard</div>
export default StaffDashboardPage
```

Repeat the same pattern for:
- `src/pages/staff/AppointmentsPage.jsx` → `const StaffAppointmentsPage`
- `src/pages/staff/LeaveRequestPage.jsx` → `const StaffLeaveRequestPage`
- `src/pages/staff/ProfileSettingsPage.jsx` → `const StaffProfileSettingsPage`

- [x] **Step 5: Update App.jsx to add staff routes**

```jsx
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
```

- [x] **Step 6: Verify app compiles**

Run: `npm run dev`
Expected: Vite starts on localhost:5173 with no errors. Visiting `/staff` redirects
to `/login` when unauthenticated.

- [x] **Step 7: Commit**

```bash
git add src/App.jsx src/pages/auth/LoginPage.jsx src/pages/staff/
git commit -m "feat: add staff routes and role-based login redirect"
```

---

## Task 3: Staff Appointment Service

**Files:**
- Create: `src/services/staffAppointmentService.js`
- Create: `src/services/staffAppointmentService.test.js`

All functions in this service take `staffId` as their first argument and filter
bookings to that staff member only.

- [x] **Step 1: Write failing test**

```js
// src/services/staffAppointmentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  getMyAppointments,
  getMyDashboardStats,
  getMyAppointmentById,
} from './staffAppointmentService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getMyAppointments', () => {
  it('filters bookings by staff_id', async () => {
    const qb = createQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(qb)
    await getMyAppointments('staff-123', {})
    expect(supabase.from).toHaveBeenCalledWith('bookings')
    expect(qb.eq).toHaveBeenCalledWith('staff_id', 'staff-123')
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('RLS'), count: 0 })
    supabase.from.mockReturnValue(qb)
    await expect(getMyAppointments('staff-123', {})).rejects.toThrow('RLS')
  })
})

describe('getMyDashboardStats', () => {
  it('returns stats with expected keys', async () => {
    const qb = createQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(qb)
    const stats = await getMyDashboardStats('staff-123')
    expect(stats).toHaveProperty('upcomingCount')
    expect(stats).toHaveProperty('todayCount')
    expect(stats).toHaveProperty('todayDurationMinutes')
    expect(stats).toHaveProperty('todaysAppointments')
  })
})
```

Run: `npm test src/services/staffAppointmentService.test.js`
Expected: FAIL — module not found

- [x] **Step 2: Create staffAppointmentService**

```js
// src/services/staffAppointmentService.js
import { supabase } from './supabaseClient'

const today = () => new Date().toISOString().split('T')[0]

const APPOINTMENT_SELECT = `
  id, reference_id, appointment_date, start_time,
  total_duration_minutes, subtotal, downpayment_amount,
  remaining_balance, booking_status, downpayment_status,
  payment_deadline, balance_settled, created_at,
  customer:profiles!bookings_customer_id_fkey(
    id, first_name, last_name, email, phone_number, avatar_url
  ),
  booking_services(
    id, price_at_booking, duration_at_booking,
    services(id, name, category_id,
      service_categories(id, name))
  )
`

/**
 * @param {string} staffId
 * @param {{
 *   status?: string,
 *   categoryId?: string,
 *   search?: string,
 *   sortField?: 'id' | 'date',
 *   sortDir?: 'asc' | 'desc',
 *   page?: number,
 *   pageSize?: number
 * }} options
 */
export const getMyAppointments = async (staffId, {
  status = 'upcoming',
  categoryId,
  search,
  sortField = 'date',
  sortDir = 'desc',
  page = 0,
  pageSize = 20,
} = {}) => {
  let query = supabase
    .from('bookings')
    .select(APPOINTMENT_SELECT, { count: 'exact' })
    .eq('staff_id', staffId)
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) query = query.eq('booking_status', status)
  if (search) query = query.ilike('reference_id', `%${search}%`)

  if (sortField === 'date') {
    query = query.order('appointment_date', { ascending: sortDir === 'asc' })
    query = query.order('start_time', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: sortDir === 'asc' })
  }

  const { data, error, count } = await query
  if (error) throw error

  // Filter by category client-side (join path is too deep for server filter)
  const filtered = categoryId
    ? (data ?? []).filter((b) =>
        b.booking_services?.some(
          (bs) => bs.services?.service_categories?.id === categoryId
        )
      )
    : (data ?? [])

  return { data: filtered, count: count ?? 0 }
}

export const getMyDashboardStats = async (staffId) => {
  const todayStr = today()

  const [upcomingRes, todaysRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('booking_status', 'upcoming'),
    supabase
      .from('bookings')
      .select(APPOINTMENT_SELECT)
      .eq('staff_id', staffId)
      .eq('appointment_date', todayStr)
      .eq('booking_status', 'upcoming')
      .order('start_time'),
  ])

  if (upcomingRes.error) throw upcomingRes.error
  if (todaysRes.error) throw todaysRes.error

  const todaysAppointments = todaysRes.data ?? []
  const todayDurationMinutes = todaysAppointments.reduce(
    (sum, appt) => sum + (appt.total_duration_minutes ?? 0),
    0
  )

  return {
    upcomingCount: upcomingRes.count ?? 0,
    todayCount: todaysAppointments.length,
    todayDurationMinutes,
    todaysAppointments,
  }
}

export const getMyAppointmentById = async (id, staffId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      ${APPOINTMENT_SELECT},
      payments(
        id, reference_number, account_name, receipt_url,
        amount, status, verified_at
      )
    `)
    .eq('id', id)
    .eq('staff_id', staffId)
    .single()
  if (error) throw error
  return data
}

export const getMyAppointmentDates = async (staffId, year, month) => {
  // Returns a Set of 'YYYY-MM-DD' strings that have upcoming appointments
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0)
    .toISOString()
    .split('T')[0]

  const { data, error } = await supabase
    .from('bookings')
    .select('appointment_date')
    .eq('staff_id', staffId)
    .eq('booking_status', 'upcoming')
    .gte('appointment_date', startDate)
    .lte('appointment_date', endDate)
  if (error) throw error
  return new Set((data ?? []).map((b) => b.appointment_date))
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/staffAppointmentService.test.js`
Expected: PASS (3 tests)

- [x] **Step 4: Commit**

```bash
git add src/services/staffAppointmentService.js \
  src/services/staffAppointmentService.test.js
git commit -m "feat: add staff appointment service"
```

---

## Task 4: Staff Dashboard Page

**Files:**
- Replace stub: `src/pages/staff/DashboardPage.jsx`

- [x] **Step 1: Replace stub with full implementation**

```jsx
// src/pages/staff/DashboardPage.jsx
import { useState, useEffect } from 'react'
import { CalendarDays, Clock, TrendingUp } from 'lucide-react'
import { getMyDashboardStats } from '../../services/staffAppointmentService'
import useAuthStore from '../../store/authStore'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import Badge from '../../components/common/Badge'

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const formatDuration = (minutes) => {
  if (!minutes) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const StaffDashboardPage = () => {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    getMyDashboardStats(user.id)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 rounded-lg p-4 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Upcoming"
          value={stats.upcomingCount}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Appointments Today"
          value={stats.todayCount}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          label="Service Duration Today"
          value={formatDuration(stats.todayDurationMinutes)}
          icon={Clock}
          color="rust"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
            <Clock size={16} className="text-[#8A956D]" />
            Today&apos;s Schedule
            <span className="ml-auto text-sm font-normal text-gray-400">
              {stats.todaysAppointments.length} appointment
              {stats.todaysAppointments.length !== 1 ? 's' : ''}
            </span>
          </h2>
        </div>

        {stats.todaysAppointments.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            No appointments scheduled for today.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.todaysAppointments.map((appt) => (
              <div key={appt.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-20 text-center flex-shrink-0">
                  <p className="text-sm font-semibold text-[#2C2C2C]">
                    {formatTime(appt.start_time)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDuration(appt.total_duration_minutes)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#4A4A4A]">
                    {appt.customer
                      ? `${appt.customer.first_name} ${appt.customer.last_name}`
                      : 'Unknown Customer'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {appt.booking_services
                      ?.map((bs) => bs.services?.name)
                      .filter(Boolean)
                      .join(', ') || 'No services'}
                  </p>
                </div>
                <Badge
                  variant={appt.downpayment_status}
                  label={appt.downpayment_status}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffDashboardPage
```

- [x] **Step 2: Commit**

```bash
git add src/pages/staff/DashboardPage.jsx
git commit -m "feat: add staff dashboard page"
```

---

## Task 5: Month Calendar Component

**Files:**
- Create: `src/components/staff/MonthCalendar.jsx`
- Create: `src/components/staff/MonthCalendar.test.jsx`

This component is used in the appointments page calendar view. It renders a monthly
grid, highlights dates that have appointments, and fires `onDateSelect` when a date
is clicked.

- [x] **Step 1: Write failing test**

```jsx
// src/components/staff/MonthCalendar.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MonthCalendar from './MonthCalendar'

describe('MonthCalendar', () => {
  const appointmentDates = new Set(['2026-04-03', '2026-04-10', '2026-04-15'])

  it('renders day-of-week headers', () => {
    render(
      <MonthCalendar
        year={2026}
        month={4}
        appointmentDates={appointmentDates}
        selectedDate={null}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('marks appointment dates with a dot', () => {
    render(
      <MonthCalendar
        year={2026}
        month={4}
        appointmentDates={appointmentDates}
        selectedDate={null}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    // Days with appointments have data-has-appointment attribute
    const apptDays = document.querySelectorAll('[data-has-appointment="true"]')
    expect(apptDays.length).toBe(3)
  })

  it('calls onDateSelect with YYYY-MM-DD when a day is clicked', () => {
    const onDateSelect = vi.fn()
    render(
      <MonthCalendar
        year={2026}
        month={4}
        appointmentDates={appointmentDates}
        selectedDate={null}
        onDateSelect={onDateSelect}
        onMonthChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('3'))
    expect(onDateSelect).toHaveBeenCalledWith('2026-04-03')
  })
})
```

Run: `npm test src/components/staff/MonthCalendar.test.jsx`
Expected: FAIL — MonthCalendar not found

- [x] **Step 2: Create MonthCalendar**

```jsx
// src/components/staff/MonthCalendar.jsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const pad = (n) => String(n).padStart(2, '0')

/**
 * @param {{
 *   year: number,
 *   month: number,          // 1-based
 *   appointmentDates: Set,  // Set of 'YYYY-MM-DD' strings
 *   selectedDate: string | null,
 *   onDateSelect: (date: string) => void,
 *   onMonthChange: (year: number, month: number) => void
 * }} props
 */
const MonthCalendar = ({
  year,
  month,
  appointmentDates,
  selectedDate,
  onDateSelect,
  onMonthChange,
}) => {
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayStr = new Date().toISOString().split('T')[0]

  const cells = []
  // leading empty cells
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12)
    else onMonthChange(year, month - 1)
  }

  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1)
    else onMonthChange(year, month + 1)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500
            transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-[#2C2C2C]">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500
            transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />
          const dateStr = `${year}-${pad(month)}-${pad(day)}`
          const hasAppt = appointmentDates.has(dateStr)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              data-has-appointment={hasAppt ? 'true' : 'false'}
              className={clsx(
                'relative flex flex-col items-center justify-center h-9 rounded-lg',
                'text-sm transition-colors',
                isSelected
                  ? 'bg-[#8A956D] text-white font-semibold'
                  : isToday
                  ? 'bg-[#8A956D]/10 text-[#8A956D] font-semibold'
                  : 'hover:bg-gray-100 text-[#4A4A4A]'
              )}
            >
              {day}
              {hasAppt && (
                <span
                  className={clsx(
                    'absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                    isSelected ? 'bg-white' : 'bg-[#CE845D]'
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MonthCalendar
```

- [x] **Step 3: Run test**

Run: `npm test src/components/staff/MonthCalendar.test.jsx`
Expected: PASS (3 tests)

- [x] **Step 4: Commit**

```bash
git add src/components/staff/
git commit -m "feat: add MonthCalendar component for staff appointments view"
```

---

## Task 6: Staff Appointments Page

**Files:**
- Replace stub: `src/pages/staff/AppointmentsPage.jsx`

This page has two views (List and Calendar) toggled by a button in the top bar.
List view is the default. Calendar view shows the month grid alongside a filtered
list for the selected date.

- [x] **Step 1: Create AppointmentsPage**

```jsx
// src/pages/staff/AppointmentsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { List, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import {
  getMyAppointments,
  getMyAppointmentById,
  getMyAppointmentDates,
} from '../../services/staffAppointmentService'
import useAuthStore from '../../store/authStore'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import SearchInput from '../../components/common/SearchInput'
import MonthCalendar from '../../components/staff/MonthCalendar'
import PaymentVerificationModal from '../../components/admin/payments/PaymentVerificationModal'

const STATUS_OPTIONS = ['upcoming', 'finished', 'cancelled', 'no_show']

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const formatDeadlineCountdown = (deadlineStr) => {
  if (!deadlineStr) return null
  const diff = new Date(deadlineStr) - new Date()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / 1000 / 60 / 60)
  const mins = Math.floor((diff / 1000 / 60) % 60)
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`
}

// Appointment card shown in list view
const AppointmentCard = ({ appt, onVerifyClick }) => {
  const countdown = formatDeadlineCountdown(appt.payment_deadline)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#2C2C2C]">
            {appt.customer
              ? `${appt.customer.first_name} ${appt.customer.last_name}`
              : 'Unknown'}
          </p>
          <p className="text-xs font-mono text-gray-400 mt-0.5">
            {appt.reference_id}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={appt.booking_status} label={appt.booking_status} />
          <Badge
            variant={appt.downpayment_status}
            label={appt.downpayment_status}
          />
        </div>
      </div>

      {/* Date/time row */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Date & Time</p>
          <p className="text-[#4A4A4A]">{formatDate(appt.appointment_date)}</p>
          <p className="text-xs text-gray-500">{formatTime(appt.start_time)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Duration & Services</p>
          <p className="text-[#4A4A4A]">
            {formatDuration(appt.total_duration_minutes)}
          </p>
          <p className="text-xs text-gray-500 line-clamp-1">
            {appt.booking_services
              ?.map((bs) => bs.services?.name)
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
      </div>

      {/* Payment row */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Downpayment / Total</p>
          <p className="text-[#4A4A4A]">
            ₱{Number(appt.downpayment_amount).toFixed(2)}
            {' '}/{' '}
            ₱{Number(appt.subtotal).toFixed(2)}
          </p>
        </div>
        {countdown && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Time Left to Pay</p>
            <p className={clsx(
              'text-sm font-medium',
              countdown === 'Expired' ? 'text-red-500' : 'text-orange-500'
            )}>
              {countdown}
            </p>
          </div>
        )}
      </div>

      {/* Action */}
      {appt.downpayment_status === 'pending' && (
        <button
          onClick={() => onVerifyClick(appt.id)}
          className="w-full py-2 bg-[#8A956D] hover:bg-[#7a8560] text-white text-sm
            font-medium rounded-lg transition-colors"
        >
          Approve Appointment
        </button>
      )}
    </div>
  )
}

const StaffAppointmentsPage = () => {
  const { user } = useAuthStore()
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [appointments, setAppointments] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [status, setStatus] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const pageSize = 10

  // Calendar state
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(null)
  const [apptDates, setApptDates] = useState(new Set())

  // Payment verification
  const [verifyBooking, setVerifyBooking] = useState(null)
  const [loadingVerify, setLoadingVerify] = useState(false)

  const staffId = user?.id

  const load = useCallback(() => {
    if (!staffId) return
    setLoading(true)
    getMyAppointments(staffId, { status, search, sortField, sortDir, page, pageSize })
      .then(({ data, count: c }) => { setAppointments(data); setCount(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [staffId, status, search, sortField, sortDir, page])

  useEffect(() => { load() }, [load])

  // Load appointment dates for calendar highlights when month changes
  useEffect(() => {
    if (!staffId || view !== 'calendar') return
    getMyAppointmentDates(staffId, calYear, calMonth)
      .then(setApptDates)
      .catch((err) => console.error('Calendar dates error:', err))
  }, [staffId, view, calYear, calMonth])

  const handleVerifyClick = async (id) => {
    setLoadingVerify(true)
    try {
      const booking = await getMyAppointmentById(id, staffId)
      setVerifyBooking(booking)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingVerify(false)
    }
  }

  // When a calendar date is selected, switch to list and filter by date
  const handleDateSelect = (dateStr) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr))
  }

  const totalPages = Math.ceil(count / pageSize)

  // Filter appointments by selected date in calendar mode
  const displayedAppointments = selectedDate
    ? appointments.filter((a) => a.appointment_date === selectedDate)
    : appointments

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Appointments</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'transition-colors',
              view === 'list'
                ? 'bg-white text-[#2C2C2C] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <List size={13} /> List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'transition-colors',
              view === 'calendar'
                ? 'bg-white text-[#2C2C2C] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <CalendarDays size={13} /> Calendar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5
        py-4 flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(0) }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                status === s
                  ? 'bg-[#8A956D] text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={`${sortField}-${sortDir}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split('-')
            setSortField(f)
            setSortDir(d)
            setPage(0)
          }}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
            text-gray-600"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="id-desc">ID Descending</option>
          <option value="id-asc">ID Ascending</option>
        </select>

        <div className="ml-auto">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0) }}
            placeholder="Customer name or Ref ID…"
          />
        </div>
      </div>

      {view === 'calendar' ? (
        /* Calendar view: side-by-side calendar + filtered list */
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
          <MonthCalendar
            year={calYear}
            month={calMonth}
            appointmentDates={apptDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m) }}
          />
          <div className="space-y-3">
            {selectedDate ? (
              <>
                <p className="text-sm text-gray-500">
                  Appointments on{' '}
                  <span className="font-medium text-[#4A4A4A]">
                    {new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric',
                    })}
                  </span>
                </p>
                {loading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : displayedAppointments.length === 0 ? (
                  <EmptyState
                    title="No appointments this day"
                    message="Select another date or change your status filter."
                  />
                ) : (
                  displayedAppointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      onVerifyClick={handleVerifyClick}
                    />
                  ))
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16
                text-center text-sm text-gray-400">
                <CalendarDays size={28} className="mb-3 text-gray-300" />
                Select a date to see appointments.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* List view */
        <>
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : error ? (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg p-4">{error}</p>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No appointments found"
              message="Try adjusting your filters."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {appointments.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  onVerifyClick={handleVerifyClick}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  className="px-3 py-1 border border-gray-200 rounded-lg
                    disabled:opacity-40 hover:bg-gray-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border border-gray-200 rounded-lg
                    disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <PaymentVerificationModal
        open={!!verifyBooking}
        booking={verifyBooking}
        onClose={() => setVerifyBooking(null)}
        onUpdated={load}
      />
    </div>
  )
}

export default StaffAppointmentsPage
```

- [x] **Step 2: Commit**

```bash
git add src/pages/staff/AppointmentsPage.jsx
git commit -m "feat: add staff appointments page with list and calendar views"
```

---

## Task 7: Staff Leave Service + Leave Request Page

**Files:**
- Create: `src/services/staffLeaveService.js`
- Create: `src/services/staffLeaveService.test.js`
- Replace stub: `src/pages/staff/LeaveRequestPage.jsx`

- [x] **Step 1: Write failing test**

```js
// src/services/staffLeaveService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { createLeaveRequest, getMyLeaveRequests } from './staffLeaveService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('createLeaveRequest', () => {
  it('inserts into leave_requests with staff_id', async () => {
    const payload = {
      leave_type: 'vacation',
      start_date: '2026-04-10',
      end_date: '2026-04-12',
      reason: 'Holiday',
    }
    const qb = createQueryBuilder({ data: { id: 'lr1', ...payload }, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await createLeaveRequest('staff-1', payload)
    expect(result.id).toBe('lr1')
    expect(supabase.from).toHaveBeenCalledWith('leave_requests')
    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ staff_id: 'staff-1', leave_type: 'vacation' })
    )
  })

  it('throws when end_date is before start_date', async () => {
    await expect(
      createLeaveRequest('staff-1', {
        leave_type: 'sick',
        start_date: '2026-04-15',
        end_date: '2026-04-10',
        reason: '',
      })
    ).rejects.toThrow('End date must be on or after start date')
  })
})

describe('getMyLeaveRequests', () => {
  it('filters by staff_id', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getMyLeaveRequests('staff-1')
    expect(qb.eq).toHaveBeenCalledWith('staff_id', 'staff-1')
  })
})
```

Run: `npm test src/services/staffLeaveService.test.js`
Expected: FAIL — module not found

- [x] **Step 2: Create staffLeaveService**

```js
// src/services/staffLeaveService.js
import { supabase } from './supabaseClient'

/**
 * @param {string} staffId
 * @param {{
 *   leave_type: 'vacation' | 'sick' | 'emergency' | 'other',
 *   start_date: string,  // 'YYYY-MM-DD'
 *   end_date: string,    // 'YYYY-MM-DD'
 *   reason?: string
 * }} payload
 */
export const createLeaveRequest = async (staffId, payload) => {
  if (new Date(payload.end_date) < new Date(payload.start_date)) {
    throw new Error('End date must be on or after start date')
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({ staff_id: staffId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export const getMyLeaveRequests = async (staffId) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('id, reference_id, leave_type, start_date, end_date, reason, status, created_at, reviewed_at')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/staffLeaveService.test.js`
Expected: PASS (3 tests)

- [x] **Step 4: Create LeaveRequestPage**

```jsx
// src/pages/staff/LeaveRequestPage.jsx
import { useState, useEffect } from 'react'
import { ClipboardList } from 'lucide-react'
import { createLeaveRequest, getMyLeaveRequests } from '../../services/staffLeaveService'
import useAuthStore from '../../store/authStore'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import clsx from 'clsx'

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacation Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'other', label: 'Others' },
]

const LEAVE_STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
}

const StaffLeaveRequestPage = () => {
  const { user } = useAuthStore()
  const staffId = user?.id

  const [leaveType, setLeaveType] = useState('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = () => {
    if (!staffId) return
    setHistoryLoading(true)
    getMyLeaveRequests(staffId)
      .then(setHistory)
      .catch((err) => console.error('History load error:', err))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => { loadHistory() }, [staffId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)
    setSubmitting(true)
    try {
      await createLeaveRequest(staffId, {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      })
      setStartDate('')
      setEndDate('')
      setReason('')
      setSuccess(true)
      loadHistory()
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = `w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Leave Request</h1>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5"
      >
        {/* Leave type */}
        <div>
          <p className="text-sm font-medium text-[#4A4A4A] mb-3">Leave Type</p>
          <div className="flex flex-wrap gap-2">
            {LEAVE_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setLeaveType(value)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  leaveType === value
                    ? 'bg-[#8A956D] text-white'
                    : 'border border-gray-200 text-[#4A4A4A] hover:bg-gray-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#4A4A4A] mb-1">
              Start Date
            </label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#4A4A4A] mb-1">
              End Date
            </label>
            <input
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-[#4A4A4A] mb-1">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            className={inputClass}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe the reason for your leave…"
          />
        </div>

        {formError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {formError}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            Leave request submitted. Awaiting admin approval.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-[#8A956D] hover:bg-[#7a8560] text-white
            text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Leave Request'}
        </button>
      </form>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
            <ClipboardList size={16} className="text-[#8A956D]" />
            My Leave History
          </h2>
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No leave requests submitted yet.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((req) => {
              const typeLabel =
                LEAVE_TYPES.find((t) => t.value === req.leave_type)?.label ??
                req.leave_type
              const start = new Date(req.start_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              })
              const end = new Date(req.end_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              return (
                <div key={req.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#4A4A4A]">
                        {typeLabel}
                      </p>
                      <Badge variant={req.status} label={LEAVE_STATUS_LABELS[req.status]} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {start} – {end}
                    </p>
                    {req.reason && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {req.reason}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffLeaveRequestPage
```

- [x] **Step 5: Commit**

```bash
git add src/services/staffLeaveService.js \
  src/services/staffLeaveService.test.js \
  src/pages/staff/LeaveRequestPage.jsx
git commit -m "feat: add staff leave service and leave request page"
```

---

## Task 8: Staff Profile Service + Profile Settings Page

**Files:**
- Create: `src/services/staffProfileService.js`
- Create: `src/services/staffProfileService.test.js`
- Replace stub: `src/pages/staff/ProfileSettingsPage.jsx`

**Note on password change:** `supabase.auth.updateUser({ password })` is called
directly in the service. This requires an active session — no special admin permissions
needed.

**Note on avatar:** Profile picture is stored as a URL string in `profiles.avatar_url`.
Uploading to Supabase Storage requires a separate integration; for now the field
accepts any valid URL (e.g., an externally hosted image or the Supabase Storage public
URL after upload via the dashboard). A file-upload UI can be added as a follow-up.

- [x] **Step 1: Write failing test**

```js
// src/services/staffProfileService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: { updateUser: vi.fn() },
  },
}))

import { supabase } from './supabaseClient'
import {
  updateMyProfile,
  updateMyStaffDetails,
  updateMyPassword,
  getMyFullProfile,
} from './staffProfileService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('updateMyProfile', () => {
  it('updates the profiles table', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', first_name: 'Ana' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await updateMyProfile('u1', { first_name: 'Ana' })
    expect(result.first_name).toBe('Ana')
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Ana' })
    )
  })
})

describe('updateMyPassword', () => {
  it('calls supabase.auth.updateUser with new password', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null })
    await updateMyPassword('newpass123')
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' })
  })

  it('throws when password is too short', async () => {
    await expect(updateMyPassword('abc')).rejects.toThrow(
      'Password must be at least 8 characters'
    )
  })

  it('throws on supabase error', async () => {
    supabase.auth.updateUser.mockResolvedValue({
      data: null,
      error: new Error('Auth error'),
    })
    await expect(updateMyPassword('validpass123')).rejects.toThrow('Auth error')
  })
})
```

Run: `npm test src/services/staffProfileService.test.js`
Expected: FAIL — module not found

- [x] **Step 2: Create staffProfileService**

```js
// src/services/staffProfileService.js
import { supabase } from './supabaseClient'

export const getMyFullProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, phone_number, avatar_url,
      staff_details(job_title, contact_number, social_media_links)
    `)
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateMyProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateMyStaffDetails = async (userId, updates) => {
  const { data, error } = await supabase
    .from('staff_details')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateMyPassword = async (newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/staffProfileService.test.js`
Expected: PASS (4 tests)

- [x] **Step 4: Create ProfileSettingsPage**

```jsx
// src/pages/staff/ProfileSettingsPage.jsx
import { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, UserCircle } from 'lucide-react'
import {
  getMyFullProfile,
  updateMyProfile,
  updateMyStaffDetails,
  updateMyPassword,
} from '../../services/staffProfileService'
import useAuthStore from '../../store/authStore'
import Spinner from '../../components/common/Spinner'

const Section = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
    <h2 className="font-semibold text-[#2C2C2C] mb-5">{title}</h2>
    {children}
  </div>
)

const inputClass = `w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm
  focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

const SaveButton = ({ loading, label = 'Save' }) => (
  <button
    type="submit"
    disabled={loading}
    className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] hover:bg-[#7a8560]
      text-white text-sm rounded-lg transition-colors disabled:opacity-50"
  >
    <Save size={14} />
    {loading ? 'Saving…' : label}
  </button>
)

const StaffProfileSettingsPage = () => {
  const { user, setProfile } = useAuthStore()
  const userId = user?.id

  const [fullProfile, setFullProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Personal info form
  const [personal, setPersonal] = useState({
    first_name: '', last_name: '', avatar_url: '',
  })
  const [personalSaving, setPersonalSaving] = useState(false)
  const [personalMsg, setPersonalMsg] = useState(null)

  // Contact & social form
  const [contact, setContact] = useState({
    contact_number: '',
    email: '',
    instagram: '',
    facebook: '',
    tiktok: '',
  })
  const [contactSaving, setContactSaving] = useState(false)
  const [contactMsg, setContactMsg] = useState(null)

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  useEffect(() => {
    if (!userId) return
    getMyFullProfile(userId)
      .then((p) => {
        setFullProfile(p)
        setPersonal({
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? '',
          avatar_url: p.avatar_url ?? '',
        })
        const social = p.staff_details?.social_media_links ?? {}
        setContact({
          contact_number: p.staff_details?.contact_number ?? '',
          email: p.email ?? '',
          instagram: social.instagram ?? '',
          facebook: social.facebook ?? '',
          tiktok: social.tiktok ?? '',
        })
      })
      .catch((err) => console.error('Profile load error:', err))
      .finally(() => setLoading(false))
  }, [userId])

  const handlePersonalSave = async (e) => {
    e.preventDefault()
    setPersonalSaving(true)
    setPersonalMsg(null)
    try {
      const updated = await updateMyProfile(userId, {
        first_name: personal.first_name,
        last_name: personal.last_name,
        avatar_url: personal.avatar_url || null,
      })
      // Keep auth store in sync so the header name updates
      setProfile(updated)
      setPersonalMsg({ type: 'success', text: 'Profile updated.' })
    } catch (err) {
      setPersonalMsg({ type: 'error', text: err.message })
    } finally {
      setPersonalSaving(false)
    }
  }

  const handleContactSave = async (e) => {
    e.preventDefault()
    setContactSaving(true)
    setContactMsg(null)
    try {
      await updateMyStaffDetails(userId, {
        contact_number: contact.contact_number || null,
        social_media_links: {
          instagram: contact.instagram || null,
          facebook: contact.facebook || null,
          tiktok: contact.tiktok || null,
        },
      })
      // Email lives in profiles table
      if (contact.email !== fullProfile?.email) {
        await updateMyProfile(userId, { email: contact.email })
      }
      setContactMsg({ type: 'success', text: 'Contact info updated.' })
    } catch (err) {
      setContactMsg({ type: 'error', text: err.message })
    } finally {
      setContactSaving(false)
    }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    setPwSaving(true)
    try {
      await updateMyPassword(pwForm.next)
      setPwForm({ current: '', next: '', confirm: '' })
      setPwMsg({ type: 'success', text: 'Password updated successfully.' })
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message })
    } finally {
      setPwSaving(false)
    }
  }

  const msgClass = (type) =>
    type === 'success'
      ? 'text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2'
      : 'text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2'

  const togglePw = (field) =>
    setShowPw((s) => ({ ...s, [field]: !s[field] }))

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Profile Settings</h1>

      {/* Personal info */}
      <Section title="Personal Information">
        <form onSubmit={handlePersonalSave} className="space-y-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-4 mb-2">
            {personal.avatar_url ? (
              <img
                src={personal.avatar_url}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover border border-gray-200"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center
                justify-center">
                <UserCircle size={32} className="text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                Profile Picture URL
              </label>
              <input
                className={inputClass}
                value={personal.avatar_url}
                onChange={(e) =>
                  setPersonal((p) => ({ ...p, avatar_url: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">First Name</label>
              <input
                className={inputClass}
                value={personal.first_name}
                onChange={(e) =>
                  setPersonal((p) => ({ ...p, first_name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Last Name</label>
              <input
                className={inputClass}
                value={personal.last_name}
                onChange={(e) =>
                  setPersonal((p) => ({ ...p, last_name: e.target.value }))
                }
                required
              />
            </div>
          </div>

          {personalMsg && (
            <p className={msgClass(personalMsg.type)}>{personalMsg.text}</p>
          )}
          <div className="flex justify-end">
            <SaveButton loading={personalSaving} />
          </div>
        </form>
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <form onSubmit={handlePasswordSave} className="space-y-4">
          {[
            { field: 'next', label: 'New Password' },
            { field: 'confirm', label: 'Confirm New Password' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <div className="relative">
                <input
                  type={showPw[field] ? 'text' : 'password'}
                  className={inputClass + ' pr-10'}
                  value={pwForm[field]}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => togglePw(field)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                    hover:text-gray-600"
                  aria-label={showPw[field] ? 'Hide' : 'Show'}
                >
                  {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          {pwMsg && <p className={msgClass(pwMsg.type)}>{pwMsg.text}</p>}
          <div className="flex justify-end">
            <SaveButton loading={pwSaving} label="Update Password" />
          </div>
        </form>
      </Section>

      {/* Contact & Social */}
      <Section title="Contact &amp; Social">
        <form onSubmit={handleContactSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Contact Number
              </label>
              <input
                className={inputClass}
                value={contact.contact_number}
                onChange={(e) =>
                  setContact((c) => ({ ...c, contact_number: e.target.value }))
                }
                placeholder="+63 912 345 6789"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                className={inputClass}
                value={contact.email}
                onChange={(e) =>
                  setContact((c) => ({ ...c, email: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
              Social Media Links
            </p>
            <div className="space-y-3">
              {[
                { field: 'instagram', placeholder: 'https://instagram.com/handle' },
                { field: 'facebook', placeholder: 'https://facebook.com/profile' },
                { field: 'tiktok', placeholder: 'https://tiktok.com/@handle' },
              ].map(({ field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1 capitalize">
                    {field}
                  </label>
                  <input
                    className={inputClass}
                    value={contact[field]}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, [field]: e.target.value }))
                    }
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          {contactMsg && <p className={msgClass(contactMsg.type)}>{contactMsg.text}</p>}
          <div className="flex justify-end">
            <SaveButton loading={contactSaving} />
          </div>
        </form>
      </Section>
    </div>
  )
}

export default StaffProfileSettingsPage
```

- [x] **Step 5: Commit**

```bash
git add src/services/staffProfileService.js \
  src/services/staffProfileService.test.js \
  src/pages/staff/ProfileSettingsPage.jsx
git commit -m "feat: add staff profile service and profile settings page"
```

---

## Task 9: Final Integration Check

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass. Fix any failures before proceeding.

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

Open `http://localhost:5173`.

- [ ] **Step 3: Smoke test the full staff flow**

Using a Supabase `staff` role account, verify each step:

1. Unauthenticated visit → redirects to `/login`
2. Login with admin account → lands on `/admin` (not `/staff`)
3. Logout → back to `/login`
4. Login with staff account → lands on `/staff`
5. Dashboard shows 3 stat cards and today's schedule (or empty state)
6. Navigate to Appointments → list view loads with "Upcoming" filter active
7. Switch sort to "Oldest First" → list reorders
8. Switch to Calendar view → month grid appears, dots mark appointment dates
9. Click a date with appointments → filtered list appears beside calendar
10. Click a date without appointments → empty state appears
11. Click "Approve Appointment" on a pending booking → verification modal opens with
    GCash receipt details
12. Navigate to Leave Request → form loads with 4 type buttons
13. Fill form with past end_date before start_date → error shown
14. Submit valid leave request → success message, history updates below
15. Navigate to Profile → all sections load with current data
16. Change name → save → header name updates
17. Enter mismatched passwords → error shown
18. Enter valid new password (8+ chars) → success message
19. Update contact/social → success message
20. Logout → back to `/login`

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Fix any linting errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete staff view implementation"
```

---

## Self-Review

### Spec Coverage Check

| Feature | Covered by |
|---|---|
| Dashboard: Total Upcoming Appointments metric | Task 4 (getMyDashboardStats → upcomingCount) |
| Dashboard: Total Appointments Today metric | Task 4 (getMyDashboardStats → todayCount) |
| Dashboard: Total Service Duration Today metric | Task 4 (getMyDashboardStats → todayDurationMinutes) |
| Dashboard: Today's appointments itinerary | Task 4 (StaffDashboardPage today's section) |
| Appointments: List view (default) | Task 6 (AppointmentsPage list branch) |
| Appointments: Calendar view toggle | Tasks 5+6 (MonthCalendar + calendar branch) |
| Appointments: Sort by ID asc/desc | Task 6 (sort select → sortField=id) |
| Appointments: Sort by date newest/oldest | Task 6 (sort select → sortField=date) |
| Appointments: Filter by status | Task 6 (status tab buttons) |
| Appointments: Search by customer name or Ref ID | Task 6 (SearchInput → search param) |
| Appointment cards: all required fields | Task 6 (AppointmentCard component) |
| Appointment cards: time left to pay countdown | Task 6 (formatDeadlineCountdown) |
| Appointment cards: Approve Appointment button | Task 6 (AppointmentCard action button) |
| Payment verification modal (GCash receipt review) | Tasks 3+6 (getMyAppointmentById → PaymentVerificationModal reuse) |
| Leave Request: type selector buttons | Task 7 (LeaveRequestPage) |
| Leave Request: start/end date inputs | Task 7 (LeaveRequestPage) |
| Leave Request: reason textarea | Task 7 (LeaveRequestPage) |
| Leave Request: submit | Task 7 (createLeaveRequest) |
| Leave Request history (own submissions) | Task 7 (getMyLeaveRequests) |
| Profile: avatar URL | Task 8 (ProfileSettingsPage personal section) |
| Profile: name | Task 8 (ProfileSettingsPage personal section) |
| Profile: password change | Task 8 (ProfileSettingsPage password section) |
| Profile: contact number | Task 8 (ProfileSettingsPage contact section) |
| Profile: email | Task 8 (ProfileSettingsPage contact section) |
| Profile: social media links | Task 8 (ProfileSettingsPage social section) |
| Role-based login redirect | Task 2 (LoginPage updated) |

### Known Gaps / Out of Scope

- **Filter by Service Type** — `getMyAppointments` accepts `categoryId` for client-side
  filtering; a category dropdown in the Appointments page filter bar would be a clean
  follow-up (needs `getCategories` call to populate options).
- **Appointment history tab** — the spec mentions a history view. The status filter
  buttons ("finished", "cancelled", "no\_show") cover this; a dedicated "History" tab
  that pre-selects those statuses could be a UX polish follow-up.
- **Avatar file upload** — profile picture update currently accepts a URL. Supabase
  Storage file upload (drag-and-drop) is a Phase 2 addition.

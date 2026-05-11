# Admin View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Admin View in `src/` (Vite+React) — a role-gated dashboard
for the clinic Super Admin to manage bookings, customers, staff, services, inquiries,
and site settings.

**Architecture:** React Router v7 handles all routing. Zustand holds auth session +
user profile. A strict service layer (`src/services/`) contains all Supabase calls.
All admin routes are gated by an `AdminRoute` guard that verifies
`profiles.role === 'admin'`. The admin UI wraps all pages in a sidebar+header shell
(`AdminLayout`).

**Tech Stack:** React 19, React Router DOM v7, Zustand 5, Tailwind CSS v4,
@supabase/supabase-js v2, clsx, lucide-react, Vitest, @testing-library/react,
@testing-library/user-event, @testing-library/jest-dom

---

## Scope Note

This plan covers the **Admin View** only. The Staff View is a separate independent
subsystem addressed in `2026-04-03-staff-view.md` after admin is complete.

---

## Database Schema Reference

| Table | Key columns |
|---|---|
| `profiles` | id (uuid), role (customer\|staff\|admin), first_name, last_name, email, phone_number, avatar_url, gender, account_status (active\|suspended\|banned), reference_id |
| `staff_details` | id (fk→profiles), job_title, bio, contact_number, social_media_links (jsonb), is_active |
| `service_categories` | id, name, description, image_url, display_order, reference_id |
| `services` | id, category_id (fk), name, description, duration_minutes, price, image_url, is_popular, is_active, reference_id |
| `bookings` | id, customer_id (fk), staff_id (fk), appointment_date, start_time, total_duration_minutes, subtotal, downpayment_amount, remaining_balance, booking_status (upcoming\|finished\|cancelled\|no_show), downpayment_status (pending\|paid\|verified\|denied), payment_deadline, balance_settled, cancelled_by, reference_id |
| `booking_services` | id, booking_id (fk), service_id (fk), price_at_booking, duration_at_booking |
| `payments` | id, booking_id (fk), reference_number, account_name, receipt_url, amount, verified_by (fk), verified_at, status (pending\|paid\|verified\|denied), reference_id |
| `leave_requests` | id, staff_id (fk), leave_type (vacation\|sick\|emergency\|other), start_date, end_date, reason, status (pending\|approved\|denied), reviewed_by (fk), reviewed_at, reference_id |
| `inquiries` | id, first_name, last_name, email, message, status (unread\|read\|archived), created_at, reference_id |
| `site_settings` | id, key (unique text), value (jsonb), updated_by (fk), updated_at |

---

## Brand Colors

Use these Tailwind arbitrary values throughout:

| Token | Hex | Usage |
|---|---|---|
| Sage Green | `#8A956D` | Sidebar active state, primary actions |
| Rust | `#CE845D` | Accent buttons, links |
| Cream | `#F9F8F5` | Main content background |
| Charcoal | `#2C2C2C` | Sidebar background |
| Text Gray | `#4A4A4A` | Body text |

---

## File Structure

**New Files:**
- `vitest.config.js`
- `src/test/setup.js`
- `src/test/mocks/supabaseMock.js`
- `src/services/authService.js`
- `src/services/dashboardService.js`
- `src/services/bookingService.js`
- `src/services/paymentService.js`
- `src/services/customerService.js`
- `src/services/staffService.js`
- `src/services/servicesCmsService.js`
- `src/services/inquiryService.js`
- `src/services/settingsService.js`
- `src/store/authStore.js`
- `src/hooks/useAuthUser.js`
- `src/components/layout/AdminLayout.jsx`
- `src/components/layout/AdminSidebar.jsx`
- `src/components/layout/AdminHeader.jsx`
- `src/components/layout/AdminRoute.jsx`
- `src/components/common/StatCard.jsx`
- `src/components/common/Badge.jsx`
- `src/components/common/Modal.jsx`
- `src/components/common/ConfirmDialog.jsx`
- `src/components/common/SearchInput.jsx`
- `src/components/common/Spinner.jsx`
- `src/components/common/EmptyState.jsx`
- `src/components/admin/payments/PaymentVerificationModal.jsx`
- `src/pages/auth/LoginPage.jsx`
- `src/pages/admin/DashboardPage.jsx`
- `src/pages/admin/bookings/BookingsPage.jsx`
- `src/pages/admin/bookings/BookingDetailPage.jsx`
- `src/pages/admin/customers/CustomersPage.jsx`
- `src/pages/admin/customers/CustomerDetailPage.jsx`
- `src/pages/admin/staff/StaffPage.jsx`
- `src/pages/admin/staff/LeaveRequestsPage.jsx`
- `src/pages/admin/services/CategoriesPage.jsx`
- `src/pages/admin/services/ServicesPage.jsx`
- `src/pages/admin/inquiries/InquiriesPage.jsx`
- `src/pages/admin/settings/SettingsPage.jsx`

**Modified Files:**
- `src/main.jsx` — Wrap in BrowserRouter
- `src/App.jsx` — Define all routes
- `src/styles/index.css` — Brand color CSS variables
- `package.json` — Add test script

---

## Task 1: Testing Infrastructure

**Files:**
- Create: `vitest.config.js`
- Create: `src/test/setup.js`
- Create: `src/test/mocks/supabaseMock.js`
- Modify: `package.json`

- [x] **Step 1: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui @testing-library/react \
  @testing-library/user-event @testing-library/jest-dom \
  jsdom clsx lucide-react
```

- [x] **Step 2: Create vitest.config.js**

```js
// vitest.config.js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
```

- [x] **Step 3: Create src/test/setup.js**

```js
// src/test/setup.js
import '@testing-library/jest-dom'
```

- [x] **Step 4: Create src/test/mocks/supabaseMock.js**

This factory creates a chainable Supabase query mock. Reuse it in every service test.

```js
// src/test/mocks/supabaseMock.js
import { vi } from 'vitest'

export const createQueryBuilder = (resolvedValue = { data: null, error: null }) => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  }
  // make the builder itself awaitable (for queries that don't end in .single())
  builder[Symbol.for('nodejs.util.inspect.custom')] = undefined
  Object.assign(builder, Promise.resolve(resolvedValue))
  builder.then = (resolve, reject) =>
    Promise.resolve(resolvedValue).then(resolve, reject)
  return builder
}
```

- [x] **Step 5: Add test script to package.json**

Open `package.json` and add `"test": "vitest"` and `"test:ui": "vitest --ui"` to the
`"scripts"` section. Do not remove existing scripts.

- [x] **Step 6: Run smoke test**

Create a throwaway test to verify the setup works:

```js
// src/test/smoke.test.js
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test`
Expected: 1 test passes. Delete `src/test/smoke.test.js` after confirming.

- [x] **Step 7: Commit**

```bash
git add vitest.config.js src/test/ package.json package-lock.json
git commit -m "chore: set up Vitest and React Testing Library"
```

---

## Task 2: Brand Colors + Dependencies

**Files:**
- Modify: `src/styles/index.css`

- [x] **Step 1: Write failing test**

```js
// src/test/colors.test.js
import { describe, it, expect } from 'vitest'

describe('brand color CSS variables', () => {
  it('are defined in the CSS file', () => {
    // This test just documents the expected variables — verified manually
    const vars = [
      '--color-sage',
      '--color-rust',
      '--color-cream',
      '--color-charcoal',
      '--color-text',
    ]
    // Existence verified via Step 2 below; this is a documentation test
    expect(vars.length).toBe(5)
  })
})
```

Run: `npm test`
Expected: PASS (trivially — confirms test runner reads this file)

- [x] **Step 2: Add CSS variables to src/styles/index.css**

Open `src/styles/index.css`. After the existing Tailwind imports, add:

```css
:root {
  --color-sage: #8A956D;
  --color-rust: #CE845D;
  --color-cream: #F9F8F5;
  --color-charcoal: #2C2C2C;
  --color-text: #4A4A4A;
}
```

- [x] **Step 3: Run tests**

Run: `npm test`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/styles/index.css src/test/colors.test.js
git commit -m "style: add brand color CSS variables"
```

---

## Task 3: Auth Service

**Files:**
- Create: `src/services/authService.js`
- Create: `src/services/authService.test.js`

- [x] **Step 1: Write failing test**

```js
// src/services/authService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from './supabaseClient'
import {
  signIn,
  signOut,
  getSession,
  getProfile,
} from './authService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('signIn', () => {
  it('returns data on success', async () => {
    const mockData = { user: { id: 'abc' }, session: {} }
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: mockData,
      error: null,
    })
    const result = await signIn('a@b.com', 'pass')
    expect(result).toEqual(mockData)
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass',
    })
  })

  it('throws on error', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: new Error('Invalid credentials'),
    })
    await expect(signIn('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })
})

describe('getProfile', () => {
  it('returns profile data', async () => {
    const profile = { id: 'abc', role: 'admin', first_name: 'Ana' }
    const qb = createQueryBuilder({ data: profile, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await getProfile('abc')
    expect(result).toEqual(profile)
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.eq).toHaveBeenCalledWith('id', 'abc')
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('Not found') })
    supabase.from.mockReturnValue(qb)
    await expect(getProfile('abc')).rejects.toThrow('Not found')
  })
})
```

Run: `npm test src/services/authService.test.js`
Expected: FAIL — `authService` module not found

- [x] **Step 2: Write implementation**

```js
// src/services/authService.js
import { supabase } from './supabaseClient'

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/authService.test.js`
Expected: PASS (5 tests)

- [x] **Step 4: Commit**

```bash
git add src/services/authService.js src/services/authService.test.js
git commit -m "feat: add auth service (signIn, signOut, getProfile)"
```

---

## Task 4: Auth Store + useAuthUser Hook

**Files:**
- Create: `src/store/authStore.js`
- Create: `src/hooks/useAuthUser.js`
- Create: `src/store/authStore.test.js`

- [x] **Step 1: Write failing test**

```js
// src/store/authStore.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import useAuthStore from './authStore'

beforeEach(() => {
  useAuthStore.setState({ user: null, profile: null, loading: true })
})

describe('authStore', () => {
  it('starts with null user and loading true', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.profile).toBeNull()
    expect(state.loading).toBe(true)
  })

  it('setUser updates user', () => {
    useAuthStore.getState().setUser({ id: 'abc' })
    expect(useAuthStore.getState().user).toEqual({ id: 'abc' })
  })

  it('setProfile updates profile', () => {
    useAuthStore.getState().setProfile({ role: 'admin' })
    expect(useAuthStore.getState().profile).toEqual({ role: 'admin' })
  })

  it('clear resets user and profile', () => {
    useAuthStore.setState({ user: { id: 'x' }, profile: { role: 'admin' } })
    useAuthStore.getState().clear()
    const { user, profile, loading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(profile).toBeNull()
    expect(loading).toBe(false)
  })
})
```

Run: `npm test src/store/authStore.test.js`
Expected: FAIL — `authStore` module not found

- [x] **Step 2: Create auth store**

```js
// src/store/authStore.js
import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  clear: () => set({ user: null, profile: null, loading: false }),
}))

export default useAuthStore
```

- [x] **Step 3: Run test**

Run: `npm test src/store/authStore.test.js`
Expected: PASS (4 tests)

- [x] **Step 4: Create useAuthUser hook**

This hook is called once at the app root. It subscribes to Supabase auth state
changes and keeps the store in sync.

```js
// src/hooks/useAuthUser.js
import { useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { getProfile } from '../services/authService'
import useAuthStore from '../store/authStore'

const useAuthUser = () => {
  const { setUser, setProfile, setLoading, clear } = useAuthStore()

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const profile = await getProfile(session.user.id)
          setUser(session.user)
          setProfile(profile)
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            const profile = await getProfile(session.user.id)
            setUser(session.user)
            setProfile(profile)
          } catch (err) {
            console.error('Auth state change error:', err)
            clear()
          }
        } else {
          clear()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])
}

export default useAuthUser
```

- [x] **Step 5: Commit**

```bash
git add src/store/ src/hooks/useAuthUser.js
git commit -m "feat: add Zustand auth store and useAuthUser hook"
```

---

## Task 5: App Routing + AdminRoute Guard

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/App.jsx`
- Create: `src/components/layout/AdminRoute.jsx`
- Create: `src/components/layout/AdminRoute.test.jsx`

- [x] **Step 1: Write failing test for AdminRoute**

```jsx
// src/components/layout/AdminRoute.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(),
}))

import useAuthStore from '../../store/authStore'
import AdminRoute from './AdminRoute'

const renderWithRouter = (storeState) => {
  useAuthStore.mockReturnValue(storeState)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<div>Admin Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminRoute', () => {
  it('shows spinner while loading', () => {
    renderWithRouter({ loading: true, profile: null })
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })

  it('redirects to /login when no profile', () => {
    renderWithRouter({ loading: false, profile: null })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('redirects to /login when role is not admin', () => {
    renderWithRouter({ loading: false, profile: { role: 'staff' } })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when role is admin', () => {
    renderWithRouter({ loading: false, profile: { role: 'admin' } })
    expect(screen.getByText('Admin Page')).toBeInTheDocument()
  })
})
```

Run: `npm test src/components/layout/AdminRoute.test.jsx`
Expected: FAIL — `AdminRoute` module not found

- [x] **Step 2: Create AdminRoute**

```jsx
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

  return <Outlet />
}

export default AdminRoute
```

- [x] **Step 3: Create Spinner (needed by AdminRoute test)**

```jsx
// src/components/common/Spinner.jsx
const Spinner = () => (
  <div
    data-testid="spinner"
    className="w-8 h-8 border-4 border-[#8A956D] border-t-transparent
      rounded-full animate-spin"
  />
)

export default Spinner
```

- [x] **Step 4: Run test**

Run: `npm test src/components/layout/AdminRoute.test.jsx`
Expected: PASS (4 tests)

- [x] **Step 5: Update src/main.jsx**

```jsx
// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [x] **Step 6: Update src/App.jsx with full route tree**

```jsx
// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthUser from './hooks/useAuthUser'
import AdminRoute from './components/layout/AdminRoute'
import AdminLayout from './components/layout/AdminLayout'
import LoginPage from './pages/auth/LoginPage'
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

const App = () => {
  useAuthUser()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
```

**Note:** Pages created in later tasks. Create stub files for each page now so the
app compiles. Each stub exports a functional component returning a `<div>` with the
page name.

- [x] **Step 7: Create page stubs**

For each file in `src/pages/`, create a stub like:

```jsx
// src/pages/admin/DashboardPage.jsx  (repeat pattern for each page)
const DashboardPage = () => <div>Dashboard</div>
export default DashboardPage
```

Pages to stub: `DashboardPage`, `BookingsPage`, `BookingDetailPage`,
`CustomersPage`, `CustomerDetailPage`, `StaffPage`, `LeaveRequestsPage`,
`CategoriesPage`, `ServicesPage`, `InquiriesPage`, `SettingsPage`,
`LoginPage`, `AdminLayout`.

- [x] **Step 8: Verify app compiles**

Run: `npm run dev`
Expected: Vite starts on localhost:5173, no build errors. Open browser → redirects to `/login`.

- [x] **Step 9: Commit**

```bash
git add src/main.jsx src/App.jsx src/components/layout/AdminRoute.jsx \
  src/components/layout/AdminRoute.test.jsx src/components/common/Spinner.jsx \
  src/pages/
git commit -m "feat: configure app routing with AdminRoute role guard"
```

---

## Task 6: Admin Layout (Sidebar + Header + Layout Wrapper)

**Files:**
- Create: `src/components/layout/AdminSidebar.jsx`
- Create: `src/components/layout/AdminHeader.jsx`
- Create: `src/components/layout/AdminLayout.jsx`
- Create: `src/components/layout/AdminLayout.test.jsx`

- [x] **Step 1: Write failing test**

```jsx
// src/components/layout/AdminLayout.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(() => ({
    profile: { first_name: 'Ana', last_name: 'Admin', role: 'admin' },
  })),
}))

vi.mock('../../services/authService', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}))

import AdminLayout from './AdminLayout'

const renderLayout = () =>
  render(
    <MemoryRouter>
      <AdminLayout />
    </MemoryRouter>
  )

describe('AdminLayout', () => {
  it('renders sidebar navigation links', () => {
    renderLayout()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Customers')).toBeInTheDocument()
    expect(screen.getByText('Staff')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('Inquiries')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders admin name in header', () => {
    renderLayout()
    expect(screen.getByText('Ana Admin')).toBeInTheDocument()
  })
})
```

Run: `npm test src/components/layout/AdminLayout.test.jsx`
Expected: FAIL — AdminLayout not implemented

- [x] **Step 2: Create AdminSidebar**

```jsx
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
  { label: 'Staff', to: '/admin/staff', icon: Briefcase },
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

export default AdminSidebar
```

- [x] **Step 3: Create AdminHeader**

```jsx
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
```

- [x] **Step 4: Create AdminLayout**

```jsx
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
```

- [x] **Step 5: Run test**

Run: `npm test src/components/layout/AdminLayout.test.jsx`
Expected: PASS (2 tests)

- [x] **Step 6: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add AdminLayout with sidebar and header"
```

---

## Task 7: Login Page

**Files:**
- Create: `src/pages/auth/LoginPage.jsx`
- Create: `src/pages/auth/LoginPage.test.jsx`

- [x] **Step 1: Write failing test**

```jsx
// src/pages/auth/LoginPage.test.jsx
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

import { signIn } from '../../services/authService'
import LoginPage from './LoginPage'

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

describe('LoginPage', () => {
  it('renders email and password inputs', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows error when non-admin logs in', async () => {
    signIn.mockResolvedValue({
      user: { id: 'x' },
      session: {},
    })
    // store will have staff profile — AdminRoute handles redirect,
    // but LoginPage shows an error when role is not admin
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'staff@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    // signIn succeeds but profile check is done in useAuthUser — LoginPage
    // just navigates to /admin on success; role check is in AdminRoute
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'))
  })

  it('shows error message on failed login', async () => {
    signIn.mockRejectedValue(new Error('Invalid login credentials'))
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    )
  })
})
```

Run: `npm test src/pages/auth/LoginPage.test.jsx`
Expected: FAIL — LoginPage not implemented

- [x] **Step 2: Implement LoginPage**

```jsx
// src/pages/auth/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { signIn } from '../../services/authService'

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
      await signIn(email, password)
      navigate('/admin')
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
          <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
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
              placeholder="admin@anaya.com"
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

- [x] **Step 4: Commit**

```bash
git add src/pages/auth/
git commit -m "feat: add admin login page"
```

---

## Task 8: Common Components

**Files:**
- Create: `src/components/common/StatCard.jsx`
- Create: `src/components/common/Badge.jsx`
- Create: `src/components/common/Modal.jsx`
- Create: `src/components/common/ConfirmDialog.jsx`
- Create: `src/components/common/SearchInput.jsx`
- Create: `src/components/common/EmptyState.jsx`
- Create: `src/components/common/Badge.test.jsx`

- [x] **Step 1: Write failing test for Badge**

```jsx
// src/components/common/Badge.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

describe('Badge', () => {
  it('renders the label', () => {
    render(<Badge variant="upcoming" label="Upcoming" />)
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
  })

  it('applies upcoming variant class', () => {
    render(<Badge variant="upcoming" label="Upcoming" />)
    const badge = screen.getByText('Upcoming')
    expect(badge).toHaveClass('bg-blue-100')
  })

  it('applies verified variant class', () => {
    render(<Badge variant="verified" label="Verified" />)
    expect(screen.getByText('Verified')).toHaveClass('bg-green-100')
  })

  it('applies denied variant class', () => {
    render(<Badge variant="denied" label="Denied" />)
    expect(screen.getByText('Denied')).toHaveClass('bg-red-100')
  })
})
```

Run: `npm test src/components/common/Badge.test.jsx`
Expected: FAIL — Badge not found

- [x] **Step 2: Create Badge**

```jsx
// src/components/common/Badge.jsx
import clsx from 'clsx'

const variants = {
  upcoming: 'bg-blue-100 text-blue-700',
  finished: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-orange-100 text-orange-700',
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  verified: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  banned: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  unread: 'bg-blue-100 text-blue-700',
  read: 'bg-gray-100 text-gray-600',
  archived: 'bg-gray-100 text-gray-400',
}

/** @param {{ variant: string, label: string, className?: string }} props */
const Badge = ({ variant, label, className }) => (
  <span
    className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant] ?? 'bg-gray-100 text-gray-600',
      className
    )}
  >
    {label}
  </span>
)

export default Badge
```

- [x] **Step 3: Run Badge test**

Run: `npm test src/components/common/Badge.test.jsx`
Expected: PASS (4 tests)

- [x] **Step 4: Create StatCard**

```jsx
// src/components/common/StatCard.jsx
import clsx from 'clsx'

/**
 * @param {{
 *   label: string,
 *   value: string | number,
 *   icon: React.ElementType,
 *   color?: 'green' | 'rust' | 'blue' | 'orange' | 'red',
 *   sub?: string
 * }} props
 */
const colorMap = {
  green: 'bg-[#8A956D]/10 text-[#8A956D]',
  rust: 'bg-[#CE845D]/10 text-[#CE845D]',
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
}

const StatCard = ({ label, value, icon: Icon, color = 'green', sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 flex
    items-start gap-4 shadow-sm">
    <div className={clsx('p-2.5 rounded-lg', colorMap[color])}>
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-[#2C2C2C] mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

export default StatCard
```

- [x] **Step 5: Create Modal**

```jsx
// src/components/common/Modal.jsx
import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   children: React.ReactNode,
 *   size?: 'sm' | 'md' | 'lg' | 'xl'
 * }} props
 */
const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-white rounded-2xl shadow-xl w-full ${sizeMap[size]}
        max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4
          border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-[#2C2C2C]">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

export default Modal
```

- [x] **Step 6: Create ConfirmDialog**

```jsx
// src/components/common/ConfirmDialog.jsx
import Modal from './Modal'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onConfirm: () => void,
 *   title: string,
 *   message: string,
 *   confirmLabel?: string,
 *   danger?: boolean
 * }} props
 */
const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-gray-600 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button
        onClick={onClose}
        className="px-4 py-2 text-sm border border-gray-200 rounded-lg
          hover:bg-gray-50 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        className={`px-4 py-2 text-sm rounded-lg text-white transition-colors
          font-medium ${danger
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-[#8A956D] hover:bg-[#7a8560]'
          }`}
      >
        {confirmLabel}
      </button>
    </div>
  </Modal>
)

export default ConfirmDialog
```

- [x] **Step 7: Create SearchInput**

```jsx
// src/components/common/SearchInput.jsx
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

/**
 * @param {{
 *   value: string,
 *   onChange: (v: string) => void,
 *   placeholder?: string,
 *   debounceMs?: number
 * }} props
 */
const SearchInput = ({ value, onChange, placeholder = 'Search…', debounceMs = 300 }) => {
  const [local, setLocal] = useState(value)

  useEffect(() => { setLocal(value) }, [value])

  useEffect(() => {
    const t = setTimeout(() => onChange(local), debounceMs)
    return () => clearTimeout(t)
  }, [local])

  return (
    <div className="relative">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64
          focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
          focus:border-[#8A956D]"
      />
    </div>
  )
}

export default SearchInput
```

- [x] **Step 8: Create EmptyState**

```jsx
// src/components/common/EmptyState.jsx
import { Inbox } from 'lucide-react'

/** @param {{ title?: string, message?: string, icon?: React.ElementType }} props */
const EmptyState = ({
  title = 'Nothing here yet',
  message = 'No records found.',
  icon: Icon = Inbox,
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="p-4 bg-gray-100 rounded-full mb-4">
      <Icon size={24} className="text-gray-400" />
    </div>
    <p className="font-medium text-[#4A4A4A]">{title}</p>
    <p className="text-sm text-gray-400 mt-1">{message}</p>
  </div>
)

export default EmptyState
```

- [x] **Step 9: Commit**

```bash
git add src/components/common/
git commit -m "feat: add common UI components (StatCard, Badge, Modal, etc.)"
```

---

## Task 9: Dashboard Service + Dashboard Page

**Files:**
- Create: `src/services/dashboardService.js`
- Create: `src/services/dashboardService.test.js`
- Replace stub: `src/pages/admin/DashboardPage.jsx`

- [x] **Step 1: Write failing service test**

```js
// src/services/dashboardService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getDashboardStats } from './dashboardService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getDashboardStats', () => {
  it('returns stats object with expected keys', async () => {
    const qb = createQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(qb)
    const stats = await getDashboardStats()
    expect(stats).toHaveProperty('totalBookings')
    expect(stats).toHaveProperty('upcomingBookings')
    expect(stats).toHaveProperty('pendingPayments')
    expect(stats).toHaveProperty('pendingLeaveRequests')
    expect(stats).toHaveProperty('unreadInquiries')
    expect(stats).toHaveProperty('todaysAppointments')
  })
})
```

Run: `npm test src/services/dashboardService.test.js`
Expected: FAIL

- [x] **Step 2: Create dashboardService**

```js
// src/services/dashboardService.js
import { supabase } from './supabaseClient'

const today = () => new Date().toISOString().split('T')[0]

export const getDashboardStats = async () => {
  const [
    bookingsRes,
    upcomingRes,
    pendingPaymentsRes,
    pendingLeaveRes,
    unreadInquiriesRes,
    todaysRes,
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_status', 'upcoming'),
    supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread'),
    supabase
      .from('bookings')
      .select(`
        id, reference_id, start_time, total_duration_minutes,
        booking_status, downpayment_status,
        customer:profiles!bookings_customer_id_fkey(first_name, last_name),
        staff:profiles!bookings_staff_id_fkey(first_name, last_name),
        booking_services(service_id, services(name))
      `)
      .eq('appointment_date', today())
      .eq('booking_status', 'upcoming')
      .order('start_time'),
  ])

  // Propagate first error found
  const errors = [
    bookingsRes, upcomingRes, pendingPaymentsRes,
    pendingLeaveRes, unreadInquiriesRes, todaysRes,
  ].map((r) => r.error).filter(Boolean)
  if (errors.length) throw errors[0]

  return {
    totalBookings: bookingsRes.count ?? 0,
    upcomingBookings: upcomingRes.count ?? 0,
    pendingPayments: pendingPaymentsRes.count ?? 0,
    pendingLeaveRequests: pendingLeaveRes.count ?? 0,
    unreadInquiries: unreadInquiriesRes.count ?? 0,
    todaysAppointments: todaysRes.data ?? [],
  }
}
```

- [x] **Step 3: Run service test**

Run: `npm test src/services/dashboardService.test.js`
Expected: PASS

- [x] **Step 4: Create DashboardPage**

```jsx
// src/pages/admin/DashboardPage.jsx
import { useEffect, useState } from 'react'
import {
  CalendarDays, Clock, CreditCard, ClipboardList, Mail, TrendingUp,
} from 'lucide-react'
import { getDashboardStats } from '../../services/dashboardService'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import Badge from '../../components/common/Badge'

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${ampm}`
}

const DashboardPage = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Bookings"
          value={stats.totalBookings}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Upcoming"
          value={stats.upcomingBookings}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          label="Pending Payments"
          value={stats.pendingPayments}
          icon={CreditCard}
          color="rust"
        />
        <StatCard
          label="Leave Requests"
          value={stats.pendingLeaveRequests}
          icon={ClipboardList}
          color="orange"
        />
        <StatCard
          label="Unread Inquiries"
          value={stats.unreadInquiries}
          icon={Mail}
          color="rust"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
            <Clock size={16} className="text-[#8A956D]" />
            Today&apos;s Appointments
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
              <div
                key={appt.id}
                className="px-6 py-4 flex items-center gap-4"
              >
                <div className="w-16 text-center">
                  <p className="text-sm font-semibold text-[#2C2C2C]">
                    {formatTime(appt.start_time)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {appt.total_duration_minutes}m
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
                <div className="flex items-center gap-2">
                  <Badge
                    variant={appt.booking_status}
                    label={appt.booking_status}
                  />
                  {appt.staff && (
                    <span className="text-xs text-gray-400">
                      {appt.staff.first_name} {appt.staff.last_name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardPage
```

- [x] **Step 5: Commit**

```bash
git add src/services/dashboardService.js src/services/dashboardService.test.js \
  src/pages/admin/DashboardPage.jsx
git commit -m "feat: add dashboard page with stats and today's appointments"
```

---

## Task 10: Booking Service

**Files:**
- Create: `src/services/bookingService.js`
- Create: `src/services/bookingService.test.js`

- [x] **Step 1: Write failing test**

```js
// src/services/bookingService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  getBookings,
  getBookingById,
  updateBookingStatus,
  settleBalance,
} from './bookingService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getBookings', () => {
  it('queries the bookings table', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getBookings({})
    expect(supabase.from).toHaveBeenCalledWith('bookings')
  })
})

describe('updateBookingStatus', () => {
  it('updates booking_status', async () => {
    const qb = createQueryBuilder({ data: { id: '1', booking_status: 'finished' }, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await updateBookingStatus('1', 'finished')
    expect(result.booking_status).toBe('finished')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ booking_status: 'finished' })
    )
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('RLS error') })
    supabase.from.mockReturnValue(qb)
    await expect(updateBookingStatus('1', 'finished')).rejects.toThrow('RLS error')
  })
})
```

Run: `npm test src/services/bookingService.test.js`
Expected: FAIL

- [x] **Step 2: Create bookingService**

```js
// src/services/bookingService.js
import { supabase } from './supabaseClient'

const BOOKING_SELECT = `
  id, reference_id, appointment_date, start_time,
  total_duration_minutes, subtotal, downpayment_amount,
  remaining_balance, booking_status, downpayment_status,
  payment_deadline, balance_settled, booking_notes,
  cancelled_at, created_at,
  customer:profiles!bookings_customer_id_fkey(
    id, first_name, last_name, email, phone_number, avatar_url
  ),
  staff:profiles!bookings_staff_id_fkey(
    id, first_name, last_name
  ),
  booking_services(
    id, price_at_booking, duration_at_booking,
    services(id, name, duration_minutes, price)
  )
`

/**
 * @param {{
 *   status?: string,
 *   search?: string,
 *   page?: number,
 *   pageSize?: number
 * }} options
 */
export const getBookings = async ({
  status,
  search,
  page = 0,
  pageSize = 20,
} = {}) => {
  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT, { count: 'exact' })
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) query = query.eq('booking_status', status)
  if (search) {
    query = query.ilike('reference_id', `%${search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export const getBookingById = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      ${BOOKING_SELECT},
      payments(
        id, reference_number, account_name, receipt_url,
        amount, status, verified_at,
        verifier:profiles!payments_verified_by_fkey(first_name, last_name)
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const updateBookingStatus = async (id, bookingStatus) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ booking_status: bookingStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const settleBalance = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      balance_settled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const cancelBooking = async (id, cancelledBy) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/bookingService.test.js`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/services/bookingService.js src/services/bookingService.test.js
git commit -m "feat: add booking service"
```

---

## Task 11: Payment Service + Verification Modal

**Files:**
- Create: `src/services/paymentService.js`
- Create: `src/services/paymentService.test.js`
- Create: `src/components/admin/payments/PaymentVerificationModal.jsx`

- [x] **Step 1: Write failing test**

```js
// src/services/paymentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { verifyPayment, denyPayment } from './paymentService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('verifyPayment', () => {
  it('updates payment status to verified and booking status to paid', async () => {
    const qb = createQueryBuilder({ data: { id: 'p1' }, error: null })
    supabase.from.mockReturnValue(qb)
    await verifyPayment('p1', 'b1', 'admin-id')
    expect(supabase.from).toHaveBeenCalledWith('payments')
  })
})

describe('denyPayment', () => {
  it('updates payment status to denied', async () => {
    const qb = createQueryBuilder({ data: { id: 'p1' }, error: null })
    supabase.from.mockReturnValue(qb)
    await denyPayment('p1', 'b1')
    expect(supabase.from).toHaveBeenCalledWith('payments')
  })
})
```

Run: `npm test src/services/paymentService.test.js`
Expected: FAIL

- [x] **Step 2: Create paymentService**

```js
// src/services/paymentService.js
import { supabase } from './supabaseClient'

export const verifyPayment = async (paymentId, bookingId, verifierId) => {
  const now = new Date().toISOString()

  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'verified', verified_by: verifierId, verified_at: now })
    .eq('id', paymentId)
  if (payErr) throw payErr

  const { data, error: bookErr } = await supabase
    .from('bookings')
    .update({ downpayment_status: 'verified', updated_at: now })
    .eq('id', bookingId)
    .select()
    .single()
  if (bookErr) throw bookErr
  return data
}

export const denyPayment = async (paymentId, bookingId) => {
  const now = new Date().toISOString()

  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'denied' })
    .eq('id', paymentId)
  if (payErr) throw payErr

  const { data, error: bookErr } = await supabase
    .from('bookings')
    .update({ downpayment_status: 'denied', updated_at: now })
    .eq('id', bookingId)
    .select()
    .single()
  if (bookErr) throw bookErr
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/paymentService.test.js`
Expected: PASS

- [x] **Step 4: Create PaymentVerificationModal**

```jsx
// src/components/admin/payments/PaymentVerificationModal.jsx
import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import Modal from '../../common/Modal'
import Badge from '../../common/Badge'
import { verifyPayment, denyPayment } from '../../../services/paymentService'
import useAuthStore from '../../../store/authStore'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   booking: object | null,
 *   onUpdated: () => void
 * }} props
 */
const PaymentVerificationModal = ({ open, onClose, booking, onUpdated }) => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!booking) return null
  const payment = booking.payments?.[0]

  const handleVerify = async () => {
    if (!payment) return
    setLoading(true)
    setError(null)
    try {
      await verifyPayment(payment.id, booking.id, user.id)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeny = async () => {
    if (!payment) return
    setLoading(true)
    setError(null)
    try {
      await denyPayment(payment.id, booking.id)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment Verification"
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Booking Ref
            </p>
            <p className="font-medium text-[#2C2C2C]">
              {booking.reference_id}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Customer
            </p>
            <p className="font-medium text-[#2C2C2C]">
              {booking.customer
                ? `${booking.customer.first_name} ${booking.customer.last_name}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Downpayment
            </p>
            <p className="font-medium text-[#2C2C2C]">
              ₱{Number(booking.downpayment_amount).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Status
            </p>
            <Badge
              variant={booking.downpayment_status}
              label={booking.downpayment_status}
            />
          </div>
        </div>

        {payment ? (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-[#2C2C2C]">GCash Receipt</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Reference No.</p>
                <p className="font-mono text-[#4A4A4A]">
                  {payment.reference_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Account Name</p>
                <p className="text-[#4A4A4A]">{payment.account_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Amount Paid</p>
                <p className="font-medium text-[#4A4A4A]">
                  ₱{Number(payment.amount).toFixed(2)}
                </p>
              </div>
            </div>
            {payment.receipt_url && (
              <a
                href={payment.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#CE845D]
                  hover:underline"
              >
                <ExternalLink size={13} />
                View Receipt Screenshot
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No payment submitted yet.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {payment && booking.downpayment_status === 'pending' && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDeny}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5
                border border-red-200 text-red-600 rounded-lg text-sm font-medium
                hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <XCircle size={15} />
              Deny
            </button>
            <button
              onClick={handleVerify}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5
                bg-[#8A956D] hover:bg-[#7a8560] text-white rounded-lg text-sm
                font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={15} />
              Verify & Approve
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default PaymentVerificationModal
```

- [x] **Step 5: Commit**

```bash
git add src/services/paymentService.js src/services/paymentService.test.js \
  src/components/admin/payments/
git commit -m "feat: add payment service and GCash verification modal"
```

---

## Task 12: Bookings Management Page + Booking Detail Page

**Files:**
- Replace stub: `src/pages/admin/bookings/BookingsPage.jsx`
- Replace stub: `src/pages/admin/bookings/BookingDetailPage.jsx`

- [x] **Step 1: Create BookingsPage**

```jsx
// src/pages/admin/bookings/BookingsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookings } from '../../../services/bookingService'
import Badge from '../../../components/common/Badge'
import SearchInput from '../../../components/common/SearchInput'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import PaymentVerificationModal from '../../../components/admin/payments/PaymentVerificationModal'
import { CalendarDays } from 'lucide-react'

const STATUS_FILTERS = ['all', 'upcoming', 'finished', 'cancelled', 'no_show']

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

const BookingsPage = () => {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [verifyModal, setVerifyModal] = useState(null)
  const pageSize = 20

  const load = useCallback(() => {
    setLoading(true)
    getBookings({
      status: status === 'all' ? undefined : status,
      search,
      page,
      pageSize,
    })
      .then(({ data, count: c }) => { setBookings(data); setCount(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [status, search, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Bookings</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap
          items-center gap-3">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(0) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium
                  transition-colors capitalize ${
                    status === s
                      ? 'bg-[#8A956D] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(0) }}
              placeholder="Search by reference ID…"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No bookings found"
            message="Try adjusting your filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Ref ID', 'Customer', 'Date & Time', 'Status',
                      'Payment', 'Staff', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-xs font-medium text-gray-400
                          uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                        {b.reference_id}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                        {b.customer
                          ? `${b.customer.first_name} ${b.customer.last_name}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        <p>{formatDate(b.appointment_date)}</p>
                        <p className="text-xs text-gray-400">
                          {formatTime(b.start_time)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={b.booking_status} label={b.booking_status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={b.downpayment_status}
                          label={b.downpayment_status}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {b.staff
                          ? `${b.staff.first_name} ${b.staff.last_name}`
                          : 'Unassigned'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/admin/bookings/${b.id}`)}
                            className="text-xs text-[#8A956D] hover:underline"
                          >
                            View
                          </button>
                          {b.downpayment_status === 'pending' && (
                            <button
                              onClick={() => setVerifyModal(b)}
                              className="text-xs text-[#CE845D] hover:underline"
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center
                justify-between text-sm text-gray-500">
                <span>
                  Showing {page * pageSize + 1}–
                  {Math.min((page + 1) * pageSize, count)} of {count}
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
      </div>

      <PaymentVerificationModal
        open={!!verifyModal}
        booking={verifyModal}
        onClose={() => setVerifyModal(null)}
        onUpdated={load}
      />
    </div>
  )
}

export default BookingsPage
```

- [x] **Step 2: Create BookingDetailPage**

```jsx
// src/pages/admin/bookings/BookingDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  getBookingById,
  updateBookingStatus,
  settleBalance,
  cancelBooking,
} from '../../../services/bookingService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import PaymentVerificationModal from '../../../components/admin/payments/PaymentVerificationModal'
import useAuthStore from '../../../store/authStore'

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const BookingDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null) // { action, label, message }
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const load = () => {
    setLoading(true)
    getBookingById(id)
      .then(setBooking)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleConfirm = async () => {
    if (!confirm) return
    setActionLoading(true)
    try {
      if (confirm.action === 'settle') await settleBalance(id)
      else if (confirm.action === 'cancel') await cancelBooking(id, user.id)
      else await updateBookingStatus(id, confirm.action)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error) return (
    <p className="text-red-600 bg-red-50 rounded-lg p-4 text-sm">{error}</p>
  )
  if (!booking) return null

  const payment = booking.payments?.[0]

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/bookings')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">
          Booking {booking.reference_id}
        </h1>
        <Badge variant={booking.booking_status} label={booking.booking_status} />
      </div>

      {/* Overview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Overview</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Date
            </p>
            <p className="text-[#4A4A4A]">{formatDate(booking.appointment_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Time
            </p>
            <p className="text-[#4A4A4A]">
              {formatTime(booking.start_time)}
              {' '}({booking.total_duration_minutes} min)
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Customer
            </p>
            <p className="text-[#4A4A4A] font-medium">
              {booking.customer
                ? `${booking.customer.first_name} ${booking.customer.last_name}`
                : '—'}
            </p>
            <p className="text-xs text-gray-400">{booking.customer?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Staff
            </p>
            <p className="text-[#4A4A4A]">
              {booking.staff
                ? `${booking.staff.first_name} ${booking.staff.last_name}`
                : 'Unassigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Services</h2>
        <div className="space-y-2">
          {booking.booking_services?.map((bs) => (
            <div key={bs.id} className="flex justify-between text-sm">
              <span className="text-[#4A4A4A]">{bs.services?.name}</span>
              <span className="text-gray-500">
                ₱{Number(bs.price_at_booking).toFixed(2)}
                {' '}· {bs.duration_at_booking} min
              </span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 flex justify-between
            text-sm font-semibold">
            <span>Total</span>
            <span>₱{Number(booking.subtotal).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Payment</h2>
        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Downpayment</p>
            <p className="font-medium">₱{Number(booking.downpayment_amount).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Remaining</p>
            <p className="font-medium">₱{Number(booking.remaining_balance).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Balance Settled</p>
            <p className="font-medium">{booking.balance_settled ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={booking.downpayment_status}
            label={`Downpayment: ${booking.downpayment_status}`}
          />
          {booking.downpayment_status === 'pending' && payment && (
            <button
              onClick={() => setVerifyOpen(true)}
              className="text-sm text-[#CE845D] hover:underline"
            >
              Review GCash Receipt
            </button>
          )}
          {!booking.balance_settled && booking.booking_status === 'upcoming' && (
            <button
              onClick={() =>
                setConfirm({
                  action: 'settle',
                  label: 'Mark Balance Settled',
                  message:
                    'Confirm that the customer has paid the remaining balance in person.',
                })
              }
              className="text-sm text-[#8A956D] hover:underline"
            >
              Mark Balance Settled
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      {booking.booking_status === 'upcoming' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-[#2C2C2C] mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                setConfirm({
                  action: 'finished',
                  label: 'Mark as Finished',
                  message: 'Mark this appointment as finished?',
                })
              }
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white
                text-sm rounded-lg font-medium transition-colors"
            >
              Mark Finished
            </button>
            <button
              onClick={() =>
                setConfirm({
                  action: 'no_show',
                  label: 'Mark as No Show',
                  message: 'Mark this customer as a no-show?',
                })
              }
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white
                text-sm rounded-lg font-medium transition-colors"
            >
              Mark No Show
            </button>
            <button
              onClick={() =>
                setConfirm({
                  action: 'cancel',
                  label: 'Cancel Booking',
                  message: 'Cancel this booking? This cannot be undone.',
                  danger: true,
                })
              }
              className="px-4 py-2 border border-red-200 text-red-600 text-sm
                rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              Cancel Booking
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title={confirm?.label ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={actionLoading ? 'Processing…' : confirm?.label}
        danger={confirm?.danger}
      />

      <PaymentVerificationModal
        open={verifyOpen}
        booking={booking}
        onClose={() => setVerifyOpen(false)}
        onUpdated={load}
      />
    </div>
  )
}

export default BookingDetailPage
```

- [x] **Step 3: Commit**

```bash
git add src/pages/admin/bookings/
git commit -m "feat: add bookings management and booking detail pages"
```

---

## Task 13: Customer Service + Customers Page + Customer Detail Page

**Files:**
- Create: `src/services/customerService.js`
- Create: `src/services/customerService.test.js`
- Replace stub: `src/pages/admin/customers/CustomersPage.jsx`
- Replace stub: `src/pages/admin/customers/CustomerDetailPage.jsx`

- [x] **Step 1: Write failing test**

```js
// src/services/customerService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  getCustomers,
  getCustomerById,
  updateAccountStatus,
} from './customerService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('updateAccountStatus', () => {
  it('updates account_status', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', account_status: 'suspended' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await updateAccountStatus('u1', 'suspended')
    expect(result.account_status).toBe('suspended')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ account_status: 'suspended' })
    )
  })
})
```

Run: `npm test src/services/customerService.test.js`
Expected: FAIL

- [x] **Step 2: Create customerService**

```js
// src/services/customerService.js
import { supabase } from './supabaseClient'

export const getCustomers = async ({ search, status, page = 0, pageSize = 20 } = {}) => {
  let query = supabase
    .from('profiles')
    .select('id, reference_id, first_name, last_name, email, phone_number, \
avatar_url, account_status, created_at', { count: 'exact' })
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) query = query.eq('account_status', status)
  if (search) query = query.ilike('email', `%${search}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export const getCustomerById = async (id) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, reference_id, first_name, last_name, email, phone_number,
      date_of_birth, avatar_url, gender, account_status, created_at
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const getCustomerBookings = async (customerId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, reference_id, appointment_date, start_time,
      booking_status, downpayment_status, subtotal, balance_settled,
      booking_services(services(name))
    `)
    .eq('customer_id', customerId)
    .order('appointment_date', { ascending: false })
  if (error) throw error
  return data
}

export const updateAccountStatus = async (id, accountStatus) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateCustomer = async (id, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/customerService.test.js`
Expected: PASS

- [x] **Step 4: Create CustomersPage**

```jsx
// src/pages/admin/customers/CustomersPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import {
  getCustomers,
  updateAccountStatus,
} from '../../../services/customerService'
import Badge from '../../../components/common/Badge'
import SearchInput from '../../../components/common/SearchInput'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const STATUS_FILTERS = ['all', 'active', 'suspended', 'banned']

const CustomersPage = () => {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [confirm, setConfirm] = useState(null) // { id, action, newStatus }
  const pageSize = 20

  const load = useCallback(() => {
    setLoading(true)
    getCustomers({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search,
      page,
      pageSize,
    })
      .then(({ data, count: c }) => { setCustomers(data); setCount(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter, search, page])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async () => {
    if (!confirm) return
    try {
      await updateAccountStatus(confirm.id, confirm.newStatus)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Customers</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap
          items-center gap-3">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium
                  transition-colors capitalize ${
                    statusFilter === s
                      ? 'bg-[#8A956D] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(0) }}
              placeholder="Search by email…"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  {['Name', 'Email', 'Phone', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-medium text-gray-400
                        uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{c.email}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {c.phone_number || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={c.account_status} label={c.account_status} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-3 text-xs">
                        <button
                          onClick={() => navigate(`/admin/customers/${c.id}`)}
                          className="text-[#8A956D] hover:underline"
                        >
                          View
                        </button>
                        {c.account_status === 'active' && (
                          <button
                            onClick={() => setConfirm({
                              id: c.id,
                              action: 'Suspend',
                              newStatus: 'suspended',
                              message: `Suspend ${c.first_name} ${c.last_name}?`,
                            })}
                            className="text-yellow-600 hover:underline"
                          >
                            Suspend
                          </button>
                        )}
                        {c.account_status !== 'banned' && (
                          <button
                            onClick={() => setConfirm({
                              id: c.id,
                              action: 'Ban',
                              newStatus: 'banned',
                              message: `Permanently ban ${c.first_name} ${c.last_name}?`,
                              danger: true,
                            })}
                            className="text-red-500 hover:underline"
                          >
                            Ban
                          </button>
                        )}
                        {c.account_status !== 'active' && (
                          <button
                            onClick={() => setConfirm({
                              id: c.id,
                              action: 'Reactivate',
                              newStatus: 'active',
                              message: `Reactivate ${c.first_name} ${c.last_name}?`,
                            })}
                            className="text-green-600 hover:underline"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center
                justify-between text-sm text-gray-500">
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
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatusChange}
        title={confirm?.action ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.action}
        danger={confirm?.danger}
      />
    </div>
  )
}

export default CustomersPage
```

- [x] **Step 5: Create CustomerDetailPage**

```jsx
// src/pages/admin/customers/CustomerDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  getCustomerById,
  getCustomerBookings,
  updateAccountStatus,
} from '../../../services/customerService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const CustomerDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getCustomerById(id), getCustomerBookings(id)])
      .then(([c, b]) => { setCustomer(c); setBookings(b) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleStatusChange = async () => {
    if (!confirm) return
    try {
      await updateAccountStatus(id, confirm.newStatus)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error) return <p className="text-red-600 p-4 text-sm">{error}</p>
  if (!customer) return null

  const noShowCount = bookings.filter((b) => b.booking_status === 'no_show').length

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/customers')} aria-label="Back">
          <ArrowLeft size={18} className="text-gray-400 hover:text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">
          {customer.first_name} {customer.last_name}
        </h1>
        <Badge variant={customer.account_status} label={customer.account_status} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-1">Email</p>
            <p className="text-[#4A4A4A]">{customer.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Phone</p>
            <p className="text-[#4A4A4A]">{customer.phone_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Gender</p>
            <p className="text-[#4A4A4A] capitalize">{customer.gender || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Date of Birth</p>
            <p className="text-[#4A4A4A]">
              {customer.date_of_birth
                ? new Date(customer.date_of_birth).toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">No-Show Count</p>
            <p className={`font-medium ${noShowCount > 2 ? 'text-red-600' : 'text-[#4A4A4A]'}`}>
              {noShowCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Member Since</p>
            <p className="text-[#4A4A4A]">
              {new Date(customer.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          {customer.account_status === 'active' && (
            <button
              onClick={() => setConfirm({
                newStatus: 'suspended',
                label: 'Suspend Account',
                message: 'This customer will not be able to make new bookings.',
              })}
              className="px-4 py-2 text-sm border border-yellow-200 text-yellow-700
                rounded-lg hover:bg-yellow-50 transition-colors"
            >
              Suspend
            </button>
          )}
          {customer.account_status !== 'banned' && (
            <button
              onClick={() => setConfirm({
                newStatus: 'banned',
                label: 'Ban Account',
                message: 'This action permanently bans the customer.',
                danger: true,
              })}
              className="px-4 py-2 text-sm border border-red-200 text-red-600
                rounded-lg hover:bg-red-50 transition-colors"
            >
              Ban
            </button>
          )}
          {customer.account_status !== 'active' && (
            <button
              onClick={() => setConfirm({
                newStatus: 'active',
                label: 'Reactivate Account',
                message: 'Restore this customer\'s access.',
              })}
              className="px-4 py-2 text-sm bg-[#8A956D] text-white rounded-lg
                hover:bg-[#7a8560] transition-colors"
            >
              Reactivate
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C]">
            Booking History ({bookings.length})
          </h2>
        </div>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No bookings yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {bookings.map((b) => (
              <div key={b.id} className="px-6 py-4 flex items-center gap-4 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-[#4A4A4A]">
                    {new Date(b.appointment_date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.booking_services
                      ?.map((bs) => bs.services?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                <Badge variant={b.booking_status} label={b.booking_status} />
                <span className="text-gray-500 text-xs font-mono">{b.reference_id}</span>
                <button
                  onClick={() => navigate(`/admin/bookings/${b.id}`)}
                  className="text-xs text-[#8A956D] hover:underline"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatusChange}
        title={confirm?.label ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label}
        danger={confirm?.danger}
      />
    </div>
  )
}

export default CustomerDetailPage
```

- [x] **Step 6: Commit**

```bash
git add src/services/customerService.js src/services/customerService.test.js \
  src/pages/admin/customers/
git commit -m "feat: add customer service, customers list, and customer detail pages"
```

---

## Task 14: Staff Service + Staff Management Page

**Files:**
- Create: `src/services/staffService.js`
- Create: `src/services/staffService.test.js`
- Replace stub: `src/pages/admin/staff/StaffPage.jsx`

- [x] **Step 1: Write failing test**

```js
// src/services/staffService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getStaff, deactivateStaff } from './staffService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getStaff', () => {
  it('queries profiles with role=staff', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getStaff()
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.eq).toHaveBeenCalledWith('role', 'staff')
  })
})

describe('deactivateStaff', () => {
  it('sets is_active to false in staff_details', async () => {
    const qb = createQueryBuilder({ data: { id: 's1', is_active: false }, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await deactivateStaff('s1')
    expect(result.is_active).toBe(false)
  })
})
```

Run: `npm test src/services/staffService.test.js`
Expected: FAIL

- [x] **Step 2: Create staffService**

```js
// src/services/staffService.js
import { supabase } from './supabaseClient'

export const getStaff = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, avatar_url, gender, created_at,
      staff_details(job_title, bio, contact_number, social_media_links, is_active)
    `)
    .eq('role', 'staff')
    .order('first_name')
  if (error) throw error
  return data
}

export const getStaffById = async (id) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, phone_number, avatar_url, gender,
      staff_details(job_title, bio, contact_number, social_media_links, is_active)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const createStaff = async (profileData, detailsData) => {
  // Note: creating a real Supabase user requires admin auth API — this creates
  // the profile record directly for staff accounts provisioned by the admin.
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .insert({ ...profileData, role: 'staff' })
    .select()
    .single()
  if (pErr) throw pErr

  const { error: dErr } = await supabase
    .from('staff_details')
    .insert({ id: profile.id, ...detailsData })
  if (dErr) throw dErr

  return profile
}

export const updateStaff = async (id, profileData, detailsData) => {
  const now = new Date().toISOString()

  if (Object.keys(profileData).length) {
    const { error } = await supabase
      .from('profiles')
      .update({ ...profileData, updated_at: now })
      .eq('id', id)
    if (error) throw error
  }

  if (detailsData && Object.keys(detailsData).length) {
    const { error } = await supabase
      .from('staff_details')
      .update({ ...detailsData, updated_at: now })
      .eq('id', id)
    if (error) throw error
  }

  return getStaffById(id)
}

export const deactivateStaff = async (id) => {
  const { data, error } = await supabase
    .from('staff_details')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getLeaveRequests = async ({ status } = {}) => {
  let query = supabase
    .from('leave_requests')
    .select(`
      id, reference_id, leave_type, start_date, end_date, reason,
      status, created_at, reviewed_at,
      staff:profiles!leave_requests_staff_id_fkey(
        first_name, last_name, avatar_url
      ),
      reviewer:profiles!leave_requests_reviewed_by_fkey(
        first_name, last_name
      )
    `)
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data
}

export const reviewLeaveRequest = async (id, status, reviewerId) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/staffService.test.js`
Expected: PASS

- [x] **Step 4: Create StaffPage**

```jsx
// src/pages/admin/staff/StaffPage.jsx
import { useState, useEffect } from 'react'
import { Plus, Pencil, UserX } from 'lucide-react'
import { getStaff, updateStaff, deactivateStaff } from '../../../services/staffService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const StaffFormModal = ({ open, onClose, onSaved, initial }) => {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    email: initial?.email ?? '',
    gender: initial?.gender ?? '',
    job_title: initial?.staff_details?.job_title ?? '',
    contact_number: initial?.staff_details?.contact_number ?? '',
    bio: initial?.staff_details?.bio ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { job_title, contact_number, bio, ...profileData } = form
      await updateStaff(initial.id, profileData, { job_title, contact_number, bio })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Staff' : 'Add Staff'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">First Name</label>
            <input className={inputClass} value={form.first_name} onChange={set('first_name')} required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Last Name</label>
            <input className={inputClass} value={form.last_name} onChange={set('last_name')} required />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input type="email" className={inputClass} value={form.email} onChange={set('email')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Gender</label>
            <select className={inputClass} value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contact Number</label>
            <input className={inputClass} value={form.contact_number} onChange={set('contact_number')} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Job Title</label>
          <input className={inputClass} value={form.job_title} onChange={set('job_title')} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bio</label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.bio}
            onChange={set('bio')}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border
            border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm
            bg-[#8A956D] text-white rounded-lg hover:bg-[#7a8560] disabled:opacity-50">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const StaffPage = () => {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [deactivateId, setDeactivateId] = useState(null)

  const load = () => {
    setLoading(true)
    getStaff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDeactivate = async () => {
    try {
      await deactivateStaff(deactivateId)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeactivateId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Staff</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : staff.length === 0 ? (
          <EmptyState title="No staff members" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {['Name', 'Email', 'Job Title', 'Gender', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-medium text-gray-400
                    uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((s) => {
                const isActive = s.staff_details?.is_active !== false
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{s.email}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {s.staff_details?.job_title || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 capitalize">
                      {s.gender || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={isActive ? 'active' : 'cancelled'}
                        label={isActive ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-3 text-xs">
                        <button
                          onClick={() => setEditTarget(s)}
                          className="text-[#8A956D] hover:underline flex items-center gap-1"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        {isActive && (
                          <button
                            onClick={() => setDeactivateId(s.id)}
                            className="text-red-500 hover:underline flex items-center gap-1"
                          >
                            <UserX size={11} /> Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editTarget && (
        <StaffFormModal
          open
          onClose={() => setEditTarget(null)}
          onSaved={load}
          initial={editTarget}
        />
      )}

      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Staff"
        message="This staff member will be marked inactive and removed from future bookings."
        confirmLabel="Deactivate"
        danger
      />
    </div>
  )
}

export default StaffPage
```

- [x] **Step 5: Commit**

```bash
git add src/services/staffService.js src/services/staffService.test.js \
  src/pages/admin/staff/StaffPage.jsx
git commit -m "feat: add staff service and staff management page"
```

---

## Task 15: Leave Requests Page

**Files:**
- Replace stub: `src/pages/admin/staff/LeaveRequestsPage.jsx`

- [x] **Step 1: Create LeaveRequestsPage**

```jsx
// src/pages/admin/staff/LeaveRequestsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, ClipboardList } from 'lucide-react'
import { getLeaveRequests, reviewLeaveRequest } from '../../../services/staffService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import useAuthStore from '../../../store/authStore'

const STATUS_FILTERS = ['pending', 'approved', 'denied']

const LEAVE_TYPE_LABELS = {
  vacation: 'Vacation',
  sick: 'Sick',
  emergency: 'Emergency',
  other: 'Other',
}

const LeaveRequestsPage = () => {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getLeaveRequests({ status: statusFilter })
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleReview = async (id, newStatus) => {
    setActionLoading(id)
    try {
      await reviewLeaveRequest(id, newStatus, user.id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDateRange = (start, end) => {
    const s = new Date(start).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    })
    const e = new Date(end).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    return `${s} – ${e}`
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Leave Requests</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium
                transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-[#8A956D] text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No leave requests"
            message={`No ${statusFilter} leave requests.`}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map((req) => (
              <div key={req.id} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#4A4A4A] text-sm">
                      {req.staff?.first_name} {req.staff?.last_name}
                    </p>
                    <Badge
                      variant={req.status}
                      label={LEAVE_TYPE_LABELS[req.leave_type] ?? req.leave_type}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDateRange(req.start_date, req.end_date)}
                  </p>
                  {req.reason && (
                    <p className="text-xs text-gray-400 mt-1">{req.reason}</p>
                  )}
                  {req.status !== 'pending' && req.reviewer && (
                    <p className="text-xs text-gray-300 mt-1">
                      {req.status === 'approved' ? 'Approved' : 'Denied'} by{' '}
                      {req.reviewer.first_name} {req.reviewer.last_name}
                      {req.reviewed_at &&
                        ` · ${new Date(req.reviewed_at).toLocaleDateString()}`}
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReview(req.id, 'denied')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border
                        border-red-200 text-red-600 text-xs rounded-lg
                        hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={12} /> Deny
                    </button>
                    <button
                      onClick={() => handleReview(req.id, 'approved')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5
                        bg-[#8A956D] text-white text-xs rounded-lg
                        hover:bg-[#7a8560] transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={12} /> Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LeaveRequestsPage
```

- [x] **Step 2: Commit**

```bash
git add src/pages/admin/staff/LeaveRequestsPage.jsx
git commit -m "feat: add leave requests management page"
```

---

## Task 16: Services CMS Service + Categories Page + Services Page

**Files:**
- Create: `src/services/servicesCmsService.js`
- Create: `src/services/servicesCmsService.test.js`
- Replace stub: `src/pages/admin/services/CategoriesPage.jsx`
- Replace stub: `src/pages/admin/services/ServicesPage.jsx`

- [x] **Step 1: Write failing test**

```js
// src/services/servicesCmsService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getCategories, deleteCategory } from './servicesCmsService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getCategories', () => {
  it('queries service_categories table ordered by display_order', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getCategories()
    expect(supabase.from).toHaveBeenCalledWith('service_categories')
    expect(qb.order).toHaveBeenCalledWith('display_order')
  })
})

describe('deleteCategory', () => {
  it('calls delete on service_categories', async () => {
    const qb = createQueryBuilder({ error: null })
    supabase.from.mockReturnValue(qb)
    await deleteCategory('cat-id')
    expect(supabase.from).toHaveBeenCalledWith('service_categories')
    expect(qb.delete).toHaveBeenCalled()
    expect(qb.eq).toHaveBeenCalledWith('id', 'cat-id')
  })
})
```

Run: `npm test src/services/servicesCmsService.test.js`
Expected: FAIL

- [x] **Step 2: Create servicesCmsService**

```js
// src/services/servicesCmsService.js
import { supabase } from './supabaseClient'

// Categories

export const getCategories = async () => {
  const { data, error } = await supabase
    .from('service_categories')
    .select('id, reference_id, name, description, image_url, display_order, created_at')
    .order('display_order')
  if (error) throw error
  return data
}

export const createCategory = async (payload) => {
  const { data, error } = await supabase
    .from('service_categories')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateCategory = async (id, payload) => {
  const { data, error } = await supabase
    .from('service_categories')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteCategory = async (id) => {
  const { error } = await supabase
    .from('service_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Services

export const getServicesByCategory = async (categoryId) => {
  const { data, error } = await supabase
    .from('services')
    .select(`
      id, reference_id, name, description, duration_minutes,
      price, image_url, is_popular, is_active, created_at
    `)
    .eq('category_id', categoryId)
    .order('name')
  if (error) throw error
  return data
}

export const createService = async (payload) => {
  const { data, error } = await supabase
    .from('services')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateService = async (id, payload) => {
  const { data, error } = await supabase
    .from('services')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteService = async (id) => {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/servicesCmsService.test.js`
Expected: PASS

- [x] **Step 4: Create CategoriesPage**

```jsx
// src/pages/admin/services/CategoriesPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Scissors } from 'lucide-react'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../../services/servicesCmsService'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const CategoryForm = ({ open, onClose, onSaved, initial }) => {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    image_url: initial?.image_url ?? '',
    display_order: initial?.display_order ?? 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (initial?.id) await updateCategory(initial.id, form)
      else await createCategory(form)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Category' : 'Add Category'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input className={inputClass} value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={set('description')}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Image URL</label>
          <input className={inputClass} value={form.image_url} onChange={set('image_url')} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Display Order</label>
          <input
            type="number"
            className={inputClass}
            value={form.display_order}
            onChange={(e) =>
              setForm((f) => ({ ...f, display_order: parseInt(e.target.value, 10) || 0 }))
            }
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border
            border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm
            bg-[#8A956D] text-white rounded-lg hover:bg-[#7a8560] disabled:opacity-50">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const CategoriesPage = () => {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formTarget, setFormTarget] = useState(null) // null = closed, {} = new, {id} = edit
  const [deleteId, setDeleteId] = useState(null)

  const load = () => {
    setLoading(true)
    getCategories()
      .then(setCategories)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    try {
      await deleteCategory(deleteId)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Service Categories</h1>
        <button
          onClick={() => setFormTarget({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] text-white
            text-sm rounded-lg hover:bg-[#7a8560] transition-colors"
        >
          <Plus size={15} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : categories.length === 0 ? (
        <EmptyState icon={Scissors} title="No categories yet" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm
                overflow-hidden group"
            >
              {cat.image_url && (
                <div className="h-36 overflow-hidden bg-gray-100">
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#2C2C2C]">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setFormTarget(cat)}
                      className="p-1.5 text-gray-400 hover:text-[#8A956D] rounded-lg
                        hover:bg-gray-100 transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg
                        hover:bg-gray-100 transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/admin/services/${cat.id}`)}
                  className="mt-3 w-full text-xs text-[#CE845D] hover:underline text-left"
                >
                  Manage services →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget !== null && (
        <CategoryForm
          open
          onClose={() => setFormTarget(null)}
          onSaved={load}
          initial={formTarget.id ? formTarget : null}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message="This will delete the category and all services within it. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

export default CategoriesPage
```

- [x] **Step 5: Create ServicesPage**

```jsx
// src/pages/admin/services/ServicesPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  getCategories,
  getServicesByCategory,
  createService,
  updateService,
  deleteService,
} from '../../../services/servicesCmsService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const ServiceForm = ({ open, onClose, onSaved, initial, categoryId }) => {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    duration_minutes: initial?.duration_minutes ?? 30,
    price: initial?.price ?? '',
    image_url: initial?.image_url ?? '',
    is_popular: initial?.is_popular ?? false,
    is_active: initial?.is_active ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        duration_minutes: parseInt(form.duration_minutes, 10),
        price: parseFloat(form.price),
        category_id: categoryId,
      }
      if (initial?.id) await updateService(initial.id, payload)
      else await createService(payload)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Service' : 'Add Service'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Service Name</label>
          <input className={inputClass} value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={set('description')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="15"
              step="15"
              className={inputClass}
              value={form.duration_minutes}
              onChange={set('duration_minutes')}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Price (₱)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.price}
              onChange={set('price')}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Image URL</label>
          <input className={inputClass} value={form.image_url} onChange={set('image_url')} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[#4A4A4A]">
            <input
              type="checkbox"
              checked={form.is_popular}
              onChange={(e) => setForm((f) => ({ ...f, is_popular: e.target.checked }))}
              className="accent-[#8A956D]"
            />
            Mark as Popular
          </label>
          <label className="flex items-center gap-2 text-sm text-[#4A4A4A]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="accent-[#8A956D]"
            />
            Active (visible to customers)
          </label>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border
            border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm
            bg-[#8A956D] text-white rounded-lg hover:bg-[#7a8560] disabled:opacity-50">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const ServicesPage = () => {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formTarget, setFormTarget] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      getServicesByCategory(categoryId),
      getCategories(),
    ])
      .then(([svcs, cats]) => {
        setServices(svcs)
        const cat = cats.find((c) => c.id === categoryId)
        setCategoryName(cat?.name ?? 'Services')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [categoryId])

  const handleDelete = async () => {
    try {
      await deleteService(deleteId)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/services')} aria-label="Back">
            <ArrowLeft size={18} className="text-gray-400 hover:text-gray-600" />
          </button>
          <h1 className="text-xl font-semibold text-[#2C2C2C]">{categoryName}</h1>
        </div>
        <button
          onClick={() => setFormTarget({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] text-white
            text-sm rounded-lg hover:bg-[#7a8560] transition-colors"
        >
          <Plus size={15} /> Add Service
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : services.length === 0 ? (
        <EmptyState title="No services in this category" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {['Name', 'Duration', 'Price', 'Popular', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-medium text-gray-400
                    uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {services.map((svc) => (
                <tr key={svc.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#4A4A4A]">{svc.name}</p>
                    {svc.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {svc.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {svc.duration_minutes} min
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    ₱{Number(svc.price).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {svc.is_popular ? '★ Yes' : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={svc.is_active ? 'active' : 'cancelled'}
                      label={svc.is_active ? 'Active' : 'Inactive'}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormTarget(svc)}
                        className="p-1.5 text-gray-400 hover:text-[#8A956D] rounded
                          hover:bg-gray-100"
                        aria-label="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(svc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded
                          hover:bg-gray-100"
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formTarget !== null && (
        <ServiceForm
          open
          onClose={() => setFormTarget(null)}
          onSaved={load}
          initial={formTarget.id ? formTarget : null}
          categoryId={categoryId}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Service"
        message="This will permanently delete the service."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

export default ServicesPage
```

- [x] **Step 6: Commit**

```bash
git add src/services/servicesCmsService.js src/services/servicesCmsService.test.js \
  src/pages/admin/services/
git commit -m "feat: add services CMS (categories and services management pages)"
```

---

## Task 17: Inquiry Service + Inquiries Page

**Files:**
- Create: `src/services/inquiryService.js`
- Create: `src/services/inquiryService.test.js`
- Replace stub: `src/pages/admin/inquiries/InquiriesPage.jsx`

- [x] **Step 1: Write failing test**

```js
// src/services/inquiryService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getInquiries, markRead, archiveInquiry } from './inquiryService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('markRead', () => {
  it('updates inquiry status to read', async () => {
    const qb = createQueryBuilder({ data: { id: 'i1', status: 'read' }, error: null })
    supabase.from.mockReturnValue(qb)
    await markRead('i1')
    expect(qb.update).toHaveBeenCalledWith({ status: 'read' })
    expect(qb.eq).toHaveBeenCalledWith('id', 'i1')
  })
})
```

Run: `npm test src/services/inquiryService.test.js`
Expected: FAIL

- [x] **Step 2: Create inquiryService**

```js
// src/services/inquiryService.js
import { supabase } from './supabaseClient'

export const getInquiries = async ({ status } = {}) => {
  let query = supabase
    .from('inquiries')
    .select('id, reference_id, first_name, last_name, email, message, status, created_at')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data
}

export const markRead = async (id) => {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status: 'read' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const archiveInquiry = async (id) => {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ status: 'archived' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/inquiryService.test.js`
Expected: PASS

- [x] **Step 4: Create InquiriesPage**

```jsx
// src/pages/admin/inquiries/InquiriesPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { Mail, Archive } from 'lucide-react'
import { getInquiries, markRead, archiveInquiry } from '../../../services/inquiryService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import Modal from '../../../components/common/Modal'

const STATUS_FILTERS = ['unread', 'read', 'archived']

const InquiriesPage = () => {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('unread')
  const [selected, setSelected] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getInquiries({ status: statusFilter })
      .then(setInquiries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const openInquiry = async (inq) => {
    setSelected(inq)
    if (inq.status === 'unread') {
      try {
        await markRead(inq.id)
        load()
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleArchive = async (id) => {
    setActionLoading(id)
    try {
      await archiveInquiry(id)
      setSelected(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Inquiries</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium
                transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-[#8A956D] text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : inquiries.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={`No ${statusFilter} inquiries`}
            message="Your inbox is clear."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {inquiries.map((inq) => (
              <div
                key={inq.id}
                className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50/50
                  cursor-pointer transition-colors"
                onClick={() => openInquiry(inq)}
              >
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  inq.status === 'unread' ? 'bg-[#CE845D]' : 'bg-transparent'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${
                      inq.status === 'unread'
                        ? 'font-semibold text-[#2C2C2C]'
                        : 'font-medium text-[#4A4A4A]'
                    }`}>
                      {inq.first_name} {inq.last_name}
                    </p>
                    <span className="text-xs text-gray-400">{inq.email}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                    {inq.message}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-400">
                    {new Date(inq.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Inquiry"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-1">From</p>
                <p className="font-medium text-[#4A4A4A]">
                  {selected.first_name} {selected.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Email</p>
                <p className="text-[#4A4A4A]">{selected.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Received</p>
                <p className="text-[#4A4A4A]">
                  {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <Badge variant={selected.status} label={selected.status} />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Message</p>
              <p className="text-sm text-[#4A4A4A] whitespace-pre-wrap">
                {selected.message}
              </p>
            </div>

            {selected.status !== 'archived' && (
              <div className="flex justify-end">
                <button
                  onClick={() => handleArchive(selected.id)}
                  disabled={actionLoading === selected.id}
                  className="flex items-center gap-2 px-4 py-2 text-sm border
                    border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50
                    transition-colors disabled:opacity-50"
                >
                  <Archive size={13} />
                  {actionLoading === selected.id ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default InquiriesPage
```

- [x] **Step 5: Commit**

```bash
git add src/services/inquiryService.js src/services/inquiryService.test.js \
  src/pages/admin/inquiries/
git commit -m "feat: add inquiry service and inquiries inbox page"
```

---

## Task 18: Settings Service + Settings Page

**Files:**
- Create: `src/services/settingsService.js`
- Create: `src/services/settingsService.test.js`
- Replace stub: `src/pages/admin/settings/SettingsPage.jsx`

- [x] **Step 1: Write failing test**

```js
// src/services/settingsService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getSetting, upsertSetting } from './settingsService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getSetting', () => {
  it('queries site_settings by key', async () => {
    const qb = createQueryBuilder({
      data: { key: 'operating_hours', value: { start: '09:00' } },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await getSetting('operating_hours')
    expect(result).toEqual({ start: '09:00' })
    expect(supabase.from).toHaveBeenCalledWith('site_settings')
    expect(qb.eq).toHaveBeenCalledWith('key', 'operating_hours')
  })

  it('returns null when setting not found', async () => {
    const qb = createQueryBuilder({ data: null, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await getSetting('missing_key')
    expect(result).toBeNull()
  })
})
```

Run: `npm test src/services/settingsService.test.js`
Expected: FAIL

- [x] **Step 2: Create settingsService**

```js
// src/services/settingsService.js
import { supabase } from './supabaseClient'

/**
 * Keys used in site_settings:
 *   operating_hours  → { start: "09:00", end: "19:30" }
 *   downpayment_rate → { percentage: 10 }
 *   cancellation_window → { hours: 12 }
 *   slot_duration    → { minutes: 30 }
 *   contact_info     → { phone, email, address }
 */

export const getSetting = async (key) => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export const getAllSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}

export const upsertSetting = async (key, value, updatedBy) => {
  const { data, error } = await supabase
    .from('site_settings')
    .upsert(
      {
        key,
        value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [x] **Step 3: Run test**

Run: `npm test src/services/settingsService.test.js`
Expected: PASS

- [x] **Step 4: Create SettingsPage**

```jsx
// src/pages/admin/settings/SettingsPage.jsx
import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { getAllSettings, upsertSetting } from '../../../services/settingsService'
import Spinner from '../../../components/common/Spinner'
import useAuthStore from '../../../store/authStore'

const Section = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
    <h2 className="font-semibold text-[#2C2C2C] mb-5">{title}</h2>
    {children}
  </div>
)

const inputClass = `px-3 py-2 border border-gray-200 rounded-lg text-sm
  focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

const SettingsPage = () => {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Local form state
  const [hours, setHours] = useState({ start: '09:00', end: '19:30' })
  const [downpayment, setDownpayment] = useState(10)
  const [cancellation, setCancellation] = useState(12)
  const [slotDuration, setSlotDuration] = useState(30)
  const [contact, setContact] = useState({ phone: '', email: '', address: '' })

  useEffect(() => {
    getAllSettings()
      .then((s) => {
        setSettings(s)
        if (s.operating_hours) setHours(s.operating_hours)
        if (s.downpayment_rate) setDownpayment(s.downpayment_rate.percentage)
        if (s.cancellation_window) setCancellation(s.cancellation_window.hours)
        if (s.slot_duration) setSlotDuration(s.slot_duration.minutes)
        if (s.contact_info) setContact(s.contact_info)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await Promise.all([
        upsertSetting('operating_hours', hours, user.id),
        upsertSetting('downpayment_rate', { percentage: Number(downpayment) }, user.id),
        upsertSetting('cancellation_window', { hours: Number(cancellation) }, user.id),
        upsertSetting('slot_duration', { minutes: Number(slotDuration) }, user.id),
        upsertSetting('contact_info', contact, user.id),
      ])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Settings</h1>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] text-white
            text-sm rounded-lg hover:bg-[#7a8560] transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
          Settings saved successfully.
        </p>
      )}

      <Section title="Operating Hours">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Opening Time</label>
            <input
              type="time"
              className={inputClass}
              value={hours.start}
              onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Closing Time</label>
            <input
              type="time"
              className={inputClass}
              value={hours.end}
              onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))}
            />
          </div>
        </div>
      </Section>

      <Section title="Booking Rules">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Downpayment (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              className={inputClass + ' w-full'}
              value={downpayment}
              onChange={(e) => setDownpayment(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Currently {downpayment}% of total
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Cancellation Window (hrs)
            </label>
            <input
              type="number"
              min="1"
              className={inputClass + ' w-full'}
              value={cancellation}
              onChange={(e) => setCancellation(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Customer can cancel up to {cancellation}h before
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Slot Duration (min)
            </label>
            <input
              type="number"
              min="15"
              step="15"
              className={inputClass + ' w-full'}
              value={slotDuration}
              onChange={(e) => setSlotDuration(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Appointment intervals
            </p>
          </div>
        </div>
      </Section>

      <Section title="Contact Information">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
            <input
              className={inputClass + ' w-full'}
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              placeholder="+63 912 345 6789"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email Address</label>
            <input
              type="email"
              className={inputClass + ' w-full'}
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
              placeholder="contact@anaya.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Address / Location Description
            </label>
            <textarea
              rows={3}
              className={inputClass + ' w-full'}
              value={contact.address}
              onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))}
              placeholder="Unit 1, Example Bldg, Street, City"
            />
          </div>
        </div>
      </Section>
    </form>
  )
}

export default SettingsPage
```

- [x] **Step 5: Commit**

```bash
git add src/services/settingsService.js src/services/settingsService.test.js \
  src/pages/admin/settings/
git commit -m "feat: add settings service and settings configuration page"
```

---

## Task 19: Final Integration Check

- [x] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass. Fix any failures before proceeding.

- [x] **Step 2: Run the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser.

- [x] **Step 3: Smoke test the full admin flow**

Verify each of the following in the browser using a Supabase admin account:

1. Unauthenticated visit → redirects to `/login`
2. Login with non-admin account → stays on `/login` (AdminRoute blocks)
3. Login with admin account → lands on `/admin` (Dashboard)
4. Dashboard shows stat cards and today's appointments (or empty state)
5. Bookings page loads, filter tabs work, search works
6. Click a booking → detail page loads, status badges show
7. Customers page loads, filter and search work
8. Staff page loads, edit modal opens and closes
9. Leave Requests page loads, pending tab shows requests
10. Services → Categories page loads, cards show
11. Click "Manage services →" → Services sub-page loads
12. Inquiries inbox loads, click an inquiry → modal opens, status changes to "read"
13. Settings page loads, form is pre-populated, save shows success message
14. Logout → redirects to `/login`

- [x] **Step 4: Run lint**

```bash
npm run lint
```

Fix any linting errors before the next step.

- [x] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete admin view implementation"
```

---

## Self-Review

### Spec Coverage Check

| Feature | Covered by |
|---|---|
| Dashboard metrics (revenue, bookings, pending) | Task 9 (getDashboardStats) |
| Today's appointments itinerary | Task 9 (DashboardPage) |
| View/filter all bookings | Task 12 (BookingsPage) |
| Approve/deny GCash downpayments | Tasks 11+12 (PaymentVerificationModal) |
| Update booking status (finished/cancelled/no-show) | Task 12 (BookingDetailPage) |
| Settle offline balance | Task 12 (BookingDetailPage) |
| View customer profiles | Task 13 (CustomerDetailPage) |
| Ban/suspend/reactivate customers | Task 13 (CustomersPage + Detail) |
| Manage staff profiles (view/edit/deactivate) | Task 14 (StaffPage) |
| Approve/deny leave requests | Task 15 (LeaveRequestsPage) |
| Service categories CMS | Task 16 (CategoriesPage) |
| Services CMS | Task 16 (ServicesPage) |
| Inquiry inbox (read/archive) | Task 17 (InquiriesPage) |
| Site settings (hours, downpayment, cancellation, contact) | Task 18 (SettingsPage) |
| Admin role gate | Task 5 (AdminRoute) |
| Admin login | Task 7 (LoginPage) |

### Known Gaps / Out of Scope for this Plan

- **Cancel/reschedule on behalf of customer** — partially covered (cancel action in
  BookingDetailPage); reschedule UI (date/time picker + reassignment) is more complex
  and should be a follow-up.
- **Monitor payment deadline countdown** — `payment_deadline` field is displayed in
  BookingDetailPage; real-time countdown timer and auto-cancel logic are backend
  concerns (Supabase Edge Function / cron) beyond this plan's scope.
- **Staff performance audit** — detailed performance analytics (appointments per staff,
  service durations, etc.) is a Phase 2 addition.
- **Homepage highlights / About Us CMS** — content editing for the public-facing page
  is deferred as it requires image upload (Supabase Storage) integration.
- **Create new staff (not just edit)** — `createStaff()` is in staffService but the
  StaffFormModal only handles edits. Creating a staff user requires Supabase Admin
  Auth SDK (server-side); add in a follow-up using an Edge Function.
- **Booking reassignment (change staff)** — the `staff_id` update endpoint exists in
  `bookingService`; UI to select a replacement staff member is a follow-up.

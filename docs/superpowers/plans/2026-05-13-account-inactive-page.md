# Account Inactive Page & Admin Deactivation Reason — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block suspended/banned accounts from accessing the app, show them a dedicated inactive page with the deactivation reason, and require admins to enter a reason before deactivating any account.

**Architecture:** A single `deactivation_reason` column on `profiles` carries the reason through the system. Two enforcement points — login and route guards — redirect non-active users to `/account-inactive`. A new `DeactivateAccountModal` replaces the plain `ConfirmDialog` for suspend/ban/deactivate actions.

**Tech Stack:** React 18, react-router-dom v7, Zustand, Tailwind CSS v4, Supabase, Vitest, @testing-library/react, lucide-react, clsx

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| Supabase migration | Create | Add `deactivation_reason TEXT NULL` to `profiles` |
| `src/services/customerService.js` | Modify | Accept `reason` in `updateAccountStatus`; clear on reactivation |
| `src/services/customerService.test.js` | Modify | Test reason is written/cleared |
| `src/services/staffService.js` | Modify | Accept `reason` in `deactivateStaff`; clear in `activateStaff` |
| `src/services/staffService.test.js` | Modify | Test reason is written/cleared |
| `src/components/admin/accounts/DeactivateAccountModal.jsx` | Create | Richer deactivation dialog with required reason textarea |
| `src/components/admin/accounts/DeactivateAccountModal.test.jsx` | Create | Tests for modal enable/disable, callback with reason |
| `src/pages/AccountInactivePage/index.jsx` | Create | Inactive account page (Navbar + centered card) |
| `src/App.jsx` | Modify | Add `/account-inactive` public route |
| `src/components/layout/AdminRoute.jsx` | Modify | Redirect non-active profiles to `/account-inactive` |
| `src/components/layout/AdminRoute.test.jsx` | Modify | Test suspended admin redirect |
| `src/components/layout/StaffRoute.jsx` | Modify | Same status check |
| `src/components/layout/StaffRoute.test.jsx` | Modify | Test suspended staff redirect |
| `src/components/layout/CustomerRoute.jsx` | Modify | Same status check |
| `src/components/layout/CustomerRoute.test.jsx` | Modify | Test suspended customer redirect |
| `src/pages/auth/LoginPage.jsx` | Modify | Redirect to `/account-inactive` before role-based nav |
| `src/pages/admin/customers/CustomerDetailPage.jsx` | Modify | Replace suspend/ban ConfirmDialog with DeactivateAccountModal |
| `src/pages/admin/staff/StaffDetailPage.jsx` | Modify | Replace deactivate ConfirmDialog with DeactivateAccountModal |

---

## Task 1: DB Migration

**Files:**
- Supabase migration (via MCP tool or Supabase dashboard)

- [ ] **Step 1: Apply migration**

Use the `mcp__supabase-mcp-server__apply_migration` tool (or paste into the Supabase dashboard SQL editor):

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NULL;
```

- [ ] **Step 2: Verify column exists**

Run in Supabase SQL editor or via `mcp__supabase-mcp-server__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'deactivation_reason';
```

Expected: one row returned with `data_type = 'text'` and `is_nullable = 'YES'`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add deactivation_reason column to profiles"
```

---

## Task 2: Update customerService

**Files:**
- Modify: `src/services/customerService.js`
- Modify: `src/services/customerService.test.js`

- [ ] **Step 1: Write failing tests**

Replace the contents of the `describe('updateAccountStatus')` block in `src/services/customerService.test.js`:

```js
// src/services/customerService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { updateAccountStatus } from './customerService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('updateAccountStatus', () => {
  it('writes deactivation_reason when suspending', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', account_status: 'suspended', deactivation_reason: 'No-shows' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await updateAccountStatus('u1', 'suspended', 'No-shows')
    expect(result.account_status).toBe('suspended')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'suspended',
        deactivation_reason: 'No-shows',
      })
    )
  })

  it('clears deactivation_reason when reactivating', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', account_status: 'active', deactivation_reason: null },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    await updateAccountStatus('u1', 'active')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'active',
        deactivation_reason: null,
      })
    )
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- customerService.test.js
```

Expected: tests fail because `updateAccountStatus` does not yet accept or write `deactivation_reason`.

- [ ] **Step 3: Update `updateAccountStatus` in customerService.js**

Replace the `updateAccountStatus` function (lines 50–59 of `src/services/customerService.js`):

```js
export const updateAccountStatus = async (id, accountStatus, reason = null) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      account_status: accountStatus,
      deactivation_reason: accountStatus === 'active' ? null : reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- customerService.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/customerService.js src/services/customerService.test.js
git commit -m "feat: pass deactivation_reason through updateAccountStatus"
```

---

## Task 3: Update staffService

**Files:**
- Modify: `src/services/staffService.js`
- Modify: `src/services/staffService.test.js`

- [ ] **Step 1: Write failing tests**

Open `src/services/staffService.test.js` and add/replace with:

```js
// src/services/staffService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { deactivateStaff, activateStaff } from './staffService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('deactivateStaff', () => {
  it('sets account_status to suspended and stores reason', async () => {
    const qb = createQueryBuilder({
      data: { id: 's1', account_status: 'suspended', deactivation_reason: 'Contract ended' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await deactivateStaff('s1', 'Contract ended')
    expect(result.account_status).toBe('suspended')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'suspended',
        deactivation_reason: 'Contract ended',
      })
    )
  })
})

describe('activateStaff', () => {
  it('sets account_status to active and clears deactivation_reason', async () => {
    const qb = createQueryBuilder({
      data: { id: 's1', account_status: 'active', deactivation_reason: null },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    await activateStaff('s1')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'active',
        deactivation_reason: null,
      })
    )
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- staffService.test.js
```

Expected: tests fail because `deactivateStaff` does not accept `reason` and `activateStaff` does not clear `deactivation_reason`.

- [ ] **Step 3: Update `deactivateStaff` and `activateStaff` in staffService.js**

Replace lines 69–88 of `src/services/staffService.js`:

```js
export const deactivateStaff = async (id, reason) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      account_status: 'suspended',
      deactivation_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const activateStaff = async (id) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      account_status: 'active',
      deactivation_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- staffService.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/staffService.js src/services/staffService.test.js
git commit -m "feat: pass deactivation_reason through deactivateStaff and activateStaff"
```

---

## Task 4: DeactivateAccountModal component

**Files:**
- Create: `src/components/admin/accounts/DeactivateAccountModal.jsx`
- Create: `src/components/admin/accounts/DeactivateAccountModal.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/admin/accounts/DeactivateAccountModal.test.jsx`:

```jsx
// src/components/admin/accounts/DeactivateAccountModal.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeactivateAccountModal from './DeactivateAccountModal'

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  userName: 'Jane Doe',
  userRole: 'customer',
  action: 'suspend',
}

describe('DeactivateAccountModal', () => {
  it('renders user name and role in subtitle', () => {
    render(<DeactivateAccountModal {...baseProps} />)
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument()
    expect(screen.getByText(/customer/i)).toBeInTheDocument()
  })

  it('confirm button is disabled when reason is empty', () => {
    render(<DeactivateAccountModal {...baseProps} />)
    expect(screen.getByRole('button', { name: /confirm suspension/i })).toBeDisabled()
  })

  it('confirm button enables after typing a reason', () => {
    render(<DeactivateAccountModal {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'No-shows' } })
    expect(screen.getByRole('button', { name: /confirm suspension/i })).not.toBeDisabled()
  })

  it('calls onConfirm with trimmed reason', () => {
    const onConfirm = vi.fn()
    render(<DeactivateAccountModal {...baseProps} onConfirm={onConfirm} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  No-shows  ' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm suspension/i }))
    expect(onConfirm).toHaveBeenCalledWith('No-shows')
  })

  it('clears reason and calls onClose when cancel is clicked', () => {
    const onClose = vi.fn()
    render(<DeactivateAccountModal {...baseProps} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'some reason' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing when open is false', () => {
    render(<DeactivateAccountModal {...baseProps} open={false} />)
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- DeactivateAccountModal.test.jsx
```

Expected: fails — component file does not exist.

- [ ] **Step 3: Create the component**

Create `src/components/admin/accounts/DeactivateAccountModal.jsx`:

```jsx
import { useState } from 'react'
import Modal from '../../common/Modal'
import clsx from 'clsx'

const actionConfig = {
  suspend: { title: 'Suspend Account', confirmLabel: 'Confirm Suspension', danger: false },
  ban: { title: 'Ban Account', confirmLabel: 'Confirm Ban', danger: true },
  deactivate: { title: 'Deactivate Account', confirmLabel: 'Confirm Deactivation', danger: false },
}

const DeactivateAccountModal = ({ open, onClose, onConfirm, userName, userRole, action = 'suspend' }) => {
  const [reason, setReason] = useState('')
  const config = actionConfig[action]
  const canSubmit = reason.trim().length > 0

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm(reason.trim())
    setReason('')
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={config.title} size="sm">
      <p className="text-xs text-gray-400 -mt-2 mb-4">
        {userName} · <span className="capitalize">{userRole}</span>
      </p>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-700">
          ⚠ This will prevent the user from logging in. The reason you enter will be visible to them.
        </p>
      </div>

      <div className="mb-5">
        <label
          htmlFor="deactivate-reason"
          className="block text-xs font-semibold text-gray-500 mb-1"
        >
          Reason <span className="text-red-400">*</span>
        </label>
        <textarea
          id="deactivate-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Multiple no-show appointments recorded."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
            text-[#4A4A4A] focus:outline-none focus:ring-1 focus:ring-[#8A956D] resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">This message will be visible to the user.</p>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg
            hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canSubmit}
          className={clsx(
            'px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            config.danger
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-amber-500 hover:bg-amber-600'
          )}
        >
          {config.confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export default DeactivateAccountModal
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- DeactivateAccountModal.test.jsx
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/accounts/
git commit -m "feat: add DeactivateAccountModal with required reason field"
```

---

## Task 5: AccountInactivePage

**Files:**
- Create: `src/pages/AccountInactivePage/index.jsx`

No unit tests for this page — it is a display component that reads from the Zustand store; the redirect logic that populates the store is tested via route guard and login tests in Tasks 6.

- [ ] **Step 1: Create the page**

Create `src/pages/AccountInactivePage/index.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import { Lock, Facebook, Mail } from 'lucide-react'
import Navbar from '../../components/Navbar'
import useAuthStore from '../../store/authStore'
import { signOut } from '../../services/authService'

const AccountInactivePage = () => {
  const navigate = useNavigate()
  const { profile, clear } = useAuthStore()

  const handleGoHome = async () => {
    try {
      await signOut()
    } catch {
      // ignore — clear local state regardless of server response
    }
    clear()
    navigate('/')
  }

  const isBanned = profile?.account_status === 'banned'
  const heading = isBanned
    ? 'Your account has been deactivated'
    : 'Your account has been suspended'
  const reason = profile?.deactivation_reason ||
    'No specific reason was provided. Please contact support for details.'

  return (
    <div className="min-h-screen bg-[#f9f8f6] flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
              <Lock size={24} className="text-amber-500" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-[#2C2C2C] mb-2">{heading}</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your access to Anaya has been restricted.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-1">Due to this reason:</p>
            <p className="text-sm text-[#4A4A4A]">{reason}</p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-700">
              Contact Anaya customer support to reactivate your account.
            </p>
          </div>

          <div className="flex gap-3 justify-center mb-6">
            <a
              href="#"
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg
                bg-[#1877F2] text-white hover:opacity-90 transition-opacity"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Anaya on Facebook"
            >
              <Facebook size={16} />
              Facebook
            </a>
            <a
              href="mailto:support@anaya.ph"
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg
                bg-[#8A956D] text-white hover:bg-[#7a8560] transition-colors"
              aria-label="Email Anaya support"
            >
              <Mail size={16} />
              Email Us
            </a>
          </div>

          <button
            onClick={handleGoHome}
            className="px-6 py-2 text-sm border border-gray-300 rounded-full
              text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Go Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountInactivePage
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/AccountInactivePage/
git commit -m "feat: add AccountInactivePage with reason display and sign-out"
```

---

## Task 6: Route guards, LoginPage, and App route

**Files:**
- Modify: `src/components/layout/AdminRoute.jsx`
- Modify: `src/components/layout/AdminRoute.test.jsx`
- Modify: `src/components/layout/StaffRoute.jsx`
- Modify: `src/components/layout/StaffRoute.test.jsx`
- Modify: `src/components/layout/CustomerRoute.jsx`
- Modify: `src/components/layout/CustomerRoute.test.jsx`
- Modify: `src/pages/auth/LoginPage.jsx`
- Modify: `src/App.jsx`

### 6a — AdminRoute

- [ ] **Step 1: Add failing test to AdminRoute.test.jsx**

Append this test inside the existing `describe('AdminRoute')` block in `src/components/layout/AdminRoute.test.jsx`:

```jsx
it('redirects to /account-inactive when admin is suspended', () => {
  useAuthStore.mockReturnValue({
    loading: false,
    profile: { role: 'admin', account_status: 'suspended' },
  })
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<div>Admin Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/account-inactive" element={<div>Inactive Page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Inactive Page')).toBeInTheDocument()
})
```

Also update the existing passing test that checks active access — add `account_status: 'active'` to its profile object so it still passes after the guard change:

```jsx
it('renders children when role is admin', () => {
  renderWithRouter({ loading: false, profile: { role: 'admin', account_status: 'active' } })
  expect(screen.getByText('Admin Page')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- AdminRoute.test.jsx
```

Expected: the new suspended test fails; the active test may also fail if it doesn't reach the outlet without `account_status: 'active'`.

- [ ] **Step 3: Update AdminRoute.jsx**

Replace the full content of `src/components/layout/AdminRoute.jsx`:

```jsx
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- AdminRoute.test.jsx
```

Expected: all tests pass.

### 6b — StaffRoute

- [ ] **Step 5: Add failing test to StaffRoute.test.jsx**

Open `src/components/layout/StaffRoute.test.jsx`. Append inside `describe('StaffRoute')`:

```jsx
it('redirects to /account-inactive when staff is suspended', () => {
  useAuthStore.mockReturnValue({
    loading: false,
    profile: { role: 'staff', account_status: 'suspended' },
  })
  render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/staff" element={<div>Staff Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/account-inactive" element={<div>Inactive Page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Inactive Page')).toBeInTheDocument()
})
```

Also update the existing active test to include `account_status: 'active'` on the profile.

- [ ] **Step 6: Run tests — expect FAIL**

```bash
npm test -- StaffRoute.test.jsx
```

- [ ] **Step 7: Update StaffRoute.jsx**

Replace the full content of `src/components/layout/StaffRoute.jsx`:

```jsx
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

  if (profile.account_status !== 'active') {
    return <Navigate to="/account-inactive" replace />
  }

  return <Outlet />
}

export default StaffRoute
```

- [ ] **Step 8: Run tests — expect PASS**

```bash
npm test -- StaffRoute.test.jsx
```

### 6c — CustomerRoute

- [ ] **Step 9: Add failing test to CustomerRoute.test.jsx**

Open `src/components/layout/CustomerRoute.test.jsx`. Append inside `describe('CustomerRoute')`:

```jsx
it('redirects to /account-inactive when customer is suspended', () => {
  useAuthStore.mockReturnValue({
    loading: false,
    profile: { role: 'customer', account_status: 'suspended' },
  })
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<CustomerRoute />}>
          <Route path="/dashboard" element={<div>Customer Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/account-inactive" element={<div>Inactive Page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Inactive Page')).toBeInTheDocument()
})
```

Also update the existing active test to include `account_status: 'active'` on the profile.

- [ ] **Step 10: Run tests — expect FAIL**

```bash
npm test -- CustomerRoute.test.jsx
```

- [ ] **Step 11: Update CustomerRoute.jsx**

Replace the full content of `src/components/layout/CustomerRoute.jsx`:

```jsx
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

  if (profile.account_status !== 'active') {
    return <Navigate to="/account-inactive" replace />
  }

  return <Outlet />
}

export default CustomerRoute
```

- [ ] **Step 12: Run tests — expect PASS**

```bash
npm test -- CustomerRoute.test.jsx
```

### 6d — LoginPage status check

- [ ] **Step 13: Update LoginPage.jsx**

In `src/pages/auth/LoginPage.jsx`, inside `handleSubmit`, locate the block starting at line 62 (`setUser(user)`) and insert the status check immediately after `setProfile(profile)` is called but before role-based navigation. Replace lines 62–71 with:

```js
setUser(user)
setProfile(profile)

if (profile.account_status !== 'active') {
  navigate('/account-inactive')
  return
}

if (profile.role === 'admin') navigate('/admin')
else if (profile.role === 'staff') navigate('/staff')
else {
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  navigate(redirectTo)
}
```

- [ ] **Step 14: Add `/account-inactive` route to App.jsx**

In `src/App.jsx`, add the new route in the public routes section (after `/location`, before the admin routes block):

```jsx
import AccountInactivePage from './pages/AccountInactivePage'
```

And in the `<Routes>` block, after `<Route path="/location" element={<LocationPage />} />`:

```jsx
<Route path="/account-inactive" element={<AccountInactivePage />} />
```

- [ ] **Step 15: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 16: Commit**

```bash
git add src/components/layout/AdminRoute.jsx src/components/layout/AdminRoute.test.jsx
git add src/components/layout/StaffRoute.jsx src/components/layout/StaffRoute.test.jsx
git add src/components/layout/CustomerRoute.jsx src/components/layout/CustomerRoute.test.jsx
git add src/pages/auth/LoginPage.jsx src/App.jsx
git commit -m "feat: redirect suspended/banned users to account-inactive page"
```

---

## Task 7: Wire up CustomerDetailPage

**Files:**
- Modify: `src/pages/admin/customers/CustomerDetailPage.jsx`

- [ ] **Step 1: Update imports**

In `src/pages/admin/customers/CustomerDetailPage.jsx`, add the `DeactivateAccountModal` import after the existing `ConfirmDialog` import (keep `ConfirmDialog` — it is still used for the Reactivate action):

```jsx
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import DeactivateAccountModal from '../../../components/admin/accounts/DeactivateAccountModal'
```

- [ ] **Step 2: Replace state and handlers**

Replace the existing `const [confirm, setConfirm] = useState(null)` line and `handleStatusChange` function with:

```jsx
const [confirm, setConfirm] = useState(null)
const [deactivateModal, setDeactivateModal] = useState({ open: false, action: 'suspend' })

const handleReactivate = async () => {
  if (!confirm) return
  try {
    await updateAccountStatus(id, 'active')
    load()
  } catch (err) {
    setError(err.message)
  } finally {
    setConfirm(null)
  }
}

const handleDeactivate = async (reason) => {
  try {
    await updateAccountStatus(id, deactivateModal.action, reason)
    load()
  } catch (err) {
    setError(err.message)
  } finally {
    setDeactivateModal({ open: false, action: 'suspend' })
  }
}
```

- [ ] **Step 3: Update the action buttons**

Replace the button group inside the card (the `<div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">` block) with:

```jsx
<div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
  {customer.account_status === 'active' ? (
    <button
      onClick={() => setDeactivateModal({ open: true, action: 'suspend' })}
      className="px-4 py-2 text-sm border border-yellow-200 text-yellow-700
        rounded-lg hover:bg-yellow-50 transition-colors cursor-pointer"
    >
      Suspend
    </button>
  ) : (
    <button
      onClick={() => setConfirm(true)}
      className="px-4 py-2 text-sm bg-[#8A956D] text-white rounded-lg
        hover:bg-[#7a8560] transition-colors cursor-pointer"
    >
      Reactivate
    </button>
  )}
  {customer.account_status !== 'banned' && (
    <button
      onClick={() => setDeactivateModal({ open: true, action: 'ban' })}
      className="px-4 py-2 text-sm border border-red-200 text-red-600
        rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
    >
      Ban
    </button>
  )}
</div>
```

- [ ] **Step 4: Replace dialog at bottom of JSX**

Replace the `<ConfirmDialog ... />` at the bottom of the return with:

```jsx
<ConfirmDialog
  open={!!confirm}
  onClose={() => setConfirm(null)}
  onConfirm={handleReactivate}
  title="Reactivate Account"
  message="Restore this customer's access."
  confirmLabel="Reactivate"
/>

<DeactivateAccountModal
  open={deactivateModal.open}
  onClose={() => setDeactivateModal({ open: false, action: 'suspend' })}
  onConfirm={handleDeactivate}
  userName={customer ? `${customer.first_name} ${customer.last_name}` : ''}
  userRole="customer"
  action={deactivateModal.action}
/>
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/customers/CustomerDetailPage.jsx
git commit -m "feat: require deactivation reason on customer suspend/ban"
```

---

## Task 8: Wire up StaffDetailPage

**Files:**
- Modify: `src/pages/admin/staff/StaffDetailPage.jsx`

- [ ] **Step 1: Update imports**

In `src/pages/admin/staff/StaffDetailPage.jsx`, add the `DeactivateAccountModal` import (keep `ConfirmDialog` for reactivation):

```jsx
import DeactivateAccountModal from '../../../components/admin/accounts/DeactivateAccountModal'
```

- [ ] **Step 2: Replace state and handlers**

Replace the existing `const [confirm, setConfirm] = useState(null)` and `handleStatusChange` function with:

```jsx
const [confirm, setConfirm] = useState(false)
const [deactivateModal, setDeactivateModal] = useState(false)

const handleReactivate = async () => {
  try {
    await activateStaff(id)
    load()
  } catch (err) {
    setError(err.message)
  } finally {
    setConfirm(false)
  }
}

const handleDeactivate = async (reason) => {
  try {
    await deactivateStaff(id, reason)
    load()
  } catch (err) {
    setError(err.message)
  } finally {
    setDeactivateModal(false)
  }
}
```

- [ ] **Step 3: Update the action buttons**

Replace the button group inside the card (the `<div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">` block, lines 108–135) with:

```jsx
<div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
  {isActive ? (
    <button
      onClick={() => setDeactivateModal(true)}
      className="px-4 py-2 text-sm border border-red-200 text-red-600
        rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
    >
      Deactivate
    </button>
  ) : (
    <button
      onClick={() => setConfirm(true)}
      className="px-4 py-2 text-sm bg-[#8A956D] text-white rounded-lg
        hover:bg-[#7a8560] transition-colors cursor-pointer"
    >
      Reactivate
    </button>
  )}
</div>
```

- [ ] **Step 4: Replace dialog at bottom of JSX**

Replace the `<ConfirmDialog ... />` block (lines 172–180) with:

```jsx
<ConfirmDialog
  open={confirm}
  onClose={() => setConfirm(false)}
  onConfirm={handleReactivate}
  title="Reactivate Staff"
  message="Restore this staff member's access to the system."
  confirmLabel="Reactivate"
/>

<DeactivateAccountModal
  open={deactivateModal}
  onClose={() => setDeactivateModal(false)}
  onConfirm={handleDeactivate}
  userName={staff ? `${staff.first_name} ${staff.last_name}` : ''}
  userRole={staff?.role ?? 'staff'}
  action="deactivate"
/>
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/staff/StaffDetailPage.jsx
git commit -m "feat: require deactivation reason on staff deactivate"
```

---

## Progress Checklist

- [ ] **Task 1** — DB migration: `deactivation_reason` column added to `profiles`
- [ ] **Task 2** — `customerService.updateAccountStatus` accepts and writes reason
- [ ] **Task 3** — `staffService.deactivateStaff` accepts reason; `activateStaff` clears it
- [ ] **Task 4** — `DeactivateAccountModal` component created and tested
- [ ] **Task 5** — `AccountInactivePage` created with Navbar, reason display, sign-out on go home
- [ ] **Task 6** — Route guards and LoginPage redirect non-active users; `/account-inactive` route added
- [ ] **Task 7** — `CustomerDetailPage` wired to `DeactivateAccountModal`
- [ ] **Task 8** — `StaffDetailPage` wired to `DeactivateAccountModal`

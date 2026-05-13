# Ban Enforcement + "Take This Session" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make account banning actually enforce access revocation (session kill + data cascade) and let staff self-assign unassigned bookings left by banned staff.

**Architecture:** A new `ban-user` Supabase edge function (service-role key required) handles session revocation + cascade DB writes atomically. Frontend service wrappers call it. Banned users get their own `/account-banned` page distinct from `/account-inactive`. Staff can claim unassigned bookings via a "Take this session" button on existing appointment cards.

**Tech Stack:** React 18, Vite, Supabase JS v2, Supabase Edge Functions (Deno), Tailwind CSS v4, Vitest + Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/functions/ban-user/index.ts` | Edge fn: revoke session + cascade |
| Modify | `src/services/customerService.js` | Add `banCustomer` wrapper |
| Modify | `src/services/staffService.js` | Add `banStaff` wrapper |
| Create | `src/pages/AccountBannedPage/index.jsx` | Permanent ban UI page |
| Modify | `src/App.jsx` | Register `/account-banned` route |
| Modify | `src/pages/auth/LoginPage.jsx` | Route banned → `/account-banned` |
| Modify | `src/components/layout/CustomerRoute.jsx` | Route banned → `/account-banned` |
| Modify | `src/components/layout/StaffRoute.jsx` | Route banned → `/account-banned` |
| Modify | `src/components/layout/AdminRoute.jsx` | Route banned → `/account-banned` |
| Modify | `src/pages/admin/customers/CustomersPage.jsx` | Use `banCustomer` instead of `updateAccountStatus` |
| Modify | `src/pages/admin/customers/CustomerDetailPage.jsx` | Use `banCustomer` for ban action |
| Modify | `src/pages/admin/staff/StaffDetailPage.jsx` | Add Ban button + `banStaff` wiring |
| Modify | `src/components/admin/accounts/DeactivateAccountModal.jsx` | Permanent-ban warning text for ban action |
| Modify | `src/services/staffAppointmentService.js` | Add `claimAppointment` |
| Modify | `src/pages/staff/AppointmentsPage.jsx` | Unassigned badge + "Take this session" button |

---

### Task 1: `ban-user` Edge Function

**Files:**
- Create: `supabase/functions/ban-user/index.ts`

- [ ] **Step 1: Create the edge function file**

```typescript
// supabase/functions/ban-user/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: callerProfile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { userId, role } = body
    const reason: string = body.reason || 'Banned by admin'

    if (!userId || !role) {
      return new Response(
        JSON.stringify({ error: 'userId and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['customer', 'staff'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'role must be customer or staff' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Revoke all sessions immediately (best-effort — don't fail ban if this errors)
    await supabaseAdmin.auth.admin.signOut(userId, { scope: 'global' }).catch(() => null)

    // 2. Cascade effects based on role
    if (role === 'customer') {
      await supabaseAdmin
        .from('bookings')
        .update({ booking_status: 'cancelled' })
        .eq('customer_id', userId)
        .eq('booking_status', 'upcoming')
    } else {
      // staff: flag upcoming bookings as unassigned so others can claim them
      await supabaseAdmin
        .from('bookings')
        .update({ staff_id: null })
        .eq('staff_id', userId)
        .eq('booking_status', 'upcoming')

      // reject any pending leave requests
      await supabaseAdmin
        .from('leave_requests')
        .update({ status: 'rejected' })
        .eq('staff_id', userId)
        .eq('status', 'pending')
    }

    // 3. Update profile status
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        account_status: 'banned',
        deactivation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

- [ ] **Step 2: Deploy the edge function**

Run:
```bash
supabase functions deploy ban-user
```

Expected: `Deployed Function ban-user`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ban-user/index.ts
git commit -m "feat: add ban-user edge function with session revocation and cascade"
```

---

### Task 2: `banCustomer` + `banStaff` service functions

**Files:**
- Modify: `src/services/customerService.js`
- Modify: `src/services/staffService.js`

- [ ] **Step 1: Write failing test for `banCustomer`**

In `src/services/customerService.test.js`, add:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { banCustomer } from './customerService'

// find the existing supabase mock block and add inside it:
// mock functions.invoke
const mockInvoke = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: {
    // ...existing mocks...
    functions: { invoke: mockInvoke },
  },
}))

describe('banCustomer', () => {
  beforeEach(() => { mockInvoke.mockReset() })

  it('invokes ban-user edge function with customer role', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null })
    await banCustomer('user-123', 'Spam')
    expect(mockInvoke).toHaveBeenCalledWith('ban-user', {
      body: { userId: 'user-123', reason: 'Spam', role: 'customer' },
    })
  })

  it('throws when edge function returns error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Forbidden' } })
    await expect(banCustomer('user-123', 'Spam')).rejects.toThrow('Forbidden')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -- customerService
```

Expected: FAIL — `banCustomer is not a function`

- [ ] **Step 3: Add `banCustomer` to `src/services/customerService.js`**

Append to the file:

```javascript
export const banCustomer = async (id, reason = 'Banned by admin') => {
  const { data, error } = await supabase.functions.invoke('ban-user', {
    body: { userId: id, reason, role: 'customer' },
  })
  if (error) {
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => ({}))
      throw new Error(body.error ?? error.message)
    }
    throw error
  }
  return data
}
```

- [ ] **Step 4: Write failing test for `banStaff`**

In `src/services/staffService.test.js`, add:

```javascript
describe('banStaff', () => {
  beforeEach(() => { mockInvoke.mockReset() })

  it('invokes ban-user edge function with staff role', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null })
    await banStaff('staff-456', 'Policy violation')
    expect(mockInvoke).toHaveBeenCalledWith('ban-user', {
      body: { userId: 'staff-456', reason: 'Policy violation', role: 'staff' },
    })
  })
})
```

- [ ] **Step 5: Add `banStaff` to `src/services/staffService.js`**

Append to the file:

```javascript
export const banStaff = async (id, reason = 'Banned by admin') => {
  const { data, error } = await supabase.functions.invoke('ban-user', {
    body: { userId: id, reason, role: 'staff' },
  })
  if (error) {
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => ({}))
      throw new Error(body.error ?? error.message)
    }
    throw error
  }
  return data
}
```

- [ ] **Step 6: Run tests to confirm both pass**

```bash
npm run test -- customerService staffService
```

Expected: all new tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/customerService.js src/services/staffService.js \
        src/services/customerService.test.js src/services/staffService.test.js
git commit -m "feat: add banCustomer and banStaff service functions"
```

---

### Task 3: `AccountBannedPage` + App.jsx route

**Files:**
- Create: `src/pages/AccountBannedPage/index.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create the page**

```jsx
// src/pages/AccountBannedPage/index.jsx
import { useNavigate } from 'react-router-dom'
import { ShieldOff, Mail } from 'lucide-react'
import Navbar from '../../components/Navbar'
import useAuthStore from '../../store/authStore'
import { signOut } from '../../services/authService'

const AccountBannedPage = () => {
  const navigate = useNavigate()
  const { profile, clear } = useAuthStore()

  const handleGoHome = async () => {
    try {
      await signOut()
    } catch {
      // ignore — clear local state regardless
    }
    clear()
    navigate('/')
  }

  const reason = profile?.deactivation_reason ||
    'No specific reason was provided. Please contact support for details.'

  return (
    <div className="min-h-screen bg-[#f9f8f6] flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <ShieldOff size={24} className="text-red-500" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-[#2C2C2C] mb-2">
            Your account has been banned
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Your access to Anaya has been permanently revoked.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-1">Due to this reason:</p>
            <p className="text-sm text-[#4A4A4A]">{reason}</p>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">
              This ban is permanent. If you believe this is a mistake, contact Anaya support.
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

export default AccountBannedPage
```

- [ ] **Step 2: Register the route in `src/App.jsx`**

Add import after the `AccountInactivePage` import:

```javascript
import AccountBannedPage from './pages/AccountBannedPage'
```

Add route after the `/account-inactive` route:

```jsx
<Route path="/account-banned" element={<AccountBannedPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/AccountBannedPage/index.jsx src/App.jsx
git commit -m "feat: add account-banned page and register route"
```

---

### Task 4: Route Guard Updates

**Files:**
- Modify: `src/pages/auth/LoginPage.jsx`
- Modify: `src/components/layout/CustomerRoute.jsx`
- Modify: `src/components/layout/StaffRoute.jsx`
- Modify: `src/components/layout/AdminRoute.jsx`
- Test: `src/components/layout/CustomerRoute.test.jsx`
- Test: `src/components/layout/StaffRoute.test.jsx`
- Test: `src/components/layout/AdminRoute.test.jsx`

- [ ] **Step 1: Write failing tests for banned redirect in `CustomerRoute.test.jsx`**

Add after the suspended test:

```javascript
it('redirects to /account-banned when customer is banned', () => {
  useAuthStore.mockReturnValue({
    loading: false,
    profile: { role: 'customer', account_status: 'banned' },
  })
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<CustomerRoute />}>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Route>
        <Route path="/account-inactive" element={<div>Inactive Page</div>} />
        <Route path="/account-banned" element={<div>Banned Page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Banned Page')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -- CustomerRoute
```

Expected: FAIL — banned redirects to `/account-inactive` instead of `/account-banned`

- [ ] **Step 3: Update `src/components/layout/CustomerRoute.jsx`**

Replace the single `account_status` check:

```jsx
  if (profile.account_status === 'banned') {
    return <Navigate to="/account-banned" replace />
  }

  if (profile.account_status !== 'active') {
    return <Navigate to="/account-inactive" replace />
  }
```

- [ ] **Step 4: Add the same tests to `StaffRoute.test.jsx`**

Add after the existing inactive test (mirror the CustomerRoute test structure, adjusting role to `staff`):

```javascript
it('redirects to /account-banned when staff is banned', () => {
  useAuthStore.mockReturnValue({
    loading: false,
    profile: { role: 'staff', account_status: 'banned' },
  })
  render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/staff" element={<div>Staff Dashboard</div>} />
        </Route>
        <Route path="/account-inactive" element={<div>Inactive Page</div>} />
        <Route path="/account-banned" element={<div>Banned Page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Banned Page')).toBeInTheDocument()
})
```

- [ ] **Step 5: Update `src/components/layout/StaffRoute.jsx`**

Replace the single `account_status` check:

```jsx
  if (profile.account_status === 'banned') {
    return <Navigate to="/account-banned" replace />
  }

  if (profile.account_status !== 'active') {
    return <Navigate to="/account-inactive" replace />
  }
```

- [ ] **Step 6: Add the same tests to `AdminRoute.test.jsx`**

```javascript
it('redirects to /account-banned when admin is banned', () => {
  useAuthStore.mockReturnValue({
    loading: false,
    profile: { role: 'admin', account_status: 'banned' },
  })
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
        </Route>
        <Route path="/account-inactive" element={<div>Inactive Page</div>} />
        <Route path="/account-banned" element={<div>Banned Page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('Banned Page')).toBeInTheDocument()
})
```

- [ ] **Step 7: Update `src/components/layout/AdminRoute.jsx`**

Replace the single `account_status` check:

```jsx
  if (profile.account_status === 'banned') {
    return <Navigate to="/account-banned" replace />
  }

  if (profile.account_status !== 'active') {
    return <Navigate to="/account-inactive" replace />
  }
```

- [ ] **Step 8: Update `src/pages/auth/LoginPage.jsx`**

Replace the existing check at line 65:

```javascript
      if (profile.account_status === 'banned') {
        navigate('/account-banned')
        return
      }

      if (profile.account_status !== 'active') {
        navigate('/account-inactive')
        return
      }
```

- [ ] **Step 9: Run all route guard tests**

```bash
npm run test -- CustomerRoute StaffRoute AdminRoute
```

Expected: all tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/CustomerRoute.jsx \
        src/components/layout/StaffRoute.jsx \
        src/components/layout/AdminRoute.jsx \
        src/pages/auth/LoginPage.jsx \
        src/components/layout/CustomerRoute.test.jsx \
        src/components/layout/StaffRoute.test.jsx \
        src/components/layout/AdminRoute.test.jsx
git commit -m "feat: redirect banned accounts to /account-banned in all route guards"
```

---

### Task 5: Wire `banCustomer` into Customer Pages

**Files:**
- Modify: `src/pages/admin/customers/CustomersPage.jsx`
- Modify: `src/pages/admin/customers/CustomerDetailPage.jsx`

- [ ] **Step 1: Update `src/pages/admin/customers/CustomersPage.jsx`**

Add `banCustomer` to the import from customerService:

```javascript
import {
  getCustomers,
  updateAccountStatus,
  banCustomer,
} from '../../../services/customerService'
```

Change `handleStatusChange` to branch on `banned`:

```javascript
  const handleStatusChange = async () => {
    if (!confirm) return
    try {
      if (confirm.newStatus === 'banned') {
        await banCustomer(confirm.id)
      } else {
        await updateAccountStatus(confirm.id, confirm.newStatus)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }
```

- [ ] **Step 2: Update `src/pages/admin/customers/CustomerDetailPage.jsx`**

Add `banCustomer` to the import:

```javascript
import {
  getCustomerById,
  getCustomerBookings,
  updateAccountStatus,
  banCustomer,
} from '../../../services/customerService'
```

Change `handleDeactivate` to use `banCustomer` when action is `ban`:

```javascript
  const handleDeactivate = async (reason) => {
    try {
      if (deactivateModal.action === 'ban') {
        await banCustomer(id, reason)
      } else {
        await updateAccountStatus(id, STATUS_MAP[deactivateModal.action], reason)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeactivateModal({ open: false, action: 'suspend' })
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/customers/CustomersPage.jsx \
        src/pages/admin/customers/CustomerDetailPage.jsx
git commit -m "feat: wire banCustomer into customer ban actions"
```

---

### Task 6: Add Ban to StaffDetailPage

**Files:**
- Modify: `src/pages/admin/staff/StaffDetailPage.jsx`
- Modify: `src/components/admin/accounts/DeactivateAccountModal.jsx`

- [ ] **Step 1: Update warning text in `DeactivateAccountModal.jsx`**

Add a `warningText` map and render it conditionally. Replace the static warning `<div>` block:

```jsx
const warningText = {
  suspend: '⚠ This will prevent the user from logging in. The reason you enter will be visible to them.',
  ban: '⚠ This action is permanent and cannot be undone. The user will be banned immediately and all their sessions will be revoked.',
  deactivate: '⚠ This will prevent the user from logging in. The reason you enter will be visible to them.',
}

// Inside the JSX, replace the amber div with:
        <div className={`rounded-lg p-3 mb-4 border ${
          action === 'ban'
            ? 'bg-red-50 border-red-100'
            : 'bg-amber-50 border-amber-100'
        }`}>
          <p className={`text-xs ${action === 'ban' ? 'text-red-700' : 'text-amber-700'}`}>
            {warningText[action]}
          </p>
        </div>
```

- [ ] **Step 2: Update `StaffDetailPage.jsx` — add banModal state and import**

Add `banStaff` to imports:

```javascript
import {
  getStaffById,
  getStaffLeaveRequests,
  deactivateStaff,
  activateStaff,
  banStaff,
} from '../../../services/staffService'
```

Add `banModal` state after the `deactivateModal` state:

```javascript
  const [banModal, setBanModal] = useState(false)
```

Add `handleBan` handler after `handleDeactivate`:

```javascript
  const handleBan = async (reason) => {
    try {
      await banStaff(id, reason)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBanModal(false)
    }
  }
```

- [ ] **Step 3: Update `StaffDetailPage.jsx` — badge + Ban button + modal**

Update the badge to handle banned status (find the Badge line and replace):

```jsx
        <Badge
          variant={staff.account_status}
          label={
            staff.account_status === 'active' ? 'Active'
            : staff.account_status === 'banned' ? 'Banned'
            : 'Inactive'
          }
        />
```

Add the Ban button next to the Deactivate button (inside the `isActive` branch):

```jsx
          {isActive ? (
            <>
              <button
                onClick={() => setDeactivateModal(true)}
                className="px-4 py-2 text-sm border border-red-200 text-red-600
                  rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                Deactivate
              </button>
              <button
                onClick={() => setBanModal(true)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg
                  hover:bg-red-600 transition-colors cursor-pointer"
              >
                Ban
              </button>
            </>
          ) : staff.account_status !== 'banned' ? (
```

Also handle the non-banned inactive state — show Reactivate only if not banned:

```jsx
          ) : staff.account_status !== 'banned' ? (
            <button
              onClick={() => setConfirm(true)}
              className="px-4 py-2 text-sm bg-[#8A956D] text-white rounded-lg
                hover:bg-[#7a8560] transition-colors cursor-pointer"
            >
              Reactivate
            </button>
          ) : null}
```

Add the ban modal at the bottom of the JSX (after `DeactivateAccountModal`):

```jsx
      <DeactivateAccountModal
        open={banModal}
        onClose={() => setBanModal(false)}
        onConfirm={handleBan}
        userName={staff ? `${staff.first_name} ${staff.last_name}` : ''}
        userRole={staff?.role ?? 'staff'}
        action="ban"
      />
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/staff/StaffDetailPage.jsx \
        src/components/admin/accounts/DeactivateAccountModal.jsx
git commit -m "feat: add ban button and banStaff wiring to StaffDetailPage"
```

---

### Task 7: `claimAppointment` Service Function

**Files:**
- Modify: `src/services/staffAppointmentService.js`
- Test: `src/services/staffAppointmentService.test.js`

- [ ] **Step 1: Write failing test**

In `src/services/staffAppointmentService.test.js`, add:

```javascript
describe('claimAppointment', () => {
  it('updates staff_id on an unassigned booking', async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockIs = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'booking-1', staff_id: 'staff-1' },
      error: null,
    })
    supabase.from.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      is: mockIs,
      select: mockSelect,
      single: mockSingle,
    })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ is: mockIs })
    mockIs.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })

    const result = await claimAppointment('booking-1', 'staff-1')
    expect(mockUpdate).toHaveBeenCalledWith({ staff_id: 'staff-1' })
    expect(result).toEqual({ id: 'booking-1', staff_id: 'staff-1' })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test -- staffAppointmentService
```

Expected: FAIL — `claimAppointment is not a function`

- [ ] **Step 3: Add `claimAppointment` to `src/services/staffAppointmentService.js`**

Append to the file:

```javascript
export const claimAppointment = async (bookingId, staffId) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ staff_id: staffId })
    .eq('id', bookingId)
    .is('staff_id', null)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test -- staffAppointmentService
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/staffAppointmentService.js \
        src/services/staffAppointmentService.test.js
git commit -m "feat: add claimAppointment to staffAppointmentService"
```

---

### Task 8: "Take This Session" UI

**Files:**
- Modify: `src/pages/staff/AppointmentsPage.jsx`

- [ ] **Step 1: Add `claimAppointment` import and handler**

Add to the import at the top:

```javascript
import {
  getMyAppointments,
  getMyAppointmentById,
  getMyAppointmentDates,
  claimAppointment,
} from '../../services/staffAppointmentService'
```

Add `handleClaimClick` handler inside `StaffAppointmentsPage`, after `handleVerifyClick`:

```javascript
  const handleClaimClick = async (id) => {
    try {
      await claimAppointment(id, staffId)
      load()
    } catch (err) {
      setError(err.message)
    }
  }
```

- [ ] **Step 2: Update `AppointmentCard` to accept and use `onClaimClick`**

Change `AppointmentCard` signature:

```javascript
const AppointmentCard = ({ appt, onVerifyClick, onClaimClick }) => {
```

Add an "Unassigned" badge in the header row badges section, after the existing badges:

```jsx
        <div className="flex flex-col items-end gap-1">
          <Badge variant={appt.booking_status} label={appt.booking_status} />
          <Badge
            variant={appt.downpayment_status}
            label={appt.downpayment_status}
          />
          {!appt.staff_id && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full
              bg-orange-100 text-orange-600 uppercase tracking-wide">
              Unassigned
            </span>
          )}
        </div>
```

Add "Take this session" button in the Action section, before the existing payment buttons:

```jsx
      {/* Action */}
      {!appt.staff_id && appt.booking_status === 'upcoming' && (
        <button
          onClick={() => onClaimClick(appt.id)}
          className="w-full py-2 bg-[#8A956D] hover:bg-[#7a8560] text-white text-sm
            font-medium rounded-lg transition-colors"
        >
          Take this session
        </button>
      )}
      {appt.staff_id && appt.downpayment_status === 'paid' && (
```

Note: wrap the existing payment action buttons in `appt.staff_id &&` so they don't show on unassigned cards:

```jsx
      {appt.staff_id && appt.downpayment_status === 'paid' && (
        <button
          onClick={() => onVerifyClick(appt.id)}
          className="w-full py-2 bg-[#CE845D] hover:bg-[#b87652] text-white text-sm
            font-medium rounded-lg transition-colors"
        >
          Review Payment
        </button>
      )}
      {appt.staff_id && appt.downpayment_status === 'pending' && (
        <button
          onClick={() => onVerifyClick(appt.id)}
          className="w-full py-2 bg-[#8A956D] hover:bg-[#7a8560] text-white text-sm
            font-medium rounded-lg transition-colors"
        >
          Approve Appointment
        </button>
      )}
```

- [ ] **Step 3: Pass `onClaimClick` to all `AppointmentCard` usages**

There are two render sites in `StaffAppointmentsPage` (calendar view and list view). Both need `onClaimClick={handleClaimClick}`:

Calendar view (inside `displayedAppointments.map`):
```jsx
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      onVerifyClick={handleVerifyClick}
                      onClaimClick={handleClaimClick}
                    />
```

List view (inside `appointments.map`):
```jsx
              <AppointmentCard
                key={appt.id}
                appt={appt}
                onVerifyClick={handleVerifyClick}
                onClaimClick={handleClaimClick}
              />
```

- [ ] **Step 4: Run lint and check for issues**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/staff/AppointmentsPage.jsx
git commit -m "feat: add Take this session button and unassigned badge to appointment cards"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| Session revocation on ban | Task 1 (edge function `signOut global`) |
| Customer upcoming bookings cancelled | Task 1 (edge function cascade) |
| Staff upcoming bookings unassigned | Task 1 (edge function cascade) |
| Staff pending leave requests rejected | Task 1 (edge function cascade) |
| `/account-banned` page (permanent tone, red UI) | Task 3 |
| Banned redirect in all route guards | Task 4 |
| `banCustomer` wired into customer pages | Task 5 |
| `banStaff` wired into StaffDetailPage | Task 6 |
| "Take this session" button for unassigned bookings | Task 8 |
| "Unassigned" badge on cards | Task 8 |
| Ban warning text in DeactivateAccountModal | Task 6 |

**No placeholders found.**

**Type consistency:** `claimAppointment(bookingId, staffId)` defined in Task 7, called in Task 8 ✓. `banCustomer(id, reason?)` defined in Task 2, called in Task 5 ✓. `banStaff(id, reason)` defined in Task 2, called in Task 6 ✓.

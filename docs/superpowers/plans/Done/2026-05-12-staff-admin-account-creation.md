# Staff & Admin Account Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Create Account" button to the Team page that lets admins invite staff or admin accounts via an email invite link, using a Supabase Edge Function to securely call the Auth Admin API.

**Architecture:** A new `invite-user` Supabase Edge Function holds the service role key and calls `supabase.auth.admin.inviteUserByEmail()`. The frontend calls it via `supabase.functions.invoke()`. The existing `handle_new_user` DB trigger creates the `profiles` row automatically from the invite metadata; a new DB trigger on `profiles` creates the `staff_details` row transactionally for staff accounts. The Team page (currently "Staff" page) is updated to show both staff and admin profiles, with filter pills and a role column.

**Tech Stack:** React, Zustand, Supabase JS client v2, Supabase Edge Functions (Deno/TypeScript), Tailwind CSS v4, clsx, Vitest + React Testing Library

---

## File Map

**Create:**
- `supabase/migrations/<timestamp>_add_staff_details_trigger.sql` — DB trigger: creates `staff_details` row transactionally when a staff profile is inserted
- `supabase/functions/invite-user/index.ts` — Edge Function: verifies caller is admin via RLS-scoped query, creates auth user via Admin API
- `src/components/admin/staff/CreateAccountModal.jsx` — Modal with role slide toggle (Staff/Admin) and invite form
- `src/components/admin/staff/CreateAccountModal.test.jsx` — Component unit tests

**Modify:**
- `src/services/staffService.js` — Update `getStaff()` to include admins; add `inviteUser()`
- `src/services/staffService.test.js` — Update mock; update `getStaff` test; add `inviteUser` tests
- `src/pages/admin/staff/StaffPage.jsx` — Add Create Account button, filter pills (All/Staff/Admin), Role column, "Team" title, mount modal
- `src/components/layout/AdminSidebar.jsx` — Rename "Staff" nav label to "Team"

---

### Task 1: Update `getStaff()` to include admin accounts

**Files:**
- Modify: `src/services/staffService.js`
- Modify: `src/services/staffService.test.js`

- [ ] **Step 1: Update the supabase mock and the `getStaff` test**

In `src/services/staffService.test.js`, make these two changes:

Replace the `vi.mock` block at the top:

```js
vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))
```

Update the import line (add `inviteUser` now to avoid re-editing the import in Task 2):

```js
import { getStaff, deactivateStaff, getStaffList, inviteUser } from './staffService'
```

Replace the entire `describe('getStaff', ...)` block:

```js
describe('getStaff', () => {
  it('queries profiles with role in [staff, admin]', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getStaff()
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.in).toHaveBeenCalledWith('role', ['staff', 'admin'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```
npm test -- staffService
```

Expected output: FAIL — `getStaff` test fails because the current implementation uses `.eq('role', 'staff')`

- [ ] **Step 3: Update `getStaff()` in `staffService.js`**

In `src/services/staffService.js`, replace the `getStaff` function:

```js
export const getStaff = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, reference_id, first_name, last_name, email, phone_number, avatar_url, created_at, role,
      staff_details(is_active)
    `)
    .in('role', ['staff', 'admin'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
```

Note: `role` is added to the select fields so the Team table can render the role badge.

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- staffService
```

Expected: All tests PASS (including the `deactivateStaff` and `getStaffList` tests that were already there)

- [ ] **Step 5: Commit**

```
git add src/services/staffService.js src/services/staffService.test.js
git commit -m "feat: update getStaff to include admin accounts in Team list"
```

---

### Task 2: Add `inviteUser()` to `staffService.js`

**Files:**
- Modify: `src/services/staffService.js`
- Modify: `src/services/staffService.test.js`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block at the bottom of `src/services/staffService.test.js`:

```js
describe('inviteUser', () => {
  it('invokes the invite-user edge function with mapped payload', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { success: true }, error: null })
    const result = await inviteUser({
      firstName: 'Maria',
      lastName: 'Cruz',
      email: 'maria@example.com',
      phone: '09171234567',
      role: 'staff',
    })
    expect(supabase.functions.invoke).toHaveBeenCalledWith('invite-user', {
      body: {
        first_name: 'Maria',
        last_name: 'Cruz',
        email: 'maria@example.com',
        phone_number: '09171234567',
        role: 'staff',
      },
    })
    expect(result).toEqual({ success: true })
  })

  it('extracts the error message from a FunctionsHttpError context response', async () => {
    const mockResponse = new Response(
      JSON.stringify({ error: 'An account with this email already exists' }),
      { status: 400 }
    )
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: Object.assign(
        new Error('Edge Function returned a non-2xx status code'),
        { context: mockResponse }
      ),
    })
    await expect(
      inviteUser({ firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '', role: 'staff' })
    ).rejects.toThrow('An account with this email already exists')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- staffService
```

Expected: FAIL — `inviteUser is not a function`

- [ ] **Step 3: Add `inviteUser()` to `staffService.js`**

Add at the bottom of `src/services/staffService.js`:

```js
export const inviteUser = async ({ firstName, lastName, email, phone, role }) => {
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phone ?? '',
      role,
    },
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

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- staffService
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add src/services/staffService.js src/services/staffService.test.js
git commit -m "feat: add inviteUser service function for staff/admin account creation"
```

---

### Task 3: Create the `invite-user` Edge Function

**Files:**
- Create: `supabase/functions/invite-user/index.ts`

This runs on Supabase's Deno runtime. There is no local unit test for this task — it is verified end-to-end in Task 5 via the admin UI. Deploy it after writing it.

- [ ] **Step 0: Apply the staff_details DB trigger migration**

Create `supabase/migrations/<timestamp>_add_staff_details_trigger.sql` (replace `<timestamp>` with the current UTC timestamp in `YYYYMMDDHHmmss` format, e.g. `20260512000000`):

```sql
CREATE OR REPLACE FUNCTION handle_staff_details()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'staff' THEN
    INSERT INTO staff_details (id, is_active) VALUES (NEW.id, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_staff_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_staff_details();
```

Apply to the remote project:

```
supabase db push --project-ref <your-project-ref>
```

This trigger fires atomically with every `profiles` insert, so `staff_details` is always created in the same DB transaction — no race condition, no orphaned rows.

- [ ] **Step 1: Create the directory and write the function**

Create `supabase/functions/invite-user/index.ts`:

```ts
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

    // Verify the caller is a logged-in admin
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

    // Parse and validate body
    const body = await req.json()
    const { first_name, last_name, email, phone_number, role } = body

    if (!first_name || !last_name || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'first_name, last_name, email, and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['staff', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'role must be staff or admin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the auth user and send the invite email
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          first_name,
          last_name,
          phone_number: phone_number ?? '',
          date_of_birth: '',
          role,
        },
      }
    )

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

- [ ] **Step 2: Deploy the Edge Function**

Run in the terminal (requires Supabase CLI and a logged-in session):

```
supabase functions deploy invite-user --project-ref <your-project-ref>
```

Your project ref is in the Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are automatically injected by Supabase into all Edge Functions — no manual secret configuration needed.

- [ ] **Step 3: Commit**

```
git add supabase/functions/invite-user/index.ts
git commit -m "feat: add invite-user edge function for secure staff/admin account creation"
```

---

### Task 4: Create `CreateAccountModal` component

**Files:**
- Create: `src/components/admin/staff/CreateAccountModal.jsx`
- Create: `src/components/admin/staff/CreateAccountModal.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/admin/staff/CreateAccountModal.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import CreateAccountModal from './CreateAccountModal'

vi.mock('../../../services/staffService', () => ({
  inviteUser: vi.fn(),
}))

import { inviteUser } from '../../../services/staffService'

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('CreateAccountModal', () => {
  it('renders form fields with Staff selected by default', () => {
    render(<CreateAccountModal {...defaultProps} />)
    expect(screen.getByPlaceholderText('First name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Last name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Phone number (optional)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Staff' })).toHaveClass('bg-white')
  })

  it('switches to Admin when Admin toggle is clicked', () => {
    render(<CreateAccountModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }))
    expect(screen.getByRole('button', { name: 'Admin' })).toHaveClass('bg-white')
    expect(screen.getByRole('button', { name: 'Staff' })).not.toHaveClass('bg-white')
  })

  it('disables Send Invite when required fields are empty', () => {
    render(<CreateAccountModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Send Invite' })).toBeDisabled()
  })

  it('calls inviteUser with correct payload and triggers onSuccess then onClose', async () => {
    inviteUser.mockResolvedValue({ success: true })
    render(<CreateAccountModal {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Cruz' } })
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(inviteUser).toHaveBeenCalledWith({
        firstName: 'Maria',
        lastName: 'Cruz',
        email: 'maria@example.com',
        phone: '',
        role: 'staff',
      })
      expect(defaultProps.onSuccess).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('shows inline error when inviteUser fails', async () => {
    inviteUser.mockRejectedValue(new Error('An account with this email already exists'))
    render(<CreateAccountModal {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Reyes' } })
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('An account with this email already exists')).toBeInTheDocument()
    })
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- CreateAccountModal
```

Expected: FAIL — module `./CreateAccountModal` not found

- [ ] **Step 3: Create the component**

Create `src/components/admin/staff/CreateAccountModal.jsx`:

```jsx
import { useState } from 'react'
import clsx from 'clsx'
import Modal from '../../common/Modal'
import Spinner from '../../common/Spinner'
import { inviteUser } from '../../../services/staffService'

const CreateAccountModal = ({ open, onClose, onSuccess }) => {
  const [role, setRole] = useState('staff')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isValid = form.firstName.trim() && form.lastName.trim() && form.email.trim()

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await inviteUser({ ...form, role })
      onSuccess()
      onClose()
      setForm({ firstName: '', lastName: '', email: '', phone: '' })
      setRole('staff')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Account" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['staff', 'admin'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRoleChange(r)}
              className={clsx(
                'flex-1 py-1.5 text-sm font-medium rounded-md capitalize transition-all',
                role === r
                  ? 'bg-white text-[#2C2C2C] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {r === 'staff' ? 'Staff' : 'Admin'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            name="firstName"
            placeholder="First name"
            value={form.firstName}
            onChange={handleChange}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
          />
          <input
            name="lastName"
            placeholder="Last name"
            value={form.lastName}
            onChange={handleChange}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
          />
        </div>

        <input
          name="email"
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={handleChange}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
        />

        <input
          name="phone"
          type="tel"
          placeholder="Phone number (optional)"
          value={form.phone}
          onChange={handleChange}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#8A956D]
            hover:bg-[#7a8560] text-white rounded-lg text-sm font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Spinner />}
          Send Invite
        </button>
      </form>
    </Modal>
  )
}

export default CreateAccountModal
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- CreateAccountModal
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```
git add src/components/admin/staff/CreateAccountModal.jsx src/components/admin/staff/CreateAccountModal.test.jsx
git commit -m "feat: add CreateAccountModal with staff/admin role slide toggle"
```

---

### Task 5: Update `StaffPage` — filter pills, role column, Create Account button, Team title

**Files:**
- Modify: `src/pages/admin/staff/StaffPage.jsx`

The `Badge` component uses `variant` for color. There are no `staff` or `admin` variants defined, so use `variant="active"` (green) for Staff and `variant="paid"` (blue) for Admin. The Deactivate/Reactivate actions only apply to staff accounts, not admins.

- [ ] **Step 1: Replace the full contents of `StaffPage.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Eye, Trash2, UserCheck, UserPlus } from 'lucide-react'
import clsx from 'clsx'
import { getStaff, deactivateStaff, activateStaff } from '../../../services/staffService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import CreateAccountModal from '../../../components/admin/staff/CreateAccountModal'

const FILTERS = ['all', 'staff', 'admin']

const StaffPage = () => {
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    setLoading(true)
    getStaff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async () => {
    if (!confirm) return
    try {
      if (confirm.action === 'Reactivate') {
        await activateStaff(confirm.id)
      } else {
        await deactivateStaff(confirm.id)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  const filtered = staff.filter((s) => filter === 'all' || s.role === filter)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Team</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#8A956D] hover:bg-[#7a8560]
            text-white rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus size={15} />
          Create Account
        </button>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition-colors',
              filter === f
                ? 'bg-[#2C2C2C] text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No team members found" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {['Name', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
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
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.email}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {s.phone_number || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={s.role === 'admin' ? 'paid' : 'active'}
                      label={s.role === 'admin' ? 'Admin' : 'Staff'}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    {s.role === 'admin' || s.staff_details?.[0]?.is_active === true ? (
                      <Badge variant="active" label="Active" />
                    ) : (
                      <Badge variant="suspended" label="Inactive" />
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs text-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => navigate(`/admin/staff/${s.id}`)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#8A956D]
                          rounded-lg text-[#8A956D] hover:bg-[#8A956D] hover:text-white
                          transition-all text-xs font-medium group"
                      >
                        <Eye size={14} className="group-hover:text-white" />
                        View
                      </button>
                      {s.role === 'staff' && (
                        s.staff_details?.[0]?.is_active === true ? (
                          <button
                            onClick={() => setConfirm({
                              id: s.id,
                              action: 'Deactivate',
                              message: `Deactivate ${s.first_name} ${s.last_name}?`,
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-500
                              rounded-lg text-red-500 hover:bg-red-500 hover:text-white
                              transition-all text-xs font-medium group"
                          >
                            <Trash2 size={14} className="group-hover:text-white" />
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirm({
                              id: s.id,
                              action: 'Reactivate',
                              message: `Reactivate ${s.first_name} ${s.last_name}?`,
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-green-600
                              rounded-lg text-green-600 hover:bg-green-600 hover:text-white
                              transition-all text-xs font-medium group"
                          >
                            <UserCheck size={14} className="group-hover:text-white" />
                            Reactivate
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatusChange}
        title={`${confirm?.action} Staff`}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.action}
        danger={confirm?.action !== 'Reactivate'}
      />

      <CreateAccountModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={load}
      />
    </div>
  )
}

export default StaffPage
```

- [ ] **Step 2: Run the full test suite**

```
npm test
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```
git add src/pages/admin/staff/StaffPage.jsx
git commit -m "feat: update Team page with filter pills, role column, and Create Account button"
```

---

### Task 6: Rename "Staff" to "Team" in the sidebar

**Files:**
- Modify: `src/components/layout/AdminSidebar.jsx`

- [ ] **Step 1: Update the nav label**

In `src/components/layout/AdminSidebar.jsx`, find the `navItems` array. Change the Staff entry from:

```js
{ label: 'Staff', to: '/admin/staff', icon: Briefcase, end: true },
```

to:

```js
{ label: 'Team', to: '/admin/staff', icon: Briefcase, end: true },
```

- [ ] **Step 2: Run the full test suite**

```
npm test
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```
git add src/components/layout/AdminSidebar.jsx
git commit -m "feat: rename Staff sidebar nav item to Team"
```

---

## Implementation Checklist

- [ ] Task 1: Update `getStaff()` to query both staff and admin profiles
- [ ] Task 2: Add `inviteUser()` service function
- [ ] Task 3: Apply staff_details DB trigger migration; create and deploy `invite-user` Edge Function
- [ ] Task 4: Create `CreateAccountModal` with role slide toggle and invite form
- [ ] Task 5: Update Team page with Create Account button, filter pills, and role column
- [ ] Task 6: Rename "Staff" sidebar nav label to "Team"

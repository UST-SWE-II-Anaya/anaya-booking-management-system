# Accept Invite Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom `/accept-invite` page that invited staff and admin users land on after clicking the email invite link, where they set their password (and gender, for staff) to activate their account.

**Architecture:** The `invite-user` Edge Function gains a `redirectTo` parameter pointing to `/accept-invite`; `inviteUser()` in `staffService.js` supplies that URL from `window.location.origin`. The `AcceptInvitePage` exchanges the Supabase PKCE code for a session, reads the user's name and role from metadata, shows a password form (plus a gender select for staff), then signs out and redirects to `/login` on success.

**Tech Stack:** React, react-router-dom v7, Supabase JS client v2, Supabase Edge Functions (Deno/TypeScript), Tailwind CSS v4, react-hot-toast, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/services/staffService.js` | Add `redirect_to` field to `inviteUser()` body |
| `src/services/staffService.test.js` | Update `inviteUser` test to assert `redirect_to` is present |
| `supabase/functions/invite-user/index.ts` | Accept `redirect_to` from body; pass to `inviteUserByEmail` |
| `src/pages/AcceptInvitePage/index.jsx` | New page — loading / form / error states |
| `src/App.jsx` | Add public route `/accept-invite` |

---

### Task 1: Update `inviteUser()` to include `redirect_to`

**Files:**
- Modify: `src/services/staffService.js`
- Modify: `src/services/staffService.test.js`

- [ ] **Step 1: Update the existing `inviteUser` payload test to assert `redirect_to`**

In `src/services/staffService.test.js`, replace the `expect(supabase.functions.invoke)` assertion inside `describe('inviteUser', ...)`:

```js
expect(supabase.functions.invoke).toHaveBeenCalledWith('invite-user', {
  body: {
    first_name: 'Maria',
    last_name: 'Cruz',
    email: 'maria@example.com',
    phone_number: '09171234567',
    role: 'staff',
    redirect_to: expect.stringContaining('/accept-invite'),
  },
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npm test -- staffService
```

Expected: FAIL — the `body` assertion fails because `redirect_to` is not in the payload.

- [ ] **Step 3: Add `redirect_to` to the body in `inviteUser()`**

In `src/services/staffService.js`, update the `inviteUser` function body:

```js
export const inviteUser = async ({ firstName, lastName, email, phone, role }) => {
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phone ?? '',
      role,
      redirect_to: `${window.location.origin}/accept-invite`,
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

- [ ] **Step 4: Run the tests to confirm they pass**

```
npm test -- staffService
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add src/services/staffService.js src/services/staffService.test.js
git commit -m "feat: add redirect_to accept-invite in inviteUser payload"
```

---

### Task 2: Update `invite-user` Edge Function to use `redirect_to`

**Files:**
- Modify: `supabase/functions/invite-user/index.ts`

No unit test for the Edge Function — verified end-to-end in the manual verification step.

- [ ] **Step 1: Accept `redirect_to` from the body and pass it to `inviteUserByEmail`**

In `supabase/functions/invite-user/index.ts`, replace the body destructure and the `inviteUserByEmail` call:

```ts
// Replace this line:
const { first_name, last_name, email, phone_number, role } = body

// With:
const { first_name, last_name, email, phone_number, role, redirect_to } = body
```

Then update the `inviteUserByEmail` call to include `redirectTo`:

```ts
const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
  email,
  {
    redirectTo: redirect_to,
    data: {
      first_name,
      last_name,
      phone_number: phone_number ?? '',
      date_of_birth: '',
      role,
    },
  }
)
```

The full updated function body (for reference — only the two sections above change):

```ts
// Parse and validate body
const body = await req.json()
const { first_name, last_name, email, phone_number, role, redirect_to } = body

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
    redirectTo: redirect_to,
    data: {
      first_name,
      last_name,
      phone_number: phone_number ?? '',
      date_of_birth: '',
      role,
    },
  }
)
```

- [ ] **Step 2: Commit**

```
git add supabase/functions/invite-user/index.ts
git commit -m "feat: pass redirectTo to inviteUserByEmail in invite-user edge function"
```

---

### Task 3: Create `AcceptInvitePage`

**Files:**
- Create: `src/pages/AcceptInvitePage/index.jsx`

No unit test — the page's logic is a thin orchestration of Supabase auth flows (same pattern as `ResetPasswordPage`, which also has no unit tests).

- [ ] **Step 1: Create the directory and file**

Create `src/pages/AcceptInvitePage/index.jsx` with the following content:

```jsx
import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import Spinner from '../../components/common/Spinner'
import { updateUserPassword, updateProfile, signOut } from '../../services/authService'
import { supabase } from '../../services/supabaseClient'

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say']

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [user, setUser] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setSessionError('No invite code found. Please use the link from your email.')
      return
    }
    supabase.auth.exchangeCodeForSession(code).then(({ data, error: exchangeError }) => {
      if (exchangeError) {
        setSessionError(
          'This invite link is invalid or has expired. Please ask your admin to resend the invitation.'
        )
      } else {
        setUser(data.session.user)
        setSessionReady(true)
      }
    })
  }, [searchParams])

  const role = user?.user_metadata?.role ?? ''
  const firstName = user?.user_metadata?.first_name ?? ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (role === 'staff' && !gender) {
      setError('Please select your gender.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await updateUserPassword(password)
      if (role === 'staff') {
        await updateProfile(user.id, { gender })
      }
      await signOut()
      toast.success('Account activated! Please sign in.')
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Failed to activate account. Please try again.')
      setLoading(false)
    }
  }

  if (sessionError) {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8 gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-xl">
            ✕
          </div>
          <p className="text-sm text-red-500">{sessionError}</p>
        </div>
      </AuthLayout>
    )
  }

  if (!sessionReady) {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
          <Spinner />
          <p className="text-sm text-gray-500">Verifying your invite link…</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout imageSrc="/flower-single.png">
      <span className="bg-[#f0f4e8] text-[#8A956D] text-[10px] tracking-widest uppercase px-3 py-1 rounded-full mb-4">
        {role === 'admin' ? 'Admin Invite' : 'Staff Invite'}
      </span>
      <h1 className="text-xl font-serif mt-2 mb-2 text-center tracking-wide text-anaya-text w-full">
        Welcome, {firstName}!
      </h1>
      <p className="text-xs text-gray-600 mb-8 text-center">
        You've been invited as a{' '}
        <span className="font-medium text-[#8A956D]">
          {role === 'admin' ? 'Admin' : 'Staff'}
        </span>{' '}
        member.
        <br />
        Create a password to activate your account.
      </p>

      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        <InputField
          label="New Password"
          type="password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError('')
          }}
        />
        <InputField
          label="Confirm Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            setError('')
          }}
        />

        {role === 'staff' && (
          <div className="w-full mb-6">
            <label className="block text-xs font-medium mb-1 tracking-wide text-gray-700">
              Gender*
            </label>
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value)
                setError('')
              }}
              required
              className="w-full bg-transparent border-0 border-b border-gray-800 outline-none pb-1 text-sm text-gray-900 focus:border-anaya-green"
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-anaya-error text-[0.65rem] mb-4 self-start">{error}</p>
        )}

        <div className="mt-2 w-full flex justify-center">
          <Button type="submit" disabled={loading}>
            {loading ? 'Activating…' : 'Activate Account'}
          </Button>
        </div>
      </form>

      <div className="w-full flex items-center justify-center space-x-2 my-8">
        <div className="h-px bg-gray-300 w-16"></div>
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px bg-gray-300 w-16"></div>
      </div>

      <Link to="/login" className="text-xs underline hover:text-gray-900 transition-colors">
        Back to Login
      </Link>
    </AuthLayout>
  )
}
```

- [ ] **Step 2: Commit**

```
git add src/pages/AcceptInvitePage/index.jsx
git commit -m "feat: add AcceptInvitePage for staff and admin invite flow"
```

---

### Task 4: Register the route in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import `AcceptInvitePage`**

In `src/App.jsx`, add this import alongside the other public page imports (near `ForgotPasswordPage`, `ResetPasswordPage`):

```js
import AcceptInvitePage from './pages/AcceptInvitePage'
```

- [ ] **Step 2: Add the public route**

In `src/App.jsx`, add the route inside the `<Routes>` block, in the Auth section (alongside `/forgot-password` and `/reset-password`):

```jsx
<Route path="/accept-invite" element={<AcceptInvitePage />} />
```

The Auth section should look like:

```jsx
{/* Auth */}
<Route path="/login" element={<LoginPage />} />
<Route path="/signup" element={<RegisterPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
<Route path="/accept-invite" element={<AcceptInvitePage />} />
```

- [ ] **Step 3: Run the full test suite**

```
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```
git add src/App.jsx
git commit -m "feat: register /accept-invite public route"
```

---

### Task 5: Deploy the Edge Function and configure Supabase

No code changes — these are deployment steps that must be done once.

- [ ] **Step 1: Deploy the updated Edge Function**

```
supabase functions deploy invite-user --project-ref <your-project-ref>
```

Your project ref is the string in your Supabase dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

Expected output: `Deployed Function invite-user`

- [ ] **Step 2: Add the redirect URL to the Supabase Auth allowlist**

In the Supabase dashboard:
1. Go to **Authentication → URL Configuration → Redirect URLs**
2. Add: `https://anaya-booking-management-system.vercel.app/accept-invite`
3. Add (for local dev): `http://localhost:5173/accept-invite`
4. Save

Without this step, Supabase will reject the `redirectTo` URL and fall back to its default hosted page.

- [ ] **Step 3: End-to-end smoke test**

1. Start the dev server: `npm run dev`
2. Log in as an admin and open the Team page
3. Click **Create Account**, fill in a real email you can check, select **Staff**, click **Send Invite**
4. Open the invite email — click **Accept the invite**
5. Confirm you land on `http://localhost:5173/accept-invite` (not Supabase's hosted page)
6. Confirm you see "Welcome, [First Name]!" with the **Staff Invite** badge
7. Confirm the **Gender** select is visible
8. Set a password, pick a gender, click **Activate Account**
9. Confirm toast appears and you are redirected to `/login`
10. Sign in with the new credentials — confirm you reach the staff dashboard
11. Repeat steps 2–10 with **Admin** selected — confirm the gender field is **not** shown

---

## Implementation Checklist

- [ ] Task 1: Update `inviteUser()` to include `redirect_to`
- [ ] Task 2: Update `invite-user` Edge Function
- [ ] Task 3: Create `AcceptInvitePage`
- [ ] Task 4: Register route in `App.jsx`
- [ ] Task 5: Deploy Edge Function + configure Supabase redirect URL allowlist

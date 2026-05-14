# Accept Invite Page — Design Spec

**Date:** 2026-05-14
**Feature:** Staff/Admin invite acceptance flow — password-setting page reached via email invite link

---

## Background

When an admin creates a staff or admin account via the "Create Account" modal, the `invite-user` Edge Function calls Supabase's `inviteUserByEmail()`. This sends an email with an "Accept the invite" link. Currently the link has no `redirectTo`, so Supabase falls back to its default hosted page. This spec covers the custom accept-invite page and the Edge Function update needed to redirect invites there.

---

## User Flow

1. Admin sends invite via Create Account modal
2. Invited user receives email → clicks "Accept the invite"
3. Supabase redirects to `/accept-invite?code=xxx`
4. Page exchanges the code for a session
5. Page shows personalized welcome (name + role) and password form
6. User sets password → success toast → redirect to `/login`

---

## Architecture

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/invite-user/index.ts` | Accept `redirect_to` in request body; pass it to `inviteUserByEmail` |
| `src/services/staffService.js` | Add `redirect_to: window.location.origin + '/accept-invite'` to `inviteUser()` body |
| `src/pages/AcceptInvitePage/index.jsx` | New public page at `/accept-invite` |
| `src/App.jsx` | Add public route `/accept-invite` → `AcceptInvitePage` |
| `src/services/staffService.test.js` | Update `inviteUser` test to assert `redirect_to` is included |

### No new service functions
`updateUserPassword` already exists in `authService.js` and is reused as-is.

---

## AcceptInvitePage Design

**Route:** `/accept-invite` (public — no auth required)

**URL param:** `?code=xxx` (Supabase PKCE invite token)

### States

**1. Verifying (loading)**
- Spinner with "Verifying your invite link…" text
- Shown while `exchangeCodeForSession(code)` is in flight

**2. Set Password (main)**
- Role badge: "Staff Invite" or "Admin Invite" (green pill, uppercase)
- Heading: "Welcome, [first_name]!"
- Subtext: "You've been invited as a [role] member. Create a password to activate your account."
- New Password field (min 8 characters)
- Confirm Password field
- "Activate Account" submit button (brand green `#8A956D`)
- "Back to Login" link at bottom
- Inline validation errors below the relevant field

**3. Invalid / Expired Link**
- Red ✕ icon
- "This invite link is invalid or has expired."
- "Please ask your admin to resend the invitation."
- No password form shown

### Personalization source
Name and role come from `user.user_metadata` set during the invite:
- `user_metadata.first_name`
- `user_metadata.last_name`
- `user_metadata.role` → displayed as "Staff" or "Admin"

### On submit
1. Validate: password ≥ 8 chars, passwords match
2. Call `updateUserPassword(password)`
3. Success: `toast.success('Account activated!')` → `navigate('/login')`
4. Error: inline error below the form

### Reused components
- `AuthLayout` (wraps the whole page, same as ResetPasswordPage)
- `InputField`
- `Button`
- `Spinner`

---

## Edge Function Update

`invite-user/index.ts` accepts `redirect_to` as an optional field in the request body:

```ts
const { first_name, last_name, email, phone_number, role, redirect_to } = body

await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  redirectTo: redirect_to,
  data: { first_name, last_name, phone_number, date_of_birth: '', role },
})
```

No allowlist validation needed — Supabase enforces the Redirect URLs allowlist configured in the project's Auth settings. The allowed URL (`https://anaya-booking-management-system.vercel.app/accept-invite`) must be added there once.

---

## staffService.js Update

`inviteUser()` adds `redirect_to` to the body:

```js
body: {
  first_name: firstName,
  last_name: lastName,
  email,
  phone_number: phone ?? '',
  role,
  redirect_to: `${window.location.origin}/accept-invite`,
}
```

This makes it work in dev (`localhost:5173`) and production (`vercel.app`) without any env config.

---

## Test Update

`staffService.test.js` — update the `inviteUser` test to assert `redirect_to` is included in the body:

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

---

## Supabase Auth Config (manual step)

Add `/accept-invite` to the Redirect URLs allowlist in the Supabase dashboard:
- **Dashboard → Authentication → URL Configuration → Redirect URLs**
- Add: `https://anaya-booking-management-system.vercel.app/accept-invite`
- Add (for local dev): `http://localhost:5173/accept-invite`

---

## Out of Scope

- Resending invites from the admin UI
- Invite expiry display or countdown
- Email template customization

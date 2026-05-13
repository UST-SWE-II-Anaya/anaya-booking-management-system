# Account Inactive Page & Admin Deactivation Reason

**Date:** 2026-05-13
**Status:** Approved

## Problem

Suspended and banned accounts can currently log in and access protected routes. Route guards only check `profile.role`, not `profile.account_status`. Admins also have no way to record why an account was deactivated, leaving users with no context when they are blocked.

## Solution Overview

1. Add a `deactivation_reason` column to `profiles`.
2. Enforce status checks at two points: the login page and all route guards.
3. Add a `/account-inactive` page (centered card, public Navbar) that shows the reason and contact info.
4. Replace the plain ConfirmDialog for suspend/ban actions with a richer `DeactivateAccountModal` that requires a reason before confirming.

---

## 1. Database

**Migration:** Add one nullable text column to `profiles`.

```sql
ALTER TABLE profiles ADD COLUMN deactivation_reason TEXT NULL;
```

- Populated when admin suspends or bans an account.
- Cleared (`NULL`) when an account is reactivated.
- No RLS changes needed — the column is read by the authenticated user's own profile fetch.

---

## 2. New Page: `/account-inactive`

**File:** `src/pages/AccountInactivePage/index.jsx`

**Route:** Added to `App.jsx` as a plain public route (no role/status guard) so suspended users can always reach it.

```jsx
<Route path="/account-inactive" element={<AccountInactivePage />} />
```

**Layout:**
- Public `Navbar` component on top (existing, unchanged).
- Page body: full-height centered container, single white card.

**Card contents (top to bottom):**
1. `Lock` icon from lucide-react, large, muted color.
2. Heading: *"Your account has been suspended"* when `account_status === 'suspended'`; *"Your account has been deactivated"* when `account_status === 'banned'`.
3. Supporting line: *"Your access to Anaya has been restricted."*
4. Reason block (always shown):
   - Label: *"Due to this reason:"*
   - Value: `profile.deactivation_reason` if set; fallback placeholder: *"No specific reason was provided. Please contact support for details."*
5. Amber callout box: *"Contact Anaya customer support to reactivate your account."*
6. Two contact buttons side by side:
   - **Facebook** — links to placeholder `#` (to be replaced with real URL)
   - **Email Us** — `mailto:support@anaya.ph` placeholder
7. **"Go Back to Home"** button (pill shape, outline style) — calls `signOut()` then navigates to `/`.

**Data source:** Reads `profile` and `user` from `useAuthStore`. No additional fetch required — the profile is already in store when the redirect happens.

**"Go Back to Home" behavior:**
1. Call `signOut()` from `authService`
2. Call `clear()` from `useAuthStore`
3. `navigate('/')`

---

## 3. Redirect Logic

### 3a. Login page (`src/pages/auth/LoginPage.jsx`)

After fetching the profile on successful login, check status before routing:

```js
if (profile.account_status !== 'active') {
  setUser(user)
  setProfile(profile)
  navigate('/account-inactive')
  return
}
```

This runs before the existing role-based navigation (`/admin`, `/staff`, `/dashboard`).

### 3b. Route guards

All three guards (`AdminRoute`, `StaffRoute`, `CustomerRoute`) get an additional check after the existing role check:

```jsx
if (profile.account_status !== 'active') {
  return <Navigate to="/account-inactive" replace />
}
```

Order of checks within each guard:
1. `loading` → spinner
2. `!profile` or wrong role → `/login`
3. `account_status !== 'active'` → `/account-inactive`
4. Otherwise → `<Outlet />`

---

## 4. Admin Deactivation Modal

### 4a. New component

**File:** `src/components/admin/accounts/DeactivateAccountModal.jsx`

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `open` | boolean | Controls visibility |
| `onClose` | function | Called on cancel or backdrop click |
| `onConfirm` | function(reason: string) | Called with the trimmed reason string |
| `userName` | string | Full name shown in the modal subtitle |
| `userRole` | string | `'customer'` or `'staff'` — shown as subtitle |
| `action` | `'suspend' \| 'ban' \| 'deactivate'` | Controls title and button label/color |

**Modal contents:**
- Title: *"Suspend Account"* / *"Ban Account"* / *"Deactivate Account"* based on `action`
- Subtitle: `userName · userRole` (e.g. *"Juan dela Cruz · Customer"*)
- Amber warning banner: *"This will prevent the user from logging in. The reason you enter will be visible to them."*
- Required `<textarea>` labeled *"Reason"* with hint *"This message will be visible to the user."*
- Buttons: Cancel (outline) + Confirm (disabled until textarea has non-whitespace content)
  - `suspend` → amber confirm button
  - `ban` → red confirm button (danger)
  - `deactivate` → amber confirm button (staff deactivation)

**Replaces** the plain `ConfirmDialog` for all suspend/ban/deactivate actions in `CustomerDetailPage` and `StaffDetailPage`.

### 4b. Service layer updates

**`src/services/customerService.js`**

```js
// Updated signature — reason is required for status changes other than 'active'
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

**`src/services/staffService.js`**

```js
// Updated — accepts reason
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

// Updated — clears reason on reactivation
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

### 4c. Page updates

**`CustomerDetailPage`**: Replace `ConfirmDialog` usage for suspend/ban with `DeactivateAccountModal`. The `handleStatusChange` function receives the reason from `onConfirm(reason)` and passes it to `updateAccountStatus`. Reactivation keeps the existing plain `ConfirmDialog` (no reason needed).

**`StaffDetailPage`**: Same pattern — replace deactivate action with `DeactivateAccountModal`; reactivation stays as-is.

---

## 5. Files Changed / Created

| File | Change |
|------|--------|
| `src/pages/AccountInactivePage/index.jsx` | **New** |
| `src/App.jsx` | Add `/account-inactive` route |
| `src/pages/auth/LoginPage.jsx` | Add status check before role-based redirect |
| `src/components/layout/AdminRoute.jsx` | Add status check |
| `src/components/layout/StaffRoute.jsx` | Add status check |
| `src/components/layout/CustomerRoute.jsx` | Add status check |
| `src/components/admin/accounts/DeactivateAccountModal.jsx` | **New** |
| `src/services/customerService.js` | Update `updateAccountStatus` signature |
| `src/services/staffService.js` | Update `deactivateStaff` and `activateStaff` |
| `src/pages/admin/customers/CustomerDetailPage.jsx` | Replace ConfirmDialog with DeactivateAccountModal |
| `src/pages/admin/staff/StaffDetailPage.jsx` | Replace ConfirmDialog with DeactivateAccountModal |
| Supabase migration | Add `deactivation_reason TEXT NULL` to `profiles` |

---

## Placeholders (to be replaced before launch)

- Facebook page URL (currently `#`)
- Support email (currently `support@anaya.ph`)

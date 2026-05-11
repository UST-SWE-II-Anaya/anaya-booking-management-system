# Staff & Admin Account Creation — Design Spec

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Admin-side feature to invite new staff and admin accounts via email

---

## Problem

There is currently no way for an admin to create staff or admin accounts through the application UI. New internal accounts must be created manually in the Supabase dashboard. This is a friction point when onboarding new team members.

---

## Goals

- Admin can create a staff or admin account from the Team page
- New account holder receives an invite email with a link to set their own password
- The Team page shows all internal accounts (staff + admin) with a filter by role
- No service role key is ever exposed client-side

---

## Architecture

### Invite Flow

1. Admin clicks **Create Account** on the Team page (`/admin/staff`)
2. Fills in: First Name, Last Name, Email, Phone (optional), Role (Staff or Admin via slide toggle)
3. Frontend calls `inviteUser()` in `staffService.js`
4. `inviteUser()` calls `supabase.functions.invoke('invite-user', { body: payload })`
5. Edge Function validates the caller's JWT (must be `admin` role), validates fields, then calls `supabase.auth.admin.inviteUserByEmail(email, { data: { role, first_name, last_name, phone_number } })`
6. Supabase sends the invite email; the existing `handle_new_user` DB trigger creates the `profiles` row
7. If role is `staff`, the Edge Function also inserts a `staff_details` row (`is_active: true`)
8. Frontend refreshes the Team list and shows the new account

### Security

- The service role key is stored as a Supabase secret (`SUPABASE_SERVICE_ROLE_KEY`), never in client code
- The Edge Function verifies the caller's JWT and rejects non-admin callers with a 403
- Frontend validates all required fields before calling the Edge Function

---

## Components

### `supabase/functions/invite-user/index.ts` (new)

Supabase Edge Function (Deno). Responsibilities:
- Authenticate caller: decode JWT, verify `role === 'admin'`
- Validate body: `first_name`, `last_name`, `email`, `role` required; `role` must be `staff` or `admin`
- Call `supabase.auth.admin.inviteUserByEmail(email, { data: { role, first_name, last_name, phone_number } })`
- If `role === 'staff'`, insert into `staff_details` (`id` = new user's UUID, `is_active: true`)
- Return `{ success: true }` or `{ error: "human-readable message" }`

### `src/services/staffService.js` (updated)

- `getStaff()` → updated to query `.in('role', ['staff', 'admin'])` so admins appear in the Team list
- `inviteUser({ firstName, lastName, email, phone, role })` → new function, calls `supabase.functions.invoke('invite-user', { body: payload })`

### `src/components/admin/staff/CreateAccountModal.jsx` (new)

Modal component using the existing `Modal` common component. Contains:
- **Role slide toggle** at the top: `Staff | Admin` pill-style switcher (not a dropdown)
- Fields: First Name, Last Name, Email, Phone (optional)
- **Send Invite** button — loading spinner while the Edge Function runs
- Inline success message on completion ("Invite sent to email@example.com"), then auto-closes and triggers list refresh
- Inline error display for failures (e.g. "An account with this email already exists")

### `src/pages/admin/staff/StaffPage.jsx` (updated)

- Page title: **Team** (was "Staff")
- **Create Account** button in the header row (top right)
- **Filter pills** below the header: `All | Staff | Admin` — filters the table client-side
- Table gains a **Role column** showing a `Badge` (staff / admin)
- Mounts `CreateAccountModal`, passes `onSuccess` to refresh the list

### `src/components/layout/AdminSidebar.jsx` (updated)

- Nav item label: **Team** (was "Staff"), route unchanged (`/admin/staff`)

---

## Error Handling

| Scenario | Handling |
|---|---|
| Email already registered | Edge Function returns structured error → shown inline in modal |
| Invalid email format | Frontend validates before calling Edge Function |
| Non-admin calls Edge Function | Edge Function returns 403 → shown as generic error |
| Missing required fields | Frontend validates, Send Invite button disabled until valid |
| Network / Supabase outage | Generic "Something went wrong, please try again" shown in modal |

---

## Out of Scope

- Editing an existing staff or admin account's email or role (separate feature)
- Resending invite emails (can be done from Supabase dashboard for now)
- Staff-specific fields at creation time (specialty, schedule) — set later via the profile detail page

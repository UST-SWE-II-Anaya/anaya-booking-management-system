# Audit Log & Actions Tracker — Implementation Plan

**Date:** 2026-06-02  
**Revised:** 2026-06-02 (addresses 5 concerns — see bottom of file)  
**Design Spec:** `docs/superpowers/specs/2026-06-02-audit-log-design.md`

---

## Overview

This plan implements a centralized audit logging system that tracks all admin and staff write
actions. Admins see all logs; staff see only their own actions. Includes a global audit log page,
inline activity history on detail pages, and a staff activity view.

**Key changes from initial plan:**
1. `ON DELETE SET NULL` on `actor_id` FK — profile deletion no longer blocked
2. Edge Functions log server-side — eliminates network-drop risk for high-impact actions
3. `logAction` reads actor from `useAuthStore.getState()` — no prop drilling
4. `getEntityAuditLogs` capped at 50 rows with offset-based load-more
5. Optional chaining on profile fields — safe against momentarily null profile

---

## Phase 1: Database

### Task 1.1 — Create audit_logs migration

```sql
CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE SET NULL: profile deletion is not blocked by this FK
  actor_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name       TEXT NOT NULL,
  actor_role       TEXT NOT NULL CHECK (actor_role IN ('admin', 'staff')),
  action_type      TEXT NOT NULL,
  entity_type      TEXT NOT NULL,
  entity_id        UUID,
  entity_reference TEXT,
  description      TEXT NOT NULL,
  metadata         JSONB,
  old_data         JSONB,
  new_data         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor_id    ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_entity      ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON audit_logs (action_type);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Staff can view own audit logs"
  ON audit_logs FOR SELECT
  USING (actor_id = auth.uid());

-- RLS prevents actor_id spoofing — client cannot claim a different uid
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_id);
```

Apply via Supabase MCP `apply_migration` tool.

**Verification:**
- Table exists with all columns and `ON DELETE SET NULL` on actor_id
- Delete a test profile → confirm `actor_id` is nulled, not blocked
- Admin user can SELECT all rows
- Staff user can SELECT only their own rows (RLS)

---

## Phase 2: Service Layer

### Task 2.1 — Create auditService.js

**File:** `src/services/auditService.js`

#### `logAction` — reads actor from Zustand, no prop drilling

```js
import { supabase } from './supabaseClient'
import { useAuthStore } from '../store/authStore'

export async function logAction({
  actionType,
  entityType,
  entityId,
  entityReference,
  description,
  metadata,
  oldData,
  newData,
}) {
  const { profile } = useAuthStore.getState()
  if (!profile?.id) return

  const actor = {
    id: profile.id,
    name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
    role: profile.role,
  }

  const { error } = await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    entity_reference: entityReference,
    description,
    metadata,
    old_data: oldData,
    new_data: newData,
  })
  if (error) console.error('Audit log failed:', error)
}
```

Key rules:
- `useAuthStore.getState()` reads Zustand state outside React — no prop needed
- Guards on `profile?.id` — safe if profile is null during loading
- Optional chaining on name fields — no crash if momentarily undefined
- Fire-and-forget: never throws, never breaks the calling service

#### `getAuditLogs` — paginated, for admin audit log page

```js
export async function getAuditLogs({
  page = 1,
  pageSize = 20,
  actorId,
  actionType,
  entityType,
  startDate,
  endDate,
  search,
}) {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })

  if (actorId) query = query.eq('actor_id', actorId)
  if (actionType) query = query.eq('action_type', actionType)
  if (entityType) query = query.eq('entity_type', entityType)
  if (startDate) query = query.gte('created_at', startDate.toISOString())
  if (endDate) query = query.lte('created_at', endDate.toISOString())
  if (search) {
    query = query.or(
      `description.ilike.%${search}%,entity_reference.ilike.%${search}%`
    )
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  return { data: data || [], count: count || 0, error }
}
```

#### `getEntityAuditLogs` — capped at 50, supports load-more

```js
export async function getEntityAuditLogs({
  entityType,
  entityId,
  limit = 50,
  offset = 0,
}) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: data || [], error }
}
```

The `ActivityHistory` component increments `offset` by 50 on each "Load more" click.

#### `getMyAuditLogs` — paginated, for staff activity page

```js
export async function getMyAuditLogs({
  page = 1,
  pageSize = 20,
  actionType,
  startDate,
  endDate,
}) {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })

  if (actionType) query = query.eq('action_type', actionType)
  if (startDate) query = query.gte('created_at', startDate.toISOString())
  if (endDate) query = query.lte('created_at', endDate.toISOString())

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  return { data: data || [], count: count || 0, error }
}
```

---

## Phase 3: Wire Logging into Services

`logAction` no longer takes an `actor` parameter — it reads it internally. No component call sites
need to change. Each service function just imports `logAction` and calls it after its main
Supabase call succeeds.

### Task 3.1 — bookingService.js

Functions: `updateBookingStatus`, `cancelBooking`, `settleBalance`

Example — `cancelBooking`:

```js
import { logAction } from './auditService'

export async function cancelBooking(bookingId) {
  const { data: prev } = await supabase
    .from('bookings')
    .select('booking_status, reference_id')
    .eq('id', bookingId)
    .single()

  const { data, error } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) return { data, error }

  logAction({
    actionType: 'booking.cancelled',
    entityType: 'booking',
    entityId: bookingId,
    entityReference: data.reference_id,
    description: `Cancelled booking #${data.reference_id}`,
    oldData: prev ? { status: prev.booking_status } : null,
    newData: { status: data.booking_status },
  })

  return { data, error: null }
}
```

### Task 3.2 — paymentService.js

Functions: `verifyPayment`, `denyPayment`

Log `payment.verified` / `payment.denied` with `old_data: { status: prev.status }` and
`new_data: { status: 'verified' | 'denied' }`.

### Task 3.3 — customerService.js

Functions: `updateAccountStatus` (covers suspend and reactivate)

Action types: `customer.suspended`, `customer.reactivated`.  
Include `old_data: { status: prev.account_status }`, `new_data: { status: newStatus }`,
`metadata: { reason }` for suspensions.

**Note:** `banCustomer` is excluded here — it's handled server-side in the Edge Function (Phase 4).

### Task 3.4 — staffService.js

Functions: `deactivateStaff`, `activateStaff`, `reviewLeaveRequest`

Action types: `staff.suspended`, `staff.reactivated`, `leave_request.approved`,
`leave_request.rejected`.

**Note:** `banStaff` and `inviteUser` are excluded — handled server-side in Edge Functions.

### Task 3.5 — staffAppointmentService.js

Functions: `claimAppointment`

Action type: `booking.claimed`. Log `entityReference` as the appointment reference_id.

### Task 3.6 — servicesCmsService.js

Functions: all create/update/delete on services and categories

Action types: `service.created`, `service.updated`, `service.deleted`, `category.created`,
`category.updated`, `category.deleted`.

For updates: capture `old_data` from the record before update (name, price, etc.).

### Task 3.7 — inquiryService.js

Functions: `markRead`, `archiveInquiry`

Action types: `inquiry.marked_read`, `inquiry.archived`.

### Task 3.8 — settingsService.js

Functions: `upsertSetting`

Action type: `setting.updated`. Include `metadata: { key }` so the log shows which setting
changed.

### Task 3.9 — qrPaymentService.js

Functions: `uploadQRCode`, `removeQRCode`

Action types: `qr_payment.uploaded`, `qr_payment.removed`. Include `metadata: { slot }`.

---

## Phase 4: Edge Function Updates

The three Edge Functions that perform the highest-impact actions must log **server-side** using
the Supabase service role client. This eliminates the network-drop risk between success response
and client-side log insert.

### banCustomer Edge Function

After completing the ban logic, insert an audit log row:

```js
// Inside the Edge Function, after ban operations complete
const actorId = req.headers.get('x-actor-id') // passed from client
const { data: actor } = await supabaseAdmin
  .from('profiles')
  .select('first_name, last_name, role')
  .eq('id', actorId)
  .single()

await supabaseAdmin.from('audit_logs').insert({
  actor_id: actorId,
  actor_name: `${actor.first_name} ${actor.last_name}`,
  actor_role: actor.role,
  action_type: 'customer.banned',
  entity_type: 'customer',
  entity_id: customerId,
  entity_reference: customerReference,
  description: `Banned customer ${customerEmail}`,
  old_data: { status: 'active' },
  new_data: { status: 'banned' },
})
```

### banStaff Edge Function

Same pattern. Action type: `staff.banned`.

### inviteUser Edge Function

Same pattern. Action type: `staff.invited`. Include `metadata: { role: invitedRole }`.

**Actor identity:** Read `actorId` from a header sent by the client. The Edge Function fetches
name/role from profiles using the service role client. The client sends the actor's `profile.id`
from `useAuthStore.getState()`.

---

## Phase 5: UI Components

### Task 5.1 — ActivityHistory component

**File:** `src/components/ActivityHistory/index.jsx`

Props: `{ entityType: string, entityId: string }`

Behavior:
- Fetch with `getEntityAuditLogs({ entityType, entityId, limit: 50, offset: 0 })`
- Render timeline, newest first
- Each entry: timestamp · actor name + role badge · description
- Expandable for `old_data` / `new_data` (formatted JSON or key-value pairs)
- "Load more" button: increments `offset` by 50, appends next batch to list
- Loading and empty states

### Task 5.2 — Add ActivityHistory to detail pages

- `src/pages/admin/BookingDetailPage/index.jsx` — add at bottom with `entityType="booking"`
- `src/pages/admin/CustomerDetailPage/index.jsx` — add with `entityType="customer"`
- `src/pages/admin/StaffDetailPage/index.jsx` — add with `entityType="staff"`

### Task 5.3 — AuditLogPage

**File:** `src/pages/admin/AuditLogPage/index.jsx`

Layout:
1. Filter bar: date range, actor dropdown (all admin/staff profiles), action type, entity type,
   search field, Apply/Reset
2. Table: Date/Time | Actor + badge | Action Type | Entity Ref | Description
3. Expandable rows: show `old_data` / `new_data`
4. Pagination: page size selector (10/20/50), Prev/Next, total count

Match existing admin table Tailwind patterns for consistency.

### Task 5.4 — Add AuditLogPage route and nav link

**Route** in `src/App.jsx`:
```jsx
<Route
  path="/admin/audit-log"
  element={<AdminRoute><AuditLogPage /></AdminRoute>}
/>
```

Add "Audit Log" link to admin sidebar component.

### Task 5.5 — MyActivityPage

**File:** `src/pages/staff/MyActivityPage/index.jsx`

Uses `getMyAuditLogs`. Filters: date range, action type. Same table layout as AuditLogPage.
RLS ensures only the current user's rows are returned — no client-side filtering needed.

### Task 5.6 — Add MyActivityPage route and nav link

**Route** in `src/App.jsx`:
```jsx
<Route
  path="/staff/my-activity"
  element={<StaffRoute><MyActivityPage /></StaffRoute>}
/>
```

Add "My Activity" link to staff sidebar component.

---

## Phase 6: Verification

### DB migration
- `audit_logs` table exists with correct schema
- `actor_id` FK has `ON DELETE SET NULL`
- Delete a test profile → `actor_id` nulled in existing logs, not blocked
- RLS: admin sees all, staff sees only own rows

### App-level logging
- Cancel a booking as admin → row in `audit_logs` with correct fields
- Verify `old_data`/`new_data` populated
- Break the log insert temporarily → main action still completes, no user-facing error

### Edge Function logging
- Trigger `banCustomer` → audit log row inserted server-side
- Confirm log appears even when client disconnects immediately after calling the function

### Entity query limit
- Entity with 60+ logs → `ActivityHistory` shows 50 → "Load more" loads next batch

### Admin audit log page
- Filters and search return correct results
- Pagination works (page size, Prev/Next)
- Row expansion shows old/new data
- `/admin/audit-log` accessible to admin, redirects for staff/customer

### Staff activity page
- `/staff/my-activity` shows only current user's actions
- Staff cannot access `/admin/audit-log`

---

## Rollout Checklist

- [ ] Migration applied (`ON DELETE SET NULL` confirmed)
- [ ] `auditService.js` created (logAction, getAuditLogs, getEntityAuditLogs, getMyAuditLogs)
- [ ] 9 service files updated with logAction calls (no actor param needed)
- [ ] 3 Edge Functions updated with server-side logging
- [ ] `ActivityHistory` component created with load-more
- [ ] ActivityHistory added to 3 detail pages
- [ ] `AuditLogPage` created and routed at `/admin/audit-log`
- [ ] Audit Log link added to admin sidebar
- [ ] `MyActivityPage` created and routed at `/staff/my-activity`
- [ ] My Activity link added to staff sidebar
- [ ] All verification tests pass
- [ ] Commit: `feat: add audit log and actions tracker`

---

## Revision Notes

**Changes from initial plan:**

| # | Concern | Fix Applied |
|---|---|---|
| 1 | Client-side logging risky for Edge Functions | Edge Functions insert logs server-side; app-level kept for standard DB ops (RLS prevents spoofing, rich context preserved) |
| 2 | FK blocks profile deletion | Changed to `ON DELETE SET NULL` |
| 3 | `getEntityAuditLogs` unbounded | Added `.range(offset, offset + limit - 1)` with default limit 50 and load-more support |
| 4 | Prop drilling actor into 10 components | `logAction` calls `useAuthStore.getState()` internally — service signatures unchanged |
| 5 | Null crash risk + 80-char violations | Optional chaining on profile fields; long lines wrapped |

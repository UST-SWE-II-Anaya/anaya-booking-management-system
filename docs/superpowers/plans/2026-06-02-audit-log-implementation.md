# Audit Log & Actions Tracker — Implementation Plan

**Date:** 2026-06-02  
**Design Spec:** `docs/superpowers/specs/2026-06-02-audit-log-design.md`

---

## Overview

This plan implements a centralized audit logging system that tracks all admin and staff write actions. Admins see all logs; staff see only their own actions. Includes a global audit log page, inline activity history on detail pages, and a staff activity view.

---

## Phase 1: Database

### Task 1.1 — Create audit_logs migration

**File to create:** Run Supabase migration

**SQL:**
```sql
CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         UUID REFERENCES profiles(id),
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
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Staff can view own audit logs"
  ON audit_logs FOR SELECT
  USING (actor_id = auth.uid());

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_id);
```

**Verification:**
- Run migration via Supabase MCP tool
- Confirm table exists with all columns
- Test admin can query all rows
- Test staff user can query only own rows (RLS enforcement)

---

## Phase 2: Service Layer

### Task 2.1 — Create auditService.js

**File:** `src/services/auditService.js`

**Exports:**
1. `logAction(options)` — Fire-and-forget insert
2. `getAuditLogs(options)` — Paginated query for admin page
3. `getEntityAuditLogs(options)` — Query for detail page history
4. `getMyAuditLogs(options)` — Query for staff activity page

**Implementation:**

```js
import { supabase } from './supabaseClient'

export async function logAction({
  actor,
  actionType,
  entityType,
  entityId,
  entityReference,
  description,
  metadata,
  oldData,
  newData,
}) {
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
  let query = supabase.from('audit_logs').select('*', { count: 'exact' })

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

export async function getEntityAuditLogs({ entityType, entityId }) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })

  return { data: data || [], error }
}

export async function getMyAuditLogs({
  page = 1,
  pageSize = 20,
  actionType,
  startDate,
  endDate,
}) {
  let query = supabase.from('audit_logs').select('*', { count: 'exact' })

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

**Verification:**
- Test `logAction` inserts a row with correct fields
- Test `getAuditLogs` returns paginated results with filters working
- Test RLS: staff user calling `getAuditLogs` (should not return others' logs via RLS policy)

---

## Phase 3: Wire Logging into Services

### Task 3.1 — Update bookingService.js

**Functions to update:**
- `updateBookingStatus(bookingId, status, actor)`
- `cancelBooking(bookingId, actor)`
- `settleBalance(bookingId, actor)`

**Pattern:**
1. Add `actor` parameter
2. Fetch old state before update (e.g., `booking_status`)
3. Perform update
4. Call `logAction()` after success

**Example for cancelBooking:**
```js
import { logAction } from './auditService'

export async function cancelBooking(bookingId, actor) {
  const { data: oldBooking } = await supabase
    .from('bookings')
    .select('booking_status, reference_id')
    .eq('id', bookingId)
    .single()

  const { data, error } = await supabase
    .from('bookings')
    .update({ booking_status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) return { data, error }

  logAction({
    actor,
    actionType: 'booking.cancelled',
    entityType: 'booking',
    entityId: bookingId,
    entityReference: data.reference_id,
    description: `Cancelled booking #${data.reference_id}`,
    oldData: oldBooking ? { status: oldBooking.booking_status } : null,
    newData: { status: data.booking_status },
  })

  return { data, error: null }
}
```

### Task 3.2 — Update paymentService.js

**Functions to update:**
- `verifyPayment(paymentId, actor)`
- `denyPayment(paymentId, actor)`

### Task 3.3 — Update customerService.js

**Functions to update:**
- `updateAccountStatus(customerId, status, reason, actor)`
- `banCustomer(customerId, actor)` — calls Edge Function, log after success

### Task 3.4 — Update staffService.js

**Functions to update:**
- `deactivateStaff(staffId, reason, actor)`
- `activateStaff(staffId, actor)`
- `banStaff(staffId, actor)` — calls Edge Function
- `inviteUser(email, role, actor)` — calls Edge Function
- `reviewLeaveRequest(leaveRequestId, status, actor)`

### Task 3.5 — Update staffAppointmentService.js

**Functions to update:**
- `claimAppointment(appointmentId, actor)`

### Task 3.6 — Update servicesCmsService.js

**Functions to update:**
- `createService(categoryId, serviceData, actor)`
- `updateService(serviceId, serviceData, actor)`
- `deleteService(serviceId, actor)`
- `createCategory(categoryData, actor)`
- `updateCategory(categoryId, categoryData, actor)`
- `deleteCategory(categoryId, actor)`

### Task 3.7 — Update inquiryService.js

**Functions to update:**
- `markRead(inquiryId, actor)`
- `archiveInquiry(inquiryId, actor)`

### Task 3.8 — Update settingsService.js

**Functions to update:**
- `upsertSetting(key, value, actor)`

### Task 3.9 — Update qrPaymentService.js

**Functions to update:**
- `uploadQRCode(slot, file, actor)`
- `removeQRCode(slot, actor)`

### Task 3.10 — Update component call sites

**Where services are called:**
- Admin pages (booking, customer, staff, services, inquiries, settings, qr-payment)
- Staff appointment page (claimAppointment)

Add `actor` from `useAuthStore()`:
```js
const { profile } = useAuthStore()
const actor = { 
  id: profile.id, 
  name: `${profile.first_name} ${profile.last_name}`, 
  role: profile.role 
}

await cancelBooking(bookingId, actor)
```

---

## Phase 4: UI Components

### Task 4.1 — Create ActivityHistory component

**File:** `src/components/ActivityHistory/index.jsx`

**Props:**
```js
{
  entityType: 'booking' | 'customer' | 'staff',
  entityId: UUID,
}
```

**Features:**
- Fetch logs using `getEntityAuditLogs`
- Render timeline (top-to-bottom, newest first)
- Each entry: timestamp · actor name (+ badge) · action type · description
- Expandable to show old_data / new_data as formatted JSON or diff
- Loading state
- Empty state

**Styling:** Use Tailwind CSS v4 (match existing admin table styles)

### Task 4.2 — Add ActivityHistory to BookingDetailPage

**File:** `src/pages/admin/BookingDetailPage/index.jsx`

Add at bottom before closing:
```jsx
<ActivityHistory entityType="booking" entityId={bookingId} />
```

### Task 4.3 — Add ActivityHistory to CustomerDetailPage

**File:** `src/pages/admin/CustomerDetailPage/index.jsx`

Add at bottom:
```jsx
<ActivityHistory entityType="customer" entityId={customerId} />
```

### Task 4.4 — Add ActivityHistory to StaffDetailPage

**File:** `src/pages/admin/StaffDetailPage/index.jsx`

Add at bottom:
```jsx
<ActivityHistory entityType="staff" entityId={staffId} />
```

### Task 4.5 — Create AuditLogPage

**File:** `src/pages/admin/AuditLogPage/index.jsx`

**Structure:**
1. Filter bar (top)
   - Date range picker (from/to)
   - Actor dropdown (all admin/staff users)
   - Action type filter
   - Entity type filter
   - Search field
   - Apply/Reset buttons

2. Results table
   - Columns: Date/Time | Actor (+ badge) | Action Type | Entity Ref | Description
   - Sortable columns
   - Expandable rows for old_data / new_data

3. Pagination
   - Page size selector (10, 20, 50)
   - Previous/Next
   - Total count

**Implementation notes:**
- Use `getAuditLogs` from auditService
- Match existing admin table patterns (use same Tailwind classes, structure)
- Handle loading and error states

### Task 4.6 — Add AuditLogPage to admin routes

**File:** `src/App.jsx` (or wherever admin routes are defined)

Add route:
```jsx
<Route path="/admin/audit-log" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
```

### Task 4.7 — Add AuditLogPage link to admin sidebar

**File:** `src/components/admin/AdminSidebar/index.jsx` (or similar)

Add nav link:
```jsx
<Link to="/admin/audit-log">Audit Log</Link>
```

### Task 4.8 — Create MyActivityPage (staff)

**File:** `src/pages/staff/MyActivityPage/index.jsx`

Similar to AuditLogPage but:
- Only shows current user's actions
- Filters: date range, action type
- Uses `getMyAuditLogs`

### Task 4.9 — Add MyActivityPage to staff routes

**File:** `src/App.jsx`

Add route:
```jsx
<Route path="/staff/my-activity" element={<StaffRoute><MyActivityPage /></StaffRoute>} />
```

### Task 4.10 — Add MyActivityPage link to staff sidebar

**File:** `src/components/staff/StaffSidebar/index.jsx` (or similar)

Add nav link:
```jsx
<Link to="/staff/my-activity">My Activity</Link>
```

---

## Phase 5: Testing & Verification

### Task 5.1 — Database verification

1. Migration applied successfully
2. `audit_logs` table exists with correct schema
3. All indexes created
4. RLS policies enforced:
   - Admin user can SELECT all rows
   - Staff user can SELECT only `actor_id = auth.uid()`

### Task 5.2 — Service logging verification

1. Trigger booking cancellation in admin UI
2. Check `audit_logs` table for new row
3. Verify fields: actor_id, action_type, old_data, new_data populated correctly
4. Temporarily break insert (wrong table name) → main action still completes

### Task 5.3 — Admin audit log page verification

1. Navigate to `/admin/audit-log`
2. Page loads with existing logs
3. Filters work (date range, actor, action type, entity type)
4. Search works (by description or entity_reference)
5. Pagination works (page size, previous/next)
6. Row expansion shows old_data / new_data

### Task 5.4 — Inline activity history verification

1. Open `/admin/bookings/:id`
2. ActivityHistory section visible at bottom
3. Shows logs for that booking
4. Expandable rows work
5. Repeat for customer detail and staff detail pages

### Task 5.5 — Staff activity page verification

1. Log in as staff user
2. Navigate to `/staff/my-activity`
3. Page shows only current user's actions
4. Filters work
5. Pagination works
6. Confirm staff cannot see other staff's logs (RLS)

### Task 5.6 — End-to-end smoke test

1. Create a booking as customer
2. As admin: approve payment, mark finished, settle balance
3. Check audit log for all three actions
4. Open booking detail → inline history shows all three actions
5. Check staff's my activity page (no entries for admin actions) ✓

---

## Rollout Checklist

- [ ] All 10 service files updated with actor parameter and logAction calls
- [ ] All 10 component/page call sites passing actor
- [ ] auditService.js tested (logAction doesn't throw, queries return correct data)
- [ ] ActivityHistory component created and tested
- [ ] Activity history added to 3 detail pages
- [ ] AuditLogPage created with filters/search/pagination
- [ ] AuditLogPage linked in admin sidebar
- [ ] MyActivityPage created
- [ ] MyActivityPage linked in staff sidebar
- [ ] Smoke tests pass (logging works, no errors, RLS enforced)
- [ ] Design spec reviewed
- [ ] Commit all changes with message `feat: add audit log and actions tracker`

---

## Notes

- **Fire-and-forget pattern**: `logAction` never throws. Logging failures are silent console.error only.
- **Actor composition**: Pull from `useAuthStore()`. Compose as `{ id, name: '${first_name} ${last_name}', role }`.
- **Before/after snapshots**: Include only relevant fields (status, amount, etc.), not entire records.
- **Denormalization**: `actor_name` and `actor_role` stored in log for readability if profile deleted later.
- **Immutable logs**: No update/delete access to audit_logs table.
- **Testing RLS**: Use a test staff account that's different from the admin account to verify policies.

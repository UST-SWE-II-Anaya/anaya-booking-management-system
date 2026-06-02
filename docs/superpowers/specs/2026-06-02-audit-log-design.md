# Audit Log & Actions Tracker — Design Spec

**Date:** 2026-06-02  
**Status:** Approved

---

## Problem Statement

The admin panel currently has no unified audit trail. Accountability tracking is scattered across individual tables:
- `payments.verified_by`, `payments.verified_at` — who verified a payment
- `bookings.cancelled_by`, `bookings.cancelled_at` — who cancelled a booking
- `leave_requests.reviewed_by`, `leave_requests.reviewed_at` — who approved/rejected leave
- `site_settings.updated_by`, `site_settings.updated_at` — who changed settings

There is no way to:
- See a full activity history for a specific actor (admin/staff member)
- See all actions taken on a specific entity (booking, customer, etc.)
- Investigate who did what and when across the system
- Generate compliance reports or audit trails for business purposes

---

## Solution Overview

Add a centralized `audit_logs` table that tracks all write operations (admin and staff actions). The implementation has four layers:

1. **Database**: Single `audit_logs` table with before/after snapshots and RLS policies
2. **Service**: Shared `auditService` that logs all write actions (fire-and-forget, non-blocking)
3. **Pages**: Global admin audit log, inline activity history on detail pages, staff "My Activity"
4. **Visibility**: Admins see all logs; staff see only their own actions

---

## Design Details

### 1. Database Schema

**Table: `audit_logs`**

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `actor_id` | UUID | FK → `profiles.id` (who performed the action) |
| `actor_name` | TEXT | Denormalized name (readable if profile deleted) |
| `actor_role` | TEXT | `admin` or `staff` at time of action |
| `action_type` | TEXT | Dot-notation: `booking.cancelled`, `customer.banned`, etc. |
| `entity_type` | TEXT | Type of object affected: `booking`, `customer`, `staff`, `service`, etc. |
| `entity_id` | UUID | ID of the affected record |
| `entity_reference` | TEXT | Human-readable ref: booking number, customer email, etc. |
| `description` | TEXT | Full sentence describing the action |
| `metadata` | JSONB | Extra context (reason for cancellation, approval notes, etc.) |
| `old_data` | JSONB | State **before** the action (null for creates) |
| `new_data` | JSONB | State **after** the action (null for deletes) |
| `created_at` | TIMESTAMPTZ | Auto-set to `now()` |

**Indexes:**
- `(actor_id)` — find all actions by an actor
- `(entity_type, entity_id)` — find all actions on a record
- `(created_at DESC)` — chronological queries
- `(action_type)` — filter by action type

**Row Level Security (RLS):**
- **Admins**: `SELECT` all rows
- **Staff**: `SELECT` only rows where `actor_id = auth.uid()`
- **Insert**: Both roles can insert (service layer enforces context)
- **No deletes or updates** — audit logs are immutable

### 2. Service Layer

**File:** `src/services/auditService.js`

#### `logAction(options)` — Fire-and-forget logging

```js
logAction({
  actor: { id, name, role },    // Current user from auth store
  actionType: string,             // e.g. 'booking.cancelled'
  entityType: string,             // e.g. 'booking'
  entityId: UUID,
  entityReference: string,        // e.g. booking ref number
  description: string,            // "Cancelled booking #ABC123 for John Doe"
  metadata: JSONB,                // optional extra context
  oldData: JSONB,                 // optional pre-action state
  newData: JSONB,                 // optional post-action state
})
```

**Behavior:**
- Inserts one row into `audit_logs`
- Never throws — logs errors to console but doesn't break the main action
- Called **after** the main write operation succeeds
- Non-blocking (async/await not required by callers)

#### `getAuditLogs(options)` — Query for admin page

```js
getAuditLogs({
  page: number,           // default 1
  pageSize: number,       // default 20
  actorId: UUID,          // optional filter
  actionType: string,     // optional filter
  entityType: string,     // optional filter
  startDate: Date,        // optional range
  endDate: Date,
  search: string,         // optional search on description/entity_reference
})
```

Returns paginated results with total count.

#### `getEntityAuditLogs(options)` — Query for detail page history

```js
getEntityAuditLogs({
  entityType: string,     // 'booking', 'customer', 'staff'
  entityId: UUID,
})
```

Returns all logs for a specific entity, ordered by `created_at DESC`.

#### `getMyAuditLogs(options)` — Query for staff activity page

```js
getMyAuditLogs({
  page: number,           // default 1
  pageSize: number,       // default 20
  actionType: string,     // optional filter
  startDate: Date,        // optional range
  endDate: Date,
})
```

Returns paginated logs for the authenticated user (RLS enforces actor_id = auth.uid()).

---

### 3. Actions to Track

**Grouped by module:**

| Module | Action Type | Entity | Trigger |
|---|---|---|---|
| **Bookings** | `booking.cancelled` | booking | Admin cancels a booking |
| | `booking.finished` | booking | Admin marks booking finished |
| | `booking.no_show` | booking | Admin marks booking no-show |
| | `booking.balance_settled` | booking | Admin settles remaining balance |
| | `booking.claimed` | booking | Staff claims an unassigned appointment |
| **Payments** | `payment.verified` | payment | Admin verifies GCash upload |
| | `payment.denied` | payment | Admin denies GCash upload |
| **Customers** | `customer.suspended` | customer | Admin suspends customer account |
| | `customer.reactivated` | customer | Admin reactivates suspended customer |
| | `customer.banned` | customer | Admin bans customer (via Edge Function) |
| **Staff** | `staff.suspended` | staff | Admin suspends staff account |
| | `staff.reactivated` | staff | Admin reactivates suspended staff |
| | `staff.banned` | staff | Admin bans staff (via Edge Function) |
| | `staff.invited` | staff | Admin invites new staff/admin (via Edge Function) |
| | `leave_request.approved` | leave_request | Admin approves leave request |
| | `leave_request.rejected` | leave_request | Admin rejects leave request |
| **Services** | `service.created` | service | Admin creates a service |
| | `service.updated` | service | Admin edits a service |
| | `service.deleted` | service | Admin deletes a service |
| | `category.created` | category | Admin creates a service category |
| | `category.updated` | category | Admin edits a category |
| | `category.deleted` | category | Admin deletes a category |
| **Inquiries** | `inquiry.marked_read` | inquiry | Admin marks inquiry as read |
| | `inquiry.archived` | inquiry | Admin archives inquiry |
| **Settings** | `setting.updated` | setting | Admin updates any setting (operating hours, rates, etc.) |
| **QR Payment** | `qr_payment.uploaded` | qr_code | Admin uploads a GCash QR code |
| | `qr_payment.removed` | qr_code | Admin removes a GCash QR code |

---

### 4. Integration Pattern

Each service function that performs a write operation is updated:

**Before:**
```js
export async function cancelBooking(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ booking_status: 'cancelled', cancelled_at: new Date() })
    .eq('id', bookingId)
  return { data, error }
}
```

**After:**
```js
import { logAction } from './auditService'

export async function cancelBooking(bookingId, actor) {
  // Fetch old state for audit
  const { data: oldBooking } = await supabase
    .from('bookings')
    .select('booking_status, cancelled_by, cancelled_at')
    .eq('id', bookingId)
    .single()

  // Perform the update
  const { data, error } = await supabase
    .from('bookings')
    .update({ booking_status: 'cancelled', cancelled_at: new Date(), cancelled_by: actor.id })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) return { data, error }

  // Log the action (fire-and-forget, never blocks)
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

**Key rules:**
- Add `actor: { id, name, role }` as a parameter (from `useAuthStore()`)
- Capture `oldData` before the update if useful for the audit trail
- Call `logAction()` **after** the main operation succeeds and **not in a try/catch** (let it fail silently)
- Never await `logAction()` — it's fire-and-forget

---

### 5. UI Components

#### AdminPage: `/admin/audit-log`

**File:** `src/pages/admin/AuditLogPage/index.jsx`

**Layout:**
1. **Filter bar** (top)
   - Date range picker (from/to)
   - Actor dropdown (fetches from `profiles` where role is admin or staff)
   - Action type filter (multiselect or dropdown of all action types)
   - Entity type filter (booking, customer, staff, service, etc.)
   - Search field (searches description and entity_reference)
   - Reset/Apply buttons

2. **Results table**
   - Columns: Date/Time | Actor (name + role badge) | Action Type | Entity Reference | Description
   - Sortable by date, actor, action type (at minimum)
   - Rows are clickable/expandable to show old_data / new_data

3. **Pagination**
   - Page size selector (10, 20, 50)
   - Previous/Next buttons
   - Total count indicator

**Navigation:**
- Add "Audit Log" link to the admin sidebar nav

**Route:** `/admin/audit-log` (wrapped in `AdminRoute`)

#### Component: `<ActivityHistory />`

**File:** `src/components/ActivityHistory/index.jsx`

**Props:**
- `entityType: string` — type of entity (booking, customer, staff)
- `entityId: UUID` — ID of the entity

**Behavior:**
- Fetches all logs for `{ entityType, entityId }` using `getEntityAuditLogs`
- Renders a timeline (top-to-bottom) of log entries
- Each entry shows: timestamp, actor name (with role badge), action type, description
- Entries are expandable to show old_data / new_data as a side-by-side diff or formatted JSON
- Loading state while fetching
- Empty state if no logs

**Where it's used:**
- Bottom of `/admin/bookings/:id` — shows all actions on that booking
- Bottom of `/admin/customers/:id` — shows all actions on that customer
- Bottom of `/admin/staff/:id` — shows all actions on that staff member

#### StaffPage: `/staff/my-activity`

**File:** `src/pages/staff/MyActivityPage/index.jsx`

**Layout:**
1. **Filter bar**
   - Date range picker
   - Action type filter
   - Apply/Reset buttons

2. **Results table**
   - Columns: Date/Time | Action Type | Entity Type | Entity Reference | Description
   - Sortable by date
   - Expandable rows for old_data / new_data

3. **Pagination** — same as admin audit log

**Navigation:**
- Add "My Activity" link to the staff sidebar nav

**Route:** `/staff/my-activity` (wrapped in `StaffRoute`)

---

## Verification & Testing

### 1. Database Migration
- Run the migration via Supabase MCP tool
- Confirm `audit_logs` table exists with correct columns
- Verify all indexes are created
- Test RLS policies:
  - Admin user can query all rows
  - Staff user can query only own rows (actor_id = auth.uid())
  - Staff user cannot query other actors' logs

### 2. Service Layer
- Call a service function (e.g., `cancelBooking`) with an actor
- Check `audit_logs` table for the inserted row
- Verify all fields populated correctly (actor_id, action_type, old_data, new_data)
- Temporarily break the insert (e.g., wrong table name) and confirm the main action still completes

### 3. Admin Audit Log Page
- Navigate to `/admin/audit-log`
- Page loads with existing logs
- Filter by date range, actor, action type — results update correctly
- Search by booking reference or action description — results match
- Pagination controls work (page size, previous/next)
- Click a row to expand and view old_data / new_data

### 4. Inline Activity History
- Open `/admin/bookings/:id` (or customer/staff detail)
- ActivityHistory section appears at bottom
- Shows all logs for that entity, most recent first
- Expandable rows show old_data / new_data

### 5. Staff My Activity
- Log in as a staff user
- Navigate to `/staff/my-activity`
- Page shows only the current user's actions (no other staff's logs visible)
- Filters and pagination work

### 6. Non-Blocking Error Handling
- Confirm that if `logAction` fails (e.g., DB error), the main user action still completes
- No error toast shown to user for logging failures (only console.error)

---

## Implementation Order

1. Database migration
2. `auditService.js` (logAction + query functions)
3. Wire `logAction` into service functions (10 files)
4. `ActivityHistory` component
5. Add ActivityHistory to detail pages
6. `AuditLogPage` (admin audit log)
7. `MyActivityPage` (staff activity)
8. Run verification tests

---

## Notes

- **Fire-and-forget**: `logAction` never throws or breaks the main action. Logging failures are silent (console.error only).
- **Actor context**: Pulled from `useAuthStore()` which has profile data. Composed as `{ id, name: '${first_name} ${last_name}', role }`.
- **Before/after snapshots**: Captured as JSONB to allow flexible diffing in the UI later. Include relevant fields only (status, reason, etc.), not entire records.
- **Denormalized fields**: `actor_name` and `actor_role` are stored in the log row so the log remains readable even if the actor's profile is deleted or modified.
- **Immutable logs**: No update or delete access to `audit_logs` — ensures integrity.

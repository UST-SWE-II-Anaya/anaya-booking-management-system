# Admin Notification Badges — Design Spec

**Date:** 2026-06-14
**Status:** Approved (rev 3)

## Overview

Add real-time notification badges to the admin sidebar for Bookings, Leave Requests, and Inquiries. New/unseen items in those pages are highlighted with a dot + warm background tint. Badges clear per-item as the admin opens each one, not per-page-visit.

Future: a notification bell in `AdminHeader` showing recent submissions will be built on this same foundation.

---

## Scope

| Section | Badge condition | Seen tracking |
|---|---|---|
| Bookings | `booking_status = 'pending'` OR `downpayment_status = 'paid'`, AND not viewed | `admin_viewed_items` table |
| Leave Requests | `status = 'pending'` AND not viewed | `admin_viewed_items` table |
| Inquiries | `status = 'unread'` AND not viewed | `unseenIds.inquiries` in store (no DB table needed) |

---

## Data Layer

### New table: `admin_viewed_items`

```sql
CREATE TABLE admin_viewed_items (
  admin_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type    text NOT NULL CHECK (item_type IN ('booking', 'leave_request')),
  item_id      uuid NOT NULL,
  viewed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, item_type, item_id)
);
```

- Composite PK prevents duplicates — safe to upsert on every open
- RLS: admins can only read/write their own rows
- Inquiries excluded — the existing `status` column already serves this role; unseen IDs are tracked only in the store

### DB triggers

**Trigger 1 — Booking state transition reset:**
On `bookings UPDATE`, when `downpayment_status` changes TO `'paid'`: delete all `admin_viewed_items` rows for that booking. This resets "seen" for all admins so they are re-notified when the customer submits payment on a booking that was already viewed.

**Trigger 2 — Resolved item cleanup (UPDATE):**
- On `leave_requests UPDATE`, when `status` changes FROM `'pending'` to anything else: delete all `admin_viewed_items` rows for that leave request.
- On `bookings UPDATE`, when the booking becomes no longer actionable (`booking_status != 'pending'` AND `downpayment_status != 'paid'`): delete all `admin_viewed_items` rows for that booking.

**Trigger 3 — Orphan cleanup (DELETE):**
On `BEFORE DELETE` on `bookings` and `leave_requests`: delete all `admin_viewed_items` rows where `item_id = OLD.id`. Required because `item_id` is polymorphic and has no FK constraint, so cascade delete does not apply.

---

## Notification Service

**File:** `src/services/notificationService.js`

### `getNotificationCounts(adminId)`
Returns `{ bookings, leaveRequests, inquiries }` — three parallel Supabase queries. Called once on `AdminLayout` mount to populate the store.

### `getUnseenItemIds(adminId, itemType)`
Returns a `Set` of unseen item IDs:
- `'booking'` / `'leave_request'`: items that are actionable AND not in `admin_viewed_items` for this admin
- `'inquiry'`: items where `status = 'unread'` (no `admin_viewed_items` lookup needed)

Called on `AdminLayout` mount for all three types to populate `unseenIds` in the store.

### `markItemViewed(adminId, itemType, itemId)`
Upserts a row into `admin_viewed_items`. Only called for `'booking'` and `'leave_request'`. Safe to call multiple times.

---

## Notification Store

**File:** `src/store/notificationStore.js` (Zustand)

```js
{
  counts: { bookings: 0, leaveRequests: 0, inquiries: 0 },
  unseenIds: {
    bookings: new Set(),
    leaveRequests: new Set(),
    inquiries: new Set(),   // ← same pattern as others; no DB table, populated from status
  },

  setCounts(counts),          // initial load
  setUnseenIds(key, set),     // per-section, on AdminLayout mount
  increment(section, id),     // realtime INSERT — adds id to unseenIds
  resolveItem(section, id),   // realtime UPDATE or DELETE (item no longer actionable)
                              //   → removes id from unseenIds only if present, then decrements
  markViewed(type, id),       // admin opened item — removes from unseenIds + decrements
                              //   (only for bookings and leave_requests — writes to DB)
}
```

**Key rule:** Page action buttons (Approve, Deny, Verify Payment, Archive, etc.) **never call `decrement()`, `resolveItem()`, or `markViewed()` directly.** All count-going-down logic flows exclusively through the realtime UPDATE/DELETE listeners, which check `unseenIds.has(id)` before acting. This prevents double-decrements and keeps all connected admin clients in sync.

---

## Realtime Subscriptions

Set up in `AdminLayout` via `useEffect` on mount, torn down on unmount. Ten channels total.

### INSERT channels (counts going up)

| Channel | Table | Event | Action |
|---|---|---|---|
| `new-bookings` | `bookings` | `INSERT` | `increment('bookings', id)` |
| `pending-payments` | `bookings` | `UPDATE` | If `downpayment_status → 'paid'`: `increment('bookings', id)` |
| `new-leave-requests` | `leave_requests` | `INSERT` | `increment('leaveRequests', id)` |
| `new-inquiries` | `inquiries` | `INSERT` | `increment('inquiries', id)` |

### UPDATE/DELETE channels (counts going down)

| Channel | Table | Event | Condition | Action |
|---|---|---|---|---|
| `resolved-bookings` | `bookings` | `UPDATE` | No longer actionable | `resolveItem('bookings', id)` |
| `resolved-leave-requests` | `leave_requests` | `UPDATE` | `status` changed from `'pending'` | `resolveItem('leaveRequests', id)` |
| `resolved-inquiries` | `inquiries` | `UPDATE` | `status` changed from `'unread'` | `resolveItem('inquiries', id)` |
| `deleted-bookings` | `bookings` | `DELETE` | — | `resolveItem('bookings', payload.old.id)` |
| `deleted-leave-requests` | `leave_requests` | `DELETE` | — | `resolveItem('leaveRequests', payload.old.id)` |
| `deleted-inquiries` | `inquiries` | `DELETE` | — | `resolveItem('inquiries', payload.old.id)` |

**How `resolveItem(section, id)` works:**
Checks `unseenIds[section].has(id)` before doing anything. If the item is present, removes it and decrements the count. If not (already viewed/resolved), it is a no-op. This makes all UPDATE and DELETE handlers idempotent and safe to call redundantly.

---

## Sidebar Badge UI

`AdminSidebar` reads from `notificationStore.counts`. Each nav item in the `navItems` array gains an optional `badgeKey` (`'bookings'`, `'leaveRequests'`, `'inquiries'`) that maps to the store.

- Badge colour: `#CE845D` (existing rust palette)
- Hidden when count is 0
- Displays `99+` when count exceeds 99

---

## Page-level Highlighting

**Bookings and Leave Requests (on page mount):**
- `unseenIds` is already populated by `AdminLayout` on mount — no additional fetch needed
- Each list row checks `unseenIds[section].has(item.id)`:
  - **Unseen:** warm tint (`#FEF6F1` background) + rust dot (`#CE845D`, 8px circle) + `font-weight: 600`
  - **Seen:** white background, transparent dot placeholder (for alignment) + `font-weight: 400`

**On item open** (row click / modal open) — Bookings and Leave Requests only:
- Call `markItemViewed(adminId, itemType, itemId)` — writes to `admin_viewed_items`
- Call `notificationStore.markViewed(itemType, itemId)` — removes from `unseenIds` + decrements
- Row re-renders immediately to seen state; sidebar badge decrements
- When the admin subsequently approves/resolves the item, the `resolved-*` listener fires but `unseenIds.has(id)` is already false — no double decrement

**Inquiries (existing row rendering — no change):**
- Rows already use `inq.status === 'unread'` for the dot highlight — this stays as-is
- `unseenIds.inquiries` is used only for badge count management, not for row rendering
- `openInquiry()` already calls `markRead()` which triggers the `resolved-inquiries` UPDATE listener, which calls `resolveItem('inquiries', id)` for all connected admins

---

## File Checklist

| File | Action |
|---|---|
| `supabase/migrations/` | `admin_viewed_items` table + RLS + 3 DB trigger sets |
| `src/services/notificationService.js` | New file |
| `src/store/notificationStore.js` | New file |
| `src/components/layout/AdminLayout.jsx` | Init unseen IDs + 10 realtime channels |
| `src/components/layout/AdminSidebar.jsx` | Add badge rendering |
| `src/pages/admin/bookings/BookingsPage.jsx` | Row highlight from store `unseenIds` + `markViewed` on open |
| `src/pages/admin/staff/LeaveRequestsPage.jsx` | Row highlight from store `unseenIds` + `markViewed` on open |
| `src/pages/admin/inquiries/InquiriesPage.jsx` | No rendering changes — `openInquiry()` already triggers the listener |

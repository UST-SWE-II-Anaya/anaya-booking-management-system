# Admin Notification Badges — Design Spec

**Date:** 2026-06-14
**Status:** Approved (rev 2)

## Overview

Add real-time notification badges to the admin sidebar for Bookings, Leave Requests, and Inquiries. New/unseen items in those pages are highlighted with a dot + warm background tint. Badges clear per-item as the admin opens each one, not per-page-visit.

Future: a notification bell in `AdminHeader` showing recent submissions will be built on this same foundation.

---

## Scope

| Section | Badge condition | Seen tracking |
|---|---|---|
| Bookings | `booking_status = 'pending'` OR `downpayment_status = 'paid'`, AND not viewed | `admin_viewed_items` table |
| Leave Requests | `status = 'pending'` AND not viewed | `admin_viewed_items` table |
| Inquiries | `status = 'unread'` | Existing `markRead()` flow (no changes to DB) |

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
- Inquiries excluded — the existing `status` column already serves this role

### DB triggers for `admin_viewed_items` cleanup

Two triggers keep the table consistent and handle state transitions automatically:

**Trigger 1 — Booking state transition reset:**
When `bookings.downpayment_status` changes TO `'paid'`, delete all `admin_viewed_items` rows for that booking. This resets "seen" for all admins so they're re-notified when the customer submits payment on an already-viewed booking.

**Trigger 2 — Resolved item cleanup:**
- When `leave_requests.status` changes FROM `'pending'` to anything else, delete all `admin_viewed_items` rows for that leave request.
- When a booking is no longer actionable (`booking_status != 'pending'` AND `downpayment_status != 'paid'`), delete all `admin_viewed_items` rows for that booking.

These triggers keep the table small (no stale rows for resolved items) and are the authoritative source for "is this item still actionable?"

---

## Notification Service

**File:** `src/services/notificationService.js`

### `getNotificationCounts(adminId)`
Returns `{ bookings, leaveRequests, inquiries }` — three parallel Supabase queries. Called once on `AdminLayout` mount to populate the store.

### `getUnseenItemIds(adminId, itemType)`
Returns a `Set` of item IDs that are actionable and not yet in `admin_viewed_items`. Called when a page (Bookings, Leave Requests) mounts to drive per-row highlighting.

### `markItemViewed(adminId, itemType, itemId)`
Upserts a row into `admin_viewed_items`. Safe to call multiple times.

---

## Notification Store

**File:** `src/store/notificationStore.js` (Zustand)

```js
{
  counts: { bookings: 0, leaveRequests: 0, inquiries: 0 },
  unseenIds: { bookings: new Set(), leaveRequests: new Set() },

  setCounts(counts),          // initial load
  setUnseenIds(key, set),     // per-page, on mount
  increment(section, id),     // realtime INSERT — adds id to unseenIds if provided
  resolveItem(section, id),   // realtime UPDATE (item no longer actionable) —
                              //   removes id from unseenIds only if present, then decrements
  markViewed(type, id),       // admin opened item — removes from unseenIds + decrements
}
```

**Key rule:** Page action buttons (Approve, Deny, Verify Payment, etc.) **never call `decrement()` or `markViewed()` directly.** All count-going-down logic flows exclusively through the `resolveItem` realtime UPDATE listener. This prevents double-decrements and keeps all connected admin clients in sync.

---

## Realtime Subscriptions

Set up in `AdminLayout` via `useEffect` on mount, torn down on unmount.

| Channel | Table | Event | Condition | Action |
|---|---|---|---|---|
| `new-bookings` | `bookings` | `INSERT` | — | `increment('bookings', id)` |
| `pending-payments` | `bookings` | `UPDATE` | `downpayment_status` changed to `'paid'` | `increment('bookings', id)` — DB trigger already cleared old viewed row |
| `resolved-bookings` | `bookings` | `UPDATE` | No longer actionable (not pending + not paid downpayment) | `resolveItem('bookings', id)` |
| `new-leave-requests` | `leave_requests` | `INSERT` | — | `increment('leaveRequests', id)` |
| `resolved-leave-requests` | `leave_requests` | `UPDATE` | `status` changed from `'pending'` | `resolveItem('leaveRequests', id)` |
| `new-inquiries` | `inquiries` | `INSERT` | — | `increment('inquiries')` — no unseenIds for inquiries |
| `resolved-inquiries` | `inquiries` | `UPDATE` | `status` changed to `'read'` or `'archived'` | `resolveItem('inquiries')` — decrements count for all connected admins |

**Why `resolveItem` instead of `decrement`:**
`resolveItem` checks `unseenIds.has(id)` before decrementing. If Admin A already opened the item (removing it from `unseenIds`), the listener is a no-op for Admin A. If Admin B hasn't opened it, the listener removes it and decrements Admin B's count. This prevents both the double-decrement and the phantom-badge bugs.

For Inquiries, `resolveItem('inquiries')` doesn't check `unseenIds` (Inquiries doesn't track them) — it just decrements the count unconditionally. The `openInquiry()` flow no longer manually calls `decrement` — the `resolved-inquiries` listener handles it for all clients.

---

## Sidebar Badge UI

`AdminSidebar` reads from `notificationStore.counts`. Each nav item in the `navItems` array gains an optional `badgeKey` (`'bookings'`, `'leaveRequests'`, `'inquiries'`) that maps to the store.

- Badge colour: `#CE845D` (existing rust palette)
- Hidden when count is 0
- Displays `99+` when count exceeds 99

---

## Page-level Highlighting

**On page mount** (Bookings, Leave Requests):
- Call `getUnseenItemIds(adminId, itemType)` → store result via `setUnseenIds`
- Each list row checks `unseenIds.has(item.id)`:
  - **Unseen:** warm tint (`#FEF6F1` background) + rust dot (`#CE845D`, 8px circle) + `font-weight: 600`
  - **Seen:** white background, transparent dot placeholder (for alignment) + `font-weight: 400`

**On item open** (row click / modal open):
- Call `markItemViewed(adminId, itemType, itemId)` — writes to `admin_viewed_items`
- Call `notificationStore.markViewed(itemType, itemId)` — removes from `unseenIds` + decrements
- Row re-renders immediately to seen state; sidebar badge decrements
- When the admin subsequently approves/denies the item, `resolveItem` fires via the realtime UPDATE listener — but since the ID is already gone from `unseenIds`, it's a no-op (no double decrement)

**Inquiries integration:**
- Remove the `notificationStore.decrement('inquiries')` call from `openInquiry()` — the `resolved-inquiries` realtime listener handles decrement for all clients when `markRead()` updates the DB
- `getUnseenItemIds` not needed for Inquiries; each row already knows its `status`

---

## File Checklist

| File | Action |
|---|---|
| `supabase/migrations/` | `admin_viewed_items` table + RLS + 2 DB triggers |
| `src/services/notificationService.js` | New file |
| `src/store/notificationStore.js` | New file |
| `src/components/layout/AdminLayout.jsx` | Add 7 realtime subscription channels |
| `src/components/layout/AdminSidebar.jsx` | Add badge rendering |
| `src/pages/admin/bookings/BookingsPage.jsx` | Add unseen IDs fetch + row highlight + markViewed on open |
| `src/pages/admin/staff/LeaveRequestsPage.jsx` | Add unseen IDs fetch + row highlight + markViewed on open |
| `src/pages/admin/inquiries/InquiriesPage.jsx` | Remove manual decrement; rely on realtime listener |

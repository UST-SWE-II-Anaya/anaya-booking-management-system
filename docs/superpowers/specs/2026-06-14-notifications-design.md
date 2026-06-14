# Admin Notification Badges — Design Spec

**Date:** 2026-06-14
**Status:** Approved

## Overview

Add real-time notification badges to the admin sidebar for Bookings, Leave Requests, and Inquiries. New/unseen items in those pages are highlighted with a dot + warm background tint. Badges clear per-item as the admin opens each one, not per-page-visit.

Future: a notification bell in `AdminHeader` showing recent submissions will be built on this same foundation.

---

## Scope

| Section | Badge condition | Seen tracking |
|---|---|---|
| Bookings | `booking_status = 'pending'` OR `downpayment_status = 'paid'`, AND not viewed | `admin_viewed_items` table |
| Leave Requests | `status = 'pending'` AND not viewed | `admin_viewed_items` table |
| Inquiries | `status = 'unread'` | Existing `markRead()` flow (no changes) |

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

  setCounts(counts),        // initial load
  setUnseenIds(key, set),   // per-page, on mount
  increment(section),       // realtime INSERT
  decrement(section),       // after status change / item viewed
  markViewed(type, id),     // removes ID from unseenIds + decrements
}
```

---

## Realtime Subscriptions

Set up in `AdminLayout` via `useEffect` on mount, torn down on unmount. Four Supabase channels:

| Channel | Table | Event | Action |
|---|---|---|---|
| `new-bookings` | `bookings` | `INSERT` | Increment bookings, add ID to `unseenIds.bookings` |
| `pending-payments` | `bookings` | `UPDATE` | If `downpayment_status → 'paid'`, increment + add ID |
| `new-leave-requests` | `leave_requests` | `INSERT` | Increment leaveRequests, add ID |
| `new-inquiries` | `inquiries` | `INSERT` | Increment inquiries (no unseenIds — page uses `status`) |

Counts going *down* are handled by existing page actions (approve, confirm, etc.) calling `notificationStore.decrement()` after the service call — no extra listener needed.

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
  - **Unseen:** warm tint (`#FEF6F1` background) + rust dot (`#CE845D`, 8px circle)
  - **Seen:** white background, transparent dot placeholder (for alignment)
  - Unseen rows also render the name in `font-weight: 600` vs `400` for seen

**On item open** (row click / modal open):
- Call `markItemViewed(adminId, itemType, itemId)` 
- Call `notificationStore.markViewed(itemType, itemId)`
- Row re-renders immediately to seen state; sidebar badge decrements

**Inquiries integration:**
- The existing `openInquiry()` already calls `markRead()` — add `notificationStore.decrement('inquiries')` there
- `getUnseenItemIds` not needed for Inquiries; each row already knows its `status`

---

## File Checklist

| File | Action |
|---|---|
| `supabase/migrations/` | New migration for `admin_viewed_items` + RLS |
| `src/services/notificationService.js` | New file |
| `src/store/notificationStore.js` | New file |
| `src/components/layout/AdminLayout.jsx` | Add realtime subscription setup |
| `src/components/layout/AdminSidebar.jsx` | Add badge rendering |
| `src/pages/admin/bookings/BookingsPage.jsx` | Add unseen IDs fetch + row highlight + markViewed |
| `src/pages/admin/staff/LeaveRequestsPage.jsx` | Add unseen IDs fetch + row highlight + markViewed |
| `src/pages/admin/inquiries/InquiriesPage.jsx` | Hook `decrement` into existing `markRead` flow |

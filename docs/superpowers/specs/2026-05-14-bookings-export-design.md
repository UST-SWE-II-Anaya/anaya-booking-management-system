# Bookings Export Feature — Design Spec

**Date:** 2026-05-14
**Scope:** Admin bookings page (`/admin/bookings`)

---

## Overview

Add CSV export functionality to the admin Bookings page. Admins use exports primarily for accounting/finance and general data analysis. The feature uses a split button pattern: one click for the common case (export current filter), and a dropdown option for a custom date-range export.

---

## UI: Split Button in Toolbar

The existing toolbar (status filters + search input) gains a split export button aligned to the right, next to the search input.

**Split button structure:**
- Left half: `↓ Export CSV` — immediately exports the current view (no modal)
- Right half: `▾` chevron — opens a small dropdown with two options

**Dropdown options:**
1. **Export current view** — same behavior as the left button (all pages, current status filter + search)
2. **Custom export…** — opens the `ExportBookingsModal`

The left button is a convenience shortcut for option 1.

---

## UI: Custom Export Modal (`ExportBookingsModal`)

A centered modal with the following controls:

| Field | Details |
|---|---|
| Date range (From) | Optional date input. Filters by `appointment_date >= dateFrom` |
| Date range (To) | Optional date input. Filters by `appointment_date <= dateTo` |
| Booking Status | Dropdown: All statuses, Upcoming, Finished, Cancelled, No Show |
| Columns | Fixed — all columns always included (no column picker) |

**Behavior:**
- Leaving date range blank exports all dates for the selected status
- Status defaults to "All statuses"
- Download button triggers export and closes the modal
- Filename format: `bookings-export-YYYY-MM-DD.csv` (date = today)

---

## CSV Columns

Every export (current view or custom) includes these columns in order:

1. Ref ID
2. Customer Name
3. Email
4. Phone
5. Appointment Date
6. Start Time
7. Services (comma-separated service names)
8. Subtotal
9. Downpayment Amount
10. Remaining Balance
11. Booking Status
12. Payment Status
13. Staff
14. Notes
15. Created At

---

## Architecture

### New: `exportBookings` in `src/services/bookingService.js`

```js
exportBookings({ status, search, dateFrom, dateTo } = {})
```

- Uses same `BOOKING_SELECT` fields as `getBookings`
- No `.range()` call — fetches all matching rows
- Filters: `booking_status` (optional), `reference_id ilike` (optional), `appointment_date gte/lte` (optional)
- Returns raw data array; caller builds the CSV

### New: `src/components/admin/bookings/ExportBookingsModal.jsx`

- Receives `open`, `onClose` props
- Manages its own `dateFrom`, `dateTo`, `status` state
- Calls `exportBookings`, builds CSV string client-side, triggers browser download via a temporary `<a>` element
- No external CSV library — plain string builder is sufficient

### Modified: `src/pages/admin/bookings/BookingsPage.jsx`

- Add split button to toolbar
- Add dropdown state (open/closed)
- Add `exportModal` boolean state for the custom modal
- Wire "Export CSV" left button → calls `exportBookings` with current `status` + `search`, downloads directly
- Wire dropdown → renders two options, opens modal on "Custom export…"

---

## Data Flow

1. **Quick export:** Admin clicks `↓ Export CSV` → `exportBookings({ status, search })` called (using current page filters) → CSV built → file downloaded
2. **Custom export:** Admin clicks `▾` → selects "Custom export…" → `ExportBookingsModal` opens → admin sets date range + status → clicks Download → `exportBookings({ status, dateFrom, dateTo })` called → CSV built → file downloaded → modal closes

---

## Out of Scope

- PDF export
- Column picker / selectable columns
- Server-side export (all generation is client-side)
- Scheduled/emailed exports

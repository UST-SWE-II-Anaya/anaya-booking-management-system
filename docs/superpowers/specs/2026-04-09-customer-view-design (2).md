# Customer View — Design Spec
**Date:** 2026-04-09
**Status:** Approved

## Overview

The customer view is the authenticated portal for booking appointments and managing account details. It lives inside the existing Vite + React app (`src/`) — no separate Next.js app. It consists of a 6-step booking wizard, an appointments dashboard, past appointments history, and a profile management section.

---

## Architecture

- **App:** Vite + React (`src/`) — same app as admin/staff/public
- **Auth guard:** New `CustomerRoute` component — mirrors existing `AdminRoute`/`StaffRoute` pattern. Checks `authStore` for authenticated user with `role = 'customer'`, redirects to `/login` if not.
- **Layout:** Reuses existing `PublicLayout` + `Navbar`. The `Navbar` is updated to be auth-aware: unauthenticated shows `Log in / Sign up`, authenticated customer shows `My Appointment / Profile / Log out`.
- **State:** New `bookingStore.js` (Zustand) for booking wizard state, persisted to `sessionStorage`.
- **Supabase client:** `src/services/supabaseClient.js` (existing, no changes)

---

## Routes

All routes inside `CustomerRoute` wrapper:

```
/booking/services           Step 1 — Service selection
/booking/staff              Step 2 — Professional selection
/booking/datetime           Step 3 — Date & time selection
/booking/review             Step 4 — Review & confirm
/booking/payment/:bookingId Step 5 — Down payment
/booking/success/:bookingId Step 6 — Booking confirmed (minimal layout, no nav/footer)
/dashboard                  Appointments list + appointment detail modal
/appointments/history       Past appointments (Finished / Cancelled / No Show)
/profile                    View profile
/profile/edit               Edit profile fields
```

---

## Booking Store (`src/store/bookingStore.js`)

Zustand store, persisted to `sessionStorage`:

```js
{
  cart: [],                  // array of service objects { id, name, category_name, duration_minutes, price }
  staffPreference: 'any',    // 'any' | 'any_female' | 'any_male' | 'specific'
  selectedStaffId: null,     // uuid | null (only when preference = 'specific')
  selectedDate: null,        // 'YYYY-MM-DD'
  selectedTime: null,        // 'HH:MM'
  bookingNotes: '',
  addToCart: fn,
  removeFromCart: fn,
  setStaffPreference: fn,
  setSelectedStaff: fn,
  setDateTime: fn,
  setBookingNotes: fn,
  clearBooking: fn,          // called after booking success
}
```

Derived values (computed, not stored):
- `subtotal` = sum of `cart[].price`
- `totalDuration` = sum of `cart[].duration_minutes`
- `downPaymentAmount` = `subtotal * 0.10` (rate from `site_settings.downpayment_rate`)

---

## Booking Wizard — Step-by-Step

### Persistent Sidebar (Steps 1–4)
All booking steps show "Your Booking" sidebar (right panel) displaying:
- Selected services list with `[Category] ServiceName` format and price
- Total
- Down Payment (10% of Total)
- Total Duration estimate
- `Continue` button (disabled until step requirements met)

### Step 1 — Service Selection (`/booking/services`)
- Same UI as public `ServicesPage` (search bar, category filter pills, grouped service list)
- `+ Add` button adds service to `bookingStore.cart`; button toggles to `- Remove` if already in cart
- On load: if URL has `?service=<id>` param, auto-add that service to cart
- `Continue` enabled when `cart.length > 0`
- Service data: calls `getAllActiveServices()` from `servicesCmsService.js`

### Step 2 — Professional Selection (`/booking/staff`)
- Step guard: redirect to `/booking/services` if cart is empty
- Calls `get_staff_list()` RPC — returns `{ id, first_name, last_name, avatar_url }` for active staff
- Three generic option cards at top: "Any professional", "Any female professional", "Any male professional"
- Specific staff cards listed directly below (no separate "Specific" toggle)
- Clicking any card immediately saves preference + optional `selectedStaffId` to store and advances to next step
- `Continue` in sidebar enabled only after selection

### Step 3 — Date & Time (`/booking/datetime`)
- Step guard: redirect to `/booking/staff` if no staff preference set
- Calendar renders current month, defaults to today
- On date click: calls `get_available_slots(staffId, date, preference)` RPC
  - `staffId`: `selectedStaffId` if preference is `'specific'`, `null` otherwise
  - `preference`: value from `bookingStore.staffPreference`
  - Returns `[{ start_time, duration_minutes }]` representing blocked intervals
- Client generates all 30-min slots from `09:00` to `19:30`
- A slot is blocked if it falls within any existing booking's time range (`start_time` to `start_time + duration_minutes`)
- Blocked slots render grayed out but visible
- Selected slot highlights in accent color
- `Continue` enabled after a slot is selected

### Step 4 — Review & Confirm (`/booking/review`)
- Step guard: redirect to `/booking/datetime` if no date/time set
- Displays: Cancellation Policy text, Important Info (securing slot, final pricing, 12-hour time limit)
- "Your Booking" sidebar shows: date, time range (start to start+duration), services, subtotal, total, down payment, "Pay at venue" balance
- Booking Notes textarea → saved to `bookingStore.bookingNotes`
- Two action buttons:
  - **"Reserve Appointment"** — calls `create_booking()` RPC, navigates to `/dashboard` on success
  - **"Reserve Appointment and Proceed to Payment"** — calls `create_booking()` RPC, navigates to `/booking/payment/:bookingId` on success
- On `SLOT_UNAVAILABLE` error: navigate back to `/booking/datetime` with toast "This time slot was just taken — please choose another."

### Step 5 — Down Payment (`/booking/payment/:bookingId`)
- Fetches booking by `bookingId` to confirm amount
- Displays two GCash QR code images (GCASH #1 and GCASH #2) — stored as static assets
- Payment details form:
  - Reference Number (13 digits, required)
  - Account Name (required)
  - Receipt upload (JPG/JPEG, max 5MB, drag-and-drop or click)
- On `Confirm`:
  1. Upload receipt to Supabase Storage: `payment-receipts/<bookingId>/<filename>`
  2. Insert to `payments` table: `{ booking_id, reference_number, account_name, receipt_url, amount, status: 'paid' }`
  3. Update `bookings.downpayment_status` to `'paid'`
  4. Navigate to `/booking/success/:bookingId`
- "Go Back to My Appointment" link at top

### Step 6 — Booking Confirmed (`/booking/success/:bookingId`)
- Minimal centered card layout (no nav, no footer)
- Green checkmark icon, "Booking Confirmed!" heading
- Booking Summary card: date, time range, services list, total, down payment paid, remaining balance ("To be paid at the venue")
- "Back to Home" button: clears `bookingStore`, navigates to `/dashboard`

---

## Dashboard (`/dashboard`)

### Empty State
- Calendar icon, "No active appointments yet." message
- Two buttons: "Book an appointment" (`/booking/services`) and "View Past Appointments" (`/appointments/history`)

### Active State
Appointment cards in a list. Each card shows:
- Appointment ID (`# XXX` from `reference_id`), Date, Time, Duration, Services (`[Category] ServiceName` format), Balance (remaining)
- Appointment Status badge: `Upcoming` / `Finished` / `Cancelled` / `No Show`
- Down Payment Status badge: `Pending` / `Checking` / `Paid` / `Denied`
  - DB mapping: `pending`→"Pending", `paid`→"Checking", `verified`→"Paid", `denied`→"Denied"
- Down Payment Total
- "Time left to pay: X hours" countdown — only visible when `downpayment_status = 'pending'` and `payment_deadline` not expired
- Action buttons (visible on card for pending appointments):
  - "Pay Down Payment" → opens detail modal with pay action
  - "Cancel Reservation" → confirm dialog, calls `cancelMyBooking()` (only within 12h of creation)
- "View Past Appointments" link top-right

### Appointment Detail Modal
Overlay on the dashboard. Shows:
- ID, date, time range
- Services list with `[Group/Category] ServiceName`, duration, price per service
- Professional preference
- Booking Notes (if any)
- Subtotal, Total, Down Payment (10%), Balance (Pay at venue)
- "Pay Down Payment" button (only if `downpayment_status = 'pending'`) → navigates to `/booking/payment/:bookingId`
- Close (×) button

---

## Past Appointments (`/appointments/history`)

- Lists bookings with `booking_status` of `finished`, `cancelled`, or `no_show`
- Same card layout as dashboard but no action buttons
- Empty state: "No past appointments." + "Book an appointment" + "Back" buttons
- "Go Back" link to `/dashboard`

---

## Profile (`/profile`)

### View Mode
- Avatar with edit pencil icon (clicking avatar opens file picker for new photo)
- Fields displayed (read-only): First Name, Last Name, Phone Number, Date of Birth, Gender
- "Edit" button → navigates to `/profile/edit`

### Edit Mode (`/profile/edit`)
- Form with: First Name, Last Name, Phone Number, Date of Birth, Gender
- "Cancel" → back to `/profile`
- "Save" → calls `updateMyProfile()`, back to `/profile` on success
- Avatar upload: on file select, upload to `avatars/<userId>/<filename>` in Supabase Storage, call `updateMyProfile({ avatar_url })` immediately

---

## New Service Files

### `src/services/customerBookingService.js`
- `createBooking(payload)` — calls `create_booking` RPC (see Supabase section)
- `getMyBookings()` — fetches all bookings for current user with `booking_status` in `['upcoming']`, joined to `booking_services.services`
- `getMyPastBookings()` — same but `booking_status` in `['finished', 'cancelled', 'no_show']`
- `getMyBookingById(id)` — single booking with full detail including `payments`
- `cancelMyBooking(id)` — updates `booking_status` to `'cancelled'`, sets `cancelled_at` and `cancelled_by`

### `src/services/availabilityService.js`
- `getAvailableSlots(staffId, date, preference)` — calls `get_available_slots` RPC, returns `[{ start_time, duration_minutes }]` of blocked intervals

### `src/services/customerProfileService.js`
- `getMyProfile()` — fetches own profile from `profiles` table
- `updateMyProfile(payload)` — updates `first_name`, `last_name`, `phone_number`, `date_of_birth`, `gender`, `avatar_url`
- `uploadAvatar(file, userId)` — uploads to `avatars/<userId>/<filename>`, returns public URL

---

## Supabase Additions (Migrations)

### Storage Buckets
- `payment-receipts` — private. Customer INSERT to `<bookingId>/*`. Admin SELECT all.
- `avatars` — private uploads, public read. Customer INSERT/UPDATE to `<userId>/*`.

### RPC: `get_staff_list()`
```sql
-- Returns id, first_name, last_name, avatar_url for active staff
-- SECURITY DEFINER to bypass RLS on profiles
```

### RPC: `get_available_slots(p_staff_id uuid, p_date date, p_preference text)`
```sql
-- p_staff_id: uuid for 'specific' preference, null otherwise
-- p_preference: 'any' | 'any_female' | 'any_male' | 'specific'
-- For 'specific': returns booked intervals for that staff member
-- For 'any': a slot is blocked only when ALL active staff are booked at that time
-- For 'any_female'/'any_male': a slot is blocked when ALL active staff of that gender are booked
-- Returns [{start_time, duration_minutes}] representing blocked intervals
-- SECURITY DEFINER — no private booking data exposed
```

### RPC: `create_booking(payload jsonb)`
```sql
-- 1. Acquire advisory lock on (staff_id, appointment_date)
-- 2. Re-check for overlapping non-cancelled bookings
-- 3. If overlap: raise exception 'SLOT_UNAVAILABLE'
-- 4. If clear: insert bookings row + booking_services rows atomically
-- 5. Set payment_deadline = now() + interval '12 hours'
-- 6. Return created booking {id, reference_id, ...}
```

Overlap check logic: a slot overlaps if any existing booking's interval
`[start_time, start_time + duration_minutes)` intersects with the new booking's interval.

---

## Downpayment Auto-Cancellation

A PostgreSQL scheduled job (via `pg_cron` or Supabase's existing `fix_low_auto_cancel_expired_bookings` migration) already handles auto-cancelling bookings whose `payment_deadline` has passed and `downpayment_status = 'pending'`. No new work needed here — verify the existing migration covers this.

---

## Out of Scope
- Email confirmation after booking (requires Edge Function or third-party email service)
- Password change (can be added to `/profile/edit` in a follow-up)
- Push notifications
- Rescheduling appointments

# Customer Booking Flow QA Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs in the customer booking flow identified in the QA report (duplicate bookings, state loss on back-navigation, broken Go Back links, misleading reference number placeholder, off-putting staff icon). GCash QR codes (QA issue #5) are already fully planned at `docs/superpowers/plans/2026-04-19-gcash-qr-management.md` — do not re-implement.

**Architecture:** Issues #1, #2, and #3 share the same root cause — `clearBooking()` is called in `ReviewStep` *before* the user confirms payment, so any back-navigation finds an empty store and either redirects unexpectedly or allows a fresh duplicate submission. The fix is two-pronged: (a) stop calling `clearBooking()` on the "proceed to payment" path (defer it to `SuccessPage`, where it already exists), and (b) add an idempotency key to the `bookings` table + `create_booking` RPC so that clicking "Reserve" again after going back returns the existing booking instead of inserting a duplicate. Issues #4 and #6 are isolated one-line/one-SVG changes.

**Tech Stack:** React (Vite), Zustand + sessionStorage, Supabase (PostgreSQL RPC via MCP), Vitest, Tailwind CSS v4

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/store/bookingStore.js` |
| Modify | `src/store/bookingStore.test.js` |
| Modify | `src/pages/customer/ReviewStep.jsx` |
| Modify | `src/pages/customer/PaymentStep.jsx` |
| Modify | `src/pages/customer/StaffStep.jsx` |
| DB via MCP | `bookings` table + `create_booking` RPC (project `snsukbyaljveqrptvuwm`) |

---

## Task 1: DB — Add `idempotency_key` to `bookings` and update `create_booking` RPC

**Files:** Applied via Supabase MCP (no local migration files in this repo)

- [ ] **Step 1: Apply the column migration**

Use `mcp__supabase-mcp-server__apply_migration` with:
- `project_id`: `snsukbyaljveqrptvuwm`
- `name`: `add_idempotency_key_to_bookings`
- `query`:

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD CONSTRAINT bookings_idempotency_key_unique UNIQUE (idempotency_key);
```

- [ ] **Step 2: Update the `create_booking` RPC to support idempotency**

Use `mcp__supabase-mcp-server__apply_migration` with:
- `name`: `update_create_booking_idempotency`
- `query` (full function replacement):

```sql
CREATE OR REPLACE FUNCTION public.create_booking(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_booking_id        uuid;
  v_staff_id          uuid;
  v_date              date;
  v_start_time        time;
  v_duration          integer;
  v_preference        professional_preference;
  v_deadline_hours    integer;
  v_idempotency_key   text;
  v_result            jsonb;
BEGIN
  v_staff_id          := (payload->>'staff_id')::uuid;
  v_date              := (payload->>'appointment_date')::date;
  v_start_time        := (payload->>'start_time')::time;
  v_duration          := (payload->>'total_duration_minutes')::integer;
  v_preference        := COALESCE(
    (payload->>'professional_preference')::professional_preference,
    'any'::professional_preference
  );
  v_idempotency_key   := NULLIF(payload->>'idempotency_key', '');

  -- If an idempotency key is provided and a matching booking already exists
  -- for the current user, return it instead of inserting a duplicate.
  IF v_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id',               b.id,
      'reference_id',     b.reference_id,
      'appointment_date', b.appointment_date,
      'start_time',       b.start_time,
      'payment_deadline', b.payment_deadline
    ) INTO v_result
    FROM bookings b
    WHERE b.idempotency_key = v_idempotency_key
      AND b.customer_id = auth.uid();

    IF v_result IS NOT NULL THEN
      RETURN v_result;
    END IF;
  END IF;

  -- Read payment deadline window from site_settings (fallback: 12 hours)
  SELECT COALESCE((value->>'hours')::integer, 12)
  INTO v_deadline_hours
  FROM public.site_settings
  WHERE key = 'payment_deadline_hours';

  IF v_deadline_hours IS NULL THEN
    v_deadline_hours := 12;
  END IF;

  -- Advisory lock: prevents concurrent double-booking for same staff+date
  PERFORM pg_advisory_xact_lock(
    hashtext(COALESCE(v_staff_id::text, 'any') || v_date::text)
  );

  -- Only check slot conflicts when a specific staff member is requested
  IF v_staff_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.staff_id = v_staff_id
      AND b.appointment_date = v_date
      AND b.booking_status != 'cancelled'
      AND (b.start_time, b.start_time + (b.total_duration_minutes * interval '1 minute'))
          OVERLAPS
          (v_start_time, v_start_time + (v_duration * interval '1 minute'))
  ) THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
  END IF;

  v_booking_id := gen_random_uuid();

  -- reference_id is auto-set by the BEFORE INSERT trigger set_reference_id_bookings()
  INSERT INTO bookings (
    id, customer_id, staff_id, professional_preference,
    appointment_date, start_time, total_duration_minutes,
    subtotal, downpayment_amount, remaining_balance,
    booking_status, downpayment_status, payment_deadline, booking_notes,
    idempotency_key
  ) VALUES (
    v_booking_id,
    auth.uid(),
    v_staff_id,
    v_preference,
    v_date,
    v_start_time,
    v_duration,
    (payload->>'subtotal')::numeric,
    (payload->>'downpayment_amount')::numeric,
    (payload->>'remaining_balance')::numeric,
    'upcoming',
    'pending',
    now() + (v_deadline_hours || ' hours')::interval,
    NULLIF(payload->>'booking_notes', ''),
    v_idempotency_key
  );

  INSERT INTO booking_services (booking_id, service_id, price_at_booking, duration_at_booking)
  SELECT
    v_booking_id,
    (svc->>'id')::uuid,
    (svc->>'price')::numeric,
    (svc->>'duration_minutes')::integer
  FROM jsonb_array_elements(payload->'services') AS svc;

  SELECT jsonb_build_object(
    'id',               b.id,
    'reference_id',     b.reference_id,
    'appointment_date', b.appointment_date,
    'start_time',       b.start_time,
    'payment_deadline', b.payment_deadline
  ) INTO v_result
  FROM bookings b WHERE b.id = v_booking_id;

  RETURN v_result;
END;
$function$;
```

- [ ] **Step 3: Verify the column exists**

Use `mcp__supabase-mcp-server__execute_sql`:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'idempotency_key';
```

Expected: 1 row — `idempotency_key | text | YES`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add idempotency_key to bookings and update create_booking RPC"
```

---

## Task 2: Update `bookingStore.js` — add session key field (TDD)

**Files:**
- Modify: `src/store/bookingStore.js`
- Modify: `src/store/bookingStore.test.js`

- [ ] **Step 1: Write the failing tests**

Open `src/store/bookingStore.test.js`. Update the `reset` helper and add two new tests:

```js
// Update the reset helper (add bookingSessionKey: null)
const reset = () =>
  useBookingStore.setState({
    cart: [],
    staffPreference: 'any',
    selectedStaffId: null,
    selectedDate: null,
    selectedTime: null,
    bookingNotes: '',
    bookingSessionKey: null,
  })

// Add these two tests inside describe('bookingStore'):

it('setBookingSessionKey stores the provided key', () => {
  useBookingStore.getState().setBookingSessionKey('test-uuid-1234')
  expect(useBookingStore.getState().bookingSessionKey).toBe('test-uuid-1234')
})

it('clearBooking resets bookingSessionKey to null', () => {
  useBookingStore.setState({ bookingSessionKey: 'existing-uuid' })
  useBookingStore.getState().clearBooking()
  expect(useBookingStore.getState().bookingSessionKey).toBeNull()
})
```

Also update the existing `'clearBooking resets all state'` test to assert `bookingSessionKey` is null:

```js
it('clearBooking resets all state', () => {
  useBookingStore.setState({
    cart: [{ id: '1' }],
    selectedDate: '2026-04-20',
    selectedTime: '10:00',
    staffPreference: 'any_female',
    bookingNotes: 'Note',
    bookingSessionKey: 'some-uuid',
  })
  useBookingStore.getState().clearBooking()
  const s = useBookingStore.getState()
  expect(s.cart).toHaveLength(0)
  expect(s.selectedDate).toBeNull()
  expect(s.selectedTime).toBeNull()
  expect(s.staffPreference).toBe('any')
  expect(s.bookingNotes).toBe('')
  expect(s.bookingSessionKey).toBeNull()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/store/bookingStore.test.js
```

Expected: FAIL — `setBookingSessionKey is not a function`

- [ ] **Step 3: Update `src/store/bookingStore.js`**

Replace the entire file with:

```js
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useBookingStore = create(
  persist(
    (set) => ({
      cart: [],
      staffPreference: 'any',
      selectedStaffId: null,
      selectedDate: null,
      selectedTime: null,
      bookingNotes: '',
      bookingSessionKey: null,
      addToCart: (service) =>
        set((s) => ({ cart: [...s.cart, service] })),
      removeFromCart: (id) =>
        set((s) => ({ cart: s.cart.filter((item) => item.id !== id) })),
      setStaffPreference: (pref) =>
        set({ staffPreference: pref, selectedStaffId: null }),
      setSelectedStaff: (id) => set({ selectedStaffId: id }),
      setDateTime: (date, time) =>
        set({ selectedDate: date, selectedTime: time }),
      setBookingNotes: (notes) => set({ bookingNotes: notes }),
      setBookingSessionKey: (key) => set({ bookingSessionKey: key }),
      clearBooking: () =>
        set({
          cart: [],
          staffPreference: 'any',
          selectedStaffId: null,
          selectedDate: null,
          selectedTime: null,
          bookingNotes: '',
          bookingSessionKey: null,
        }),
    }),
    {
      name: 'booking-store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

export default useBookingStore
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/store/bookingStore.test.js
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/bookingStore.js src/store/bookingStore.test.js
git commit -m "feat: add bookingSessionKey to bookingStore for idempotency"
```

---

## Task 3: Update `ReviewStep.jsx` — idempotency key + preserve state through payment

**Files:**
- Modify: `src/pages/customer/ReviewStep.jsx`

This fixes QA issues #1 (duplicate bookings), #2 (state loss), and #3 (broken Go Back).

The two changes are:
1. Generate a `bookingSessionKey` on mount and include it in `buildPayload()`.
2. Remove the `clearBooking()` call from the "proceed to payment" path. The state must survive until `SuccessPage.handleBackHome()`, which already calls `clearBooking()`. Going back from the payment page will find the intact store, and repeating "Reserve" will return the existing booking via idempotency key.

- [ ] **Step 1: Update `ReviewStep.jsx`**

Replace the entire file with:

```jsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useBookingStore from '../../store/bookingStore'
import { createBooking } from '../../services/customerBookingService'
import { formatDuration } from '../../utils/bookingUtils'
import useSiteSettings from '../../hooks/useSiteSettings'

const to12h = (time24) => {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const ReviewStep = () => {
  const navigate = useNavigate()
  const {
    cart,
    staffPreference,
    selectedStaffId,
    selectedDate,
    selectedTime,
    bookingNotes,
    setBookingNotes,
    clearBooking,
    bookingSessionKey,
    setBookingSessionKey,
  } = useBookingStore()
  const [submitting, setSubmitting] = useState(false)
  // Tracks a successful submit so the date-guard below doesn't fire
  // and override the post-booking navigation when clearBooking() wipes the dates.
  const submittedRef = useRef(false)
  const { settings } = useSiteSettings()

  // Generate a session-scoped idempotency key the first time the user lands
  // on this page. Persisted in sessionStorage so a back-navigation from the
  // payment page reuses the same key and the RPC returns the existing booking
  // instead of creating a duplicate.
  useEffect(() => {
    if (!bookingSessionKey) {
      setBookingSessionKey(crypto.randomUUID())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!submittedRef.current && (!selectedDate || !selectedTime)) {
    navigate('/booking/datetime', { replace: true })
    return null
  }

  const subtotal = cart.reduce((sum, s) => sum + Number(s.price), 0)
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0)
  const downpaymentPct = (settings?.downpayment_rate?.percentage ?? 10) / 100
  const downPayment = subtotal * downpaymentPct
  const downpaymentLabel = `${settings?.downpayment_rate?.percentage ?? 10}% of Total`
  const balance = subtotal - downPayment

  const [startH, startM] = selectedTime.split(':').map(Number)
  const endTotal = startH * 60 + startM + totalDuration
  const endHH = String(Math.floor(endTotal / 60)).padStart(2, '0')
  const endMM = String(endTotal % 60).padStart(2, '0')
  const endTime = `${endHH}:${endMM}`

  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  )

  const buildPayload = () => ({
    staff_id: selectedStaffId,
    professional_preference: staffPreference,
    appointment_date: selectedDate,
    start_time: selectedTime,
    total_duration_minutes: totalDuration,
    subtotal,
    downpayment_amount: downPayment,
    remaining_balance: balance,
    booking_notes: bookingNotes,
    idempotency_key: bookingSessionKey,
    services: cart.map((s) => ({
      id: s.id,
      price: s.price,
      duration_minutes: s.duration_minutes,
    })),
  })

  const handleReserve = async (goToPayment = false) => {
    setSubmitting(true)
    try {
      const booking = await createBooking(buildPayload())
      submittedRef.current = true
      if (goToPayment) {
        // Do NOT call clearBooking() here — the user may navigate back from
        // the payment page and the store state must remain intact so that
        // (a) the review page renders correctly and (b) a repeated "Reserve"
        // click returns the same booking via the idempotency key.
        // clearBooking() is called by SuccessPage.handleBackHome() after payment.
        navigate(`/booking/payment/${booking.id}`)
      } else {
        clearBooking()
        navigate('/dashboard')
      }
    } catch (err) {
      if (err.message === 'SLOT_UNAVAILABLE') {
        toast.error('This time slot was just taken — please choose another.')
        navigate('/booking/datetime')
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          to="/booking/datetime"
          className="text-sm text-gray-500 hover:underline mb-4 inline-block"
        >
          ← Go Back to Previous Page
        </Link>
        <div className="flex gap-8 items-start">
          {/* Left: policies + notes */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-6">
              Review and Confirm
            </h1>

            <div className="mb-5">
              <h2 className="font-semibold text-anaya-text mb-2">
                Cancellation Policy
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                You are free to cancel this booking request up to{' '}
                <strong>{settings?.cancellation_window?.hours ?? 12} hours</strong>{' '}
                of the initial appointment reservation time, as long as you
                haven't completed the down payment step. Please finalize your
                payment to secure your slot.
              </p>
            </div>

            <div className="mb-5">
              <h2 className="font-semibold text-anaya-text mb-2">
                Important info
              </h2>
              <ul className="space-y-2 text-sm text-gray-600 leading-relaxed">
                <li>
                  <span className="font-medium text-anaya-text">
                    Securing Your Slot:{' '}
                  </span>
                  To finalize your appointment, a non-refundable down payment
                  is required.
                </li>
                <li>
                  <span className="font-medium text-anaya-text">
                    Final Pricing:{' '}
                  </span>
                  We apply all eligible discounts in person during your visit.
                </li>
                <li>
                  <span className="font-medium text-anaya-text">
                    Time Limit:{' '}
                  </span>
                  We will tentatively reserve this time for you! Please
                  complete your payment within the next{' '}
                  <strong>{settings?.cancellation_window?.hours ?? 12} hours</strong>{' '}
                  to keep this appointment from expiring once reserved.
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h2 className="font-semibold text-anaya-text mb-2">
                Booking Notes
              </h2>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-anaya-accent bg-white"
                rows={4}
                placeholder="Include comments or requests about your booking"
              />
            </div>
          </div>

          {/* Right: booking summary + actions */}
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl p-5 h-fit sticky top-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-3 text-anaya-text">
              Your Booking
            </h2>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{displayDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>
                {to12h(selectedTime)} – {to12h(endTime)}{' '}
                ({formatDuration(totalDuration)})
              </span>
            </div>

            <ul className="space-y-2 mb-4">
              {cart.map((s) => (
                <li key={s.id} className="flex justify-between text-sm text-anaya-text">
                  <div className="flex-1 pr-2">
                    <p className="font-medium leading-snug">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDuration(s.duration_minutes)} with any professional
                    </p>
                  </div>
                  <span className="font-medium shrink-0">
                    ₱{Number(s.price).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal:</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-anaya-text">
                <span>Total:</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>
                  Down Payment
                  <br />
                  <span className="text-xs">({downpaymentLabel}):</span>
                </span>
                <span>₱{downPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Pay at venue:</span>
                <span>₱{balance.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleReserve(false)}
                disabled={submitting}
                className="w-full border border-anaya-accent text-anaya-accent py-2.5 rounded-lg text-sm font-medium hover:bg-anaya-accent/5 transition-colors disabled:opacity-50"
              >
                Reserve Appointment
              </button>
              <button
                onClick={() => handleReserve(true)}
                disabled={submitting}
                className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Reserve Appointment and
                <br />
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewStep
```

- [ ] **Step 2: Run the full test suite to catch regressions**

```bash
npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/ReviewStep.jsx
git commit -m "fix: add idempotency key to booking payload and preserve state through payment flow"
```

---

## Task 4: Fix misleading reference number placeholder in `PaymentStep.jsx`

**Files:**
- Modify: `src/pages/customer/PaymentStep.jsx`

The field label says "13 digits" but the placeholder `e.g. 1234567890ABC` includes letters, which contradicts the 13-digit-only validation (`/^\d{13}$/`).

- [ ] **Step 1: Fix the placeholder**

In `src/pages/customer/PaymentStep.jsx`, find the reference number input (around line 204) and change:

```jsx
placeholder="e.g. 1234567890ABC"
```

to:

```jsx
placeholder="e.g. 1234567890123"
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/PaymentStep.jsx
git commit -m "fix: correct reference number placeholder to show digits only"
```

---

## Task 5: Fix "Any professional" icon in `StaffStep.jsx`

**Files:**
- Modify: `src/pages/customer/StaffStep.jsx`

The current icon — two equal circles side-by-side with a curved path beneath — can read as a face (eyes + frown) at small icon size. Replace with a depth-layered two-figure design where a smaller background figure and a larger foreground figure clearly communicate "a group of people."

- [ ] **Step 1: Update the SVG icon (lines 14–20)**

In `src/pages/customer/StaffStep.jsx`, replace the `icon` value for the `'any'` entry in `GENERIC_OPTIONS`:

```jsx
// Before:
icon: (
  <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
    <circle cx="14" cy="13" r="5" fill="currentColor" opacity="0.7" />
    <circle cx="26" cy="13" r="5" fill="currentColor" opacity="0.9" />
    <path d="M4 34c0-6 4.5-10 10-10h12c5.5 0 10 4 10 10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.7" />
  </svg>
),

// After:
icon: (
  <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
    {/* Background figure — smaller, offset right */}
    <circle cx="25" cy="12" r="5" fill="currentColor" opacity="0.45" />
    <path d="M15 34c0-5.5 4-9 10-9h6c6 0 9 3.5 9 9"
      stroke="currentColor" strokeWidth="2" fill="none" opacity="0.45" />
    {/* Foreground figure — larger, offset left */}
    <circle cx="16" cy="14" r="6" fill="currentColor" opacity="0.9" />
    <path d="M4 34c0-6 4.5-10 12-10s12 4 12 10"
      stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9" />
  </svg>
),
```

- [ ] **Step 2: Start the dev server and visually verify**

```bash
npm run dev
```

Navigate to `/booking/staff`. Confirm the "Any professional" card shows two clearly distinct overlapping figures — a larger one in front and a smaller one behind — with no face-like ambiguity.

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/StaffStep.jsx
git commit -m "fix: update Any professional icon to clearly depict a group of people"
```

---

## Verification — End-to-End Test

After all tasks complete, perform this manual QA walkthrough:

1. **Duplicate booking test (issues #1, #2, #3):**
   - Log in as a customer
   - Complete the full booking flow through the Review page
   - Click "Reserve Appointment and Proceed to Payment"
   - On the payment page, click the browser **Back** button
   - Confirm the Review page shows your original services/date/time (state preserved)
   - Click "Reserve Appointment and Proceed to Payment" again
   - Confirm you are navigated to the **same** payment URL (`/booking/payment/<same-id>`)
   - In Supabase dashboard, confirm only **one** booking row exists for this session

2. **Go Back navigation test (issue #3):**
   - On the Review page, click "← Go Back to Previous Page"
   - Confirm you land on DateTimeStep with your date/time visible
   - Click "← Go Back to Previous Page" from DateTimeStep
   - Confirm you land on StaffStep with your preference visible
   - Confirm no unexpected redirect to ServicesStep

3. **Reference number placeholder (issue #4):**
   - Navigate to any booking's payment page
   - Confirm the Reference Number field shows `e.g. 1234567890123` (digits only)

4. **Staff icon (issue #6):**
   - Navigate to `/booking/staff`
   - Confirm "Any professional" card shows two overlapping figures (not a face)

5. **Run the full test suite:**
   ```bash
   npx vitest run
   ```
   Expected: all tests pass

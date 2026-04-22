# Booking Flow One-Way Door — Design Spec

**Date:** 2026-04-22
**Status:** Approved
**Relates to:** `docs/superpowers/plans/2026-04-20-booking-flow-qa-fixes.md`

---

## Problem

The existing QA fix plan introduced an idempotency key to prevent duplicate bookings on back-navigation, but two critical flaws remain:

1. **Stale idempotency key:** The key is generated once and persisted. If the user edits their cart or date/time and clicks Reserve again, the DB returns the *old* booking unchanged — customer pays for the wrong services or time slot.
2. **Self-blocking slot:** Resetting the key on cart/datetime change generates a new booking attempt, but the previous pending booking still occupies the slot for up to 12 hours, causing a `SLOT_UNAVAILABLE` error against the customer's own prior attempt.

## Solution

Rather than solve these problems technically, eliminate the scenario entirely: **reservation is a one-way door**. Once the customer clicks either Reserve button, the booking store is cleared and they cannot navigate back to the booking summary screen. To change details, they must cancel the booking and re-book.

This makes the idempotency key's only remaining job double-click protection (same session key = same booking returned), which the existing plan already handles correctly.

---

## Architecture

### What does NOT change from the existing plan

- Task 1 (DB `idempotency_key` column + updated `create_booking` RPC) — kept as-is for double-click protection.
- Task 2 (`bookingSessionKey` in Zustand store) — kept as-is.
- Task 3 `bookingSessionKey` generation on ReviewStep mount — kept as-is.
- Tasks 4 and 5 (PaymentStep placeholder fix, StaffStep icon) — unchanged.

### What changes / is added

Four targeted changes replace the stale-key and self-blocking problems:

---

### Change 1 — ReviewStep: `handleReserve` + date guard

**File:** `src/pages/customer/ReviewStep.jsx`

**`handleReserve(true)` (Reserve + Payment path):**

```
clearBooking()
navigate('/booking/payment/' + booking.id, { replace: true })
```

- `clearBooking()` wipes all store state (cart, dates, `bookingSessionKey`) before leaving.
- `replace: true` removes `/booking/review` from the browser history stack so it cannot be reached by pressing back.
- `submittedRef` is no longer needed — the component unmounts immediately after `clearBooking()` + `navigate`, so the date guard never has a chance to fire.

**`handleReserve(false)` (Reserve without payment path):**
No change — already calls `clearBooking()` then `navigate('/dashboard')`.

**Date guard:**
```
// Before
navigate('/booking/datetime', { replace: true })

// After
navigate('/dashboard', { replace: true })
```

If the user somehow lands on `/booking/review` with an empty store, they are sent to booking management rather than deeper into the booking flow.

---

### Change 2 — PaymentStep: native back button interception

**File:** `src/pages/customer/PaymentStep.jsx`

Add a `useEffect` on mount:

```js
useEffect(() => {
  window.history.pushState(null, '')
  const handlePopState = () => navigate('/dashboard', { replace: true })
  window.addEventListener('popstate', handlePopState)
  return () => window.removeEventListener('popstate', handlePopState)
}, [])
```

**How it works:**
- `pushState` adds a duplicate `/payment` entry so the first back press fires `popstate` while staying on the same URL.
- The `popstate` handler redirects to `/dashboard` with `replace: true`, overwriting the `/payment` entry.
- On unmount (e.g., successful payment → success page), the listener is cleaned up automatically — it never interferes with the success flow.
- The existing `← Go Back to My Appointment` `<Link to="/dashboard">` already covers the UI back button; this `useEffect` adds native back button coverage.

---

### Change 3 — StaffStep: retarget empty-cart guard

**File:** `src/pages/customer/StaffStep.jsx`

```js
// Before
if (cart.length === 0) navigate('/booking/services', { replace: true })

// After
if (cart.length === 0) navigate('/dashboard', { replace: true })
```

After `clearBooking()`, an empty cart on StaffStep means the user navigated here after reserving. Send them to booking management.

---

### Change 4 — DateTimeStep: add empty-cart guard

**File:** `src/pages/customer/DateTimeStep.jsx`

Add as the first guard (before any other logic):

```js
if (cart.length === 0) {
  navigate('/dashboard', { replace: true })
  return null
}
```

DateTimeStep has no guard today. An empty cart here is always invalid — users must select services before reaching this step.

---

## Data Flow After "Reserve + Payment"

```
User clicks "Reserve + Proceed to Payment"
  → handleReserve(true) fires
  → createBooking(payload) succeeds
  → clearBooking() — store wiped, bookingSessionKey = null
  → navigate('/booking/payment/:id', { replace: true })
     — review page removed from history

History stack: /services → /staff → /datetime → /payment

PaymentStep mounts
  → pushState adds duplicate: /services → /staff → /datetime → /payment → /payment

User presses native back
  → first /payment entry → popstate fires
  → navigate('/dashboard', { replace: true })
  → history: /services → /staff → /datetime → /dashboard

User presses back again from /dashboard
  → /datetime — empty cart → guard fires → /dashboard (replace)
  → no way to re-enter the booking flow with stale state
```

---

## What is NOT protected

- **ServicesStep** remains reachable after reserving. This is intentional — it is the legitimate entry point for starting a fresh booking.
- Direct URL navigation to `/booking/review` with no store state redirects to `/dashboard` (the updated date guard), not back into the flow.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/customer/ReviewStep.jsx` | `clearBooking()` before payment nav; `replace: true`; retarget date guard; remove `submittedRef` |
| `src/pages/customer/PaymentStep.jsx` | Add `popstate` intercept `useEffect` |
| `src/pages/customer/StaffStep.jsx` | Retarget empty-cart guard to `/dashboard` |
| `src/pages/customer/DateTimeStep.jsx` | Add empty-cart guard → `/dashboard` |

No DB changes beyond what Task 1 already specifies. No new store fields.

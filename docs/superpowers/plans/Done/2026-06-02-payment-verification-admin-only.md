# Plan: Restrict Payment Verification to Admin Only

## Context

Currently, both **Admin** and **Staff** can verify or deny customer payments through `PaymentVerificationModal`. Staff trigger this via "Review Payment" and "Approve Appointment" buttons on `AppointmentsPage`. The goal is to move all payment verification authority exclusively to Admin, while:

- Giving staff a **read-only view** of submitted payment details
- **Blocking staff from claiming** appointments that have a pending/submitted payment (since claiming was the prerequisite for the now-removed verify action)
- **Enforcing the restriction at the DB level** via a Supabase RLS policy on the `payments` table

---

## Changes Required

### 1. `src/pages/staff/AppointmentsPage.jsx`

The `AppointmentCard` component inside this file currently renders two conditional buttons:

- **"Approve Appointment"** — shown when `downpayment_status === 'pending'` and `staff_id` is set
- **"Review Payment"** — shown when `downpayment_status === 'paid'` and `staff_id` is set

**Changes:**
- Remove both buttons and their `onClick` handlers that open `PaymentVerificationModal` for action
- Add a **read-only "View Payment" button** (neutral styling) that opens `PaymentVerificationModal` with `readOnly={true}` when `downpayment_status` is `'paid'` or `'pending'`
- **Block the "Claim" button** when `downpayment_status` is `'paid'` or `'pending'` — replace it with a static badge/label such as "Awaiting admin payment review" so staff understand why they cannot claim

**Logic summary:**
```
if downpayment_status is 'paid' or 'pending':
  → show "View Payment" (read-only) button
  → hide "Claim" button, show "Awaiting payment review" label instead
else:
  → show "Claim" / "Unclaim" as before
```

### 2. `src/components/admin/payments/PaymentVerificationModal.jsx`

This modal is shared. Adding a `readOnly` prop allows staff to view receipt details without action buttons.

**Changes:**
- Accept a new `readOnly` prop (default `false`)
- When `readOnly={true}`, hide the "Deny" and "Verify & Approve" button row entirely
- When `readOnly={true}`, show a small informational note below the receipt details: e.g., *"Payment verification is handled by an admin."*
- No changes to admin usage of the modal

### 3. Supabase RLS — `payments` table UPDATE policy

An existing `payments_update_staff` policy grants staff UPDATE access. Since PostgreSQL policies are additive (multiple policies stack), creating a new admin policy alone will not block staff. Instead, **drop the existing staff policy** to revoke staff UPDATE permissions.

**Migration to apply via `apply_migration`:**
```sql
DROP POLICY IF EXISTS payments_update_staff ON public.payments;
```

This removes staff's UPDATE access to the `payments` table. The existing admin policy (or role-based enforcement) remains in place for admin actions.

---

## Files Modified

| File | Change |
|---|---|
| `src/pages/staff/AppointmentsPage.jsx` | Remove verify/deny buttons; block claim for pending payments; add read-only view button |
| `src/components/admin/payments/PaymentVerificationModal.jsx` | Add `readOnly` prop to hide action buttons |
| Supabase `payments` table | Apply RLS UPDATE policy restricted to admin role |

**Files left unchanged:**
- `src/services/paymentService.js` — `verifyPayment`/`denyPayment` remain; they are now admin-only by route guard + RLS
- `src/pages/admin/bookings/BookingsPage.jsx` — no change needed
- `src/pages/admin/bookings/BookingDetailPage.jsx` — no change needed

---

## Verification

1. **Staff portal** — Log in as a staff user. On the Appointments page, find an appointment where a customer has submitted a GCash payment (`downpayment_status === 'paid'` or `'pending'`):
   - Confirm "Review Payment" and "Approve Appointment" buttons are gone
   - Confirm the "Claim" button is replaced with the "Awaiting admin payment review" label
   - Confirm a "View Payment" button is present and opens the modal in read-only mode (no action buttons, informational note visible)
2. **Admin portal** — Log in as admin. On Bookings, confirm "Verify" buttons and the full `PaymentVerificationModal` with Deny/Verify still work normally.
3. **DB enforcement** — After the migration is applied, attempt to call `verifyPayment()` directly (via browser console or Supabase client) as a staff user. Confirm the UPDATE is rejected by RLS with a policy violation error.
4. **Claiming guard** — Confirm a staff member cannot claim an appointment with a pending/submitted payment.

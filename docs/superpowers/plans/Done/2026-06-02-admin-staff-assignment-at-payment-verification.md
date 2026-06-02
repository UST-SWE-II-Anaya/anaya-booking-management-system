# Admin Staff Assignment at Payment Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin must assign a staff member when verifying a booking payment; customers only pick a gender preference (not a specific staff); staff can no longer self-claim unassigned bookings.

**Architecture:** `PaymentVerificationModal` gains a two-step flow — Step 1 reviews the payment (unchanged), Step 2 shows a filtered staff picker; clicking "Confirm Assignment" atomically verifies payment and writes `staff_id` to the booking. Customer `StaffStep` drops specific staff cards entirely. Staff appointment queries and claim UI are updated to reflect admin-only assignment.

**Tech Stack:** React 18, Zustand, Supabase JS v2, Tailwind CSS v4, lucide-react

---

## File Map

| Action | File |
|---|---|
| Modify | `src/services/paymentService.js` |
| Modify | `src/services/staffService.js` |
| Modify | `src/components/admin/payments/PaymentVerificationModal.jsx` |
| Modify | `src/pages/customer/StaffStep.jsx` |
| Modify | `src/pages/staff/AppointmentsPage.jsx` |
| Modify | `src/services/staffAppointmentService.js` |

---

## Task 1: Add `verifyAndAssignPayment` to `paymentService.js`

**Files:**
- Modify: `src/services/paymentService.js`

- [ ] **Step 1: Add the new combined service function**

Append to the end of `src/services/paymentService.js` (after the `denyPayment` export):

```js
export const verifyAndAssignPayment = async (paymentId, bookingId, staffId, verifierId) => {
  const now = new Date().toISOString()

  const { data: prev } = await supabase
    .from('payments')
    .select('status, reference_number')
    .eq('id', paymentId)
    .single()

  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'verified', verified_by: verifierId, verified_at: now })
    .eq('id', paymentId)
  if (payErr) throw payErr

  const { data, error: bookErr } = await supabase
    .from('bookings')
    .update({ downpayment_status: 'verified', staff_id: staffId, updated_at: now })
    .eq('id', bookingId)
    .select()
    .single()
  if (bookErr) throw bookErr

  logAction({
    actionType: 'payment.verified_and_assigned',
    entityType: 'payment',
    entityId: paymentId,
    entityReference: prev?.reference_number,
    description: `Verified payment ${prev?.reference_number} and assigned staff`,
    oldData: prev ? { status: prev.status } : null,
    newData: { status: 'verified', staff_id: staffId },
  })

  return data
}
```

- [ ] **Step 2: Verify file compiles (no lint errors)**

```bash
npm run lint -- --max-warnings=0 src/services/paymentService.js
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/services/paymentService.js
git commit -m "feat: add verifyAndAssignPayment service function"
```

---

## Task 2: Add `getAssignableStaff` to `staffService.js`

**Files:**
- Modify: `src/services/staffService.js`

- [ ] **Step 1: Add the new staff query function**

Append to the end of `src/services/staffService.js` (after the `banStaff` export):

```js
export const getAssignableStaff = async (preference) => {
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, gender, staff_details(is_active, job_title)')
    .eq('role', 'staff')
    .eq('account_status', 'active')
    .order('first_name', { ascending: true })

  if (preference === 'any_female') query = query.eq('gender', 'female')
  else if (preference === 'any_male') query = query.eq('gender', 'male')

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).filter((s) => s.staff_details?.is_active)
}
```

- [ ] **Step 2: Verify file compiles**

```bash
npm run lint -- --max-warnings=0 src/services/staffService.js
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/services/staffService.js
git commit -m "feat: add getAssignableStaff with preference-based gender filter"
```

---

## Task 3: Rewrite `PaymentVerificationModal` with two-step flow

**Files:**
- Modify: `src/components/admin/payments/PaymentVerificationModal.jsx`

- [ ] **Step 1: Replace the entire file with the two-step version**

```jsx
// src/components/admin/payments/PaymentVerificationModal.jsx
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, ExternalLink, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import Modal from '../../common/Modal'
import Badge from '../../common/Badge'
import { verifyAndAssignPayment, denyPayment } from '../../../services/paymentService'
import { getAssignableStaff } from '../../../services/staffService'
import useAuthStore from '../../../store/authStore'

const PREF_LABELS = {
  any: 'Any Professional',
  any_female: 'Any Female Professional',
  any_male: 'Any Male Professional',
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   booking: object | null,
 *   onUpdated: () => void,
 *   readOnly?: boolean
 * }} props
 */
const PaymentVerificationModal = ({ open, onClose, booking, onUpdated, readOnly = false }) => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('review')
  const [staffList, setStaffList] = useState([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState(null)

  const payment = booking?.payments?.[0]

  useEffect(() => {
    if (!open) {
      setStep('review')
      setSelectedStaffId(null)
      setError(null)
      setStaffList([])
    }
  }, [open])

  useEffect(() => {
    if (step !== 'assign' || !booking) return
    setLoadingStaff(true)
    getAssignableStaff(booking.professional_preference)
      .then(setStaffList)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingStaff(false))
  }, [step, booking?.professional_preference])

  if (!booking) return null

  const handleProceedToAssign = () => {
    setError(null)
    setStep('assign')
  }

  const handleConfirmAssignment = async () => {
    if (!payment || !selectedStaffId) return
    setLoading(true)
    setError(null)
    try {
      await verifyAndAssignPayment(payment.id, booking.id, selectedStaffId, user.id)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeny = async () => {
    if (!payment) return
    setLoading(true)
    setError(null)
    try {
      await denyPayment(payment.id, booking.id)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'review' ? 'Payment Verification' : 'Assign Staff Member'}
      size="lg"
    >
      {step === 'review' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Booking Ref
              </p>
              <p className="font-medium text-[#2C2C2C]">{booking.reference_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Customer
              </p>
              <p className="font-medium text-[#2C2C2C]">
                {booking.customer
                  ? `${booking.customer.first_name} ${booking.customer.last_name}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Downpayment
              </p>
              <p className="font-medium text-[#2C2C2C]">
                ₱{Number(booking.downpayment_amount).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Status
              </p>
              <Badge variant={booking.downpayment_status} label={booking.downpayment_status} />
            </div>
          </div>

          {payment ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-[#2C2C2C]">GCash Receipt</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Reference No.</p>
                  <p className="font-mono text-[#4A4A4A]">{payment.reference_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Account Name</p>
                  <p className="text-[#4A4A4A]">{payment.account_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Amount Paid</p>
                  <p className="font-medium text-[#4A4A4A]">
                    ₱{Number(payment.amount).toFixed(2)}
                  </p>
                </div>
              </div>
              {payment.receipt_url && (
                <a
                  href={payment.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#CE845D]
                    hover:underline"
                >
                  <ExternalLink size={13} />
                  View Receipt Screenshot
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No payment submitted yet.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {readOnly && payment && (
            <p className="text-sm text-gray-500 italic text-center py-2">
              Payment verification is handled by an admin.
            </p>
          )}

          {!readOnly && payment && ['pending', 'paid'].includes(booking.downpayment_status) && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDeny}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5
                  border border-red-200 text-red-600 rounded-lg text-sm font-medium
                  hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={15} />
                Deny
              </button>
              <button
                onClick={handleProceedToAssign}
                disabled={loading || !payment}
                className="flex-1 flex items-center justify-center gap-2 py-2.5
                  bg-[#8A956D] hover:bg-[#7a8560] text-white rounded-lg text-sm
                  font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle size={15} />
                Verify & Approve
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <button
            onClick={() => { setStep('review'); setSelectedStaffId(null); setError(null) }}
            className="flex items-center gap-1.5 text-sm text-gray-500
              hover:text-[#2C2C2C] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to payment review
          </button>

          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm">
            <span className="text-gray-500">Customer preference: </span>
            <span className="font-medium text-[#2C2C2C]">
              {PREF_LABELS[booking.professional_preference] ?? 'Any Professional'}
            </span>
          </div>

          {loadingStaff ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading staff…</p>
          ) : staffList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No available staff members match this preference.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {staffList.map((s) => {
                const isSelected = selectedStaffId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaffId(s.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-xl border',
                      'text-left transition-colors',
                      isSelected
                        ? 'bg-[#8A956D]/10 border-[#8A956D]'
                        : 'bg-white border-gray-200 hover:border-[#8A956D]'
                    )}
                  >
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={`${s.first_name} ${s.last_name}`}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center
                        justify-center text-sm font-bold text-gray-500 shrink-0">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C2C2C] text-sm">
                        {s.first_name} {s.last_name}
                      </p>
                      {s.staff_details?.job_title && (
                        <p className="text-xs text-gray-400 truncate">
                          {s.staff_details.job_title}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#8A956D] flex items-center
                        justify-center text-white shrink-0">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              onClick={handleConfirmAssignment}
              disabled={!selectedStaffId || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5
                bg-[#8A956D] hover:bg-[#7a8560] text-white rounded-lg text-sm font-medium
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={15} />
              {loading ? 'Confirming…' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default PaymentVerificationModal
```

- [ ] **Step 2: Verify file compiles**

```bash
npm run lint -- --max-warnings=0 src/components/admin/payments/PaymentVerificationModal.jsx
```

Expected: no errors

- [ ] **Step 3: Manual smoke test (admin)**

Start the dev server:
```bash
npm run dev
```

1. Log in as admin, navigate to Bookings
2. Find a booking with `downpayment_status = paid`
3. Click "Verify" — modal opens showing payment details (Step 1)
4. Click "Verify & Approve" — modal transitions to Step 2 with staff picker
5. Verify the customer preference label shows at top ("Customer preference: Any Professional" or similar)
6. Verify staff cards render with avatar/initials, name, and job title
7. Select a staff member — card highlights in green
8. Click "Confirm Assignment" — modal closes, booking list refreshes
9. Open the booking detail — verify `downpayment_status = verified` and assigned staff name shows
10. Click "Verify" on the same booking again — "Verify & Approve" button should no longer be shown (status is already verified)

- [ ] **Step 4: Test Back navigation**

1. Open the modal for a payable booking
2. Click "Verify & Approve" → Step 2 opens
3. Select a staff member
4. Click "Back to payment review" → returns to Step 1, selection is cleared
5. Click "Verify & Approve" again → Step 2 opens fresh (no pre-selection)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/payments/PaymentVerificationModal.jsx
git commit -m "feat: add two-step staff assignment flow to PaymentVerificationModal"
```

---

## Task 4: Remove specific staff selection from `StaffStep.jsx`

**Files:**
- Modify: `src/pages/customer/StaffStep.jsx`

- [ ] **Step 1: Replace the entire file**

```jsx
// src/pages/customer/StaffStep.jsx
import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import BookingSidebar from '../../components/customer/BookingSidebar'

const GENERIC_OPTIONS = [
  {
    id: 'any',
    preference: 'any',
    label: 'Any professional',
    subtitle: 'for maximum availability',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
        <circle cx="25" cy="12" r="5" fill="currentColor" opacity="0.45" />
        <path
          d="M15 34c0-5.5 4-9 10-9h6c6 0 9 3.5 9 9"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.45"
        />
        <circle cx="16" cy="14" r="6" fill="currentColor" opacity="0.9" />
        <path
          d="M4 34c0-6 4.5-10 12-10s12 4 12 10"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9"
        />
      </svg>
    ),
  },
  {
    id: 'any_female',
    preference: 'any_female',
    label: 'Any female professional',
    subtitle: 'any female professional available',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
        <circle cx="20" cy="13" r="7" fill="currentColor" opacity="0.85" />
        <path
          d="M8 36c0-7 5.4-12 12-12s12 5 12 12"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.85"
        />
      </svg>
    ),
  },
  {
    id: 'any_male',
    preference: 'any_male',
    label: 'Any male professional',
    subtitle: 'any male professional available',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
        <circle cx="20" cy="13" r="7" fill="currentColor" opacity="0.85" />
        <path
          d="M8 36c0-7 5.4-12 12-12s12 5 12 12"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.85"
        />
      </svg>
    ),
  },
]

const StaffStep = () => {
  const navigate = useNavigate()
  const { cart, staffPreference, setStaffPreference } = useBookingStore()

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/booking/services', { replace: true })
    }
  }, [])

  const handleSelect = (pref) => {
    setStaffPreference(pref)
    navigate('/booking/datetime')
  }

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          to="/booking/services"
          className="text-sm text-gray-500 hover:underline mb-4 inline-block"
        >
          ← Go Back to Previous Page
        </Link>
        <div className="flex gap-8 items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-6">
              Select a Professional
            </h1>
            <div className="space-y-3">
              {GENERIC_OPTIONS.map((opt) => {
                const isSelected = staffPreference === opt.preference
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt.preference)}
                    className={clsx(
                      'w-full flex items-center gap-4 p-4 rounded-xl border',
                      'text-left transition-colors',
                      isSelected
                        ? 'bg-anaya-accent/10 border-anaya-accent'
                        : 'bg-white border-gray-200 hover:border-anaya-accent'
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center
                      justify-center shrink-0">
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-anaya-text">{opt.label}</p>
                      <p className="text-sm text-gray-400">{opt.subtitle}</p>
                    </div>
                    {isSelected ? (
                      <div className="w-8 h-8 rounded-full bg-anaya-accent flex items-center
                        justify-center text-white shrink-0">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <span className="text-sm border border-anaya-accent text-anaya-accent
                        px-3 py-1 rounded-full shrink-0">
                        Select
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <BookingSidebar
            onContinue={() => navigate('/booking/datetime')}
            continueDisabled={!staffPreference}
          />
        </div>
      </div>
    </div>
  )
}

export default StaffStep
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint -- --max-warnings=0 src/pages/customer/StaffStep.jsx
```

Expected: no errors

- [ ] **Step 3: Manual smoke test (customer booking)**

1. Open the customer booking flow at `/booking/services`
2. Add a service and continue to the Staff step
3. Verify only 3 cards appear: "Any professional", "Any female professional", "Any male professional"
4. Verify no "Loading professionals…" text or specific staff names appear
5. Select one — it highlights and navigates to DateTime step immediately

- [ ] **Step 4: Commit**

```bash
git add src/pages/customer/StaffStep.jsx
git commit -m "feat: remove specific staff selection from customer booking flow"
```

---

## Task 5: Remove staff self-claim — service layer

**Files:**
- Modify: `src/services/staffAppointmentService.js`

The `claimAppointment` function and all `staff_id.is.null` filters must be removed. Staff now only see bookings explicitly assigned to them.

- [ ] **Step 1: Replace the entire file**

```js
// src/services/staffAppointmentService.js
import { supabase } from './supabaseClient'

const today = () => new Date().toISOString().split('T')[0]

const APPOINTMENT_SELECT = `
  id, reference_id, appointment_date, start_time,
  total_duration_minutes, subtotal, downpayment_amount,
  remaining_balance, booking_status, downpayment_status,
  payment_deadline, balance_settled, created_at,
  staff_id, professional_preference,
  customer:profiles!bookings_customer_id_fkey(
    id, first_name, last_name, email, phone_number, avatar_url
  ),
  booking_services(
    id, price_at_booking, duration_at_booking,
    services(id, name, category_id,
      service_categories(id, name))
  )
`

/**
 * @param {string} staffId
 * @param {{
 *   status?: string,
 *   categoryId?: string,
 *   search?: string,
 *   sortField?: 'id' | 'date',
 *   sortDir?: 'asc' | 'desc',
 *   page?: number,
 *   pageSize?: number
 * }} options
 */
export const getMyAppointments = async (staffId, {
  status = 'upcoming',
  categoryId,
  search,
  sortField = 'date',
  sortDir = 'desc',
  page = 0,
  pageSize = 20,
} = {}) => {
  let query = supabase
    .from('bookings')
    .select(APPOINTMENT_SELECT, { count: 'exact' })
    .eq('staff_id', staffId)
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) query = query.eq('booking_status', status)
  if (search) query = query.ilike('reference_id', `%${search}%`)

  if (sortField === 'date') {
    query = query.order('appointment_date', { ascending: sortDir === 'asc' })
    query = query.order('start_time', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: sortDir === 'asc' })
  }

  const { data, error, count } = await query
  if (error) throw error

  const filtered = categoryId
    ? (data ?? []).filter((b) =>
        b.booking_services?.some(
          (bs) => bs.services?.service_categories?.id === categoryId
        )
      )
    : (data ?? [])

  return { data: filtered, count: count ?? 0 }
}

export const getMyDashboardStats = async (staffId) => {
  const todayStr = today()

  const [upcomingRes, todaysRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('booking_status', 'upcoming'),
    supabase
      .from('bookings')
      .select(APPOINTMENT_SELECT)
      .eq('staff_id', staffId)
      .eq('appointment_date', todayStr)
      .eq('booking_status', 'upcoming')
      .order('start_time'),
  ])

  if (upcomingRes.error) throw upcomingRes.error
  if (todaysRes.error) throw todaysRes.error

  const todaysAppointments = todaysRes.data ?? []
  const todayDurationMinutes = todaysAppointments.reduce(
    (sum, appt) => sum + (appt.total_duration_minutes ?? 0),
    0
  )

  return {
    upcomingCount: upcomingRes.count ?? 0,
    todayCount: todaysAppointments.length,
    todayDurationMinutes,
    todaysAppointments,
  }
}

export const getMyAppointmentById = async (id, staffId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      ${APPOINTMENT_SELECT},
      payments(
        id, reference_number, account_name, receipt_url,
        amount, status, verified_at
      )
    `)
    .eq('id', id)
    .eq('staff_id', staffId)
    .single()
  if (error) throw error
  return data
}

export const getMyAppointmentDates = async (staffId, year, month) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('bookings')
    .select('appointment_date')
    .eq('staff_id', staffId)
    .eq('booking_status', 'upcoming')
    .gte('appointment_date', startDate)
    .lte('appointment_date', endDate)
  if (error) throw error
  return new Set((data ?? []).map((b) => b.appointment_date))
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint -- --max-warnings=0 src/services/staffAppointmentService.js
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/services/staffAppointmentService.js
git commit -m "feat: restrict staff appointment queries to assigned bookings only, remove claimAppointment"
```

---

## Task 6: Remove staff self-claim — UI layer

**Files:**
- Modify: `src/pages/staff/AppointmentsPage.jsx`

- [ ] **Step 1: Remove `claimAppointment` import and `handleClaimClick`**

Remove `claimAppointment,` from the import on line 8. The import block becomes:

```js
import {
  getMyAppointments,
  getMyAppointmentById,
  getMyAppointmentDates,
} from '../../services/staffAppointmentService'
```

- [ ] **Step 2: Delete the `handleClaimClick` function**

Remove the entire function (lines 209–215 in the original):

```js
  const handleClaimClick = async (id) => {
    try {
      await claimAppointment(id, staffId)
      load()
    } catch (err) {
      setError(err.message)
    }
  }
```

- [ ] **Step 3: Replace the `AppointmentCard` component**

Replace the entire `AppointmentCard` component (lines 47–151 in the original) with:

```jsx
const AppointmentCard = ({ appt, onVerifyClick }) => {
  const countdown = formatDeadlineCountdown(appt.payment_deadline)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#2C2C2C]">
            {appt.customer
              ? `${appt.customer.first_name} ${appt.customer.last_name}`
              : 'Unknown'}
          </p>
          <p className="text-xs font-mono text-gray-400 mt-0.5">
            {appt.reference_id}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={appt.booking_status} label={appt.booking_status} />
          <Badge variant={appt.downpayment_status} label={appt.downpayment_status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Date &amp; Time</p>
          <p className="text-[#4A4A4A]">{formatDate(appt.appointment_date)}</p>
          <p className="text-xs text-gray-500">{formatTime(appt.start_time)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Duration &amp; Services</p>
          <p className="text-[#4A4A4A]">
            {formatDuration(appt.total_duration_minutes)}
          </p>
          <p className="text-xs text-gray-500 line-clamp-1">
            {appt.booking_services
              ?.map((bs) => bs.services?.name)
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Downpayment / Total</p>
          <p className="text-[#4A4A4A]">
            ₱{Number(appt.downpayment_amount).toFixed(2)}
            {' '}/{' '}
            ₱{Number(appt.subtotal).toFixed(2)}
          </p>
        </div>
        {countdown && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Time Left to Pay</p>
            <p className={clsx(
              'text-sm font-medium',
              countdown === 'Expired' ? 'text-red-500' : 'text-orange-500'
            )}>
              {countdown}
            </p>
          </div>
        )}
      </div>

      {['paid', 'pending'].includes(appt.downpayment_status) && (
        <button
          onClick={() => onVerifyClick(appt.id)}
          className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm
            font-medium rounded-lg transition-colors border border-gray-200"
        >
          View Payment
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Remove `onClaimClick` from both `AppointmentCard` call sites**

Two places in the file pass `onClaimClick={handleClaimClick}` — remove that prop from both. Each becomes:

```jsx
<AppointmentCard
  key={appt.id}
  appt={appt}
  onVerifyClick={handleVerifyClick}
/>
```

- [ ] **Step 5: Verify lint**

```bash
npm run lint -- --max-warnings=0 src/pages/staff/AppointmentsPage.jsx
```

Expected: no errors

- [ ] **Step 6: Manual smoke test (staff view)**

1. Log in as a staff member
2. Navigate to the Appointments page
3. Verify there is no "Take this session" or "Awaiting admin payment review" UI on any card
4. Verify only bookings explicitly assigned to this staff member appear in the list
5. Verify the "View Payment" button still appears for bookings with `paid`/`pending` status and opens the modal in read-only mode

- [ ] **Step 7: Commit**

```bash
git add src/pages/staff/AppointmentsPage.jsx
git commit -m "feat: remove staff self-claim UI, show only assigned appointments"
```

---

## Task 7: Unit Tests

**Files:**
- Create: `src/test/services/paymentService.test.js`
- Create: `src/test/services/staffService.test.js`
- Create: `src/test/services/staffAppointmentService.test.js`
- Create: `src/test/components/PaymentVerificationModal.test.jsx`
- Create: `src/test/components/StaffStep.test.jsx`

- [ ] **Step 1: Create `src/test/services/paymentService.test.js`**

```js
// src/test/services/paymentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../mocks/supabaseMock'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../../services/auditService', () => ({
  logAction: vi.fn(),
}))

import { supabase } from '../../services/supabaseClient'
import { logAction } from '../../services/auditService'
import { verifyAndAssignPayment } from '../../services/paymentService'

describe('verifyAndAssignPayment', () => {
  const prevPayment = { status: 'paid', reference_number: 'GC-001' }
  const updatedBooking = { id: 'booking-1', downpayment_status: 'verified', staff_id: 'staff-1' }

  const setupMocks = (bookingResult = { data: updatedBooking, error: null }) => {
    supabase.from
      .mockReturnValueOnce(createQueryBuilder({ data: prevPayment, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }))
      .mockReturnValueOnce(createQueryBuilder(bookingResult))
  }

  beforeEach(() => vi.clearAllMocks())

  it('updates the booking with verified status and the assigned staff_id', async () => {
    setupMocks()
    const result = await verifyAndAssignPayment('pay-1', 'booking-1', 'staff-1', 'admin-1')
    expect(result).toEqual(updatedBooking)
    const bookingUpdateBuilder = supabase.from.mock.results[2].value
    expect(bookingUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ downpayment_status: 'verified', staff_id: 'staff-1' })
    )
  })

  it('sets verified_by and verified_at on the payment record', async () => {
    setupMocks()
    await verifyAndAssignPayment('pay-1', 'booking-1', 'staff-1', 'admin-1')
    const paymentUpdateBuilder = supabase.from.mock.results[1].value
    expect(paymentUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'verified', verified_by: 'admin-1' })
    )
  })

  it('logs the action with type payment.verified_and_assigned', async () => {
    setupMocks()
    await verifyAndAssignPayment('pay-1', 'booking-1', 'staff-1', 'admin-1')
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'payment.verified_and_assigned' })
    )
  })

  it('throws when the payment update fails and does not update the booking', async () => {
    supabase.from
      .mockReturnValueOnce(createQueryBuilder({ data: prevPayment, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: new Error('DB write error') }))

    await expect(
      verifyAndAssignPayment('pay-err', 'booking-err', 'staff-1', 'admin-1')
    ).rejects.toThrow('DB write error')

    expect(supabase.from).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Create `src/test/services/staffService.test.js`**

```js
// src/test/services/staffService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../mocks/supabaseMock'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../../services/auditService', () => ({ logAction: vi.fn() }))
vi.mock('../../store/authStore', () => ({ default: { getState: vi.fn(() => ({ profile: null })) } }))

import { supabase } from '../../services/supabaseClient'
import { getAssignableStaff } from '../../services/staffService'

const activeStaff = [
  { id: '1', first_name: 'Ana', last_name: 'Cruz', gender: 'female', staff_details: { is_active: true, job_title: 'Therapist' } },
  { id: '2', first_name: 'Ben', last_name: 'Lee', gender: 'male', staff_details: { is_active: true, job_title: 'Stylist' } },
]

describe('getAssignableStaff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all active staff when preference is "any"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: activeStaff, error: null }))
    const result = await getAssignableStaff('any')
    expect(result).toHaveLength(2)
  })

  it('does not apply a gender filter when preference is "any"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: activeStaff, error: null }))
    await getAssignableStaff('any')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).not.toHaveBeenCalledWith('gender', expect.anything())
  })

  it('filters by gender female when preference is "any_female"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: [activeStaff[0]], error: null }))
    await getAssignableStaff('any_female')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('gender', 'female')
  })

  it('filters by gender male when preference is "any_male"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: [activeStaff[1]], error: null }))
    await getAssignableStaff('any_male')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('gender', 'male')
  })

  it('excludes staff where staff_details.is_active is false', async () => {
    const mixedStaff = [
      { ...activeStaff[0] },
      { id: '3', first_name: 'Cam', last_name: 'Park', gender: 'female', staff_details: { is_active: false, job_title: 'Stylist' } },
    ]
    supabase.from.mockReturnValue(createQueryBuilder({ data: mixedStaff, error: null }))
    const result = await getAssignableStaff('any')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('throws when supabase returns an error', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: null, error: new Error('Network error') }))
    await expect(getAssignableStaff('any')).rejects.toThrow('Network error')
  })
})
```

- [ ] **Step 3: Create `src/test/services/staffAppointmentService.test.js`**

```js
// src/test/services/staffAppointmentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../mocks/supabaseMock'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../../services/supabaseClient'
import { getMyAppointments } from '../../services/staffAppointmentService'

describe('getMyAppointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters by staff_id using eq, not or', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: [], error: null, count: 0 })
    )
    await getMyAppointments('staff-1')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('staff_id', 'staff-1')
    expect(builder.or).not.toHaveBeenCalled()
  })

  it('returns data and count from the query', async () => {
    const mockBookings = [{ id: 'b1', booking_status: 'upcoming' }]
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: mockBookings, error: null, count: 1 })
    )
    const { data, count } = await getMyAppointments('staff-1')
    expect(data).toHaveLength(1)
    expect(count).toBe(1)
  })
})
```

- [ ] **Step 4: Create `src/test/components/PaymentVerificationModal.test.jsx`**

```jsx
// src/test/components/PaymentVerificationModal.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PaymentVerificationModal from '../../components/admin/payments/PaymentVerificationModal'

vi.mock('../../components/common/Modal', () => ({
  default: ({ open, title, children }) =>
    open ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}))

vi.mock('../../components/common/Badge', () => ({
  default: ({ label }) => <span data-testid="badge">{label}</span>,
}))

vi.mock('../../services/paymentService', () => ({
  verifyAndAssignPayment: vi.fn().mockResolvedValue({}),
  denyPayment: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../services/staffService', () => ({
  getAssignableStaff: vi.fn().mockResolvedValue([
    { id: 'staff-1', first_name: 'Ana', last_name: 'Cruz', avatar_url: null,
      staff_details: { job_title: 'Therapist' } },
    { id: 'staff-2', first_name: 'Ben', last_name: 'Lee', avatar_url: null,
      staff_details: { job_title: 'Stylist' } },
  ]),
}))

vi.mock('../../store/authStore', () => ({
  default: () => ({ user: { id: 'admin-1' } }),
}))

const mockBooking = {
  id: 'booking-1',
  reference_id: 'BK-0001',
  customer: { first_name: 'Jane', last_name: 'Doe' },
  downpayment_amount: 500,
  downpayment_status: 'paid',
  professional_preference: 'any',
  payments: [{
    id: 'pay-1',
    reference_number: 'GC-12345678901',
    account_name: 'Jane Doe',
    amount: 500,
    receipt_url: null,
  }],
}

describe('PaymentVerificationModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    booking: mockBooking,
    onUpdated: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders booking reference and customer name in step 1', () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    expect(screen.getByText('BK-0001')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('transitions to "Assign Staff Member" step when Verify & Approve is clicked', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    expect(await screen.findByText('Assign Staff Member')).toBeInTheDocument()
  })

  it('shows customer preference label and staff list in step 2', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    expect(await screen.findByText('Any Professional')).toBeInTheDocument()
    expect(await screen.findByText('Ana Cruz')).toBeInTheDocument()
    expect(await screen.findByText('Ben Lee')).toBeInTheDocument()
  })

  it('keeps Confirm Assignment button disabled until a staff member is selected', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    const btn = await screen.findByText('Confirm Assignment')
    expect(btn.closest('button')).toBeDisabled()
  })

  it('enables Confirm Assignment after selecting a staff member', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    fireEvent.click(await screen.findByText('Ana Cruz'))
    expect(screen.getByText('Confirm Assignment').closest('button')).not.toBeDisabled()
  })

  it('returns to step 1 and shows Payment Verification title when Back is clicked', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    await screen.findByText('Assign Staff Member')
    fireEvent.click(screen.getByText('Back to payment review'))
    expect(screen.getByText('Payment Verification')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Create `src/test/components/StaffStep.test.jsx`**

```jsx
// src/test/components/StaffStep.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StaffStep from '../../pages/customer/StaffStep'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, className }) => <a href={to} className={className}>{children}</a>,
}))

vi.mock('../../store/bookingStore', () => ({
  default: () => ({
    cart: [{ id: 'svc-1', name: 'Massage' }],
    staffPreference: 'any',
    setStaffPreference: vi.fn(),
  }),
}))

vi.mock('../../components/customer/BookingSidebar', () => ({
  default: ({ onContinue, continueDisabled }) => (
    <button onClick={onContinue} disabled={continueDisabled}>Continue</button>
  ),
}))

describe('StaffStep', () => {
  it('renders exactly the 3 generic preference options', () => {
    render(<StaffStep />)
    expect(screen.getByText('Any professional')).toBeInTheDocument()
    expect(screen.getByText('Any female professional')).toBeInTheDocument()
    expect(screen.getByText('Any male professional')).toBeInTheDocument()
  })

  it('does not render a loading state or any staff-specific content', () => {
    render(<StaffStep />)
    expect(screen.queryByText(/Loading professionals/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No specific professionals/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run all tests and confirm they pass**

```bash
npm test -- --run
```

Expected output: all tests pass with no failures. Example:
```
 ✓ src/test/services/paymentService.test.js (4)
 ✓ src/test/services/staffService.test.js (6)
 ✓ src/test/services/staffAppointmentService.test.js (2)
 ✓ src/test/components/PaymentVerificationModal.test.jsx (6)
 ✓ src/test/components/StaffStep.test.jsx (2)

 Test Files  5 passed (5)
      Tests  20 passed (20)
```

If a test fails, investigate the error message and fix either the test setup or the implementation before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/test/services/paymentService.test.js \
        src/test/services/staffService.test.js \
        src/test/services/staffAppointmentService.test.js \
        src/test/components/PaymentVerificationModal.test.jsx \
        src/test/components/StaffStep.test.jsx
git commit -m "test: add unit tests for staff assignment at payment verification"
```

---

## Verification Checklist

End-to-end test covering all three flows:

**Admin — payment verification with staff assignment:**
- [ ] Open admin Bookings, find booking with `downpayment_status = paid`
- [ ] Click Verify → modal Step 1 shows payment details unchanged
- [ ] Deny path: click Deny → booking cancelled, modal closes
- [ ] Verify path: click "Verify & Approve" → modal transitions to Step 2
- [ ] Preference label shows correctly for all three preference types (`any`, `any_female`, `any_male`)
- [ ] Staff list is filtered (only female staff shown for `any_female` preference)
- [ ] Cannot click "Confirm Assignment" without selecting a staff member (button disabled)
- [ ] After confirming: booking `downpayment_status = verified`, `staff_id` is populated
- [ ] Modal closes and list refreshes after confirmation
- [ ] Back button returns to Step 1 and clears staff selection

**Customer — booking flow:**
- [ ] Booking flow Step 2 (Staff) shows exactly 3 cards
- [ ] No loading spinner or specific staff names appear
- [ ] Selecting any card navigates to DateTime step
- [ ] Booking created with `professional_preference` set, `staff_id = null`

**Staff — appointments:**
- [ ] Staff only see bookings where they are the assigned staff
- [ ] No "Take this session" button anywhere
- [ ] "View Payment" button still opens read-only payment modal

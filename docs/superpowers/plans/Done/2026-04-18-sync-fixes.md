# Sync Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all data-sync gaps between the admin, staff, and customer views so that admin-configured settings, service flags, and booking assignments are correctly reflected across all parts of the app.

**Architecture:** Each fix is isolated to specific service files and/or page components. Settings-driven values (downpayment, cancellation window, slot duration, operating hours) will be read from the `useSiteSettings` hook which already calls `getAllSettings()` from Supabase. Structural queries in `staffAppointmentService.js` will be extended with `.or()` filters. The popular services section in `HomePage` will be replaced with a dedicated `getPopularServices()` query.

**Tech Stack:** React (Vite), Zustand, Supabase JS client (`@supabase/supabase-js`), Tailwind CSS v4, react-router-dom v7, react-hot-toast.

---

## File Map

| File | Change |
|------|--------|
| `src/services/servicesCmsService.js` | Add `getPopularServices()` — queries `services` where `is_popular = true` |
| `src/pages/HomePage/index.jsx` | Replace `getCategories().slice(0,3)` with `getPopularServices()` |
| `src/services/staffAppointmentService.js` | Add `.or('staff_id.eq.{staffId},staff_id.is.null')` to all booking queries; add `professional_preference` to select |
| `src/utils/bookingUtils.js` | Accept `{ start, end, stepMinutes }` params instead of hardcoded values |
| `src/pages/customer/DateTimeStep.jsx` | Pass operating hours + slot duration from `useSiteSettings` into `generateTimeSlots` |
| `src/pages/customer/ReviewStep.jsx` | Read `downpayment_rate` and `cancellation_window` from `useSiteSettings`; remove hardcoded `0.1` and `"12 hours"` |
| `src/pages/customer/PaymentStep.jsx` | Remove hardcoded `"(10% of Total)"` label; display actual percentage from booking record |
| `src/services/staffService.js` | Add `getActiveStaffList()` that filters by `is_active = true` client-side if RPC returns all staff |
| `src/pages/customer/StaffStep.jsx` | Switch from `getStaffList()` to `getActiveStaffList()` |

---

## Task 1: Add `getPopularServices()` to servicesCmsService

**Files:**
- Modify: `src/services/servicesCmsService.js`

- [ ] **Step 1: Add the new function**

Open `src/services/servicesCmsService.js` and add after line 13 (after `getCategories`):

```js
export const getPopularServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, image_url, category_id, service_categories(id, name)')
    .eq('is_popular', true)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Verify the function is exported correctly**

Run the dev server (`npm run dev` from the repo root) and open the browser console. In a React component with access to the service, call `getPopularServices()` manually to confirm it returns results. No test runner is set up, so manual verification is required.

- [ ] **Step 3: Commit**

```bash
git add src/services/servicesCmsService.js
git commit -m "feat: add getPopularServices query filtering by is_popular and is_active"
```

---

## Task 2: Wire Popular Services into the Homepage

**Files:**
- Modify: `src/pages/HomePage/index.jsx`

- [ ] **Step 1: Update the import**

At the top of `src/pages/HomePage/index.jsx`, change:

```js
import { getCategories } from '../../services/servicesCmsService'
```

to:

```js
import { getPopularServices } from '../../services/servicesCmsService'
```

- [ ] **Step 2: Update the state and fetch**

Replace lines 48 and 71–75:

```js
// Before
const [categories, setCategories] = useState([])
// ...
useEffect(() => {
  getCategories()
    .then((data) => setCategories(data.slice(0, 3)))
    .catch(console.error)
}, [])
```

With:

```js
const [popularServices, setPopularServices] = useState([])
// ...
useEffect(() => {
  getPopularServices()
    .then(setPopularServices)
    .catch(console.error)
}, [])
```

- [ ] **Step 3: Update the JSX render**

In the "Popular Services" section (around line 133–141), change:

```jsx
// Before
{categories.length > 0 ? (
  categories.map((cat) => (
    <ServiceCard key={cat.id} title={cat.name} catId={cat.id} imgUrl={cat.image_url} />
  ))
) : (
  <p className="text-gray-500 text-center col-span-1 md:col-span-3">Loading services...</p>
)}
```

To:

```jsx
{popularServices.length > 0 ? (
  popularServices.map((svc) => (
    <ServiceCard
      key={svc.id}
      title={svc.name}
      catId={svc.category_id}
      imgUrl={svc.image_url}
    />
  ))
) : (
  <p className="text-gray-500 text-center col-span-1 md:col-span-3">
    No popular services configured yet.
  </p>
)}
```

- [ ] **Step 4: Verify in browser**

Start the dev server. Go to the homepage. Confirm the popular services section now shows only services where `is_popular = true` in the database. If you see "No popular services configured yet", log into the admin panel and check the "Mark as Popular" checkbox on at least one service and verify it appears.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage/index.jsx
git commit -m "feat: homepage popular services now reads from is_popular flag instead of hardcoded first-3 categories"
```

---

## Task 3: Fix Staff Appointment Queries to Include Unassigned Bookings

**Context:** When a customer picks "Any professional", "Any female professional", or "Any male professional", the booking is stored with `staff_id = NULL`. Currently all queries in `staffAppointmentService.js` use `.eq('staff_id', staffId)` which silently excludes those bookings. The fix adds `.or()` so staff can see bookings they are assigned to OR bookings that are unassigned (which any staff can potentially handle).

**Files:**
- Modify: `src/services/staffAppointmentService.js`

- [ ] **Step 1: Add `professional_preference` to the select string**

At line 5, update `APPOINTMENT_SELECT` to include `professional_preference` and `staff_id`:

```js
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
```

- [ ] **Step 2: Fix `getMyAppointments` — replace `.eq` with `.or`**

Replace lines 41–45 in `getMyAppointments`:

```js
// Before
let query = supabase
  .from('bookings')
  .select(APPOINTMENT_SELECT, { count: 'exact' })
  .eq('staff_id', staffId)
  .range(page * pageSize, page * pageSize + pageSize - 1)
```

With:

```js
let query = supabase
  .from('bookings')
  .select(APPOINTMENT_SELECT, { count: 'exact' })
  .or(`staff_id.eq.${staffId},staff_id.is.null`)
  .range(page * pageSize, page * pageSize + pageSize - 1)
```

- [ ] **Step 3: Fix `getMyDashboardStats` — both sub-queries**

Replace lines 76–88:

```js
// Before
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
```

With:

```js
const [upcomingRes, todaysRes] = await Promise.all([
  supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .or(`staff_id.eq.${staffId},staff_id.is.null`)
    .eq('booking_status', 'upcoming'),
  supabase
    .from('bookings')
    .select(APPOINTMENT_SELECT)
    .or(`staff_id.eq.${staffId},staff_id.is.null`)
    .eq('appointment_date', todayStr)
    .eq('booking_status', 'upcoming')
    .order('start_time'),
])
```

- [ ] **Step 4: Fix `getMyAppointmentById` — allow looking up unassigned bookings by id**

Lines 107–122 use `.eq('staff_id', staffId)` which would fail for unassigned bookings looked up directly. Change:

```js
// Before
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
```

To:

```js
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
  .or(`staff_id.eq.${staffId},staff_id.is.null`)
  .single()
```

- [ ] **Step 5: Fix `getMyAppointmentDates` calendar query**

Replace lines 128–134:

```js
// Before
const { data, error } = await supabase
  .from('bookings')
  .select('appointment_date')
  .eq('staff_id', staffId)
  .eq('booking_status', 'upcoming')
  .gte('appointment_date', startDate)
  .lte('appointment_date', endDate)
```

With:

```js
const { data, error } = await supabase
  .from('bookings')
  .select('appointment_date')
  .or(`staff_id.eq.${staffId},staff_id.is.null`)
  .eq('booking_status', 'upcoming')
  .gte('appointment_date', startDate)
  .lte('appointment_date', endDate)
```

- [ ] **Step 6: Verify in browser**

Log in as a staff account. Create a booking as a customer with "Any professional". Confirm the booking now appears in the staff appointments list. Also verify the staff calendar dot appears on the correct date.

- [ ] **Step 7: Commit**

```bash
git add src/services/staffAppointmentService.js
git commit -m "fix: staff appointment queries now include unassigned bookings (staff_id IS NULL)"
```

---

## Task 4: Fix Slot Duration and Operating Hours to Use Admin Settings

**Context:** `generateTimeSlots` in `bookingUtils.js` hardcodes 9:00–19:30 and 30-minute intervals. `DateTimeStep.jsx` calls it without any settings. The fix passes dynamic values from `useSiteSettings`.

**Files:**
- Modify: `src/utils/bookingUtils.js`
- Modify: `src/pages/customer/DateTimeStep.jsx`

- [ ] **Step 1: Refactor `generateTimeSlots` to accept operating hours and step**

Replace the entire `generateTimeSlots` function in `src/utils/bookingUtils.js`:

```js
/**
 * @param {Array<{start_time: string, duration_minutes: number}>} blockedIntervals
 * @param {{ start?: string, end?: string, stepMinutes?: number }} options
 *   start/end are "HH:MM" strings (default "09:00" / "19:30")
 *   stepMinutes is the slot interval in minutes (default 30)
 */
export const generateTimeSlots = (blockedIntervals = [], {
  start = '09:00',
  end = '19:30',
  stepMinutes = 30,
} = {}) => {
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startTotal = startH * 60 + startM
  const endTotal = endH * 60 + endM

  const slots = []
  for (let totalMins = startTotal; totalMins <= endTotal; totalMins += stepMinutes) {
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const isBlocked = blockedIntervals.some(({ start_time, duration_minutes }) => {
      const [bh, bm] = start_time.split(':').map(Number)
      const blockStart = bh * 60 + bm
      const blockEnd = blockStart + duration_minutes
      return totalMins >= blockStart && totalMins < blockEnd
    })
    slots.push({ time, blocked: isBlocked })
  }
  return slots
}
```

- [ ] **Step 2: Update `DateTimeStep.jsx` to read settings and pass them**

In `src/pages/customer/DateTimeStep.jsx`, add the `useSiteSettings` import after existing imports:

```js
import useSiteSettings from '../../hooks/useSiteSettings'
```

Then inside the `DateTimeStep` component, add the hook call after the existing `useState` calls:

```js
const { settings } = useSiteSettings()
```

Then update `handleDateSelect` to pass settings into `generateTimeSlots`:

```js
const handleDateSelect = async (date) => {
  setSelectedDate(date)
  setSelectedTime(null)
  setLoadingSlots(true)
  const staffId = staffPreference === 'specific' ? selectedStaffId : null
  try {
    const blocked = await getAvailableSlots(staffId, date, staffPreference)
    const slotOptions = {
      start: settings?.operating_hours?.start ?? '09:00',
      end: settings?.operating_hours?.end ?? '19:30',
      stepMinutes: settings?.slot_duration?.minutes ?? 30,
    }
    setSlots(generateTimeSlots(blocked || [], slotOptions))
  } finally {
    setLoadingSlots(false)
  }
}
```

- [ ] **Step 3: Verify in browser**

Go to the admin settings panel and change slot duration to 60 minutes and operating hours to 10:00–18:00. Navigate to the customer booking flow → date/time step → select a date. Confirm that time slots now start at 10:00, end at 18:00, and are 60 minutes apart. Then revert settings back to defaults.

- [ ] **Step 4: Commit**

```bash
git add src/utils/bookingUtils.js src/pages/customer/DateTimeStep.jsx
git commit -m "fix: slot duration and operating hours now read from site_settings instead of hardcoded values"
```

---

## Task 5: Fix Downpayment Rate and Cancellation Window in ReviewStep

**Context:** `ReviewStep.jsx` hardcodes `subtotal * 0.1` for the down payment and displays `"12 hours"` as the cancellation/payment deadline window. Both values exist in `site_settings` and should be read dynamically. The component is a non-async functional component so settings must be loaded via the hook.

**Files:**
- Modify: `src/pages/customer/ReviewStep.jsx`

- [ ] **Step 1: Add `useSiteSettings` import**

At the top of `src/pages/customer/ReviewStep.jsx`, add after the existing imports:

```js
import useSiteSettings from '../../hooks/useSiteSettings'
```

- [ ] **Step 2: Call the hook inside the component**

Inside `ReviewStep`, add the hook call at the top of the component body (before the early-return guard):

```js
const { settings } = useSiteSettings()
```

- [ ] **Step 3: Replace hardcoded downpayment calculation**

Replace line 39:

```js
// Before
const downPayment = subtotal * 0.1
```

With:

```js
const downpaymentPct = (settings?.downpayment_rate?.percentage ?? 10) / 100
const downPayment = subtotal * downpaymentPct
const downpaymentLabel = `${settings?.downpayment_rate?.percentage ?? 10}% of Total`
```

- [ ] **Step 4: Replace hardcoded cancellation window text**

Replace the cancellation policy paragraph (around lines 115–120):

```jsx
// Before
<p className="text-sm text-gray-600 leading-relaxed">
  You are free to cancel this booking request up to 12 hours of
  the initial appointment reservation time, as long as you
  haven't completed the down payment step. Please finalize your
  payment to secure your slot.
</p>
```

With:

```jsx
<p className="text-sm text-gray-600 leading-relaxed">
  You are free to cancel this booking request up to{' '}
  <strong>{settings?.cancellation_window?.hours ?? 12} hours</strong>{' '}
  of the initial appointment reservation time, as long as you
  haven't completed the down payment step. Please finalize your
  payment to secure your slot.
</p>
```

- [ ] **Step 5: Replace hardcoded "12 hours" in Time Limit item**

Replace the Time Limit list item (around lines 142–149):

```jsx
// Before
<li>
  <span className="font-medium text-anaya-text">
    Time Limit:{' '}
  </span>
  We will tentatively reserve this time for you! Please
  complete your payment within the next{' '}
  <strong>12 hours</strong> to keep this appointment from
  expiring once reserved.
</li>
```

With:

```jsx
<li>
  <span className="font-medium text-anaya-text">
    Time Limit:{' '}
  </span>
  We will tentatively reserve this time for you! Please
  complete your payment within the next{' '}
  <strong>{settings?.cancellation_window?.hours ?? 12} hours</strong>{' '}
  to keep this appointment from expiring once reserved.
</li>
```

- [ ] **Step 6: Replace hardcoded downpayment label in the summary card**

Replace the Down Payment display (around lines 218–224):

```jsx
// Before
<div className="flex justify-between text-gray-500">
  <span>
    Down Payment
    <br />
    <span className="text-xs">(10% of Total):</span>
  </span>
  <span>₱{downPayment.toFixed(2)}</span>
</div>
```

With:

```jsx
<div className="flex justify-between text-gray-500">
  <span>
    Down Payment
    <br />
    <span className="text-xs">({downpaymentLabel}):</span>
  </span>
  <span>₱{downPayment.toFixed(2)}</span>
</div>
```

- [ ] **Step 7: Verify in browser**

Go to admin settings, set downpayment rate to 20% and cancellation window to 24 hours. Navigate through the customer booking flow to the Review step. Confirm the down payment now shows 20% and the time limit/cancellation text shows "24 hours". Revert admin settings back to defaults after testing.

- [ ] **Step 8: Commit**

```bash
git add src/pages/customer/ReviewStep.jsx
git commit -m "fix: downpayment rate and cancellation window in ReviewStep now read from site_settings"
```

---

## Task 6: Fix Hardcoded Downpayment Label in PaymentStep

**Context:** `PaymentStep.jsx` displays the stored `downpayment_amount` from the booking record (correct), but labels it as a hardcoded `"(10% of Total)"`. The label should reflect the actual stored percentage, which is available via `useSiteSettings`.

**Files:**
- Modify: `src/pages/customer/PaymentStep.jsx`

- [ ] **Step 1: Add `useSiteSettings` import**

In `src/pages/customer/PaymentStep.jsx`, add after the existing imports:

```js
import useSiteSettings from '../../hooks/useSiteSettings'
```

- [ ] **Step 2: Call the hook inside `PaymentStep`**

Inside the `PaymentStep` component, add:

```js
const { settings } = useSiteSettings()
const downpaymentPctLabel = `${settings?.downpayment_rate?.percentage ?? 10}% of Total`
```

- [ ] **Step 3: Replace the hardcoded label**

Find the down payment label around line 320:

```jsx
// Before
<span className="text-xs">(10% of Total):</span>
```

Replace with:

```jsx
<span className="text-xs">({downpaymentPctLabel}):</span>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/customer/PaymentStep.jsx
git commit -m "fix: PaymentStep downpayment label now reads percentage from site_settings"
```

---

## Task 7: Filter Inactive Staff from Customer Booking Flow

**Context:** `StaffStep.jsx` calls `getStaffList()` which uses the `get_staff_list` RPC. Since the RPC is a Supabase-side function whose filtering behavior is unknown from the frontend, we add a client-side `is_active` filter as a defensive measure. We add a new exported function `getActiveStaffList()` in `staffService.js` so the service layer stays clean.

**Files:**
- Modify: `src/services/staffService.js`
- Modify: `src/pages/customer/StaffStep.jsx`

- [ ] **Step 1: Add `getActiveStaffList` to staffService**

Open `src/services/staffService.js`. After the existing `getStaffList` function (around line 95), add:

```js
export const getActiveStaffList = async () => {
  const data = await getStaffList()
  return (data ?? []).filter((s) => s.is_active !== false)
}
```

Note: The RPC returns whatever columns it selects. If `is_active` is not in the RPC result, this filter will not remove anyone (it filters only when `is_active` is explicitly `false`). That is safe — it means the RPC already filters, or the column isn't returned. A future migration can enforce this at the DB level.

- [ ] **Step 2: Update `StaffStep.jsx` to use `getActiveStaffList`**

In `src/pages/customer/StaffStep.jsx`, change the import on line 5:

```js
// Before
import { getStaffList } from '../../services/staffService'
```

To:

```js
import { getActiveStaffList } from '../../services/staffService'
```

And update the `useEffect` call on line 59:

```js
// Before
getStaffList()
  .then(setStaff)
  .finally(() => setLoading(false))
```

To:

```js
getActiveStaffList()
  .then(setStaff)
  .finally(() => setLoading(false))
```

- [ ] **Step 3: Verify in browser**

In the admin panel, deactivate a staff member. Navigate to the customer booking flow → Select a Professional. Confirm that the deactivated staff member no longer appears. Re-activate them and confirm they appear again.

- [ ] **Step 4: Commit**

```bash
git add src/services/staffService.js src/pages/customer/StaffStep.jsx
git commit -m "fix: customer booking flow now filters out inactive staff members"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Staff can't see unassigned / "any professional" bookings → Task 3
- [x] Popular services ignores `is_popular` flag → Tasks 1 & 2
- [x] Downpayment % hardcoded → Tasks 5 & 6
- [x] Cancellation window hardcoded → Task 5
- [x] Slot duration hardcoded → Task 4
- [x] Operating hours hardcoded → Task 4
- [x] Inactive staff shown to customers → Task 7
- [ ] No real-time booking status updates for customers → **Not included.** Adding Supabase realtime subscriptions is a larger architectural change (requires channel setup in multiple components and cleanup logic). It is deferred as a separate feature branch.
- [ ] Leave approval may not block customer slots → **Not included.** The `get_available_slots` RPC lives entirely in Supabase and cannot be audited or modified from the frontend. This requires a database-side investigation and separate plan.

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references found.

**Type consistency:** `generateTimeSlots` signature change is used correctly in `DateTimeStep.jsx` with the `{ start, end, stepMinutes }` options object. All other function names match across tasks.

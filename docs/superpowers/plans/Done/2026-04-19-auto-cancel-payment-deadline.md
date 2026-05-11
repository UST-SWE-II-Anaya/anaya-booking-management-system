# Auto-Cancel on Payment Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the payment deadline configurable via admin settings and wire the full end-to-end auto-cancellation flow: admin sets the deadline window → `create_booking` reads it → pg_cron cancels expired bookings → customer UI shows an expired state gracefully.

**Architecture:** The pg_cron job (`auto-cancel-expired-bookings`) already exists and runs every 5 minutes; `updated_at` is auto-managed by a DB trigger. The gap is that the 12-hour deadline in `create_booking` is hardcoded and there is no admin UI to change it. A new `payment_deadline_hours` key in `site_settings` bridges this. The customer `AppointmentCard` already shows a live countdown but has no expired-deadline state, so a small UI pass handles the window between deadline expiry and the next cron tick.

**Tech Stack:** PostgreSQL (pl/pgsql, pg_cron), Supabase MCP (`apply_migration`, `execute_sql`), React, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| DB migration (via MCP) | Apply | Add `payment_deadline_hours` setting; update `create_booking` to read it |
| `src/services/settingsService.js` | Modify | Document new `payment_deadline_hours` key in JSDoc |
| `src/pages/admin/settings/SettingsPage.jsx` | Modify | Add Payment Deadline field to Booking Rules section |
| `src/components/customer/AppointmentCard.jsx` | Modify | Show expired state when deadline has passed |

---

### Task 1: DB Migration — add `payment_deadline_hours` setting and update `create_booking`

**Files:**
- Apply via: Supabase MCP `apply_migration`

The `create_booking` function currently hardcodes `now() + interval '12 hours'`. This task inserts a `payment_deadline_hours` row into `site_settings` and replaces the function body so it reads that setting at call time.

- [ ] **Step 1: Apply the migration via Supabase MCP**

Use `mcp__supabase-mcp-server__apply_migration` with project_id `snsukbyaljveqrptvuwm`, name `add_payment_deadline_hours_setting`, and the SQL below:

```sql
-- 1. Insert the new setting (skip if already exists)
INSERT INTO public.site_settings (key, value)
VALUES ('payment_deadline_hours', '{"hours": 12}')
ON CONFLICT (key) DO NOTHING;

-- 2. Replace create_booking to read payment_deadline_hours dynamically
CREATE OR REPLACE FUNCTION public.create_booking(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_booking_id        uuid;
  v_staff_id          uuid;
  v_date              date;
  v_start_time        time;
  v_duration          integer;
  v_preference        professional_preference;
  v_deadline_hours    integer;
  v_result            jsonb;
BEGIN
  v_staff_id    := (payload->>'staff_id')::uuid;
  v_date        := (payload->>'appointment_date')::date;
  v_start_time  := (payload->>'start_time')::time;
  v_duration    := (payload->>'total_duration_minutes')::integer;
  v_preference  := COALESCE(
    (payload->>'professional_preference')::professional_preference,
    'any'::professional_preference
  );

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
    booking_status, downpayment_status, payment_deadline, booking_notes
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
    NULLIF(payload->>'booking_notes', '')
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
$$;
```

- [ ] **Step 2: Smoke-test the migration**

Run via `mcp__supabase-mcp-server__execute_sql`:

```sql
-- Verify the setting row exists
SELECT key, value FROM public.site_settings WHERE key = 'payment_deadline_hours';
```

Expected: one row `{ "hours": 12 }`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add payment_deadline_hours setting and update create_booking to use it"
```

---

### Task 2: Update `settingsService.js` JSDoc

**Files:**
- Modify: `src/services/settingsService.js`

- [ ] **Step 1: Add `payment_deadline_hours` to the JSDoc comment**

In `src/services/settingsService.js`, replace the existing JSDoc block (lines 3–10) with:

```js
/**
 * Keys used in site_settings:
 *   operating_hours        → { start: "09:00", end: "19:30" }
 *   downpayment_rate       → { percentage: 10 }
 *   cancellation_window    → { hours: 12 }
 *   payment_deadline_hours → { hours: 12 }
 *   slot_duration          → { minutes: 30 }
 *   contact_info           → { phone, email, address }
 */
```

- [ ] **Step 2: Verify tests still pass**

```bash
npx vitest run src/services/settingsService.test.js
```

Expected output: all tests pass (2 tests).

- [ ] **Step 3: Commit**

```bash
git add src/services/settingsService.js
git commit -m "docs: document payment_deadline_hours in settingsService JSDoc"
```

---

### Task 3: Admin Settings UI — Payment Deadline field

**Files:**
- Modify: `src/pages/admin/settings/SettingsPage.jsx`

Add a "Payment Deadline (hrs)" number input to the Booking Rules `Section`, alongside the existing Downpayment, Cancellation Window, and Slot Duration fields.

- [ ] **Step 1: Add `paymentDeadline` state and load from settings**

In `SettingsPage.jsx`, add state for `paymentDeadline` alongside the existing state declarations (after the `cancellation` state on line 27):

```js
const [paymentDeadline, setPaymentDeadline] = useState(12)
```

In the `useEffect` `.then` callback (after the `if (s.cancellation_window)` block on line 36), add:

```js
if (s.payment_deadline_hours) setPaymentDeadline(s.payment_deadline_hours.hours)
```

- [ ] **Step 2: Save `payment_deadline_hours` in `handleSave`**

In the `Promise.all([...])` array inside `handleSave` (after the `cancellation_window` upsert on line 53), add:

```js
upsertSetting('payment_deadline_hours', { hours: Number(paymentDeadline) }, user.id),
```

- [ ] **Step 3: Add the input field to the Booking Rules section**

The Booking Rules `Section` has a `grid grid-cols-3` div. Change it to `grid-cols-4` and add the Payment Deadline field. Replace the grid `div` opening tag and its contents (lines 116–165) with:

```jsx
<div className="grid grid-cols-4 gap-4">
  <div>
    <label className="block text-xs text-gray-500 mb-1">
      Downpayment (%)
    </label>
    <input
      type="number"
      min="1"
      max="100"
      className={inputClass + ' w-full'}
      value={downpayment}
      onChange={(e) => setDownpayment(e.target.value)}
    />
    <p className="text-xs text-gray-400 mt-1">
      Currently {downpayment}% of total
    </p>
  </div>
  <div>
    <label className="block text-xs text-gray-500 mb-1">
      Cancellation Window (hrs)
    </label>
    <input
      type="number"
      min="1"
      className={inputClass + ' w-full'}
      value={cancellation}
      onChange={(e) => setCancellation(e.target.value)}
    />
    <p className="text-xs text-gray-400 mt-1">
      Customer can cancel up to {cancellation}h before
    </p>
  </div>
  <div>
    <label className="block text-xs text-gray-500 mb-1">
      Payment Deadline (hrs)
    </label>
    <input
      type="number"
      min="1"
      className={inputClass + ' w-full'}
      value={paymentDeadline}
      onChange={(e) => setPaymentDeadline(e.target.value)}
    />
    <p className="text-xs text-gray-400 mt-1">
      Hours to submit downpayment
    </p>
  </div>
  <div>
    <label className="block text-xs text-gray-500 mb-1">
      Slot Duration (min)
    </label>
    <input
      type="number"
      min="15"
      step="15"
      className={inputClass + ' w-full'}
      value={slotDuration}
      onChange={(e) => setSlotDuration(e.target.value)}
    />
    <p className="text-xs text-gray-400 mt-1">
      Appointment intervals
    </p>
  </div>
</div>
```

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: same pass/fail counts as before this task (3 pre-existing LoginPage failures, everything else green).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/settings/SettingsPage.jsx
git commit -m "feat: add payment deadline hours field to admin settings UI"
```

---

### Task 4: Customer UI — expired deadline state in `AppointmentCard`

**Files:**
- Modify: `src/components/customer/AppointmentCard.jsx`

When a booking is `upcoming` + `downpayment_status = 'pending'` but the `payment_deadline` has already passed, there is a window (up to 5 minutes) before the cron job runs and sets the status to `cancelled`. During this window the booking still shows in the customer dashboard. Currently the UI shows the countdown at 0 hours and the "Pay Down Payment" button is still visible. Fix this to hide the pay button and show an "expired" warning instead.

- [ ] **Step 1: Derive `isExpired` from the deadline**

In `AppointmentCard.jsx`, after the `showCountdown` variable (line 39), add:

```js
const isExpired = isPending && deadline && deadline <= Date.now()
```

- [ ] **Step 2: Hide "Pay Down Payment" button when expired**

The "Pay Down Payment" button is rendered when `isPending` (line 99). Change its condition to also require `!isExpired`:

Replace:
```jsx
{isPending && (
  <button
    onClick={() => onPay(booking)}
    className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-xs px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap"
  >
    Pay Down Payment
  </button>
)}
```

With:
```jsx
{isPending && !isExpired && (
  <button
    onClick={() => onPay(booking)}
    className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-xs px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap"
  >
    Pay Down Payment
  </button>
)}
```

- [ ] **Step 3: Show expired notice in place of countdown**

The countdown span is rendered when `showCountdown` is true (line 154). Replace the entire countdown block with a conditional that covers both the live countdown and the expired state:

Replace:
```jsx
{showCountdown && (
  <span className="text-xs text-orange-500 ml-auto">
    Time left to pay: {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}
  </span>
)}
```

With:
```jsx
{isExpired ? (
  <span className="text-xs text-red-500 ml-auto">
    Payment deadline expired — booking cancellation pending
  </span>
) : showCountdown ? (
  <span className="text-xs text-orange-500 ml-auto">
    Time left to pay: {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}
  </span>
) : null}
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: same pass/fail counts as before (3 pre-existing LoginPage failures, everything else green).

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/AppointmentCard.jsx
git commit -m "feat: show expired state in AppointmentCard when payment deadline has passed"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|---|---|
| Auto-cancel when downpayment timer expires | Already implemented (pg_cron job existed). Plan documents it and fixes root cause (hardcoded deadline). |
| Timer is configurable | Task 1 (DB setting) + Task 3 (admin UI) |
| `create_booking` respects configurable deadline | Task 1 (`create_booking` reads `payment_deadline_hours`) |
| Customer sees expired state gracefully | Task 4 (`AppointmentCard` expired branch) |
| Admin can update the deadline window | Task 3 (`SettingsPage` form field) |

### Placeholder Scan

No TBDs, TODOs, or vague instructions. All code blocks are complete.

### Type Consistency

- `payment_deadline_hours` setting shape: `{ hours: number }` — consistent across DB migration, `settingsService.js` JSDoc, `SettingsPage` load/save, and `AppointmentCard` (reads `payment_deadline` from booking, not the setting directly).
- `isExpired` is `boolean` — used consistently in two JSX conditionals.

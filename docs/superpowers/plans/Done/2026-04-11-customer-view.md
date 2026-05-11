# Customer View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated customer portal (6-step booking wizard, dashboard, past appointments, and profile management) inside the existing Vite + React `src/` app.

**Architecture:** All customer routes live inside a `CustomerRoute` auth guard that checks `profile.role === 'customer'` from `useAuthStore`. A new `bookingStore` (Zustand v5, sessionStorage) drives the wizard. All Supabase calls live in `src/services/`. Three new Supabase RPCs and two storage buckets are applied via MCP migrations.

**Tech Stack:** Vite + React 19, React Router v7, Zustand v5 with persist middleware, Tailwind CSS v4, Supabase JS v2, Vitest + Testing Library, lucide-react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| Supabase migration: `create_customer_buckets_and_staff_rpc` | Create | Storage buckets + get_staff_list RPC |
| Supabase migration: `create_get_available_slots_rpc` | Create | Slot availability RPC |
| Supabase migration: `create_booking_rpc` | Create | Atomic booking creation RPC |
| `src/services/servicesCmsService.js` | Modify | Add getAllActiveServices |
| `src/utils/bookingUtils.js` | Create | generateTimeSlots, formatDuration |
| `src/store/bookingStore.js` | Create | Zustand booking wizard state |
| `src/services/customerBookingService.js` | Create | Booking CRUD (getMyBookings, createBooking, cancel…) |
| `src/services/availabilityService.js` | Create | getAvailableSlots RPC wrapper |
| `src/services/customerProfileService.js` | Create | getMyProfile, updateMyProfile, uploadAvatar |
| `src/services/staffService.js` | Create | getStaffList RPC wrapper |
| `src/components/layout/CustomerRoute.jsx` | Create | Auth guard — role='customer' |
| `src/components/Navbar/index.jsx` | Modify | Auth-aware customer nav links |
| `src/App.jsx` | Modify | Wire CustomerRoute + 10 routes |
| `src/pages/customer/ServicesStep.jsx` | Create | Booking step 1 |
| `src/components/customer/BookingSidebar.jsx` | Create | Shared sidebar (steps 1–4) |
| `src/pages/customer/StaffStep.jsx` | Create | Booking step 2 |
| `src/pages/customer/DateTimeStep.jsx` | Create | Booking step 3 |
| `src/components/customer/BookingCalendar.jsx` | Create | Month calendar component |
| `src/pages/customer/ReviewStep.jsx` | Create | Booking step 4 |
| `src/pages/customer/PaymentStep.jsx` | Create | Booking step 5 |
| `src/pages/customer/SuccessPage.jsx` | Create | Booking step 6 |
| `src/pages/customer/Dashboard.jsx` | Create | Active appointments + modal |
| `src/components/customer/AppointmentCard.jsx` | Create | Card with status badges |
| `src/components/customer/AppointmentDetailModal.jsx` | Create | Detail overlay |
| `src/pages/customer/AppointmentsHistory.jsx` | Create | Past appointments list |
| `src/pages/customer/Profile.jsx` | Create | Profile view + avatar upload |
| `src/pages/customer/ProfileEdit.jsx` | Create | Profile edit form |

---

### Task 1: Supabase — Storage Buckets + get_staff_list RPC

**Files:**
- Apply via MCP: `mcp__supabase__apply_migration`

- [ ] **Step 1: Apply migration**

Call MCP tool `mcp__supabase__apply_migration` with:
- `name`: `create_customer_buckets_and_staff_rpc`
- `query`:

```sql
-- Storage bucket: payment-receipts (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket: avatars (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: customers insert own receipts
CREATE POLICY "customer_insert_receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: admins select all receipts
CREATE POLICY "admin_select_receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS: customers manage own avatars
CREATE POLICY "customer_insert_avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "customer_update_avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RPC: get_staff_list
CREATE OR REPLACE FUNCTION get_staff_list()
RETURNS TABLE (id uuid, first_name text, last_name text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT p.id, p.first_name, p.last_name, p.avatar_url
  FROM profiles p
  WHERE p.role IN ('staff', 'admin') AND p.is_active = true
  ORDER BY p.first_name;
$$;
```

- [ ] **Step 2: Verify migration**

Call `mcp__supabase__list_migrations` and confirm `create_customer_buckets_and_staff_rpc` appears.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add storage buckets and get_staff_list RPC"
```

---

### Task 2: Supabase — get_available_slots RPC

**Files:**
- Apply via MCP: `mcp__supabase__apply_migration`

- [ ] **Step 1: Apply migration**

Call `mcp__supabase__apply_migration` with:
- `name`: `create_get_available_slots_rpc`
- `query`:

```sql
CREATE OR REPLACE FUNCTION get_available_slots(
  p_staff_id uuid,
  p_date date,
  p_preference text
)
RETURNS TABLE (start_time text, duration_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_eligible integer;
BEGIN
  IF p_preference = 'specific' THEN
    RETURN QUERY
      SELECT b.start_time::text, b.total_duration_minutes
      FROM bookings b
      WHERE b.staff_id = p_staff_id
        AND b.appointment_date = p_date
        AND b.booking_status != 'cancelled';
  ELSE
    SELECT COUNT(*) INTO v_total_eligible
    FROM profiles p
    WHERE p.role IN ('staff', 'admin')
      AND p.is_active = true
      AND CASE
        WHEN p_preference = 'any_female' THEN p.gender = 'female'
        WHEN p_preference = 'any_male' THEN p.gender = 'male'
        ELSE true
      END;

    IF v_total_eligible = 0 THEN
      RETURN;
    END IF;

    RETURN QUERY
      WITH slot_series AS (
        SELECT (time '09:00' + (n * interval '30 minutes')) AS slot_start
        FROM generate_series(0, 21) AS n
      ),
      booked_counts AS (
        SELECT ss.slot_start, COUNT(DISTINCT b.staff_id) AS booked_count
        FROM slot_series ss
        LEFT JOIN bookings b ON b.appointment_date = p_date
          AND b.booking_status != 'cancelled'
          AND b.start_time::time <= ss.slot_start
          AND (b.start_time::time + (b.total_duration_minutes * interval '1 minute')) > ss.slot_start
        LEFT JOIN profiles p ON p.id = b.staff_id
          AND p.role IN ('staff', 'admin')
          AND p.is_active = true
          AND CASE
            WHEN p_preference = 'any_female' THEN p.gender = 'female'
            WHEN p_preference = 'any_male' THEN p.gender = 'male'
            ELSE true
          END
        WHERE b.id IS NOT NULL
        GROUP BY ss.slot_start
      )
      SELECT to_char(bc.slot_start, 'HH24:MI'), 30
      FROM booked_counts bc
      WHERE bc.booked_count >= v_total_eligible;
  END IF;
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: add get_available_slots RPC"
```

---

### Task 3: Supabase — create_booking RPC

**Files:**
- Apply via MCP: `mcp__supabase__apply_migration`

- [ ] **Step 1: Apply migration**

Call `mcp__supabase__apply_migration` with:
- `name`: `create_booking_rpc`
- `query`:

```sql
CREATE OR REPLACE FUNCTION create_booking(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id uuid;
  v_reference_id text;
  v_staff_id uuid;
  v_date date;
  v_start_time time;
  v_duration integer;
  v_result jsonb;
BEGIN
  v_staff_id := (payload->>'staff_id')::uuid;
  v_date := (payload->>'appointment_date')::date;
  v_start_time := (payload->>'start_time')::time;
  v_duration := (payload->>'total_duration_minutes')::integer;

  -- Advisory lock: prevents concurrent double-booking for same staff+date
  PERFORM pg_advisory_xact_lock(hashtext(v_staff_id::text || v_date::text));

  -- Re-check for overlapping non-cancelled bookings
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.staff_id = v_staff_id
      AND b.appointment_date = v_date
      AND b.booking_status != 'cancelled'
      AND (b.start_time::time,
           b.start_time::time + (b.total_duration_minutes * interval '1 minute'))
          OVERLAPS
          (v_start_time,
           v_start_time + (v_duration * interval '1 minute'))
  ) THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
  END IF;

  v_booking_id := gen_random_uuid();
  v_reference_id := 'BK' || lpad(
    (SELECT COALESCE(MAX(CAST(SUBSTRING(reference_id FROM 3) AS integer)), 0) + 1
     FROM bookings)::text,
    6, '0'
  );

  INSERT INTO bookings (
    id, reference_id, customer_id, staff_id, staff_preference,
    appointment_date, start_time, total_duration_minutes,
    subtotal, downpayment_amount, remaining_balance,
    booking_status, downpayment_status, payment_deadline, booking_notes
  ) VALUES (
    v_booking_id, v_reference_id, auth.uid(), v_staff_id,
    payload->>'staff_preference', v_date, v_start_time, v_duration,
    (payload->>'subtotal')::numeric,
    (payload->>'downpayment_amount')::numeric,
    (payload->>'remaining_balance')::numeric,
    'upcoming', 'pending',
    now() + interval '12 hours',
    payload->>'booking_notes'
  );

  INSERT INTO booking_services (booking_id, service_id, price_at_booking, duration_at_booking)
  SELECT
    v_booking_id,
    (svc->>'id')::uuid,
    (svc->>'price')::numeric,
    (svc->>'duration_minutes')::integer
  FROM jsonb_array_elements(payload->'services') AS svc;

  SELECT jsonb_build_object(
    'id', b.id,
    'reference_id', b.reference_id,
    'appointment_date', b.appointment_date,
    'start_time', b.start_time,
    'payment_deadline', b.payment_deadline
  ) INTO v_result
  FROM bookings b WHERE b.id = v_booking_id;

  RETURN v_result;
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: add create_booking RPC with advisory lock"
```

---

### Task 4: getAllActiveServices

**Files:**
- Modify: `src/services/servicesCmsService.js`
- Test: `src/services/servicesCmsService.test.js` (add to existing or create)

- [ ] **Step 1: Write failing test**

Add to `src/services/servicesCmsService.test.js` (create file if it does not exist):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getAllActiveServices } from './servicesCmsService'

describe('getAllActiveServices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns services mapped with category_name', async () => {
    const raw = [
      {
        id: '1',
        name: 'Manicure',
        duration_minutes: 60,
        price: 350,
        service_categories: { name: 'Nails' },
      },
    ]
    supabase.from.mockReturnValue(createQueryBuilder({ data: raw, error: null }))
    const result = await getAllActiveServices()
    expect(result).toEqual([
      { id: '1', name: 'Manicure', category_name: 'Nails', duration_minutes: 60, price: 350 },
    ])
  })

  it('throws on Supabase error', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error('DB error') })
    )
    await expect(getAllActiveServices()).rejects.toThrow('DB error')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- servicesCmsService --run
```

Expected: FAIL — `getAllActiveServices is not a function`

- [ ] **Step 3: Add getAllActiveServices to servicesCmsService.js**

Open `src/services/servicesCmsService.js` and add at the bottom:

```js
export const getAllActiveServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price, service_categories(name)')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    category_name: s.service_categories.name,
    duration_minutes: s.duration_minutes,
    price: s.price,
  }))
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- servicesCmsService --run
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/servicesCmsService.js src/services/servicesCmsService.test.js
git commit -m "feat: add getAllActiveServices with category join"
```

---

### Task 5: Time Utilities

**Files:**
- Create: `src/utils/bookingUtils.js`
- Create: `src/utils/bookingUtils.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/utils/bookingUtils.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { generateTimeSlots, formatDuration } from './bookingUtils'

describe('generateTimeSlots', () => {
  it('generates 22 slots from 09:00 to 19:30', () => {
    const slots = generateTimeSlots([])
    expect(slots).toHaveLength(22)
    expect(slots[0].time).toBe('09:00')
    expect(slots[21].time).toBe('19:30')
    expect(slots.every((s) => !s.blocked)).toBe(true)
  })

  it('blocks slots that fall within a blocked interval', () => {
    const slots = generateTimeSlots([{ start_time: '10:00', duration_minutes: 60 }])
    expect(slots.find((s) => s.time === '10:00').blocked).toBe(true)
    expect(slots.find((s) => s.time === '10:30').blocked).toBe(true)
    expect(slots.find((s) => s.time === '11:00').blocked).toBe(false)
  })

  it('does not block a slot that ends exactly when an interval starts', () => {
    const slots = generateTimeSlots([{ start_time: '11:00', duration_minutes: 60 }])
    expect(slots.find((s) => s.time === '10:30').blocked).toBe(false)
  })

  it('handles multiple blocked intervals', () => {
    const slots = generateTimeSlots([
      { start_time: '09:00', duration_minutes: 30 },
      { start_time: '14:00', duration_minutes: 60 },
    ])
    expect(slots.find((s) => s.time === '09:00').blocked).toBe(true)
    expect(slots.find((s) => s.time === '09:30').blocked).toBe(false)
    expect(slots.find((s) => s.time === '14:00').blocked).toBe(true)
    expect(slots.find((s) => s.time === '14:30').blocked).toBe(true)
    expect(slots.find((s) => s.time === '15:00').blocked).toBe(false)
  })
})

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(45)).toBe('45 mins')
  })
  it('formats exact hours (singular)', () => {
    expect(formatDuration(60)).toBe('1 hr')
  })
  it('formats exact hours (plural)', () => {
    expect(formatDuration(120)).toBe('2 hrs')
  })
  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1 hr 30 mins')
  })
  it('formats multiple hours and minutes', () => {
    expect(formatDuration(150)).toBe('2 hrs 30 mins')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- bookingUtils --run
```

Expected: FAIL — module not found

- [ ] **Step 3: Create bookingUtils.js**

Create `src/utils/bookingUtils.js`:

```js
export const generateTimeSlots = (blockedIntervals = []) => {
  const slots = []
  for (let totalMins = 9 * 60; totalMins <= 19 * 60 + 30; totalMins += 30) {
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

export const formatDuration = (minutes) => {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins} mins`
  if (mins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`
  return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} mins`
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- bookingUtils --run
```

Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/bookingUtils.js src/utils/bookingUtils.test.js
git commit -m "feat: add generateTimeSlots and formatDuration utilities"
```

---

### Task 6: Booking Store

**Files:**
- Create: `src/store/bookingStore.js`
- Create: `src/store/bookingStore.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/store/bookingStore.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import useBookingStore from './bookingStore'

const reset = () =>
  useBookingStore.setState({
    cart: [],
    staffPreference: 'any',
    selectedStaffId: null,
    selectedDate: null,
    selectedTime: null,
    bookingNotes: '',
  })

describe('bookingStore', () => {
  beforeEach(reset)

  it('adds a service to cart', () => {
    const svc = { id: '1', name: 'Manicure', category_name: 'Nails', duration_minutes: 60, price: 350 }
    useBookingStore.getState().addToCart(svc)
    expect(useBookingStore.getState().cart).toHaveLength(1)
    expect(useBookingStore.getState().cart[0].id).toBe('1')
  })

  it('removes a service from cart by id', () => {
    const svc = { id: '1', name: 'Manicure', category_name: 'Nails', duration_minutes: 60, price: 350 }
    useBookingStore.getState().addToCart(svc)
    useBookingStore.getState().removeFromCart('1')
    expect(useBookingStore.getState().cart).toHaveLength(0)
  })

  it('sets staff preference and clears selectedStaffId', () => {
    useBookingStore.setState({ selectedStaffId: 'abc' })
    useBookingStore.getState().setStaffPreference('any_female')
    expect(useBookingStore.getState().staffPreference).toBe('any_female')
    expect(useBookingStore.getState().selectedStaffId).toBeNull()
  })

  it('setSelectedStaff sets selectedStaffId', () => {
    useBookingStore.getState().setSelectedStaff('staff-uuid')
    expect(useBookingStore.getState().selectedStaffId).toBe('staff-uuid')
  })

  it('sets date and time', () => {
    useBookingStore.getState().setDateTime('2026-04-20', '10:00')
    expect(useBookingStore.getState().selectedDate).toBe('2026-04-20')
    expect(useBookingStore.getState().selectedTime).toBe('10:00')
  })

  it('sets booking notes', () => {
    useBookingStore.getState().setBookingNotes('No gel please')
    expect(useBookingStore.getState().bookingNotes).toBe('No gel please')
  })

  it('clearBooking resets all state', () => {
    useBookingStore.setState({
      cart: [{ id: '1' }],
      selectedDate: '2026-04-20',
      selectedTime: '10:00',
      staffPreference: 'any_female',
      bookingNotes: 'Note',
    })
    useBookingStore.getState().clearBooking()
    const s = useBookingStore.getState()
    expect(s.cart).toHaveLength(0)
    expect(s.selectedDate).toBeNull()
    expect(s.selectedTime).toBeNull()
    expect(s.staffPreference).toBe('any')
    expect(s.bookingNotes).toBe('')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- bookingStore --run
```

Expected: FAIL — module not found

- [ ] **Step 3: Create bookingStore.js**

Create `src/store/bookingStore.js`:

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
      clearBooking: () =>
        set({
          cart: [],
          staffPreference: 'any',
          selectedStaffId: null,
          selectedDate: null,
          selectedTime: null,
          bookingNotes: '',
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

- [ ] **Step 4: Run tests**

```bash
npm test -- bookingStore --run
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/store/bookingStore.js src/store/bookingStore.test.js
git commit -m "feat: add bookingStore with sessionStorage persistence"
```

---

### Task 7: Customer Booking Service

**Files:**
- Create: `src/services/customerBookingService.js`
- Create: `src/services/customerBookingService.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/services/customerBookingService.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  createBooking,
  getMyBookings,
  getMyPastBookings,
  getMyBookingById,
  cancelMyBooking,
} from './customerBookingService'

describe('createBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls create_booking RPC and returns data', async () => {
    const payload = { appointment_date: '2026-04-20', start_time: '10:00', services: [] }
    const result = { id: 'b1', reference_id: 'BK000001' }
    supabase.rpc.mockResolvedValue({ data: result, error: null })
    const res = await createBooking(payload)
    expect(supabase.rpc).toHaveBeenCalledWith('create_booking', { payload })
    expect(res).toEqual(result)
  })

  it('throws SLOT_UNAVAILABLE when RPC returns that error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'SLOT_UNAVAILABLE' } })
    await expect(createBooking({})).rejects.toThrow('SLOT_UNAVAILABLE')
  })
})

describe('getMyBookings', () => {
  it('fetches upcoming bookings for a user', async () => {
    const data = [{ id: 'b1', booking_status: 'upcoming' }]
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyBookings('user-1')
    expect(res).toEqual(data)
  })
})

describe('getMyPastBookings', () => {
  it('fetches past bookings for a user', async () => {
    const data = [{ id: 'b2', booking_status: 'finished' }]
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyPastBookings('user-1')
    expect(res).toEqual(data)
  })
})

describe('getMyBookingById', () => {
  it('fetches a single booking by id', async () => {
    const data = { id: 'b1', reference_id: 'BK000001' }
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyBookingById('b1')
    expect(res).toEqual(data)
  })
})

describe('cancelMyBooking', () => {
  it('updates booking_status to cancelled', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: null, error: null }))
    await cancelMyBooking('b1', 'user-1')
    expect(supabase.from).toHaveBeenCalledWith('bookings')
  })

  it('throws on error', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error('DB error') })
    )
    await expect(cancelMyBooking('b1', 'user-1')).rejects.toThrow('DB error')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- customerBookingService --run
```

Expected: FAIL — module not found

- [ ] **Step 3: Create customerBookingService.js**

Create `src/services/customerBookingService.js`:

```js
import { supabase } from './supabaseClient'

const BOOKING_SELECT = `
  id, reference_id, appointment_date, start_time, total_duration_minutes,
  subtotal, downpayment_amount, remaining_balance, booking_status,
  downpayment_status, payment_deadline, booking_notes, staff_preference,
  booking_services(
    id, price_at_booking, duration_at_booking,
    services(id, name, service_categories(name))
  )
`

export const createBooking = async (payload) => {
  const { data, error } = await supabase.rpc('create_booking', { payload })
  if (error) throw new Error(error.message)
  return data
}

export const getMyBookings = async (userId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('customer_id', userId)
    .in('booking_status', ['upcoming'])
    .order('appointment_date', { ascending: true })
  if (error) throw error
  return data
}

export const getMyPastBookings = async (userId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('customer_id', userId)
    .in('booking_status', ['finished', 'cancelled', 'no_show'])
    .order('appointment_date', { ascending: false })
  if (error) throw error
  return data
}

export const getMyBookingById = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      BOOKING_SELECT +
        ', payments(id, reference_number, account_name, receipt_url, amount, status)'
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const cancelMyBooking = async (id, userId) => {
  const { error } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
    })
    .eq('id', id)
    .eq('customer_id', userId)
  if (error) throw error
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- customerBookingService --run
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/customerBookingService.js src/services/customerBookingService.test.js
git commit -m "feat: add customerBookingService"
```

---

### Task 8: Availability Service

**Files:**
- Create: `src/services/availabilityService.js`
- Create: `src/services/availabilityService.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/services/availabilityService.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getAvailableSlots } from './availabilityService'

describe('getAvailableSlots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls get_available_slots with correct params', async () => {
    const blocked = [{ start_time: '10:00', duration_minutes: 60 }]
    supabase.rpc.mockResolvedValue({ data: blocked, error: null })
    const result = await getAvailableSlots(null, '2026-04-20', 'any')
    expect(supabase.rpc).toHaveBeenCalledWith('get_available_slots', {
      p_staff_id: null,
      p_date: '2026-04-20',
      p_preference: 'any',
    })
    expect(result).toEqual(blocked)
  })

  it('passes specific staff id for specific preference', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    await getAvailableSlots('staff-uuid', '2026-04-20', 'specific')
    expect(supabase.rpc).toHaveBeenCalledWith('get_available_slots', {
      p_staff_id: 'staff-uuid',
      p_date: '2026-04-20',
      p_preference: 'specific',
    })
  })

  it('throws on RPC error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') })
    await expect(getAvailableSlots(null, '2026-04-20', 'any')).rejects.toThrow('RPC error')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- availabilityService --run
```

Expected: FAIL — module not found

- [ ] **Step 3: Create availabilityService.js**

Create `src/services/availabilityService.js`:

```js
import { supabase } from './supabaseClient'

export const getAvailableSlots = async (staffId, date, preference) => {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_staff_id: staffId,
    p_date: date,
    p_preference: preference,
  })
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- availabilityService --run
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/availabilityService.js src/services/availabilityService.test.js
git commit -m "feat: add availabilityService"
```

---

### Task 9: Customer Profile Service

**Files:**
- Create: `src/services/customerProfileService.js`
- Create: `src/services/customerProfileService.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/services/customerProfileService.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { supabase } from './supabaseClient'
import { getMyProfile, updateMyProfile, uploadAvatar } from './customerProfileService'

describe('getMyProfile', () => {
  it('fetches profile by userId', async () => {
    const data = { id: 'u1', first_name: 'Ana', last_name: 'Santos' }
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyProfile('u1')
    expect(res).toEqual(data)
  })

  it('throws on error', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error('DB error') })
    )
    await expect(getMyProfile('u1')).rejects.toThrow('DB error')
  })
})

describe('updateMyProfile', () => {
  it('calls update on profiles table', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: null, error: null }))
    await updateMyProfile('u1', { first_name: 'Ana' })
    expect(supabase.from).toHaveBeenCalledWith('profiles')
  })
})

describe('uploadAvatar', () => {
  it('uploads file and returns public URL', async () => {
    const mockFile = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const storageMock = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://cdn.example.com/avatars/u1/photo.jpg' },
      }),
    }
    supabase.storage.from.mockReturnValue(storageMock)
    const url = await uploadAvatar(mockFile, 'u1')
    expect(storageMock.upload).toHaveBeenCalled()
    expect(url).toBe('https://cdn.example.com/avatars/u1/photo.jpg')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- customerProfileService --run
```

Expected: FAIL — module not found

- [ ] **Step 3: Create customerProfileService.js**

Create `src/services/customerProfileService.js`:

```js
import { supabase } from './supabaseClient'

export const getMyProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone_number, date_of_birth, gender, avatar_url')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateMyProfile = async (userId, payload) => {
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
  if (error) throw error
}

export const uploadAvatar = async (file, userId) => {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- customerProfileService --run
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/customerProfileService.js src/services/customerProfileService.test.js
git commit -m "feat: add customerProfileService"
```

---

### Task 10: Staff Service

**Files:**
- Create: `src/services/staffService.js`
- Create: `src/services/staffService.test.js`

- [ ] **Step 1: Write failing test**

Create `src/services/staffService.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getStaffList } from './staffService'

describe('getStaffList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls get_staff_list RPC and returns data', async () => {
    const data = [{ id: 's1', first_name: 'Maria', last_name: 'Cruz', avatar_url: null }]
    supabase.rpc.mockResolvedValue({ data, error: null })
    const result = await getStaffList()
    expect(supabase.rpc).toHaveBeenCalledWith('get_staff_list')
    expect(result).toEqual(data)
  })

  it('throws on RPC error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') })
    await expect(getStaffList()).rejects.toThrow('RPC error')
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- staffService --run
```

Expected: FAIL — module not found

- [ ] **Step 3: Create staffService.js**

Create `src/services/staffService.js`:

```js
import { supabase } from './supabaseClient'

export const getStaffList = async () => {
  const { data, error } = await supabase.rpc('get_staff_list')
  if (error) throw error
  return data
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- staffService --run
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/staffService.js src/services/staffService.test.js
git commit -m "feat: add staffService"
```

---

### Task 11: CustomerRoute Auth Guard

**Files:**
- Create: `src/components/layout/CustomerRoute.jsx`
- Create: `src/components/layout/CustomerRoute.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/layout/CustomerRoute.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../store/authStore')
import useAuthStore from '../../store/authStore'

vi.mock('../ui/Spinner', () => ({ default: () => <div>Loading...</div> }))

import CustomerRoute from './CustomerRoute'

const renderRoute = (storeState) => {
  useAuthStore.mockReturnValue(storeState)
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<CustomerRoute />}>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Route>
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CustomerRoute', () => {
  it('shows spinner while loading', () => {
    renderRoute({ loading: true, profile: null })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to /login when no profile', () => {
    renderRoute({ loading: false, profile: null })
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects to /login when role is admin', () => {
    renderRoute({ loading: false, profile: { role: 'admin' } })
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects to /login when role is staff', () => {
    renderRoute({ loading: false, profile: { role: 'staff' } })
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('renders outlet when role is customer', () => {
    renderRoute({ loading: false, profile: { role: 'customer' } })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- CustomerRoute --run
```

Expected: FAIL — module not found

- [ ] **Step 3: Create CustomerRoute.jsx**

Create `src/components/layout/CustomerRoute.jsx`:

```jsx
import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import Spinner from '../ui/Spinner'

const CustomerRoute = () => {
  const { loading, profile } = useAuthStore()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!profile || profile.role !== 'customer') {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export default CustomerRoute
```

- [ ] **Step 4: Run tests**

```bash
npm test -- CustomerRoute --run
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/CustomerRoute.jsx src/components/layout/CustomerRoute.test.jsx
git commit -m "feat: add CustomerRoute auth guard"
```

---

### Task 12: Auth-Aware Navbar

**Files:**
- Modify: `src/components/Navbar/index.jsx`
- Create/Modify: `src/components/Navbar/index.test.jsx`

- [ ] **Step 1: Read the current Navbar**

Read `src/components/Navbar/index.jsx` to understand existing structure and classes before editing.

- [ ] **Step 2: Write failing tests**

Create `src/components/Navbar/index.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../store/authStore')
import useAuthStore from '../../store/authStore'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({}) } },
}))

import Navbar from './index'

const render_ = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  )

describe('Navbar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows Log in when no profile', () => {
    useAuthStore.mockReturnValue({ profile: null, clear: vi.fn() })
    render_()
    expect(screen.getByText(/log in/i)).toBeInTheDocument()
  })

  it('shows customer links when profile.role is customer', () => {
    useAuthStore.mockReturnValue({ profile: { role: 'customer' }, clear: vi.fn() })
    render_()
    expect(screen.getByText(/my appointment/i)).toBeInTheDocument()
    expect(screen.getByText(/profile/i)).toBeInTheDocument()
    expect(screen.getByText(/log out/i)).toBeInTheDocument()
  })

  it('does not show customer links for admin role', () => {
    useAuthStore.mockReturnValue({ profile: { role: 'admin' }, clear: vi.fn() })
    render_()
    expect(screen.queryByText(/my appointment/i)).not.toBeInTheDocument()
  })

  it('calls supabase.auth.signOut and clear on Log out click', async () => {
    const clear = vi.fn()
    useAuthStore.mockReturnValue({ profile: { role: 'customer' }, clear })
    render_()
    fireEvent.click(screen.getByText(/log out/i))
    const { supabase } = await import('../../services/supabaseClient')
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run to confirm it fails**

```bash
npm test -- "Navbar/index" --run
```

Expected: FAIL

- [ ] **Step 4: Update Navbar**

In `src/components/Navbar/index.jsx`:

1. Add imports at the top (after existing imports):

```jsx
import useAuthStore from '../../store/authStore'
import { supabase } from '../../services/supabaseClient'
```

2. Inside the component function, add:

```jsx
const { profile, clear } = useAuthStore()

const handleLogout = async () => {
  await supabase.auth.signOut()
  clear()
}
```

3. Replace the static "Log in / Sign up" section with:

```jsx
{profile?.role === 'customer' ? (
  <>
    <Link to="/dashboard">My Appointment</Link>
    <Link to="/profile">Profile</Link>
    <button onClick={handleLogout}>Log out</button>
  </>
) : (
  <>
    <Link to="/login">Log in</Link>
    <Link to="/signup">Sign up</Link>
  </>
)}
```

Keep all existing markup, classes, and non-auth links exactly as they are.

- [ ] **Step 5: Run tests**

```bash
npm test -- "Navbar/index" --run
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar/index.jsx src/components/Navbar/index.test.jsx
git commit -m "feat: make Navbar auth-aware for customer role"
```

---

### Task 13: App.jsx Routing + Stub Pages

**Files:**
- Modify: `src/App.jsx`
- Create: `src/pages/customer/` (10 stub files)

- [ ] **Step 1: Create stub page files**

Create each file below with the exact content shown (replace the final content in later tasks):

`src/pages/customer/ServicesStep.jsx`:
```jsx
const ServicesStep = () => <div>Services Step</div>
export default ServicesStep
```

`src/pages/customer/StaffStep.jsx`:
```jsx
const StaffStep = () => <div>Staff Step</div>
export default StaffStep
```

`src/pages/customer/DateTimeStep.jsx`:
```jsx
const DateTimeStep = () => <div>Date Time Step</div>
export default DateTimeStep
```

`src/pages/customer/ReviewStep.jsx`:
```jsx
const ReviewStep = () => <div>Review Step</div>
export default ReviewStep
```

`src/pages/customer/PaymentStep.jsx`:
```jsx
const PaymentStep = () => <div>Payment Step</div>
export default PaymentStep
```

`src/pages/customer/SuccessPage.jsx`:
```jsx
const SuccessPage = () => <div>Success Page</div>
export default SuccessPage
```

`src/pages/customer/Dashboard.jsx`:
```jsx
const Dashboard = () => <div>Dashboard</div>
export default Dashboard
```

`src/pages/customer/AppointmentsHistory.jsx`:
```jsx
const AppointmentsHistory = () => <div>Appointments History</div>
export default AppointmentsHistory
```

`src/pages/customer/Profile.jsx`:
```jsx
const Profile = () => <div>Profile</div>
export default Profile
```

`src/pages/customer/ProfileEdit.jsx`:
```jsx
const ProfileEdit = () => <div>Profile Edit</div>
export default ProfileEdit
```

- [ ] **Step 2: Read App.jsx**

Read `src/App.jsx` to understand current route structure before modifying.

- [ ] **Step 3: Add CustomerRoute and all customer routes to App.jsx**

Add these imports at the top of `src/App.jsx`:

```jsx
import CustomerRoute from './components/layout/CustomerRoute'
import ServicesStep from './pages/customer/ServicesStep'
import StaffStep from './pages/customer/StaffStep'
import DateTimeStep from './pages/customer/DateTimeStep'
import ReviewStep from './pages/customer/ReviewStep'
import PaymentStep from './pages/customer/PaymentStep'
import SuccessPage from './pages/customer/SuccessPage'
import Dashboard from './pages/customer/Dashboard'
import AppointmentsHistory from './pages/customer/AppointmentsHistory'
import Profile from './pages/customer/Profile'
import ProfileEdit from './pages/customer/ProfileEdit'
```

Add inside `<Routes>` (alongside existing AdminRoute and StaffRoute blocks):

```jsx
<Route element={<CustomerRoute />}>
  <Route path="/booking/services" element={<ServicesStep />} />
  <Route path="/booking/staff" element={<StaffStep />} />
  <Route path="/booking/datetime" element={<DateTimeStep />} />
  <Route path="/booking/review" element={<ReviewStep />} />
  <Route path="/booking/payment/:bookingId" element={<PaymentStep />} />
  <Route path="/booking/success/:bookingId" element={<SuccessPage />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/appointments/history" element={<AppointmentsHistory />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/profile/edit" element={<ProfileEdit />} />
</Route>
```

- [ ] **Step 4: Install react-hot-toast if not present**

```bash
npm list react-hot-toast || npm install react-hot-toast
```

Add `<Toaster />` from `react-hot-toast` inside `App.jsx`'s return (alongside the `<Router>` block).

- [ ] **Step 5: Manual verification**

Run `npm run dev`. Log in as a customer role user. Navigate to `/dashboard` — confirm stub renders. Navigate to `/dashboard` while logged out — confirm redirect to `/login`. Navigate to `/dashboard` while logged in as admin — confirm redirect to `/login`.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/pages/customer/
git commit -m "feat: wire CustomerRoute and stub customer pages into App.jsx"
```

---

### Task 14: Step 1 — Service Selection

**Files:**
- Modify: `src/pages/customer/ServicesStep.jsx`
- Create: `src/components/customer/BookingSidebar.jsx`

- [ ] **Step 1: Create BookingSidebar**

Create `src/components/customer/BookingSidebar.jsx`:

```jsx
import useBookingStore from '../../store/bookingStore'
import { formatDuration } from '../../utils/bookingUtils'

const BookingSidebar = ({ onContinue, continueDisabled }) => {
  const { cart } = useBookingStore()
  const subtotal = cart.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0)
  const downPayment = subtotal * 0.1

  return (
    <div className="w-72 shrink-0 border rounded p-4 h-fit sticky top-6">
      <h2 className="font-bold text-lg mb-3">Your Booking</h2>
      {cart.length === 0 ? (
        <p className="text-sm text-gray-400">No services selected</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {cart.map((s) => (
            <li key={s.id} className="flex justify-between text-sm">
              <span>[{s.category_name}] {s.name}</span>
              <span>₱{s.price}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t pt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Total</span>
          <span>₱{subtotal}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Down Payment (10%)</span>
          <span>₱{downPayment.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Duration</span>
          <span>{totalDuration > 0 ? formatDuration(totalDuration) : '—'}</span>
        </div>
      </div>
      <button
        onClick={onContinue}
        disabled={continueDisabled}
        className="mt-4 w-full bg-black text-white py-2 rounded disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}

export default BookingSidebar
```

- [ ] **Step 2: Implement ServicesStep**

Replace `src/pages/customer/ServicesStep.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import { getAllActiveServices } from '../../services/servicesCmsService'
import BookingSidebar from '../../components/customer/BookingSidebar'

const ServicesStep = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { cart, addToCart, removeFromCart } = useBookingStore()
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllActiveServices().then((data) => {
      setServices(data)
      setCategories(['All', ...new Set(data.map((s) => s.category_name))])
      setLoading(false)
      const preselect = searchParams.get('service')
      if (preselect) {
        const svc = data.find((s) => s.id === preselect)
        if (svc && !cart.find((c) => c.id === svc.id)) addToCart(svc)
      }
    })
  }, [])

  const filtered = services.filter((s) => {
    const matchCat = selectedCategory === 'All' || s.category_name === selectedCategory
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const isInCart = (id) => cart.some((c) => c.id === id)

  if (loading) return <div className="p-8 text-center">Loading services...</div>

  return (
    <div className="flex gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">Select Services</h1>
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
        />
        <div className="flex gap-2 flex-wrap mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'px-3 py-1 rounded-full text-sm border',
                selectedCategory === cat ? 'bg-black text-white' : 'bg-white text-black'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filtered.map((svc) => (
            <div key={svc.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <p className="font-medium">{svc.name}</p>
                <p className="text-sm text-gray-500">
                  {svc.category_name} · {svc.duration_minutes} min · ₱{svc.price}
                </p>
              </div>
              <button
                onClick={() => (isInCart(svc.id) ? removeFromCart(svc.id) : addToCart(svc))}
                className={clsx(
                  'px-3 py-1 rounded text-sm',
                  isInCart(svc.id)
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-700'
                )}
              >
                {isInCart(svc.id) ? '− Remove' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <BookingSidebar
        onContinue={() => navigate('/booking/staff')}
        continueDisabled={cart.length === 0}
      />
    </div>
  )
}

export default ServicesStep
```

- [ ] **Step 3: Manual test**

Navigate to `/booking/services`. Confirm: services load, search filters correctly, category pills filter correctly, `+ Add` / `− Remove` toggles work, sidebar shows subtotal and duration, Continue is disabled when cart is empty, Continue navigates to `/booking/staff`.

Also test `?service=<id>` param: visit `/booking/services?service=<a valid service id>` — the service should be pre-added to cart.

- [ ] **Step 4: Commit**

```bash
git add src/pages/customer/ServicesStep.jsx src/components/customer/BookingSidebar.jsx
git commit -m "feat: implement booking step 1 — service selection"
```

---

### Task 15: Step 2 — Professional Selection

**Files:**
- Modify: `src/pages/customer/StaffStep.jsx`

- [ ] **Step 1: Implement StaffStep**

Replace `src/pages/customer/StaffStep.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useBookingStore from '../../store/bookingStore'
import { getStaffList } from '../../services/staffService'
import BookingSidebar from '../../components/customer/BookingSidebar'

const GENERIC_OPTIONS = [
  { id: 'any', label: 'Any professional', preference: 'any' },
  { id: 'any_female', label: 'Any female professional', preference: 'any_female' },
  { id: 'any_male', label: 'Any male professional', preference: 'any_male' },
]

const StaffStep = () => {
  const navigate = useNavigate()
  const { cart, staffPreference, setStaffPreference, setSelectedStaff } = useBookingStore()
  const [staff, setStaff] = useState([])

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/booking/services', { replace: true })
      return
    }
    getStaffList().then(setStaff)
  }, [])

  const handleGenericSelect = (pref) => {
    setStaffPreference(pref)
    navigate('/booking/datetime')
  }

  const handleSpecificSelect = (staffId) => {
    setStaffPreference('specific')
    setSelectedStaff(staffId)
    navigate('/booking/datetime')
  }

  return (
    <div className="flex gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">Choose a Professional</h1>
        <div className="space-y-2 mb-6">
          {GENERIC_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleGenericSelect(opt.preference)}
              className="w-full text-left border rounded p-3 hover:bg-gray-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <h2 className="font-semibold mb-2">Specific professional</h2>
        <div className="grid grid-cols-2 gap-3">
          {staff.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSpecificSelect(s.id)}
              className="border rounded p-3 flex items-center gap-3 hover:bg-gray-50 text-left"
            >
              {s.avatar_url ? (
                <img
                  src={s.avatar_url}
                  alt={s.first_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                  {s.first_name?.[0]}
                </div>
              )}
              <span>{s.first_name} {s.last_name}</span>
            </button>
          ))}
        </div>
      </div>
      <BookingSidebar
        onContinue={() => navigate('/booking/datetime')}
        continueDisabled={!staffPreference}
      />
    </div>
  )
}

export default StaffStep
```

- [ ] **Step 2: Manual test**

Navigate to `/booking/staff` (with items in cart). Confirm: generic options appear at top, staff cards load below, clicking any option immediately navigates to `/booking/datetime`. Navigate to `/booking/staff` with empty cart — confirm redirect to `/booking/services`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/StaffStep.jsx
git commit -m "feat: implement booking step 2 — professional selection"
```

---

### Task 16: Step 3 — Date & Time Selection

**Files:**
- Modify: `src/pages/customer/DateTimeStep.jsx`
- Create: `src/components/customer/BookingCalendar.jsx`

- [ ] **Step 1: Create BookingCalendar**

Create `src/components/customer/BookingCalendar.jsx`:

```jsx
import { useState } from 'react'
import clsx from 'clsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const BookingCalendar = ({ onDateSelect, selectedDate }) => {
  const today = new Date()
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const toISO = (d) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const isPast = (d) =>
    new Date(year, month, d) <
    new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="border rounded p-4 max-w-sm">
      <div className="flex justify-between items-center mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
        <span className="font-semibold">
          {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
        {DAYS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((d, i) => (
          <div key={i}>
            {d && (
              <button
                disabled={isPast(d)}
                onClick={() => onDateSelect(toISO(d))}
                className={clsx(
                  'w-8 h-8 rounded-full text-sm mx-auto block',
                  isPast(d) && 'text-gray-300 cursor-not-allowed',
                  !isPast(d) && selectedDate === toISO(d) && 'bg-black text-white',
                  !isPast(d) && selectedDate !== toISO(d) && 'hover:bg-gray-100'
                )}
              >
                {d}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default BookingCalendar
```

- [ ] **Step 2: Implement DateTimeStep**

Replace `src/pages/customer/DateTimeStep.jsx` with:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import { getAvailableSlots } from '../../services/availabilityService'
import { generateTimeSlots } from '../../utils/bookingUtils'
import BookingSidebar from '../../components/customer/BookingSidebar'
import BookingCalendar from '../../components/customer/BookingCalendar'

const DateTimeStep = () => {
  const navigate = useNavigate()
  const { staffPreference, selectedStaffId, setDateTime } = useBookingStore()
  const [selectedDate, setSelectedDate] = useState(null)
  const [slots, setSlots] = useState([])
  const [selectedTime, setSelectedTime] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  if (!staffPreference) {
    navigate('/booking/staff', { replace: true })
    return null
  }

  const handleDateSelect = async (date) => {
    setSelectedDate(date)
    setSelectedTime(null)
    setLoadingSlots(true)
    const staffId = staffPreference === 'specific' ? selectedStaffId : null
    try {
      const blocked = await getAvailableSlots(staffId, date, staffPreference)
      setSlots(generateTimeSlots(blocked))
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleContinue = () => {
    setDateTime(selectedDate, selectedTime)
    navigate('/booking/review')
  }

  return (
    <div className="flex gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">Choose Date & Time</h1>
        <BookingCalendar onDateSelect={handleDateSelect} selectedDate={selectedDate} />
        {selectedDate && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">Available Times</h2>
            {loadingSlots ? (
              <p className="text-sm text-gray-400">Loading slots...</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={slot.blocked}
                    onClick={() => setSelectedTime(slot.time)}
                    className={clsx(
                      'py-2 rounded text-sm border',
                      slot.blocked && 'opacity-40 cursor-not-allowed bg-gray-100',
                      !slot.blocked && selectedTime === slot.time && 'bg-black text-white',
                      !slot.blocked && selectedTime !== slot.time && 'hover:bg-gray-50'
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <BookingSidebar
        onContinue={handleContinue}
        continueDisabled={!selectedDate || !selectedTime}
      />
    </div>
  )
}

export default DateTimeStep
```

- [ ] **Step 3: Manual test**

Navigate to `/booking/datetime`. Confirm: calendar renders with current month, past dates are grayed out, clicking a date fetches and shows time slots, blocked slots are grayed out, selecting a time slot enables Continue, Continue saves to store and navigates to `/booking/review`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/customer/DateTimeStep.jsx src/components/customer/BookingCalendar.jsx
git commit -m "feat: implement booking step 3 — date and time selection"
```

---

### Task 17: Step 4 — Review & Confirm

**Files:**
- Modify: `src/pages/customer/ReviewStep.jsx`

- [ ] **Step 1: Implement ReviewStep**

Replace `src/pages/customer/ReviewStep.jsx` with:

```jsx
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useBookingStore from '../../store/bookingStore'
import useAuthStore from '../../store/authStore'
import { createBooking } from '../../services/customerBookingService'
import { formatDuration } from '../../utils/bookingUtils'

const ReviewStep = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    cart,
    staffPreference,
    selectedStaffId,
    selectedDate,
    selectedTime,
    bookingNotes,
    setBookingNotes,
    clearBooking,
  } = useBookingStore()

  if (!selectedDate || !selectedTime) {
    navigate('/booking/datetime', { replace: true })
    return null
  }

  const subtotal = cart.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0)
  const downPayment = subtotal * 0.1
  const balance = subtotal - downPayment

  const [startH, startM] = selectedTime.split(':').map(Number)
  const endTotal = startH * 60 + startM + totalDuration
  const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

  const buildPayload = () => ({
    staff_id: selectedStaffId,
    staff_preference: staffPreference,
    appointment_date: selectedDate,
    start_time: selectedTime,
    total_duration_minutes: totalDuration,
    subtotal,
    downpayment_amount: downPayment,
    remaining_balance: balance,
    booking_notes: bookingNotes,
    services: cart.map((s) => ({
      id: s.id,
      price: s.price,
      duration_minutes: s.duration_minutes,
    })),
  })

  const handleReserve = async (goToPayment = false) => {
    try {
      const booking = await createBooking(buildPayload())
      if (goToPayment) {
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
    }
  }

  return (
    <div className="flex gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">Review & Confirm</h1>
        <div className="border rounded p-4 mb-4">
          <h2 className="font-semibold mb-2">Cancellation Policy</h2>
          <p className="text-sm text-gray-600">
            Cancellations must be made within 12 hours of booking creation.
            After that, your down payment may not be refunded.
          </p>
        </div>
        <div className="border rounded p-4 mb-4">
          <h2 className="font-semibold mb-2">Important Info</h2>
          <ul className="text-sm text-gray-600 space-y-1 list-disc pl-4">
            <li>Your slot is secured upon payment of the down payment.</li>
            <li>Final pricing may vary based on services rendered.</li>
            <li>You have 12 hours to complete the down payment.</li>
          </ul>
        </div>
        <div className="mb-6">
          <label className="block font-medium mb-1">Booking Notes</label>
          <textarea
            value={bookingNotes}
            onChange={(e) => setBookingNotes(e.target.value)}
            className="w-full border rounded p-2 text-sm"
            rows={3}
            placeholder="Any special requests or notes..."
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleReserve(false)}
            className="flex-1 border rounded py-2 font-medium hover:bg-gray-50"
          >
            Reserve Appointment
          </button>
          <button
            onClick={() => handleReserve(true)}
            className="flex-1 bg-black text-white rounded py-2 font-medium"
          >
            Reserve & Pay Down Payment
          </button>
        </div>
      </div>
      <div className="w-72 shrink-0 border rounded p-4 h-fit sticky top-6">
        <h2 className="font-bold text-lg mb-3">Your Booking</h2>
        <p className="text-sm mb-1">
          <strong>Date:</strong> {selectedDate}
        </p>
        <p className="text-sm mb-3">
          <strong>Time:</strong> {selectedTime} – {endTime} ({formatDuration(totalDuration)})
        </p>
        <ul className="space-y-1 mb-3 text-sm">
          {cart.map((s) => (
            <li key={s.id} className="flex justify-between">
              <span>[{s.category_name}] {s.name}</span>
              <span>₱{s.price}</span>
            </li>
          ))}
        </ul>
        <div className="border-t pt-2 space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>₱{subtotal}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Down Payment (10%)</span>
            <span>₱{downPayment.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Pay at venue</span>
            <span>₱{balance.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewStep
```

- [ ] **Step 2: Manual test**

Complete steps 1–3, then navigate to `/booking/review`. Confirm: booking summary shows correct date/time/services/prices, notes textarea works, both Reserve buttons call `createBooking`, SLOT_UNAVAILABLE error shows toast and redirects to `/booking/datetime`, successful reserve-only goes to `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/ReviewStep.jsx
git commit -m "feat: implement booking step 4 — review and confirm"
```

---

### Task 18: Step 5 — Down Payment

**Files:**
- Modify: `src/pages/customer/PaymentStep.jsx`

- [ ] **Step 1: Implement PaymentStep**

Replace `src/pages/customer/PaymentStep.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { supabase } from '../../services/supabaseClient'
import { getMyBookingById } from '../../services/customerBookingService'

const PaymentStep = () => {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [refNumber, setRefNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    getMyBookingById(bookingId).then(setBooking)
  }, [bookingId])

  const handleFile = (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Only JPG/JPEG files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB.')
      return
    }
    setReceipt(file)
  }

  const handleConfirm = async () => {
    if (!refNumber.match(/^\d{13}$/)) {
      toast.error('Reference number must be exactly 13 digits.')
      return
    }
    if (!accountName.trim()) {
      toast.error('Account name is required.')
      return
    }
    if (!receipt) {
      toast.error('Receipt image is required.')
      return
    }
    setSubmitting(true)
    try {
      const path = `${bookingId}/${receipt.name}`
      const { error: uploadErr } = await supabase.storage
        .from('payment-receipts')
        .upload(path, receipt)
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(path)

      const { error: insertErr } = await supabase.from('payments').insert({
        booking_id: bookingId,
        reference_number: refNumber,
        account_name: accountName,
        receipt_url: urlData.publicUrl,
        amount: booking.downpayment_amount,
        status: 'paid',
      })
      if (insertErr) throw insertErr

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ downpayment_status: 'paid' })
        .eq('id', bookingId)
      if (updateErr) throw updateErr

      navigate(`/booking/success/${bookingId}`)
    } catch {
      toast.error('Payment submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!booking) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="max-w-lg mx-auto p-6">
      <Link to="/dashboard" className="text-sm text-gray-500 hover:underline mb-4 block">
        ← Go Back to My Appointment
      </Link>
      <h1 className="text-2xl font-bold mb-2">Down Payment</h1>
      <p className="text-sm text-gray-600 mb-6">
        Amount due: <strong>₱{booking.downpayment_amount?.toFixed(2)}</strong>
      </p>
      <div className="flex gap-4 mb-6">
        <div className="border rounded p-4 text-center flex-1 text-sm text-gray-400">
          GCASH QR #1<br />
          <span className="text-xs">(place QR image here)</span>
        </div>
        <div className="border rounded p-4 text-center flex-1 text-sm text-gray-400">
          GCASH QR #2<br />
          <span className="text-xs">(place QR image here)</span>
        </div>
      </div>
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Reference Number (13 digits)
          </label>
          <input
            type="text"
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            maxLength={13}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Account Name</label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Receipt (JPG, max 5MB)</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFile(e.dataTransfer.files[0])
            }}
            onClick={() => document.getElementById('receipt-input').click()}
            className={`border-2 border-dashed rounded p-6 text-center cursor-pointer text-sm ${
              dragOver ? 'border-black bg-gray-50' : 'border-gray-300'
            }`}
          >
            {receipt ? receipt.name : 'Drag & drop or click to upload'}
            <input
              id="receipt-input"
              type="file"
              accept=".jpg,.jpeg"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        </div>
      </div>
      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Confirm Payment'}
      </button>
    </div>
  )
}

export default PaymentStep
```

- [ ] **Step 2: Manual test**

Navigate to `/booking/payment/<bookingId>`. Confirm: booking amount shows, file validation triggers for non-JPG and >5MB files, reference number validation triggers for non-13-digit input, successful submission navigates to `/booking/success/<bookingId>`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/PaymentStep.jsx
git commit -m "feat: implement booking step 5 — down payment"
```

---

### Task 19: Step 6 — Booking Confirmed

**Files:**
- Modify: `src/pages/customer/SuccessPage.jsx`

- [ ] **Step 1: Implement SuccessPage**

Replace `src/pages/customer/SuccessPage.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import useBookingStore from '../../store/bookingStore'
import { getMyBookingById } from '../../services/customerBookingService'
import { formatDuration } from '../../utils/bookingUtils'

const SuccessPage = () => {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const clearBooking = useBookingStore((s) => s.clearBooking)
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    getMyBookingById(bookingId).then(setBooking)
  }, [bookingId])

  const handleBackToDashboard = () => {
    clearBooking()
    navigate('/dashboard')
  }

  if (!booking) return <div className="p-8 text-center">Loading...</div>

  const services = booking.booking_services ?? []

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
        <h1 className="text-2xl font-bold mb-1">Booking Confirmed!</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Reference: #{booking.reference_id}
        </p>
        <div className="text-left border rounded p-4 mb-6 space-y-2 text-sm">
          <p><strong>Date:</strong> {booking.appointment_date}</p>
          <p>
            <strong>Time:</strong> {booking.start_time}{' '}
            ({formatDuration(booking.total_duration_minutes)})
          </p>
          <div>
            <strong>Services:</strong>
            <ul className="mt-1 space-y-1">
              {services.map((bs) => (
                <li key={bs.id} className="flex justify-between">
                  <span>
                    [{bs.services?.service_categories?.name}] {bs.services?.name}
                  </span>
                  <span>₱{bs.price_at_booking}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t pt-2 space-y-1">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>₱{booking.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Down Payment Paid</span>
              <span>₱{booking.downpayment_amount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>To be paid at venue</span>
              <span>₱{booking.remaining_balance?.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleBackToDashboard}
          className="w-full bg-black text-white py-2 rounded"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default SuccessPage
```

- [ ] **Step 2: Manual test**

Complete a full booking flow (including payment). Confirm: SuccessPage shows all booking details, "Back to Home" clears sessionStorage booking data and navigates to `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/SuccessPage.jsx
git commit -m "feat: implement booking step 6 — booking confirmed"
```

---

### Task 20: Dashboard

**Files:**
- Modify: `src/pages/customer/Dashboard.jsx`
- Create: `src/components/customer/AppointmentCard.jsx`
- Create: `src/components/customer/AppointmentDetailModal.jsx`

- [ ] **Step 1: Create AppointmentCard**

Create `src/components/customer/AppointmentCard.jsx`:

```jsx
import clsx from 'clsx'
import { formatDuration } from '../../utils/bookingUtils'

const STATUS_LABEL = {
  pending: 'Pending',
  paid: 'Checking',
  verified: 'Paid',
  denied: 'Denied',
}

const AppointmentCard = ({ booking, onViewDetail, onPay, onCancel }) => {
  const services = booking.booking_services ?? []
  const isPending = booking.downpayment_status === 'pending'
  const deadline = booking.payment_deadline ? new Date(booking.payment_deadline) : null
  const hoursLeft = deadline
    ? Math.max(0, Math.round((deadline - Date.now()) / 3_600_000))
    : 0

  return (
    <div
      className="border rounded p-4 space-y-2 cursor-pointer hover:bg-gray-50"
      onClick={() => onViewDetail(booking)}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">#{booking.reference_id}</p>
          <p className="text-sm text-gray-500">
            {booking.appointment_date} · {booking.start_time} ·{' '}
            {formatDuration(booking.total_duration_minutes)}
          </p>
        </div>
        <span className="text-xs border rounded px-2 py-0.5 capitalize">
          {booking.booking_status}
        </span>
      </div>
      <ul className="text-sm space-y-0.5">
        {services.map((bs) => (
          <li key={bs.id}>
            [{bs.services?.service_categories?.name}] {bs.services?.name}
          </li>
        ))}
      </ul>
      <div className="flex justify-between items-center">
        <span
          className={clsx('rounded px-2 py-0.5 text-xs', {
            'bg-yellow-100 text-yellow-700': booking.downpayment_status === 'pending',
            'bg-blue-100 text-blue-700': booking.downpayment_status === 'paid',
            'bg-green-100 text-green-700': booking.downpayment_status === 'verified',
            'bg-red-100 text-red-700': booking.downpayment_status === 'denied',
          })}
        >
          {STATUS_LABEL[booking.downpayment_status] ?? booking.downpayment_status}
        </span>
        <span className="text-sm text-gray-500">
          Balance: ₱{booking.remaining_balance}
        </span>
      </div>
      {isPending && hoursLeft > 0 && (
        <p className="text-xs text-orange-500">
          Time left to pay: {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}
        </p>
      )}
      {booking.booking_status === 'upcoming' && (
        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          {isPending && (
            <button
              onClick={() => onPay(booking)}
              className="text-sm bg-black text-white px-3 py-1 rounded"
            >
              Pay Down Payment
            </button>
          )}
          <button
            onClick={() => onCancel(booking)}
            className="text-sm border px-3 py-1 rounded"
          >
            Cancel Reservation
          </button>
        </div>
      )}
    </div>
  )
}

export default AppointmentCard
```

- [ ] **Step 2: Create AppointmentDetailModal**

Create `src/components/customer/AppointmentDetailModal.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { formatDuration } from '../../utils/bookingUtils'

const AppointmentDetailModal = ({ booking, onClose }) => {
  const navigate = useNavigate()
  if (!booking) return null
  const services = booking.booking_services ?? []

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4">
          <X size={18} />
        </button>
        <h2 className="font-bold text-lg mb-1">#{booking.reference_id}</h2>
        <p className="text-sm text-gray-500 mb-3">
          {booking.appointment_date} · {booking.start_time}{' '}
          ({formatDuration(booking.total_duration_minutes)})
        </p>
        <div className="space-y-1 text-sm mb-3">
          {services.map((bs) => (
            <div key={bs.id} className="flex justify-between">
              <span>
                [{bs.services?.service_categories?.name}] {bs.services?.name}{' '}
                ({bs.duration_at_booking} min)
              </span>
              <span>₱{bs.price_at_booking}</span>
            </div>
          ))}
        </div>
        <p className="text-sm mb-1">
          Professional preference: {booking.staff_preference}
        </p>
        {booking.booking_notes && (
          <p className="text-sm mb-3 text-gray-500">Notes: {booking.booking_notes}</p>
        )}
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>₱{booking.subtotal}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Down Payment (10%)</span>
            <span>₱{booking.downpayment_amount?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Pay at venue</span>
            <span>₱{booking.remaining_balance?.toFixed(2)}</span>
          </div>
        </div>
        {booking.downpayment_status === 'pending' && (
          <button
            onClick={() => navigate(`/booking/payment/${booking.id}`)}
            className="mt-4 w-full bg-black text-white py-2 rounded"
          >
            Pay Down Payment
          </button>
        )}
      </div>
    </div>
  )
}

export default AppointmentDetailModal
```

- [ ] **Step 3: Implement Dashboard**

Replace `src/pages/customer/Dashboard.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { toast } from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import { getMyBookings, cancelMyBooking } from '../../services/customerBookingService'
import AppointmentCard from '../../components/customer/AppointmentCard'
import AppointmentDetailModal from '../../components/customer/AppointmentDetailModal'

const Dashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState(null)

  const load = () => {
    getMyBookings(user.id).then((data) => {
      setBookings(data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleCancel = async (booking) => {
    if (!window.confirm('Cancel this reservation?')) return
    try {
      await cancelMyBooking(booking.id, user.id)
      toast.success('Reservation cancelled.')
      load()
    } catch {
      toast.error('Could not cancel. Please try again.')
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Appointments</h1>
        <Link to="/appointments/history" className="text-sm text-gray-500 hover:underline">
          View Past Appointments
        </Link>
      </div>
      {bookings.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <Calendar size={48} className="mx-auto text-gray-300" />
          <p className="text-gray-500">No active appointments yet.</p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/booking/services"
              className="bg-black text-white px-4 py-2 rounded text-sm"
            >
              Book an appointment
            </Link>
            <Link
              to="/appointments/history"
              className="border px-4 py-2 rounded text-sm"
            >
              View Past Appointments
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <AppointmentCard
              key={b.id}
              booking={b}
              onViewDetail={setSelectedBooking}
              onPay={(b) => navigate(`/booking/payment/${b.id}`)}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
      <AppointmentDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  )
}

export default Dashboard
```

- [ ] **Step 4: Manual test**

Navigate to `/dashboard`. Confirm: empty state shows for a new customer with both action buttons, active bookings render with correct status badges, downpayment badge shows "Pending"/"Checking"/"Paid"/"Denied" mapping correctly, clicking a card opens detail modal, "Pay Down Payment" navigates to payment page, "Cancel Reservation" shows confirmation dialog and cancels booking.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/Dashboard.jsx src/components/customer/AppointmentCard.jsx src/components/customer/AppointmentDetailModal.jsx
git commit -m "feat: implement customer dashboard"
```

---

### Task 21: Past Appointments, Profile, and Profile Edit

**Files:**
- Modify: `src/pages/customer/AppointmentsHistory.jsx`
- Modify: `src/pages/customer/Profile.jsx`
- Modify: `src/pages/customer/ProfileEdit.jsx`

- [ ] **Step 1: Implement AppointmentsHistory**

Replace `src/pages/customer/AppointmentsHistory.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { getMyPastBookings } from '../../services/customerBookingService'
import AppointmentCard from '../../components/customer/AppointmentCard'

const AppointmentsHistory = () => {
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyPastBookings(user.id).then((data) => {
      setBookings(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="text-sm text-gray-500 hover:underline">
          ← Go Back
        </Link>
        <h1 className="text-2xl font-bold">Past Appointments</h1>
      </div>
      {bookings.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-500">No past appointments.</p>
          <Link
            to="/booking/services"
            className="bg-black text-white px-4 py-2 rounded text-sm inline-block"
          >
            Book an appointment
          </Link>
          <Link to="/dashboard" className="block text-sm text-gray-500 hover:underline">
            Back
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <AppointmentCard
              key={b.id}
              booking={b}
              onViewDetail={() => {}}
              onPay={() => {}}
              onCancel={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AppointmentsHistory
```

- [ ] **Step 2: Implement Profile**

Replace `src/pages/customer/Profile.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { getMyProfile, uploadAvatar, updateMyProfile } from '../../services/customerProfileService'

const FIELDS = [
  ['First Name', 'first_name'],
  ['Last Name', 'last_name'],
  ['Phone Number', 'phone_number'],
  ['Date of Birth', 'date_of_birth'],
  ['Gender', 'gender'],
]

const Profile = () => {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    getMyProfile(user.id).then(setProfile)
  }, [])

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = await uploadAvatar(file, user.id)
    await updateMyProfile(user.id, { avatar_url: url })
    setProfile((p) => ({ ...p, avatar_url: url }))
  }

  if (!profile) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      <div className="relative w-24 h-24 mx-auto mb-6">
        <img
          src={profile.avatar_url ?? 'https://via.placeholder.com/96'}
          alt="Avatar"
          className="w-24 h-24 rounded-full object-cover"
        />
        <label className="absolute bottom-0 right-0 bg-white border rounded-full p-1 cursor-pointer">
          <Pencil size={14} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </label>
      </div>
      <div className="space-y-3 text-sm">
        {FIELDS.map(([label, key]) => (
          <div key={key} className="flex justify-between border-b pb-2">
            <span className="text-gray-500">{label}</span>
            <span>{profile[key] ?? '—'}</span>
          </div>
        ))}
      </div>
      <Link
        to="/profile/edit"
        className="mt-6 w-full bg-black text-white py-2 rounded block text-center text-sm"
      >
        Edit
      </Link>
    </div>
  )
}

export default Profile
```

- [ ] **Step 3: Implement ProfileEdit**

Replace `src/pages/customer/ProfileEdit.jsx` with:

```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import { getMyProfile, updateMyProfile } from '../../services/customerProfileService'

const ProfileEdit = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getMyProfile(user.id).then((p) => {
      setForm({
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        phone_number: p.phone_number ?? '',
        date_of_birth: p.date_of_birth ?? '',
        gender: p.gender ?? '',
      })
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMyProfile(user.id, form)
      toast.success('Profile updated.')
      navigate('/profile')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const field = (key, label, type = 'text') => (
    <div key={key}>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </div>
  )

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>
      <div className="space-y-4">
        {field('first_name', 'First Name')}
        {field('last_name', 'Last Name')}
        {field('phone_number', 'Phone Number', 'tel')}
        {field('date_of_birth', 'Date of Birth', 'date')}
        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <select
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => navigate('/profile')}
          className="flex-1 border rounded py-2 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-black text-white rounded py-2 text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default ProfileEdit
```

- [ ] **Step 4: Manual test**

Navigate to `/appointments/history` — confirm past bookings list, empty state shows correct buttons. Navigate to `/profile` — confirm all fields display, clicking avatar pencil opens file picker and updates photo. Navigate to `/profile/edit` — confirm all fields pre-filled, Save updates and redirects to `/profile`, Cancel goes back.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/AppointmentsHistory.jsx src/pages/customer/Profile.jsx src/pages/customer/ProfileEdit.jsx
git commit -m "feat: implement past appointments, profile view, and profile edit"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| CustomerRoute auth guard (role=customer) | Task 11 |
| Auth-aware Navbar (customer links + log out) | Task 12 |
| bookingStore with sessionStorage persist | Task 6 |
| Step 1: service selection + search + category filter | Task 14 |
| Step 1: ?service= URL param pre-selects service | Task 14 |
| Step 2: 3 generic options + specific staff cards | Task 15 |
| Step 2: redirect to /booking/services if cart empty | Task 15 |
| Step 3: calendar renders current month | Task 16 |
| Step 3: 22 slots 09:00–19:30, blocked slots grayed | Task 16 |
| Step 4: cancellation policy + important info | Task 17 |
| Step 4: Reserve vs Reserve+Pay buttons | Task 17 |
| Step 4: SLOT_UNAVAILABLE toast + redirect | Task 17 |
| Step 5: GCash QR placeholders | Task 18 |
| Step 5: 13-digit ref, account name, JPG receipt | Task 18 |
| Step 5: drag-and-drop upload | Task 18 |
| Step 5: upload to payment-receipts bucket | Task 18 |
| Step 5: insert payments row + update downpayment_status | Task 18 |
| Step 6: minimal layout, no nav/footer | Task 19 |
| Step 6: clearBooking on "Back to Home" | Task 19 |
| Dashboard: empty state with two action buttons | Task 20 |
| Dashboard: appointment cards with status badges | Task 20 |
| Downpayment badge: pending→Pending, paid→Checking, verified→Paid, denied→Denied | Task 20 |
| "Time left to pay" countdown | Task 20 |
| Cancel within 12h (confirm dialog) | Task 20 |
| Appointment detail modal | Task 20 |
| Past appointments list | Task 21 |
| Profile view with avatar upload | Task 21 |
| Profile edit form | Task 21 |
| get_staff_list RPC | Task 1 |
| get_available_slots RPC | Task 2 |
| create_booking RPC with advisory lock | Task 3 |
| payment-receipts storage bucket | Task 1 |
| avatars storage bucket | Task 1 |
| getAllActiveServices | Task 4 |
| generateTimeSlots (22 slots, overlap detection) | Task 5 |
| formatDuration | Task 5 |
| customerBookingService | Task 7 |
| availabilityService | Task 8 |
| customerProfileService | Task 9 |
| staffService | Task 10 |
| All 10 routes wired in App.jsx | Task 13 |

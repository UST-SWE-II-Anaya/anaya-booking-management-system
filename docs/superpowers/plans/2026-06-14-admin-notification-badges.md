# Admin Notification Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time sidebar badge counts and per-row "unseen" highlighting for Bookings, Leave Requests, and Inquiries in the admin portal.

**Architecture:** A Zustand `notificationStore` holds counts and unseen ID sets for all three sections, populated once on `AdminLayout` mount and kept live via three Supabase Realtime channels (one per table). Pages read `unseenIds` from the store to highlight rows; opening an item calls `markItemViewed` (DB write) then `resolveItem` (store update). All count-going-down logic flows exclusively through realtime UPDATE/DELETE listeners — page action buttons never touch the store directly.

**Tech Stack:** Supabase (postgres_changes realtime), Zustand, Vitest + Testing Library, Tailwind CSS v4, React 18, `clsx`

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/20260614000001_admin_viewed_items.sql` | Create — table, RLS, REPLICA IDENTITY, publication, 3 trigger sets |
| `src/services/notificationService.js` | Create — `getNotificationCounts`, `markItemViewed` |
| `src/services/notificationService.test.js` | Create — unit tests |
| `src/store/notificationStore.js` | Create — Zustand store with `setAllUnseen`, `increment`, `resolveItem` |
| `src/store/notificationStore.test.js` | Create — unit tests |
| `src/components/layout/AdminLayout.jsx` | Modify — add `useEffect` for init fetch + 3 realtime channels |
| `src/components/layout/AdminLayout.test.jsx` | Modify — add mocks for new deps |
| `src/components/layout/AdminSidebar.jsx` | Modify — add `badgeKey` to navItems, read store, render badge |
| `src/pages/admin/bookings/BookingsPage.jsx` | Modify — row tint + dot, `markItemViewed` on View/Verify |
| `src/pages/admin/staff/LeaveRequestsPage.jsx` | Modify — row tint + dot, `markItemViewed` on row click |

**InquiriesPage: no changes needed.** `openInquiry()` already calls `markRead()` which triggers the `resolved-inquiries` realtime listener, which calls `resolveItem('inquiries', id)` for all connected admins. Row highlighting already uses `inq.status === 'unread'`.

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260614000001_admin_viewed_items.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260614000001_admin_viewed_items.sql

-- 1. Table
CREATE TABLE IF NOT EXISTS admin_viewed_items (
  admin_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('booking', 'leave_request')),
  item_id   uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, item_type, item_id)
);

-- 2. RLS
ALTER TABLE admin_viewed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage own viewed items"
  ON admin_viewed_items
  FOR ALL
  USING  (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- 3. REPLICA IDENTITY FULL so UPDATE/DELETE realtime payloads include old row values
ALTER TABLE bookings      REPLICA IDENTITY FULL;
ALTER TABLE leave_requests REPLICA IDENTITY FULL;
ALTER TABLE inquiries     REPLICA IDENTITY FULL;

-- 4. Add tables to realtime publication (safe if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'leave_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inquiries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inquiries;
  END IF;
END $$;

-- 5. Trigger 1: Reset viewed state when customer submits payment proof
--    (downpayment_status → 'paid' means admin needs to re-review)
CREATE OR REPLACE FUNCTION reset_booking_viewed_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.downpayment_status IS DISTINCT FROM NEW.downpayment_status
     AND NEW.downpayment_status = 'paid' THEN
    DELETE FROM admin_viewed_items
    WHERE item_type = 'booking' AND item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_payment_viewed_reset
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION reset_booking_viewed_on_payment();

-- 6. Trigger 2: Clean up viewed rows when items are resolved (UPDATE)
CREATE OR REPLACE FUNCTION cleanup_viewed_on_resolve()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'leave_requests' THEN
    IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
      DELETE FROM admin_viewed_items
      WHERE item_type = 'leave_request' AND item_id = NEW.id;
    END IF;
  ELSIF TG_TABLE_NAME = 'bookings' THEN
    -- Remove viewed rows when booking is no longer actionable
    IF NOT (NEW.booking_status = 'pending' OR NEW.downpayment_status = 'paid') THEN
      DELETE FROM admin_viewed_items
      WHERE item_type = 'booking' AND item_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leave_request_resolved_cleanup
  AFTER UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION cleanup_viewed_on_resolve();

CREATE TRIGGER booking_resolved_cleanup
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION cleanup_viewed_on_resolve();

-- 7. Trigger 3: Orphan cleanup on DELETE
--    (item_id is polymorphic — no FK cascade possible)
CREATE OR REPLACE FUNCTION cleanup_viewed_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    DELETE FROM admin_viewed_items
    WHERE item_type = 'booking' AND item_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'leave_requests' THEN
    DELETE FROM admin_viewed_items
    WHERE item_type = 'leave_request' AND item_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_delete_cleanup
  BEFORE DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION cleanup_viewed_on_delete();

CREATE TRIGGER leave_request_delete_cleanup
  BEFORE DELETE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION cleanup_viewed_on_delete();
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

If the Supabase CLI is not configured locally, apply via the Supabase MCP tool `apply_migration` with the SQL above, or paste it into the Supabase Studio SQL editor.

- [ ] **Step 3: Verify in Supabase Studio**

- Table `admin_viewed_items` exists with correct columns and PK
- RLS is enabled and the policy appears
- All 5 triggers appear on their respective tables (`bookings` × 3, `leave_requests` × 2)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260614000001_admin_viewed_items.sql
git commit -m "feat: add admin_viewed_items table, RLS, and DB triggers"
```

---

## Task 2: Notification Service

**Files:**
- Create: `src/services/notificationService.js`
- Create: `src/services/notificationService.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/services/notificationService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getNotificationCounts, markItemViewed } from './notificationService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getNotificationCounts', () => {
  it('returns counts and unseenIds excluding viewed items', async () => {
    // bookings: two actionable, one already viewed
    const bookingsQb = createQueryBuilder({
      data: [{ id: 'b1' }, { id: 'b2' }], error: null,
    })
    // leave_requests: one pending, not viewed
    const leaveQb = createQueryBuilder({
      data: [{ id: 'lr1' }], error: null,
    })
    // inquiries: two unread
    const inquiriesQb = createQueryBuilder({
      data: [{ id: 'iq1' }, { id: 'iq2' }], error: null,
    })
    // admin_viewed_items for bookings: b1 already viewed
    const viewedBookingsQb = createQueryBuilder({
      data: [{ item_id: 'b1' }], error: null,
    })
    // admin_viewed_items for leave_requests: none viewed
    const viewedLeaveQb = createQueryBuilder({
      data: [], error: null,
    })

    supabase.from
      .mockReturnValueOnce(bookingsQb)
      .mockReturnValueOnce(leaveQb)
      .mockReturnValueOnce(inquiriesQb)
      .mockReturnValueOnce(viewedBookingsQb)
      .mockReturnValueOnce(viewedLeaveQb)

    const result = await getNotificationCounts('admin-id')

    expect(result.counts).toEqual({ bookings: 1, leaveRequests: 1, inquiries: 2 })
    expect(result.unseenIds.bookings).toEqual(new Set(['b2']))
    expect(result.unseenIds.leaveRequests).toEqual(new Set(['lr1']))
    expect(result.unseenIds.inquiries).toEqual(new Set(['iq1', 'iq2']))
  })

  it('throws when a query errors', async () => {
    const errQb = createQueryBuilder({ data: null, error: new Error('db error') })
    supabase.from.mockReturnValue(errQb)

    await expect(getNotificationCounts('admin-id')).rejects.toThrow('db error')
  })
})

describe('markItemViewed', () => {
  it('upserts into admin_viewed_items', async () => {
    const qb = createQueryBuilder({ data: null, error: null })
    supabase.from.mockReturnValue(qb)

    await markItemViewed('admin-id', 'booking', 'b1')

    expect(supabase.from).toHaveBeenCalledWith('admin_viewed_items')
    expect(qb.upsert).toHaveBeenCalledWith(
      { admin_id: 'admin-id', item_type: 'booking', item_id: 'b1' },
      { onConflict: 'admin_id,item_type,item_id' }
    )
  })

  it('throws when upsert errors', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('upsert failed') })
    supabase.from.mockReturnValue(qb)

    await expect(markItemViewed('admin-id', 'booking', 'b1')).rejects.toThrow('upsert failed')
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm run test -- notificationService --run
```

Expected: `Cannot find module './notificationService'`

- [ ] **Step 3: Add `upsert` to the query builder mock**

The mock in `src/test/mocks/supabaseMock.js` doesn't have `upsert`. Add it:

```js
// src/test/mocks/supabaseMock.js  (add inside the builder object)
upsert: vi.fn().mockReturnThis(),
```

The full updated builder object should include `upsert: vi.fn().mockReturnThis()` alongside the existing methods.

- [ ] **Step 4: Implement the service**

```js
// src/services/notificationService.js
import { supabase } from './supabaseClient'

export const getNotificationCounts = async (adminId) => {
  const [bookingsRes, leaveRes, inquiriesRes, viewedBookingsRes, viewedLeaveRes] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('id')
        .or('booking_status.eq.pending,downpayment_status.eq.paid'),
      supabase
        .from('leave_requests')
        .select('id')
        .eq('status', 'pending'),
      supabase
        .from('inquiries')
        .select('id')
        .eq('status', 'unread'),
      supabase
        .from('admin_viewed_items')
        .select('item_id')
        .eq('admin_id', adminId)
        .eq('item_type', 'booking'),
      supabase
        .from('admin_viewed_items')
        .select('item_id')
        .eq('admin_id', adminId)
        .eq('item_type', 'leave_request'),
    ])

  for (const res of [bookingsRes, leaveRes, inquiriesRes, viewedBookingsRes, viewedLeaveRes]) {
    if (res.error) throw res.error
  }

  const viewedBookingIds = new Set((viewedBookingsRes.data ?? []).map((r) => r.item_id))
  const viewedLeaveIds = new Set((viewedLeaveRes.data ?? []).map((r) => r.item_id))

  const unseenBookings = (bookingsRes.data ?? []).filter((r) => !viewedBookingIds.has(r.id))
  const unseenLeave = (leaveRes.data ?? []).filter((r) => !viewedLeaveIds.has(r.id))
  const unseenInquiries = inquiriesRes.data ?? []

  return {
    counts: {
      bookings: unseenBookings.length,
      leaveRequests: unseenLeave.length,
      inquiries: unseenInquiries.length,
    },
    unseenIds: {
      bookings: new Set(unseenBookings.map((r) => r.id)),
      leaveRequests: new Set(unseenLeave.map((r) => r.id)),
      inquiries: new Set(unseenInquiries.map((r) => r.id)),
    },
  }
}

export const markItemViewed = async (adminId, itemType, itemId) => {
  const { error } = await supabase
    .from('admin_viewed_items')
    .upsert(
      { admin_id: adminId, item_type: itemType, item_id: itemId },
      { onConflict: 'admin_id,item_type,item_id' }
    )
  if (error) throw error
}
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npm run test -- notificationService --run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/notificationService.js src/services/notificationService.test.js src/test/mocks/supabaseMock.js
git commit -m "feat: add notificationService with getNotificationCounts and markItemViewed"
```

---

## Task 3: Notification Store

**Files:**
- Create: `src/store/notificationStore.js`
- Create: `src/store/notificationStore.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/store/notificationStore.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import useNotificationStore from './notificationStore'

const reset = () =>
  useNotificationStore.setState({
    counts: { bookings: 0, leaveRequests: 0, inquiries: 0 },
    unseenIds: {
      bookings: new Set(),
      leaveRequests: new Set(),
      inquiries: new Set(),
    },
  })

beforeEach(reset)

describe('setAllUnseen', () => {
  it('sets counts and unseenIds together', () => {
    useNotificationStore.getState().setAllUnseen({
      counts: { bookings: 2, leaveRequests: 1, inquiries: 3 },
      unseenIds: {
        bookings: new Set(['b1', 'b2']),
        leaveRequests: new Set(['lr1']),
        inquiries: new Set(['iq1', 'iq2', 'iq3']),
      },
    })
    const s = useNotificationStore.getState()
    expect(s.counts).toEqual({ bookings: 2, leaveRequests: 1, inquiries: 3 })
    expect(s.unseenIds.bookings).toEqual(new Set(['b1', 'b2']))
  })
})

describe('increment', () => {
  it('increases count and adds id to unseenIds', () => {
    useNotificationStore.getState().increment('bookings', 'b1')
    const s = useNotificationStore.getState()
    expect(s.counts.bookings).toBe(1)
    expect(s.unseenIds.bookings.has('b1')).toBe(true)
  })

  it('can increment multiple sections independently', () => {
    useNotificationStore.getState().increment('inquiries', 'iq1')
    useNotificationStore.getState().increment('leaveRequests', 'lr1')
    const s = useNotificationStore.getState()
    expect(s.counts.inquiries).toBe(1)
    expect(s.counts.leaveRequests).toBe(1)
    expect(s.counts.bookings).toBe(0)
  })
})

describe('resolveItem', () => {
  it('removes id from unseenIds and decrements count', () => {
    useNotificationStore.setState({
      counts: { bookings: 1, leaveRequests: 0, inquiries: 0 },
      unseenIds: { bookings: new Set(['b1']), leaveRequests: new Set(), inquiries: new Set() },
    })
    useNotificationStore.getState().resolveItem('bookings', 'b1')
    const s = useNotificationStore.getState()
    expect(s.counts.bookings).toBe(0)
    expect(s.unseenIds.bookings.has('b1')).toBe(false)
  })

  it('is a no-op if id is not in unseenIds', () => {
    useNotificationStore.setState({
      counts: { bookings: 1, leaveRequests: 0, inquiries: 0 },
      unseenIds: { bookings: new Set(['b1']), leaveRequests: new Set(), inquiries: new Set() },
    })
    useNotificationStore.getState().resolveItem('bookings', 'not-there')
    expect(useNotificationStore.getState().counts.bookings).toBe(1)
  })

  it('never goes below zero', () => {
    useNotificationStore.getState().increment('bookings', 'b1')
    useNotificationStore.getState().resolveItem('bookings', 'b1')
    useNotificationStore.getState().resolveItem('bookings', 'b1') // second call — no-op
    expect(useNotificationStore.getState().counts.bookings).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm run test -- notificationStore --run
```

Expected: `Cannot find module './notificationStore'`

- [ ] **Step 3: Implement the store**

```js
// src/store/notificationStore.js
import { create } from 'zustand'

const useNotificationStore = create((set) => ({
  counts: { bookings: 0, leaveRequests: 0, inquiries: 0 },
  unseenIds: {
    bookings: new Set(),
    leaveRequests: new Set(),
    inquiries: new Set(),
  },

  setAllUnseen: ({ counts, unseenIds }) => set({ counts, unseenIds }),

  increment: (section, id) =>
    set((state) => {
      const newSet = new Set(state.unseenIds[section])
      newSet.add(id)
      return {
        counts: { ...state.counts, [section]: state.counts[section] + 1 },
        unseenIds: { ...state.unseenIds, [section]: newSet },
      }
    }),

  resolveItem: (section, id) =>
    set((state) => {
      if (!state.unseenIds[section]?.has(id)) return state
      const newSet = new Set(state.unseenIds[section])
      newSet.delete(id)
      return {
        counts: {
          ...state.counts,
          [section]: Math.max(0, state.counts[section] - 1),
        },
        unseenIds: { ...state.unseenIds, [section]: newSet },
      }
    }),
}))

export default useNotificationStore
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm run test -- notificationStore --run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/notificationStore.js src/store/notificationStore.test.js
git commit -m "feat: add notificationStore with increment and resolveItem"
```

---

## Task 4: AdminLayout — Init + Realtime Subscriptions

**Files:**
- Modify: `src/components/layout/AdminLayout.jsx`
- Modify: `src/components/layout/AdminLayout.test.jsx`

- [ ] **Step 1: Update the existing AdminLayout test to mock new dependencies**

Replace the full content of `src/components/layout/AdminLayout.test.jsx`:

```jsx
// src/components/layout/AdminLayout.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(() => ({
    user: { id: 'admin-uuid' },
    profile: { first_name: 'Ana', last_name: 'Admin', role: 'admin' },
  })),
}))

vi.mock('../../services/authService', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../services/notificationService', () => ({
  getNotificationCounts: vi.fn().mockResolvedValue({
    counts: { bookings: 0, leaveRequests: 0, inquiries: 0 },
    unseenIds: { bookings: new Set(), leaveRequests: new Set(), inquiries: new Set() },
  }),
}))

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}))

vi.mock('../../store/notificationStore', () => ({
  default: vi.fn(() => ({
    setAllUnseen: vi.fn(),
    increment: vi.fn(),
    resolveItem: vi.fn(),
    counts: { bookings: 0, leaveRequests: 0, inquiries: 0 },
    unseenIds: { bookings: new Set(), leaveRequests: new Set(), inquiries: new Set() },
  })),
}))

import AdminLayout from './AdminLayout'

const renderLayout = () =>
  render(
    <MemoryRouter>
      <AdminLayout />
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

describe('AdminLayout', () => {
  it('renders sidebar navigation links', () => {
    renderLayout()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Customers')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('Inquiries')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders admin name in header', () => {
    renderLayout()
    expect(screen.getByText('Ana Admin')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect the existing tests still pass (they will fail now because AdminLayout hasn't been updated yet — that's expected)**

```bash
npm run test -- AdminLayout --run
```

Expected: FAIL (import errors) — this is expected and confirms the mocks are wired correctly.

- [ ] **Step 3: Implement the updated AdminLayout**

Replace the full content of `src/components/layout/AdminLayout.jsx`:

```jsx
// src/components/layout/AdminLayout.jsx
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import useAuthStore from '../../store/authStore'
import useNotificationStore from '../../store/notificationStore'
import { getNotificationCounts } from '../../services/notificationService'
import { supabase } from '../../services/supabaseClient'

const AdminLayout = () => {
  const { user } = useAuthStore()
  const { setAllUnseen, increment, resolveItem } = useNotificationStore()

  useEffect(() => {
    if (!user?.id) return

    getNotificationCounts(user.id)
      .then(setAllUnseen)
      .catch(console.error)

    const bookingsCh = supabase
      .channel('admin-bookings')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        ({ new: n }) => increment('bookings', n.id)
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        ({ new: n, old: o }) => {
          if (o.downpayment_status !== 'paid' && n.downpayment_status === 'paid') {
            increment('bookings', n.id)
          }
          const wasActionable = o.booking_status === 'pending' || o.downpayment_status === 'paid'
          const isActionable = n.booking_status === 'pending' || n.downpayment_status === 'paid'
          if (wasActionable && !isActionable) resolveItem('bookings', n.id)
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'bookings' },
        ({ old: o }) => resolveItem('bookings', o.id)
      )
      .subscribe()

    const leaveCh = supabase
      .channel('admin-leave-requests')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leave_requests' },
        ({ new: n }) => increment('leaveRequests', n.id)
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
        ({ new: n, old: o }) => {
          if (o.status === 'pending' && n.status !== 'pending') {
            resolveItem('leaveRequests', n.id)
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leave_requests' },
        ({ old: o }) => resolveItem('leaveRequests', o.id)
      )
      .subscribe()

    const inquiriesCh = supabase
      .channel('admin-inquiries')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiries' },
        ({ new: n }) => increment('inquiries', n.id)
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inquiries' },
        ({ new: n, old: o }) => {
          if (o.status === 'unread' && n.status !== 'unread') {
            resolveItem('inquiries', n.id)
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'inquiries' },
        ({ old: o }) => resolveItem('inquiries', o.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(bookingsCh)
      supabase.removeChannel(leaveCh)
      supabase.removeChannel(inquiriesCh)
    }
  }, [user?.id, increment, resolveItem, setAllUnseen])

  return (
    <div className="flex min-h-screen bg-[#F9F8F5]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npm run test -- AdminLayout --run
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AdminLayout.jsx src/components/layout/AdminLayout.test.jsx
git commit -m "feat: init notification counts and realtime subscriptions in AdminLayout"
```

---

## Task 5: AdminSidebar — Badge UI

**Files:**
- Modify: `src/components/layout/AdminSidebar.jsx`

- [ ] **Step 1: Replace AdminSidebar with badge support**

```jsx
// src/components/layout/AdminSidebar.jsx
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Briefcase,
  Scissors,
  Mail,
  Settings,
  ClipboardList,
  QrCode,
  History,
} from 'lucide-react'
import clsx from 'clsx'
import useNotificationStore from '../../store/notificationStore'

const navItems = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarDays, badgeKey: 'bookings' },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Team', to: '/admin/staff', icon: Briefcase, end: true },
  { label: 'Leave Requests', to: '/admin/staff/leave-requests', icon: ClipboardList, badgeKey: 'leaveRequests' },
  { label: 'Services', to: '/admin/services', icon: Scissors },
  { label: 'Inquiries', to: '/admin/inquiries', icon: Mail, badgeKey: 'inquiries' },
  { label: 'QR Payment', to: '/admin/qr-payment', icon: QrCode },
  { label: 'Audit Log', to: '/admin/audit-log', icon: History },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]

const AdminSidebar = () => {
  const counts = useNotificationStore((s) => s.counts)

  return (
    <aside className="w-60 min-h-screen bg-[#2C2C2C] flex flex-col">
      <div className="px-6 py-6 border-b border-white/10">
        <span className="text-white font-serif text-xl font-semibold tracking-wide">
          Anaya
        </span>
        <p className="text-white/40 text-xs mt-0.5">Admin Portal</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ label, to, icon: Icon, end, badgeKey }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm',
                'transition-colors duration-150',
                isActive
                  ? 'bg-[#8A956D] text-white font-medium'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Icon size={16} />
            {label}
            {badgeKey && counts[badgeKey] > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] flex items-center
                justify-center rounded-full bg-[#CE845D] text-white text-[10px]
                font-bold px-1 leading-none">
                {counts[badgeKey] > 99 ? '99+' : counts[badgeKey]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default AdminSidebar
```

- [ ] **Step 2: Run all tests to check for regressions**

```bash
npm run test -- --run
```

Expected: all tests PASS (AdminLayout test mocks notificationStore, so badge rendering won't break existing assertions)

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AdminSidebar.jsx
git commit -m "feat: add notification badge counts to AdminSidebar nav items"
```

---

## Task 6: BookingsPage — Row Highlight + markViewed

**Files:**
- Modify: `src/pages/admin/bookings/BookingsPage.jsx`

- [ ] **Step 1: Add imports and hook up store + markViewed**

At the top of `src/pages/admin/bookings/BookingsPage.jsx`, add these imports after the existing ones:

```jsx
import clsx from 'clsx'
import useAuthStore from '../../../store/authStore'
import useNotificationStore from '../../../store/notificationStore'
import { markItemViewed } from '../../../services/notificationService'
```

- [ ] **Step 2: Add store reads inside the component**

Inside `BookingsPage`, after the existing state declarations, add:

```jsx
const { user } = useAuthStore()
const bookingUnseenIds = useNotificationStore((s) => s.unseenIds.bookings)
const resolveItem = useNotificationStore((s) => s.resolveItem)
```

- [ ] **Step 3: Add a helper to mark a booking viewed**

Inside `BookingsPage`, before the `return` statement, add:

```jsx
const handleMarkViewed = (id) => {
  if (!bookingUnseenIds.has(id)) return
  markItemViewed(user.id, 'booking', id).catch(console.error)
  resolveItem('bookings', id)
}
```

- [ ] **Step 4: Call handleMarkViewed from the View and Verify buttons**

Replace the existing View button `onClick`:

```jsx
// Before:
onClick={() => navigate(`/admin/bookings/${b.id}`)}

// After:
onClick={() => { handleMarkViewed(b.id); navigate(`/admin/bookings/${b.id}`) }}
```

Replace the existing Verify button `onClick`:

```jsx
// Before:
onClick={() => setVerifyModal(b)}

// After:
onClick={() => { handleMarkViewed(b.id); setVerifyModal(b) }}
```

- [ ] **Step 5: Apply tint + dot to unseen rows**

Replace the existing `<tr>` opening tag:

```jsx
// Before:
<tr
  key={b.id}
  className="hover:bg-gray-50/50 transition-colors"
>

// After:
<tr
  key={b.id}
  className={clsx(
    'transition-colors',
    bookingUnseenIds.has(b.id)
      ? 'bg-[#FEF6F1] hover:bg-[#fdeee4]'
      : 'hover:bg-gray-50/50'
  )}
>
```

- [ ] **Step 6: Add dot indicator and bold text to the Ref ID and Customer cells**

Replace the Ref ID `<td>`:

```jsx
// Before:
<td className="px-5 py-3.5 font-mono text-xs text-gray-500">
  {b.reference_id}
</td>

// After:
<td className="px-5 py-3.5 font-mono text-xs text-gray-500">
  <span className="flex items-center gap-1.5">
    <span className={clsx(
      'inline-block w-2 h-2 rounded-full flex-shrink-0',
      bookingUnseenIds.has(b.id) ? 'bg-[#CE845D]' : 'bg-transparent'
    )} />
    {b.reference_id}
  </span>
</td>
```

Replace the Customer `<td>`:

```jsx
// Before:
<td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
  {b.customer
    ? `${b.customer.first_name} ${b.customer.last_name}`
    : '—'}
</td>

// After:
<td className={clsx(
  'px-5 py-3.5 text-[#4A4A4A]',
  bookingUnseenIds.has(b.id) ? 'font-semibold' : 'font-medium'
)}>
  {b.customer
    ? `${b.customer.first_name} ${b.customer.last_name}`
    : '—'}
</td>
```

- [ ] **Step 7: Run all tests**

```bash
npm run test -- --run
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/bookings/BookingsPage.jsx
git commit -m "feat: add unseen row highlight and markViewed to BookingsPage"
```

---

## Task 7: LeaveRequestsPage — Row Highlight + markViewed

**Files:**
- Modify: `src/pages/admin/staff/LeaveRequestsPage.jsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/admin/staff/LeaveRequestsPage.jsx`, add after the existing imports:

```jsx
import clsx from 'clsx'
import useNotificationStore from '../../../store/notificationStore'
import { markItemViewed } from '../../../services/notificationService'
```

- [ ] **Step 2: Add store reads inside the component**

Inside `LeaveRequestsPage`, after the existing `const { user } = useAuthStore()` line:

```jsx
const leaveUnseenIds = useNotificationStore((s) => s.unseenIds.leaveRequests)
const resolveItem = useNotificationStore((s) => s.resolveItem)
```

- [ ] **Step 3: Add row click handler**

Inside `LeaveRequestsPage`, before the `return` statement:

```jsx
const handleRowClick = (id) => {
  if (!leaveUnseenIds.has(id)) return
  markItemViewed(user.id, 'leave_request', id).catch(console.error)
  resolveItem('leaveRequests', id)
}
```

- [ ] **Step 4: Apply tint + dot + bold to unseen rows, wire click handler**

Replace the existing row `<div>` opening:

```jsx
// Before:
<div key={req.id} className="px-6 py-4 flex items-start gap-4">

// After:
<div
  key={req.id}
  className={clsx(
    'px-6 py-4 flex items-start gap-4 cursor-pointer',
    leaveUnseenIds.has(req.id)
      ? 'bg-[#FEF6F1] hover:bg-[#fdeee4]'
      : 'hover:bg-gray-50/50'
  )}
  onClick={() => handleRowClick(req.id)}
>
```

Inside the row, replace the staff name `<p>`:

```jsx
// Before:
<p className="font-medium text-[#4A4A4A] text-sm">
  {req.staff?.first_name} {req.staff?.last_name}
</p>

// After:
<p className={clsx(
  'text-[#4A4A4A] text-sm flex items-center gap-1.5',
  leaveUnseenIds.has(req.id) ? 'font-semibold' : 'font-medium'
)}>
  <span className={clsx(
    'inline-block w-2 h-2 rounded-full flex-shrink-0',
    leaveUnseenIds.has(req.id) ? 'bg-[#CE845D]' : 'bg-transparent'
  )} />
  {req.staff?.first_name} {req.staff?.last_name}
</p>
```

- [ ] **Step 5: Run all tests**

```bash
npm run test -- --run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/staff/LeaveRequestsPage.jsx
git commit -m "feat: add unseen row highlight and markViewed to LeaveRequestsPage"
```

---

## Final Verification

- [ ] **Run the full test suite**

```bash
npm run test -- --run
```

Expected: all tests PASS with no failures.

- [ ] **Run the dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173` and log in as admin. Verify:

1. Sidebar shows badge counts on Bookings, Leave Requests, and Inquiries matching actual pending/unread counts in the DB
2. New booking created by a customer → Bookings badge increments in real-time (test in a second browser tab)
3. Clicking View on a booking → dot and tint disappear from that row; Bookings badge decrements
4. Clicking Verify on a booking → same effect
5. Leave request rows show dot + tint for unseen pending requests; clicking a row marks it as seen
6. Opening an inquiry → Inquiries badge decrements (existing behavior, now driven by realtime listener)
7. Admin approving a leave request → Leave Requests badge decrements even without opening the row

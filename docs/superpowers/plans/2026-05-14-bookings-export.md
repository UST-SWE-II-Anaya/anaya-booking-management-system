# Bookings Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CSV export feature to the admin Bookings page — a split button for quick export of the current filter, and a modal for custom date-range exports.

**Architecture:** A new `exportBookings` service function fetches all matching rows (no pagination). A shared `bookingsCsv` utility converts the raw data to CSV and triggers a browser download. `ExportBookingsModal` owns the custom-export UI; `BookingsPage` owns the split button and quick-export path.

**Tech Stack:** React, Vitest, Supabase JS client, Tailwind CSS v4, Lucide React

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/test/mocks/supabaseMock.js` | Add `gte` / `lte` chain methods |
| Modify | `src/services/bookingService.js` | Add `exportBookings` function |
| Modify | `src/services/bookingService.test.js` | Tests for `exportBookings` |
| Create | `src/utils/bookingsCsv.js` | `buildCsv` + `downloadCsv` utilities |
| Create | `src/utils/bookingsCsv.test.js` | Unit tests for `buildCsv` |
| Create | `src/components/admin/bookings/ExportBookingsModal.jsx` | Custom export modal |
| Modify | `src/pages/admin/bookings/BookingsPage.jsx` | Split button, dropdown, modal wiring |

---

## Task 1: Extend mock + add `exportBookings` service

**Files:**
- Modify: `src/test/mocks/supabaseMock.js`
- Modify: `src/services/bookingService.js`
- Modify: `src/services/bookingService.test.js`

- [ ] **Step 1.1 — Add `gte` and `lte` to the Supabase mock**

The `exportBookings` function uses `.gte()` and `.lte()` for date filtering. The existing mock doesn't have these methods — add them:

In `src/test/mocks/supabaseMock.js`, add two lines inside the `builder` object (after `ilike`):

```js
// src/test/mocks/supabaseMock.js
import { vi } from 'vitest'

export const createQueryBuilder = (resolvedValue = { data: null, error: null }) => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  }
  builder[Symbol.for('nodejs.util.inspect.custom')] = undefined
  Object.assign(builder, Promise.resolve(resolvedValue))
  builder.then = (resolve, reject) =>
    Promise.resolve(resolvedValue).then(resolve, reject)
  return builder
}
```

- [ ] **Step 1.2 — Write failing tests for `exportBookings`**

Add this `describe` block to `src/services/bookingService.test.js`:

```js
import {
  getBookings,
  updateBookingStatus,
  exportBookings,
} from './bookingService'

// ... existing tests unchanged ...

describe('exportBookings', () => {
  it('queries the bookings table and returns data array', async () => {
    const rows = [{ id: '1', reference_id: 'AN-XXXX' }]
    const qb = createQueryBuilder({ data: rows, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await exportBookings({})
    expect(supabase.from).toHaveBeenCalledWith('bookings')
    expect(result).toEqual(rows)
  })

  it('applies status filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ status: 'finished' })
    expect(qb.eq).toHaveBeenCalledWith('booking_status', 'finished')
  })

  it('does not apply status filter when omitted', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({})
    expect(qb.eq).not.toHaveBeenCalledWith('booking_status', expect.anything())
  })

  it('applies search filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ search: 'AN-123' })
    expect(qb.ilike).toHaveBeenCalledWith('reference_id', '%AN-123%')
  })

  it('applies dateFrom filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ dateFrom: '2026-05-01' })
    expect(qb.gte).toHaveBeenCalledWith('appointment_date', '2026-05-01')
  })

  it('applies dateTo filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ dateTo: '2026-05-31' })
    expect(qb.lte).toHaveBeenCalledWith('appointment_date', '2026-05-31')
  })

  it('does not call .range() — fetches all rows', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({})
    expect(qb.range).not.toHaveBeenCalled()
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('RLS denied') })
    supabase.from.mockReturnValue(qb)
    await expect(exportBookings({})).rejects.toThrow('RLS denied')
  })
})
```

- [ ] **Step 1.3 — Run tests to confirm they fail**

```bash
npx vitest run src/services/bookingService.test.js
```

Expected: several FAIL errors about `exportBookings` not being a function / not exported.

- [ ] **Step 1.4 — Implement `exportBookings` in `bookingService.js`**

Add this export at the bottom of `src/services/bookingService.js`:

```js
export const exportBookings = async ({
  status,
  search,
  dateFrom,
  dateTo,
} = {}) => {
  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: true })

  if (status) query = query.eq('booking_status', status)
  if (search) query = query.ilike('reference_id', `%${search}%`)
  if (dateFrom) query = query.gte('appointment_date', dateFrom)
  if (dateTo) query = query.lte('appointment_date', dateTo)

  const { data, error } = await query
  if (error) throw error
  return data
}
```

- [ ] **Step 1.5 — Run tests to confirm they pass**

```bash
npx vitest run src/services/bookingService.test.js
```

Expected: all tests PASS.

- [ ] **Step 1.6 — Commit**

```bash
git add src/test/mocks/supabaseMock.js src/services/bookingService.js src/services/bookingService.test.js
git commit -m "feat: add exportBookings service function"
```

---

## Task 2: CSV utility (`buildCsv` + `downloadCsv`)

Both the quick-export path (in `BookingsPage`) and the modal need to build and download a CSV from booking data. Extracting this to a utility avoids duplication.

**Files:**
- Create: `src/utils/bookingsCsv.js`
- Create: `src/utils/bookingsCsv.test.js`

- [ ] **Step 2.1 — Write failing tests for `buildCsv`**

Create `src/utils/bookingsCsv.test.js`:

```js
// src/utils/bookingsCsv.test.js
import { describe, it, expect } from 'vitest'
import { buildCsv } from './bookingsCsv'

const makeBooking = (overrides = {}) => ({
  reference_id: 'AN-TEST',
  appointment_date: '2026-05-14',
  start_time: '09:00:00',
  booking_status: 'upcoming',
  downpayment_status: 'pending',
  subtotal: '500.00',
  downpayment_amount: '250.00',
  remaining_balance: '250.00',
  booking_notes: null,
  created_at: '2026-05-01T10:00:00Z',
  customer: {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    phone_number: '09171234567',
  },
  staff: { first_name: 'Fiona', last_name: 'Facial' },
  booking_services: [
    { services: { name: 'Facial Treatment' } },
    { services: { name: 'Eyebrow Shaping' } },
  ],
  ...overrides,
})

describe('buildCsv', () => {
  it('includes header row as first line', () => {
    const csv = buildCsv([makeBooking()])
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toBe(
      'Ref ID,Customer Name,Email,Phone,Appointment Date,Start Time,Services,Subtotal,Downpayment Amount,Remaining Balance,Booking Status,Payment Status,Staff,Notes,Created At'
    )
  })

  it('maps booking fields to correct columns', () => {
    const csv = buildCsv([makeBooking()])
    const dataLine = csv.split('\n')[1]
    expect(dataLine).toContain('AN-TEST')
    expect(dataLine).toContain('Jane Doe')
    expect(dataLine).toContain('jane@example.com')
    expect(dataLine).toContain('09171234567')
    expect(dataLine).toContain('2026-05-14')
    expect(dataLine).toContain('09:00:00')
    expect(dataLine).toContain('Fiona Facial')
    expect(dataLine).toContain('upcoming')
    expect(dataLine).toContain('pending')
  })

  it('joins multiple services with semicolon', () => {
    const csv = buildCsv([makeBooking()])
    expect(csv).toContain('Facial Treatment; Eyebrow Shaping')
  })

  it('uses "Unassigned" when staff is null', () => {
    const csv = buildCsv([makeBooking({ staff: null })])
    expect(csv).toContain('Unassigned')
  })

  it('handles empty booking_services gracefully', () => {
    const csv = buildCsv([makeBooking({ booking_services: [] })])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('wraps values containing commas in double quotes', () => {
    const csv = buildCsv([makeBooking({ booking_notes: 'bring ID, please' })])
    expect(csv).toContain('"bring ID, please"')
  })

  it('escapes double quotes inside values', () => {
    const csv = buildCsv([makeBooking({ booking_notes: 'she said "hello"' })])
    expect(csv).toContain('"she said ""hello"""')
  })

  it('produces one data row per booking', () => {
    const csv = buildCsv([makeBooking(), makeBooking()])
    expect(csv.split('\n')).toHaveLength(3) // header + 2 rows
  })
})
```

- [ ] **Step 2.2 — Run tests to confirm they fail**

```bash
npx vitest run src/utils/bookingsCsv.test.js
```

Expected: FAIL — `buildCsv` not found.

- [ ] **Step 2.3 — Implement `bookingsCsv.js`**

Create `src/utils/bookingsCsv.js`:

```js
// src/utils/bookingsCsv.js
const HEADERS = [
  'Ref ID', 'Customer Name', 'Email', 'Phone',
  'Appointment Date', 'Start Time', 'Services',
  'Subtotal', 'Downpayment Amount', 'Remaining Balance',
  'Booking Status', 'Payment Status', 'Staff', 'Notes', 'Created At',
]

const escape = (val) => {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const buildCsv = (bookings) => {
  const rows = bookings.map((b) => [
    b.reference_id,
    b.customer ? `${b.customer.first_name} ${b.customer.last_name}` : '',
    b.customer?.email ?? '',
    b.customer?.phone_number ?? '',
    b.appointment_date,
    b.start_time ?? '',
    (b.booking_services ?? [])
      .map((bs) => bs.services?.name ?? '')
      .filter(Boolean)
      .join('; '),
    b.subtotal ?? '',
    b.downpayment_amount ?? '',
    b.remaining_balance ?? '',
    b.booking_status,
    b.downpayment_status,
    b.staff ? `${b.staff.first_name} ${b.staff.last_name}` : 'Unassigned',
    b.booking_notes ?? '',
    b.created_at,
  ].map(escape).join(','))

  return [HEADERS.map(escape).join(','), ...rows].join('\n')
}

export const downloadCsv = (csv) => {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bookings-export-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2.4 — Run tests to confirm they pass**

```bash
npx vitest run src/utils/bookingsCsv.test.js
```

Expected: all tests PASS.

- [ ] **Step 2.5 — Commit**

```bash
git add src/utils/bookingsCsv.js src/utils/bookingsCsv.test.js
git commit -m "feat: add bookingsCsv utility with buildCsv and downloadCsv"
```

---

## Task 3: `ExportBookingsModal` component

**Files:**
- Create: `src/components/admin/bookings/ExportBookingsModal.jsx`

No automated test for this component (it is a thin UI shell over already-tested utilities). Manual verification in Task 4.

- [ ] **Step 3.1 — Create `ExportBookingsModal.jsx`**

Create `src/components/admin/bookings/ExportBookingsModal.jsx`:

```jsx
// src/components/admin/bookings/ExportBookingsModal.jsx
import { useState } from 'react'
import { Download } from 'lucide-react'
import Modal from '../../common/Modal'
import { exportBookings } from '../../../services/bookingService'
import { buildCsv, downloadCsv } from '../../../utils/bookingsCsv'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'finished', label: 'Finished' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

const ExportBookingsModal = ({ open, onClose }) => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await exportBookings({
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      downloadCsv(buildCsv(data))
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Custom Export" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Date Range
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2
                  text-sm text-[#4A4A4A] focus:outline-none
                  focus:ring-2 focus:ring-[#8A956D]/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2
                  text-sm text-[#4A4A4A] focus:outline-none
                  focus:ring-2 focus:ring-[#8A956D]/30"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Booking Status
          </p>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2
              text-sm text-[#4A4A4A] focus:outline-none
              focus:ring-2 focus:ring-[#8A956D]/30"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm
              text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] text-white
              rounded-lg text-sm font-medium hover:bg-[#7a8560] transition-colors
              disabled:opacity-50"
          >
            <Download size={14} />
            {loading ? 'Exporting…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ExportBookingsModal
```

- [ ] **Step 3.2 — Commit**

```bash
git add src/components/admin/bookings/ExportBookingsModal.jsx
git commit -m "feat: add ExportBookingsModal component"
```

---

## Task 4: Update `BookingsPage` — split button + dropdown + modal wiring

**Files:**
- Modify: `src/pages/admin/bookings/BookingsPage.jsx`

- [ ] **Step 4.1 — Replace `BookingsPage.jsx` with the updated version**

Replace the full contents of `src/pages/admin/bookings/BookingsPage.jsx`:

```jsx
// src/pages/admin/bookings/BookingsPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookings, exportBookings } from '../../../services/bookingService'
import { buildCsv, downloadCsv } from '../../../utils/bookingsCsv'
import Badge from '../../../components/common/Badge'
import SearchInput from '../../../components/common/SearchInput'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import PaymentVerificationModal from '../../../components/admin/payments/PaymentVerificationModal'
import ExportBookingsModal from '../../../components/admin/bookings/ExportBookingsModal'
import { CalendarDays, Eye, CheckCircle2, Download, ChevronDown } from 'lucide-react'

const STATUS_FILTERS = ['all', 'upcoming', 'finished', 'cancelled', 'no_show']

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

const BookingsPage = () => {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [verifyModal, setVerifyModal] = useState(null)
  const [exportModal, setExportModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const dropdownRef = useRef(null)
  const pageSize = 20

  const load = useCallback(() => {
    setLoading(true)
    getBookings({
      status: status === 'all' ? undefined : status,
      search,
      page,
      pageSize,
    })
      .then(({ data, count: c }) => { setBookings(data); setCount(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [status, search, page])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const handleQuickExport = async () => {
    setExporting(true)
    try {
      const data = await exportBookings({
        status: status === 'all' ? undefined : status,
        search: search || undefined,
      })
      downloadCsv(buildCsv(data))
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Bookings</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap
          items-center gap-3">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(0) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium
                  transition-colors capitalize ${
                    status === s
                      ? 'bg-[#8A956D] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(0) }}
              placeholder="Search by reference ID…"
            />
            <div className="relative" ref={dropdownRef}>
              <div className="flex rounded-lg overflow-hidden border border-[#8A956D]">
                <button
                  onClick={handleQuickExport}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8A956D]
                    text-white text-xs font-medium hover:bg-[#7a8560]
                    transition-colors disabled:opacity-50
                    border-r border-white/20"
                >
                  <Download size={13} />
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="px-2 py-1.5 bg-[#8A956D] text-white
                    hover:bg-[#7a8560] transition-colors"
                  aria-label="Export options"
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white
                  border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => { setDropdownOpen(false); handleQuickExport() }}
                    className="w-full text-left px-4 py-3 text-sm text-[#4A4A4A]
                      hover:bg-gray-50 transition-colors border-b border-gray-50"
                  >
                    <p className="font-medium text-xs">Export current view</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      All pages, current filters
                    </p>
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); setExportModal(true) }}
                    className="w-full text-left px-4 py-3 text-sm text-[#4A4A4A]
                      hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-xs">Custom export…</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Choose date range &amp; status
                    </p>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No bookings found"
            message="Try adjusting your filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Ref ID', 'Customer', 'Date & Time', 'Status',
                      'Payment', 'Staff', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-xs font-medium text-gray-400
                          uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                        {b.reference_id}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                        {b.customer
                          ? `${b.customer.first_name} ${b.customer.last_name}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        <p>{formatDate(b.appointment_date)}</p>
                        <p className="text-xs text-gray-400">
                          {formatTime(b.start_time)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={b.booking_status} label={b.booking_status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={b.downpayment_status}
                          label={b.downpayment_status}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {b.staff
                          ? `${b.staff.first_name} ${b.staff.last_name}`
                          : 'Unassigned'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/admin/bookings/${b.id}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#8A956D]
                              rounded-lg text-[#8A956D] hover:bg-[#8A956D] hover:text-white
                              transition-all text-xs font-medium group"
                          >
                            <Eye size={14} className="group-hover:text-white" />
                            View
                          </button>
                          {b.downpayment_status === 'pending' && b.booking_status !== 'cancelled' && (
                            <button
                              onClick={() => setVerifyModal(b)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#CE845D]
                                rounded-lg text-[#CE845D] hover:bg-[#CE845D] hover:text-white
                                transition-all text-xs font-medium group"
                            >
                              <CheckCircle2 size={14} className="group-hover:text-white" />
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center
                justify-between text-sm text-gray-500">
                <span>
                  Showing {page * pageSize + 1}–
                  {Math.min((page + 1) * pageSize, count)} of {count}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                    className="px-3 py-1 border border-gray-200 rounded-lg
                      disabled:opacity-40 hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 border border-gray-200 rounded-lg
                      disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <PaymentVerificationModal
        open={!!verifyModal}
        booking={verifyModal}
        onClose={() => setVerifyModal(null)}
        onUpdated={load}
      />

      <ExportBookingsModal
        open={exportModal}
        onClose={() => setExportModal(false)}
      />
    </div>
  )
}

export default BookingsPage
```

- [ ] **Step 4.2 — Run the full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (no regressions).

- [ ] **Step 4.3 — Start dev server and verify manually**

```bash
npm run dev
```

Open `http://localhost:5173` and log in as an admin. Navigate to **Bookings** and verify:

1. Split export button appears in the toolbar to the right of the search input
2. Clicking **Export CSV** directly downloads a `.csv` file with all bookings matching the current filter
3. Clicking **▾** opens a dropdown with "Export current view" and "Custom export…"
4. "Export current view" downloads the same CSV as the direct button
5. "Custom export…" opens the modal with date range inputs and status selector
6. In the modal, setting a date range and clicking **Download CSV** downloads a filtered `.csv` file and closes the modal
7. Leaving all modal fields blank and downloading exports all bookings
8. The dropdown closes when clicking outside it

- [ ] **Step 4.4 — Commit**

```bash
git add src/pages/admin/bookings/BookingsPage.jsx
git commit -m "feat: add export CSV split button to BookingsPage"
```

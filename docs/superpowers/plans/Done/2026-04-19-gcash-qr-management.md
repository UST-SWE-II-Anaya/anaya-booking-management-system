# GCash QR Payment Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin to upload, replace, and remove GCash QR code images per slot (1 & 2); customer payment page shows real images or "Not Available" when a slot is empty.

**Architecture:** QR images are stored in a new Supabase Storage bucket `qr-codes` using fixed paths (`gcash-qr-1`, `gcash-qr-2`) with upsert semantics. The public URL for each slot is saved under new `site_settings` keys (`gcash_qr_1`, `gcash_qr_2`). The existing `useSiteSettings` hook already fetches all settings, so no hook changes are needed on the customer side.

**Tech Stack:** React (Vite), Supabase Storage, Supabase DB (`site_settings` table), Vitest + React Testing Library, Tailwind CSS v4, Lucide-react icons, react-hot-toast.

---

## File Map

| Action  | Path |
|---------|------|
| Create  | `src/services/qrPaymentService.js` |
| Create  | `src/services/qrPaymentService.test.js` |
| Create  | `src/pages/admin/qr-payment/QRPaymentPage.jsx` |
| Modify  | `src/App.jsx` |
| Modify  | `src/components/layout/AdminSidebar.jsx` |
| Modify  | `src/pages/customer/PaymentStep.jsx` |

---

## Task 1: Supabase — Create `qr-codes` storage bucket

**Files:**
- Run in Supabase SQL editor (no migration file tracked in this repo)

- [ ] **Step 1: Run the following SQL in the Supabase dashboard SQL editor**

```sql
-- 1. Create public bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Public read (customers can see QR images)
CREATE POLICY "Public read qr-codes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'qr-codes');

-- 3. Admin insert (upload new / upsert)
CREATE POLICY "Admin insert qr-codes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'qr-codes'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 4. Admin update (replace existing)
CREATE POLICY "Admin update qr-codes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 5. Admin delete (remove slot)
CREATE POLICY "Admin delete qr-codes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

- [ ] **Step 2: Verify in Supabase dashboard**

  Go to Storage → Buckets. Confirm `qr-codes` exists and is marked **Public**.
  Go to Storage → Policies and confirm 5 policies on `storage.objects` for `qr-codes`.

---

## Task 2: Service — `qrPaymentService.js` (TDD)

**Files:**
- Create: `src/services/qrPaymentService.js`
- Create: `src/services/qrPaymentService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/services/qrPaymentService.test.js`:

```js
// src/services/qrPaymentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

vi.mock('./settingsService', () => ({
  upsertSetting: vi.fn().mockResolvedValue({}),
  getSetting: vi.fn(),
}))

import { supabase } from './supabaseClient'
import { upsertSetting, getSetting } from './settingsService'
import { uploadQRCode, removeQRCode, getQRCodeUrls } from './qrPaymentService'

beforeEach(() => vi.clearAllMocks())

describe('uploadQRCode', () => {
  it('uploads file to storage and saves URL to settings', async () => {
    const mockFile = new File(['img'], 'qr.png', { type: 'image/png' })
    const storageMock = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://cdn.example.com/qr-codes/gcash-qr-1' },
      }),
    }
    supabase.storage.from.mockReturnValue(storageMock)

    const url = await uploadQRCode(1, mockFile, 'admin-id')

    expect(supabase.storage.from).toHaveBeenCalledWith('qr-codes')
    expect(storageMock.upload).toHaveBeenCalledWith(
      'gcash-qr-1',
      mockFile,
      { upsert: true, contentType: 'image/png' }
    )
    expect(upsertSetting).toHaveBeenCalledWith(
      'gcash_qr_1',
      expect.objectContaining({ url: expect.stringContaining('gcash-qr-1') }),
      'admin-id'
    )
    expect(url).toContain('gcash-qr-1')
  })

  it('throws when storage upload fails', async () => {
    supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: new Error('storage error') }),
    })
    await expect(uploadQRCode(1, new File([''], 'q.png', { type: 'image/png' }), 'admin-id'))
      .rejects.toThrow('storage error')
  })
})

describe('removeQRCode', () => {
  it('removes file from storage and nullifies the setting', async () => {
    const storageMock = {
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    supabase.storage.from.mockReturnValue(storageMock)

    await removeQRCode(2, 'admin-id')

    expect(storageMock.remove).toHaveBeenCalledWith(['gcash-qr-2'])
    expect(upsertSetting).toHaveBeenCalledWith('gcash_qr_2', { url: null }, 'admin-id')
  })

  it('nullifies setting even if storage remove fails', async () => {
    const storageMock = {
      remove: vi.fn().mockResolvedValue({ error: new Error('remove failed') }),
    }
    supabase.storage.from.mockReturnValue(storageMock)

    await removeQRCode(1, 'admin-id')

    expect(storageMock.remove).toHaveBeenCalledWith(['gcash-qr-1'])
    expect(upsertSetting).toHaveBeenCalledWith('gcash_qr_1', { url: null }, 'admin-id')
  })
})

describe('getQRCodeUrls', () => {
  it('returns urls for both slots', async () => {
    getSetting
      .mockResolvedValueOnce({ url: 'https://cdn.example.com/gcash-qr-1' })
      .mockResolvedValueOnce({ url: 'https://cdn.example.com/gcash-qr-2' })

    const result = await getQRCodeUrls()

    expect(getSetting).toHaveBeenCalledWith('gcash_qr_1')
    expect(getSetting).toHaveBeenCalledWith('gcash_qr_2')
    expect(result).toEqual({
      qr1: 'https://cdn.example.com/gcash-qr-1',
      qr2: 'https://cdn.example.com/gcash-qr-2',
    })
  })

  it('returns null for slots with no setting', async () => {
    getSetting.mockResolvedValue(null)
    const result = await getQRCodeUrls()
    expect(result).toEqual({ qr1: null, qr2: null })
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npx vitest run src/services/qrPaymentService.test.js
```

Expected: FAIL — `Cannot find module './qrPaymentService'`

- [ ] **Step 3: Write the service implementation**

Create `src/services/qrPaymentService.js`:

```js
// src/services/qrPaymentService.js
import { supabase } from './supabaseClient'
import { upsertSetting, getSetting } from './settingsService'

const BUCKET = 'qr-codes'

export const uploadQRCode = async (slot, file, adminId) => {
  const path = `gcash-qr-${slot}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`
  await upsertSetting(`gcash_qr_${slot}`, { url }, adminId)
  return url
}

export const removeQRCode = async (slot, adminId) => {
  const path = `gcash-qr-${slot}`
  await supabase.storage.from(BUCKET).remove([path]) // Best effort removal
  await upsertSetting(`gcash_qr_${slot}`, { url: null }, adminId)
}

export const getQRCodeUrls = async () => {
  const [qr1, qr2] = await Promise.all([
    getSetting('gcash_qr_1'),
    getSetting('gcash_qr_2'),
  ])
  return {
    qr1: qr1?.url ?? null,
    qr2: qr2?.url ?? null,
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npx vitest run src/services/qrPaymentService.test.js
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/qrPaymentService.js src/services/qrPaymentService.test.js
git commit -m "feat: add qrPaymentService for upload, remove, and fetch QR code URLs"
```

---

## Task 3: Admin Page — `QRPaymentPage.jsx`

**Files:**
- Create: `src/pages/admin/qr-payment/QRPaymentPage.jsx`

- [ ] **Step 1: Create the page**

Create `src/pages/admin/qr-payment/QRPaymentPage.jsx`:

```jsx
// src/pages/admin/qr-payment/QRPaymentPage.jsx
import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Upload, Trash2 } from 'lucide-react'
import { uploadQRCode, removeQRCode, getQRCodeUrls } from '../../../services/qrPaymentService'
import Spinner from '../../../components/common/Spinner'
import useAuthStore from '../../../store/authStore'

const QRSlot = ({ slot, label, url, onUpload, onRemove, loading }) => {
  const inputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB.')
      return
    }
    onUpload(slot, file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
        {url ? (
          <img 
            src={url} 
            alt={label} 
            className="w-full h-full object-contain"
            onError={(e) => { e.target.style.display = 'none' }} 
          />
        ) : (
          <p className="text-xs text-gray-400 text-center px-4">No QR image uploaded</p>
        )}
      </div>
      <p className="text-sm font-medium text-[#2C2C2C]">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8A956D] text-white
            text-xs rounded-lg hover:bg-[#7a8560] transition-colors disabled:opacity-50"
        >
          <Upload size={12} />
          {url ? 'Replace' : 'Upload'}
        </button>
        {url && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onRemove(slot)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600
              text-xs rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} />
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

const QRPaymentPage = () => {
  const { user } = useAuthStore()
  const [urls, setUrls] = useState({ qr1: null, qr2: null })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    getQRCodeUrls()
      .then(setUrls)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleUpload = async (slot, file) => {
    setActionLoading(true)
    try {
      const url = await uploadQRCode(slot, file, user.id)
      setUrls((prev) => ({ ...prev, [`qr${slot}`]: url }))
      toast.success(`GCash QR #${slot} updated.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemove = async (slot) => {
    setActionLoading(true)
    try {
      await removeQRCode(slot, user.id)
      setUrls((prev) => ({ ...prev, [`qr${slot}`]: null }))
      toast.success(`GCash QR #${slot} removed.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-[#2C2C2C] mb-1">QR Payment</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage the GCash QR codes shown to customers during payment.
        Slots with no image will appear as unavailable.
      </p>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
        <div className="flex gap-12 justify-center flex-wrap">
          <QRSlot
            slot={1}
            label="GCash QR #1"
            url={urls.qr1}
            onUpload={handleUpload}
            onRemove={handleRemove}
            loading={actionLoading}
          />
          <QRSlot
            slot={2}
            label="GCash QR #2"
            url={urls.qr2}
            onUpload={handleUpload}
            onRemove={handleRemove}
            loading={actionLoading}
          />
        </div>
      </div>
    </div>
  )
}

export default QRPaymentPage
```

- [ ] **Step 2: Manually verify the page renders**

Start the dev server (`npm run dev`) and navigate to `/admin/qr-payment` after wiring the route in the next task. Confirm two empty QR slots appear with Upload buttons. (Skip until Task 4 is done.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/qr-payment/QRPaymentPage.jsx
git commit -m "feat: add QRPaymentPage admin UI for managing GCash QR code slots"
```

---

## Task 4: Wire Route and Sidebar

**Files:**
- Modify: `src/App.jsx` (lines 23–24 import block, line 90 route block)
- Modify: `src/components/layout/AdminSidebar.jsx` (navItems array)

- [ ] **Step 1: Add the import and route in `src/App.jsx`**

After the existing `import SettingsPage` line (line 23), add:

```jsx
import QRPaymentPage from './pages/admin/qr-payment/QRPaymentPage'
```

After the existing `<Route path="/admin/settings" .../>` line (line 90), add:

```jsx
<Route path="/admin/qr-payment" element={<QRPaymentPage />} />
```

- [ ] **Step 2: Add the nav item in `src/components/layout/AdminSidebar.jsx`**

Add `QrCode` to the lucide-react import:

```jsx
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
} from 'lucide-react'
```

Add the nav item after the `Settings` entry in the `navItems` array:

```jsx
{ label: 'QR Payment', to: '/admin/qr-payment', icon: QrCode },
```

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

- Log in as admin, open the sidebar. Confirm "QR Payment" link appears.
- Click it — `QRPaymentPage` loads with two empty QR slots.
- Upload a test image to slot 1. Confirm the image appears and a success toast fires.
- Click Remove on slot 1. Confirm the slot returns to "No QR image uploaded".

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/layout/AdminSidebar.jsx
git commit -m "feat: add QR Payment route and admin sidebar nav item"
```

---

## Task 5: Update Customer PaymentStep to Show Real QR Images

**Files:**
- Modify: `src/pages/customer/PaymentStep.jsx` (lines 19–44 `GCashCard`, line 191–194 usage)

- [ ] **Step 1: Replace the `GCashCard` component (lines 19–44)**

Replace the entire `GCashCard` component with:

```jsx
const GCashCard = ({ number, url }) => (
  <div className="flex-1 flex flex-col items-center">
    <div className="w-full rounded-xl overflow-hidden border-2 border-blue-200 bg-blue-600
      flex flex-col items-center py-4 px-3">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="bg-white rounded-full w-6 h-6 flex items-center justify-center">
          <span className="text-blue-600 font-black text-xs">G</span>
        </div>
        <span className="text-white font-bold text-sm tracking-wide">GCash</span>
      </div>
      {url ? (
        <>
          <p className="text-blue-200 text-xs mb-2 font-medium tracking-wider">
            SCAN TO PAY HERE
          </p>
          <div className="w-28 h-28 bg-white rounded-lg overflow-hidden
            flex items-center justify-center">
            <img
              src={url}
              alt={`GCash QR ${number}`}
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
        </>
      ) : (
        <div className="w-28 h-28 bg-white/20 rounded-lg flex items-center justify-center">
          <p className="text-white/70 text-xs text-center px-2">Not Available</p>
        </div>
      )}
    </div>
    <p className="text-sm font-semibold text-anaya-text mt-2">GCASH #{number}</p>
  </div>
)
```

- [ ] **Step 2: Update the GCashCard usage (lines 191–194)**

Replace:

```jsx
<GCashCard number={1} />
<GCashCard number={2} />
```

With:

```jsx
{settings?.gcash_qr_1?.url && <GCashCard number={1} url={settings.gcash_qr_1.url} />}
{settings?.gcash_qr_2?.url && <GCashCard number={2} url={settings.gcash_qr_2.url} />}
{(!settings?.gcash_qr_1?.url && !settings?.gcash_qr_2?.url) && (
  <div className="w-full py-4 text-center text-sm text-gray-500 italic bg-gray-50 rounded-xl border border-gray-100">
    GCash payment is currently unavailable.
  </div>
)}
```

(`settings` is already available from the existing `useSiteSettings()` call on line 56.)

- [ ] **Step 3: Verify in the browser**

Navigate to any active booking's payment page (`/booking/payment/:bookingId`).

- **With no QR uploaded:** A message "GCash payment is currently unavailable" is shown.
- **After uploading QR #1 in admin:** Only the slot 1 GCash card is rendered with the QR image.
- **After uploading both QRs:** Both cards show side-by-side with real images.

- [ ] **Step 4: Run the full test suite to catch regressions**

```bash
npx vitest run
```

Expected: all existing tests pass plus the 6 new `qrPaymentService` tests.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/PaymentStep.jsx
git commit -m "feat: display real GCash QR images in PaymentStep, show Not Available when empty"
```

---

## Self-Review Checklist

| Requirement | Covered in |
|-------------|-----------|
| Admin can upload a QR image to slot 1 or 2 | Task 3 (QRSlot upload button) |
| Admin can replace an existing QR image | Task 2 (`upsert: true` in `uploadQRCode`) |
| Admin can remove a QR image | Task 3 (Remove button) + Task 2 (`removeQRCode`) |
| QR images are stored as public-accessible files | Task 1 (public bucket + SELECT policy) |
| QR display is constrained to standard QR size | Task 3 (w-48 h-48 preview) + Task 5 (w-28 h-28 in card) |
| Customer only sees active GCash slots | Task 5 (conditional rendering) |
| Customer sees real image when slot is populated | Task 5 (`<img src={url}>`) |
| Only admins can upload/delete in storage | Task 1 (RLS policies scoped by `profiles.role = 'admin'`) |
| New admin sidebar tab "QR Payment" | Task 4 |
| Service functions are unit-tested | Task 2 (6 tests) |

# Public View — Backend Integration Design
**Date:** 2026-04-09
**Status:** Approved

## Overview

The public view is already fully scaffolded in `src/` (Vite + React). All pages exist with correct UI but use hardcoded mock data from `src/utils/mockData.js`. This spec covers replacing that mock data with real Supabase queries, wiring the contact form, and implementing the `+ Book` auth handoff.

No new pages, no layout changes. This is purely a data-wiring task.

---

## Architecture

- **App:** Vite + React (`src/`)
- **Auth:** None required — public pages use anon Supabase client
- **Supabase client:** `src/services/supabaseClient.js` (existing, no changes)
- **RLS:** `service_categories` and `services` have `categories_select_public` and `services_select_public` — anon reads work without auth. `inquiries` has `inquiries_insert_public` — anon inserts work without auth.

---

## New Service Functions

All Supabase calls live in `src/services/` per project conventions. Components never call Supabase directly.

### `src/services/servicesCmsService.js` (additions)

**`getAllActiveServices()`**
- Fetches all services where `is_active = true`, joined to `service_categories` (for `category_id` and `name`)
- Returns flat array: `{ id, name, description, duration_minutes, price, category_id, category_name }`
- Used by `ServicesPage` to populate filter pills and service list

**`getCategoryWithServices(slug)`**
- Fetches all categories, finds the one whose `name` slugifies to `slug` (e.g. "Nail Care" → `nail-care`)
- Fetches its services via `getServicesByCategory(categoryId)` (existing function)
- Returns `{ id, name, description, image_url, services[] }`
- Used by `CategoryDetailPage`
- Slug utility: a local `slugify(str)` helper (`str.toLowerCase().replace(/[^a-z0-9]+/g, '-')`)

### `src/services/inquiryService.js` (addition)

**`submitInquiry({ firstName, lastName, email, message })`**
- Inserts one row to `inquiries` table
- No auth required (public RLS policy already exists)
- Returns the created row

---

## Page Changes

### `HomePage`
- Popular services section: replace hardcoded `ServiceCard` array with `getCategories()` call
- Renders real category cards with `image_url` from DB (falls back to placeholder if null)
- Contact info block (address, phone, email, hours) remains hardcoded — `site_settings.contact_info` is currently empty; wire up in a future pass

### `CategoriesPage`
- Replace `CATEGORIES` import with `getCategories()` call
- `useEffect` + `useState({ loading, data, error })` pattern
- Show loading spinner while fetching, error state if fetch fails

### `CategoryDetailPage`
- Replace `CATEGORIES` + `NAIL_CARE_DETAILS` imports with `getCategoryWithServices(slug)` call
- Services checklist populated from real `services[]` data
- Redirect to `/categories` if slug resolves to no category (existing behaviour preserved)

### `ServicesPage`
- Replace `BOOKABLE_SERVICES` import with `getAllActiveServices()` call
- Filter pills: derived from real category names (same logic as today, just from DB)
- Grouping: services grouped by `category_name` (replaces `groupName` — DB has no group concept)
- `+ Book` button behaviour: see Auth Handoff below

### `LocationPage`
- Contact form: calls `submitInquiry()` on submit
- Form state: `{ firstName, lastName, email, message, submitting, success, error }`
- Validation: all fields required, email format check
- On success: show success message, clear form
- On error: show error message, keep form data

---

## Auth Handoff (`+ Book` → Login → Booking)

1. Customer clicks `+ Book` on a service card in `ServicesPage`
2. Service `id` is saved to `sessionStorage` under key `pending_service_id`
3. Customer is navigated to `/login`
4. After successful login, `LoginPage` checks `sessionStorage` for `pending_service_id`
   - If found: clear it, navigate to `/booking/services?service=<id>`
   - If not found: navigate to `/dashboard`

The login page at `/login` is `src/pages/auth/LoginPage.jsx` — this is the file that needs the `sessionStorage` check after successful login.

---

## `mockData.js` Cleanup

After all pages are wired:
- Remove `CATEGORIES`, `NAIL_CARE_DETAILS`, `BOOKABLE_SERVICES` exports
- Keep `TEAM_MEMBERS` until `AboutPage` is wired (staff data requires an authenticated `get_staff_list()` RPC — out of scope for public view)

---

## Error & Loading States

Each page that fetches data follows this pattern:
```jsx
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)

useEffect(() => {
  serviceFn()
    .then(setData)
    .catch(err => setError(err.message))
    .finally(() => setLoading(false))
}, [])
```

- Loading: render `<Spinner />` (existing `src/components/common/Spinner.jsx`)
- Error: render a minimal inline error message
- Empty: existing empty state fallbacks in each page are preserved

---

## Out of Scope

- `AboutPage` staff wiring (requires `get_staff_list()` RPC — defined in customer view spec)
- `site_settings` contact info wiring on `HomePage`
- Email notifications
- Any admin-side changes

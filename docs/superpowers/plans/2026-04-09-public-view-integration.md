# Public View — Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded mock data in the public Vite pages with real Supabase queries, wire the contact form, and connect the `+ Book` auth handoff so customers can log in and reach the booking flow.

**Architecture:** All Supabase calls go through `src/services/`. Pages use `useEffect` + `useState` to load data. Auth uses Supabase's `signInWithPassword` / `signUp`. A `handle_new_user` DB trigger auto-creates a `profiles` row when a new auth user signs up.

**Tech Stack:** Vite + React 19, Supabase JS v2, Zustand (auth state), React Router v7, Tailwind CSS v4, Vitest + Testing Library

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/services/servicesCmsService.js` | Modify | Add `getAllActiveServices`, `getCategoryWithServices` |
| `src/services/inquiryService.js` | Modify | Add `submitInquiry` |
| `src/services/authService.js` | Modify | Add `signUp` |
| `src/utils/formatDuration.js` | Create | Format minutes → "1 hr 30 mins" |
| `src/services/servicesCmsService.test.js` | Modify | Tests for new functions |
| `src/services/inquiryService.test.js` | Modify | Test for `submitInquiry` |
| `src/pages/LoginPage/index.jsx` | Modify | Wire real auth, role routing, sessionStorage check |
| `src/pages/RegisterPage/index.jsx` | Modify | Wire real Supabase signUp |
| `src/App.jsx` | Modify | Change `/login` to use public `LoginPage` |
| `src/pages/HomePage/index.jsx` | Modify | Replace hardcoded ServiceCards with DB categories |
| `src/pages/CategoriesPage/index.jsx` | Modify | Replace `CATEGORIES` mock |
| `src/pages/CategoryDetailPage/index.jsx` | Modify | Replace mock data with real DB fetch |
| `src/pages/ServicesPage/index.jsx` | Modify | Replace `BOOKABLE_SERVICES` mock |
| `src/components/BookableServiceCard/index.jsx` | Modify | Auth handoff on Book + duration format |
| `src/pages/LocationPage/index.jsx` | Modify | Wire contact form to `submitInquiry` |
| `src/utils/mockData.js` | Modify | Remove wired exports, keep `TEAM_MEMBERS` |

---

### Task 1: DB Migration — Auto-create profile on signup

**Files:**
- Apply via Supabase MCP `apply_migration`

- [ ] **Step 1: Apply the migration**

Use `mcp__supabase__apply_migration` with name `handle_new_user_on_signup` and SQL:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone_number, date_of_birth, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone_number',
    NULLIF(new.raw_user_meta_data->>'date_of_birth', '')::date,
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Verify the trigger exists**

Use `mcp__supabase__execute_sql`:
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```
Expected: one row returned.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add handle_new_user trigger for auto profile creation"
```

---

### Task 2: Add `formatDuration` utility + new service functions

**Files:**
- Create: `src/utils/formatDuration.js`
- Modify: `src/services/servicesCmsService.js`

- [ ] **Step 1: Create `src/utils/formatDuration.js`**

```js
// src/utils/formatDuration.js

export const formatDuration = (minutes) => {
  if (!minutes) return ''
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins} mins`
  if (mins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`
  return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} mins`
}
```

- [ ] **Step 2: Add `slugify` helper + `getAllActiveServices` + `getCategoryWithServices` to `src/services/servicesCmsService.js`**

Add after the existing `deleteService` function:

```js
// src/services/servicesCmsService.js (additions — append to existing file)

const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const getAllActiveServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, image_url, is_popular, category_id, service_categories(name)')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    duration_minutes: s.duration_minutes,
    price: Number(s.price),
    image_url: s.image_url,
    is_popular: s.is_popular,
    category_id: s.category_id,
    category_name: s.service_categories?.name ?? null,
  }))
}

export const getCategoryWithServices = async (slug) => {
  const categories = await getCategories()
  const category = categories.find((c) => slugify(c.name) === slug)
  if (!category) return null
  const services = await getServicesByCategory(category.id)
  return { ...category, services }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/formatDuration.js src/services/servicesCmsService.js
git commit -m "feat: add getAllActiveServices, getCategoryWithServices, formatDuration"
```

---

### Task 3: Tests for new service functions

**Files:**
- Modify: `src/services/servicesCmsService.test.js`

- [ ] **Step 1: Add tests**

Append to the end of `src/services/servicesCmsService.test.js`:

```js
import { getAllActiveServices, getCategoryWithServices } from './servicesCmsService'

describe('getAllActiveServices', () => {
  it('fetches only active services with category join', async () => {
    const mockServices = [
      {
        id: 's1', name: 'Classic Mani', description: '', duration_minutes: 45,
        price: '170.00', image_url: null, is_popular: false,
        category_id: 'cat1', service_categories: { name: 'Nail Care' },
      },
    ]
    const qb = createQueryBuilder({ data: mockServices, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await getAllActiveServices()
    expect(supabase.from).toHaveBeenCalledWith('services')
    expect(qb.eq).toHaveBeenCalledWith('is_active', true)
    expect(result[0].category_name).toBe('Nail Care')
    expect(result[0].price).toBe(170)
  })

  it('throws when supabase returns an error', async () => {
    const qb = createQueryBuilder({ data: null, error: { message: 'fail' } })
    supabase.from.mockReturnValue(qb)
    await expect(getAllActiveServices()).rejects.toThrow('fail')
  })
})

describe('getCategoryWithServices', () => {
  it('returns null for unknown slug', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    const result = await getCategoryWithServices('not-a-category')
    expect(result).toBeNull()
  })

  it('finds category by slugified name and returns with services', async () => {
    const catRow = {
      id: 'cat1', name: 'Nail Care', description: null, image_url: null,
      display_order: 1, created_at: '', reference_id: 'CAT-001',
    }
    const qbCats = createQueryBuilder({ data: [catRow], error: null })
    const qbSvcs = createQueryBuilder({ data: [{ id: 's1', name: 'Classic Mani' }], error: null })
    supabase.from
      .mockReturnValueOnce(qbCats)
      .mockReturnValueOnce(qbSvcs)
    const result = await getCategoryWithServices('nail-care')
    expect(result.id).toBe('cat1')
    expect(result.services).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm test -- servicesCmsService
```
Expected: all new tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/servicesCmsService.test.js
git commit -m "test: add tests for getAllActiveServices and getCategoryWithServices"
```

---

### Task 4: Add `submitInquiry` to `inquiryService.js` + test

**Files:**
- Modify: `src/services/inquiryService.js`
- Modify: `src/services/inquiryService.test.js`

- [ ] **Step 1: Add `submitInquiry` to `src/services/inquiryService.js`**

Append after the existing `archiveInquiry` function:

```js
export const submitInquiry = async ({ firstName, lastName, email, message }) => {
  const { data, error } = await supabase
    .from('inquiries')
    .insert({ first_name: firstName, last_name: lastName, email, message })
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Write failing test**

Open `src/services/inquiryService.test.js`. Add at the bottom:

```js
import { submitInquiry } from './inquiryService'

describe('submitInquiry', () => {
  it('inserts a row into inquiries and returns it', async () => {
    const mockRow = { id: 'i1', first_name: 'Jane', last_name: 'Doe', email: 'jane@test.com', message: 'Hi' }
    const qb = createQueryBuilder({ data: mockRow, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await submitInquiry({
      firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', message: 'Hi',
    })
    expect(supabase.from).toHaveBeenCalledWith('inquiries')
    expect(qb.insert).toHaveBeenCalledWith({
      first_name: 'Jane', last_name: 'Doe', email: 'jane@test.com', message: 'Hi',
    })
    expect(result.id).toBe('i1')
  })
})
```

(Check if `src/services/inquiryService.test.js` has the same mock/import header as `servicesCmsService.test.js`. If not, add the `vi.mock`, imports, and `beforeEach` at the top of the file first.)

- [ ] **Step 3: Run tests**

```bash
npm test -- inquiryService
```
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/inquiryService.js src/services/inquiryService.test.js
git commit -m "feat: add submitInquiry service function"
```

---

### Task 5: Add `signUp` to `authService.js`

**Files:**
- Modify: `src/services/authService.js`

- [ ] **Step 1: Append `signUp` to `src/services/authService.js`**

```js
export const signUp = async ({ email, password, firstName, lastName, phone, dob }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone || null,
        date_of_birth: dob || null,
      },
    },
  })
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/authService.js
git commit -m "feat: add signUp to authService"
```

---

### Task 6: Wire `src/pages/LoginPage/index.jsx` with real auth

The public `LoginPage` at `src/pages/LoginPage/index.jsx` is currently a mock UI with no real auth. Replace the form handler with real Supabase auth + role-based routing + sessionStorage handoff.

**Files:**
- Modify: `src/pages/LoginPage/index.jsx`

- [ ] **Step 1: Replace the file content**

```jsx
// src/pages/LoginPage/index.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import GoogleButton from '../../components/GoogleButton'
import { signIn, getProfile } from '../../services/authService'
import useAuthStore from '../../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const setProfile = useAuthStore((s) => s.setProfile)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await signIn(email, password)
      const profile = await getProfile(user.id)
      setUser(user)
      setProfile(profile)

      if (profile.role === 'admin') {
        navigate('/admin')
      } else if (profile.role === 'staff') {
        navigate('/staff')
      } else {
        // Customer: check for pending service from public + Book flow
        const pendingServiceId = sessionStorage.getItem('pending_service_id')
        if (pendingServiceId) {
          sessionStorage.removeItem('pending_service_id')
          navigate(`/booking/services?service=${pendingServiceId}`)
        } else {
          navigate('/dashboard')
        }
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout imageSrc="/flower-bouquet.png">
      <div className="flex flex-col items-center mb-6 w-full">
        <img src="/logo.png" alt="ANAYA Aesthetic Studio" className="h-16 md:h-20 object-contain invert mix-blend-darken" />
      </div>

      <h1 className="text-sm font-medium mb-8 text-center tracking-wide">Welcome to ANAYA</h1>

      {error && (
        <div className="w-full text-xs text-red-600 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSignIn} className="w-full flex flex-col items-center">
        <InputField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
        />
        <InputField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
        />
        <div className="w-full flex justify-end -mt-4 mb-6">
          <Link to="/forgot-password" className="text-[0.65rem] text-gray-500 hover:text-gray-800 transition-colors">
            Forget password?
          </Link>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <div className="w-full flex items-center justify-center space-x-2 my-8">
        <div className="h-px bg-gray-300 w-16"></div>
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px bg-gray-300 w-16"></div>
      </div>

      <GoogleButton onClick={() => {}} className="mb-8" />

      <div className="text-[0.7rem] text-gray-600">
        New to ANAYA?{' '}
        <Link to="/signup" className="underline hover:text-gray-900 ml-1">
          Create an Account
        </Link>
      </div>
    </AuthLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/LoginPage/index.jsx
git commit -m "feat: wire LoginPage with real Supabase auth and role routing"
```

---

### Task 7: Wire `src/pages/RegisterPage/index.jsx` with real auth

**Files:**
- Modify: `src/pages/RegisterPage/index.jsx`

- [ ] **Step 1: Replace the `handleRegister` function and add auth imports**

Replace the imports and handler only (keep form JSX unchanged, just update the `handleRegister` body and add `navigate`/`signUp` imports):

```jsx
// src/pages/RegisterPage/index.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import GoogleButton from '../../components/GoogleButton'
import { signUp } from '../../services/authService'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    dob: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setSubmitError('')

    const newErrors = {}
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address.'
    if (!formData.firstName) newErrors.firstName = 'First Name is required.'
    if (!formData.lastName) newErrors.lastName = 'Last Name is required.'
    if (!formData.dob) newErrors.dob = 'Invalid date format.'
    if (!formData.password || formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters.'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setLoading(true)
    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        dob: formData.dob,
      })
      navigate('/login')
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ... rest of JSX is unchanged except:
  // 1. Add {submitError && <div className="w-full text-xs text-red-600 mb-4">{submitError}</div>} before the form
  // 2. Add disabled={loading} to the Button
```

Keep the form JSX exactly as-is. Add the `submitError` display just above the `<form>` tag, and add `disabled={loading}` to the `<Button>`. Remove the reCAPTCHA placeholder.

- [ ] **Step 2: Commit**

```bash
git add src/pages/RegisterPage/index.jsx
git commit -m "feat: wire RegisterPage with real Supabase signUp"
```

---

### Task 8: Update `App.jsx` `/login` route

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Change the `/login` route import**

In `src/App.jsx`, find:
```jsx
import LoginPage from './pages/auth/LoginPage'
```
Replace with:
```jsx
import LoginPage from './pages/LoginPage'
```

- [ ] **Step 2: Run the app and verify login works**

```bash
npm run dev
```
Navigate to `http://localhost:5173/login`. Should see the customer-facing login form with ANAYA logo.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix: point /login route to public-facing LoginPage"
```

---

### Task 9: Wire `CategoriesPage`

**Files:**
- Modify: `src/pages/CategoriesPage/index.jsx`

- [ ] **Step 1: Replace file content**

```jsx
// src/pages/CategoriesPage/index.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import Spinner from '../../components/common/Spinner'
import { getCategories } from '../../services/servicesCmsService'

const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout>
      <div className="w-full bg-anaya-green-dark pt-32 pb-24 px-8 text-center">
        <h1 className="text-4xl text-white font-serif tracking-widest drop-shadow-sm">Our Services</h1>
      </div>

      <div className="w-full bg-anaya-bg py-16 px-8 md:px-16 lg:px-32">
        {loading && (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-red-500 py-12">{error}</p>
        )}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {categories.map((category) => (
              <Link key={category.id} to={`/category/${slugify(category.name)}`} className="group drop-shadow-md">
                <div className="relative w-full aspect-square overflow-hidden bg-white">
                  <div className="absolute inset-0 bg-anaya-accent/10 flex items-center justify-center">
                    <span className="text-gray-400 text-xs italic tracking-widest">{category.name}</span>
                  </div>
                  {category.image_url && (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                  <div className="absolute bottom-4 left-6 text-white pointer-events-none">
                    <h3 className="font-bold text-sm tracking-widest mb-1">{category.name}</h3>
                    <span className="text-xs font-light flex items-center group-hover:underline opacity-90">
                      Learn more <span className="ml-1 leading-none">&gt;</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/CategoriesPage/index.jsx
git commit -m "feat: wire CategoriesPage to Supabase"
```

---

### Task 10: Wire `CategoryDetailPage`

**Files:**
- Modify: `src/pages/CategoryDetailPage/index.jsx`

- [ ] **Step 1: Replace file content**

```jsx
// src/pages/CategoryDetailPage/index.jsx
import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import Spinner from '../../components/common/Spinner'
import { getCategoryWithServices } from '../../services/servicesCmsService'

export default function CategoryDetailPage() {
  const { slug } = useParams()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getCategoryWithServices(slug)
      .then((data) => {
        if (!data) setNotFound(true)
        else setDetail(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      </PublicLayout>
    )
  }

  if (notFound) return <Navigate to="/categories" replace />

  return (
    <PublicLayout>
      <div className="w-full bg-anaya-light pt-32 pb-24 px-8 md:px-16 lg:px-32 flex flex-col min-h-screen">
        <div className="max-w-6xl mx-auto w-full">
          <div className="mb-10">
            <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-wide mb-2">{detail.name}</h1>
            {detail.description && (
              <h2 className="text-xs text-gray-600 font-medium tracking-wider">{detail.description}</h2>
            )}
          </div>

          {detail.image_url && (
            <div className="w-full aspect-[21/9] overflow-hidden shadow-sm mb-12">
              <img src={detail.image_url} alt={detail.name} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="mb-12 max-w-4xl">
            <h3 className="font-bold text-sm tracking-wide text-gray-900 mb-6">Services under this Category</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              {detail.services.map((service) => (
                <div key={service.id} className="flex items-center">
                  <svg className="w-4 h-4 mr-3 text-anaya-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.96 4.397A1.5 1.5 0 009.04 4.4C6.541 7.228 5 10.957 5 15a1 1 0 001 1h8a1 1 0 001-1c0-4.043-1.54-7.772-4.04-10.603z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.7rem] text-gray-800">{service.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/CategoryDetailPage/index.jsx
git commit -m "feat: wire CategoryDetailPage to Supabase"
```

---

### Task 11: Wire `ServicesPage` + update `BookableServiceCard`

**Files:**
- Modify: `src/pages/ServicesPage/index.jsx`
- Modify: `src/components/BookableServiceCard/index.jsx`

- [ ] **Step 1: Update `BookableServiceCard` for auth handoff and duration format**

```jsx
// src/components/BookableServiceCard/index.jsx
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '../../utils/formatDuration'

export default function BookableServiceCard({ service, onAdd, isInCart }) {
  const navigate = useNavigate()

  const handleBook = () => {
    sessionStorage.setItem('pending_service_id', service.id)
    navigate('/login')
  }

  // onAdd is only provided in the authenticated booking flow
  const handleAction = onAdd ? (onAdd) : handleBook

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md transition-shadow">
      <div className="flex flex-col flex-1 pb-4 sm:pb-0 pr-4">
        <h4 className="font-bold text-gray-900 text-sm mb-1 tracking-wide">{service.name}</h4>
        <div className="flex items-center text-[0.65rem] text-gray-500 mb-2">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatDuration(service.duration_minutes)}
        </div>
        {service.description && (
          <p className="text-[0.7rem] text-gray-700 leading-relaxed max-w-md">{service.description}</p>
        )}
      </div>

      <div className="flex items-center w-full justify-between sm:w-auto sm:justify-end sm:flex-col sm:items-end border-t border-gray-100 sm:border-0 pt-4 sm:pt-0">
        <span className="font-semibold text-gray-900 text-sm sm:mb-3">
          ₱ {Number(service.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {onAdd ? (
          <button
            onClick={onAdd}
            className={clsx(
              'flex items-center justify-center px-4 py-1.5 rounded-full border transition-colors',
              isInCart
                ? 'border-red-400 text-red-400 hover:bg-red-400 hover:text-white'
                : 'border-anaya-accent text-anaya-accent hover:bg-anaya-accent hover:text-white'
            )}
          >
            <span className="mr-1 text-lg leading-none font-light">{isInCart ? '−' : '+'}</span>
            <span className="text-xs font-medium tracking-wide">{isInCart ? 'Remove' : 'Add'}</span>
          </button>
        ) : (
          <button
            onClick={handleBook}
            className="flex items-center justify-center px-4 py-1.5 rounded-full border border-anaya-accent text-anaya-accent hover:bg-anaya-accent hover:text-white transition-colors"
          >
            <span className="mr-1 text-lg leading-none font-light">+</span>
            <span className="text-xs font-medium tracking-wide">Book</span>
          </button>
        )}
      </div>
    </div>
  )
}
```

Add `import clsx from 'clsx'` at the top.

- [ ] **Step 2: Replace `src/pages/ServicesPage/index.jsx`**

```jsx
// src/pages/ServicesPage/index.jsx
import { useState, useEffect, useMemo } from 'react'
import PublicLayout from '../../components/PublicLayout'
import ServiceFilterPills from '../../components/ServiceFilterPills'
import BookableServiceCard from '../../components/BookableServiceCard'
import Spinner from '../../components/common/Spinner'
import { getAllActiveServices } from '../../services/servicesCmsService'

export default function ServicesPage() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState(null)

  useEffect(() => {
    getAllActiveServices()
      .then((data) => {
        setServices(data)
        if (data.length > 0 && data[0].category_name) {
          setActiveFilter(data[0].category_name)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const allCategories = useMemo(
    () => [...new Set(services.map((s) => s.category_name).filter(Boolean))],
    [services]
  )

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesCategory = !activeFilter || s.category_name === activeFilter
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [services, activeFilter, searchQuery])

  const groupedServices = useMemo(() => {
    return filteredServices.reduce((acc, s) => {
      const group = s.category_name || 'Other'
      if (!acc[group]) acc[group] = []
      acc[group].push(s)
      return acc
    }, {})
  }, [filteredServices])

  return (
    <PublicLayout>
      <div className="w-full bg-anaya-light pt-32 pb-24 px-4 sm:px-8 md:px-16 min-h-screen">
        <div className="max-w-4xl mx-auto w-full">
          <h1 className="text-2xl font-serif font-bold text-gray-900 tracking-wide mb-8">Our Services</h1>

          <div className="relative mb-10">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search for a service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-3 pl-10 pr-4 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-anaya-accent focus:ring-1 focus:ring-anaya-accent shadow-sm"
            />
          </div>

          {loading && <div className="flex justify-center py-24"><Spinner /></div>}
          {error && <p className="text-sm text-red-500 py-12 text-center">{error}</p>}

          {!loading && !error && (
            <>
              <ServiceFilterPills
                categories={allCategories}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />
              {Object.entries(groupedServices).map(([groupName, svcs]) => (
                <div key={groupName} className="mb-12">
                  <h3 className="font-bold text-gray-900 mb-4">{groupName}</h3>
                  <div className="flex flex-col space-y-4 shadow-sm bg-white border border-gray-100 rounded-lg p-2 sm:p-4">
                    {svcs.map((service) => (
                      <BookableServiceCard key={service.id} service={service} />
                    ))}
                  </div>
                </div>
              ))}
              {filteredServices.length === 0 && (
                <div className="w-full text-center py-12 text-gray-500 text-sm">
                  No services found matching your criteria.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ServicesPage/index.jsx src/components/BookableServiceCard/index.jsx
git commit -m "feat: wire ServicesPage to Supabase and update BookableServiceCard auth handoff"
```

---

### Task 12: Wire `HomePage` popular services

**Files:**
- Modify: `src/pages/HomePage/index.jsx`

- [ ] **Step 1: Replace the hardcoded Popular Services section**

In `src/pages/HomePage/index.jsx`:

1. Add imports at the top:
```jsx
import { useState, useEffect } from 'react'
import { getCategories } from '../../services/servicesCmsService'
```

2. Add state inside the component (before the return):
```jsx
const [categories, setCategories] = useState([])

useEffect(() => {
  getCategories().then(setCategories).catch(() => {})
}, [])
```

3. Replace the static Popular Services grid (the three hardcoded `<ServiceCard>` elements) with:
```jsx
{(categories.length > 0 ? categories.slice(0, 3) : [
  { id: null, name: 'Facial Care', image_url: null },
  { id: null, name: 'Hand Care', image_url: null },
  { id: null, name: 'Nail Care', image_url: null },
]).map((cat) => (
  <ServiceCard
    key={cat.id || cat.name}
    title={cat.name}
    catId={cat.id ? cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null}
    imgUrl={cat.image_url}
  />
))}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/HomePage/index.jsx
git commit -m "feat: wire HomePage popular services to Supabase categories"
```

---

### Task 13: Wire `LocationPage` contact form + cleanup `mockData.js`

**Files:**
- Modify: `src/pages/LocationPage/index.jsx`
- Modify: `src/utils/mockData.js`

- [ ] **Step 1: Wire contact form in `src/pages/LocationPage/index.jsx`**

Replace the `<form>` element and its `onSubmit`:

1. Add imports:
```jsx
import { useState } from 'react'
import { submitInquiry } from '../../services/inquiryService'
```

2. Add state inside the component:
```jsx
const [form, setForm] = useState({ firstName: '', lastName: '', email: '', message: '' })
const [submitting, setSubmitting] = useState(false)
const [success, setSuccess] = useState(false)
const [formError, setFormError] = useState('')

const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

const handleSubmit = async (e) => {
  e.preventDefault()
  setFormError('')
  if (!form.firstName || !form.lastName || !form.email || !form.message) {
    setFormError('All fields are required.')
    return
  }
  if (!/\S+@\S+\.\S+/.test(form.email)) {
    setFormError('Please enter a valid email address.')
    return
  }
  setSubmitting(true)
  try {
    await submitInquiry(form)
    setSuccess(true)
    setForm({ firstName: '', lastName: '', email: '', message: '' })
  } catch {
    setFormError('Failed to send message. Please try again.')
  } finally {
    setSubmitting(false)
  }
}
```

3. Update the form tag: `<form className="flex flex-col space-y-6" onSubmit={handleSubmit}>`

4. Add `name` attributes to each input:
   - First name input: `name="firstName" value={form.firstName} onChange={handleChange}`
   - Last name input: `name="lastName" value={form.lastName} onChange={handleChange}`
   - Email input: `name="email" value={form.email} onChange={handleChange}`
   - Textarea: `name="message" value={form.message} onChange={handleChange}`

5. Above the submit button, add error and success states:
```jsx
{formError && <p className="text-xs text-red-500">{formError}</p>}
{success && <p className="text-xs text-green-600">Message sent! We'll get back to you within 24 hours.</p>}
```

6. Update submit button: `disabled={submitting}` and label `{submitting ? 'Sending…' : 'Send Message'}`.

- [ ] **Step 2: Clean up `src/utils/mockData.js`**

Remove the `CATEGORIES`, `NAIL_CARE_DETAILS`, and `BOOKABLE_SERVICES` exports. Keep only `TEAM_MEMBERS`:

```js
// src/utils/mockData.js
export const TEAM_MEMBERS = [
  { id: '1', name: 'Mary Nicole', role: '[Occupation]', image: '/team-member-1.png' },
  { id: '2', name: 'Savannah Maire', role: '[Occupation]', image: '/team-member-2.png' },
  { id: '3', name: 'Samantha', role: '[Occupation]', image: '/team-member-3.png' },
  { id: '4', name: 'Tanya', role: '[Occupation]', image: '/team-member-4.png' },
  { id: '5', name: 'Jessica', role: '[Occupation]', image: '/team-member-5.png' },
  { id: '6', name: 'Ian Jacobs', role: '[Occupation]', image: '/team-member-6.png' },
]
```

- [ ] **Step 3: Verify no remaining imports of removed mock exports**

```bash
grep -r "CATEGORIES\|NAIL_CARE_DETAILS\|BOOKABLE_SERVICES" src/
```
Expected: no results.

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LocationPage/index.jsx src/utils/mockData.js
git commit -m "feat: wire LocationPage contact form to Supabase and clean up mockData"
```

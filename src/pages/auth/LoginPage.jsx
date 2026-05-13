// src/pages/auth/LoginPage.jsx
import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { signIn, getProfile } from '../../services/authService'
import useAuthStore from '../../store/authStore'
import AuthLayout from '../../components/AuthLayout'

const TABS = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
}

const LoginPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab =
    searchParams.get('portal') === 'staff' ? TABS.STAFF : TABS.CUSTOMER

  const [activeTab, setActiveTab] = useState(initialTab)
  const setUser = useAuthStore((s) => s.setUser)
  const setProfile = useAuthStore((s) => s.setProfile)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    setEmail('')
    setPassword('')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await signIn(email, password)
      const profile = await getProfile(user.id)

      if (activeTab === TABS.CUSTOMER && profile.role !== 'customer') {
        setError(
          'This account is not a customer account. Please use the Staff & Admin portal.'
        )
        return
      }
      if (
        activeTab === TABS.STAFF &&
        profile.role !== 'admin' &&
        profile.role !== 'staff'
      ) {
        setError(
          'This account does not have staff or admin access. Please use the Customer portal.'
        )
        return
      }

      setUser(user)
      setProfile(profile)

      if (profile.account_status !== 'active') {
        navigate('/account-inactive')
        return
      }

      if (profile.role === 'admin') navigate('/admin')
      else if (profile.role === 'staff') navigate('/staff')
      else {
        // Honour any ?redirect= param (e.g. set by BookableServiceCard for guests)
        const redirectTo = searchParams.get('redirect') || '/dashboard'
        navigate(redirectTo)
      }
    } catch (err) {
      const msg = err.message || ''
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError(
          'Please confirm your email address before signing in. Check your inbox for a confirmation link.'
        )
      } else if (msg.toLowerCase().includes('lock broken')) {
        setError('A temporary error occurred. Please try signing in again.')
      } else {
        setError(msg || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isCustomer = activeTab === TABS.CUSTOMER

  return (
    <AuthLayout imageSrc="/flower-bouquet.png">
      <div className="w-full flex-col px-2 max-w-sm mx-auto">
        {/* Logo / Brand */}
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="ANAYA Aesthetic Studio" className="h-[4.5rem] object-contain invert mix-blend-darken mx-auto" />
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-md border border-gray-200 bg-white p-1 mb-8 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => handleTabSwitch(TABS.CUSTOMER)}
            className={[
              'flex-1 py-1.5 text-[0.65rem] font-medium rounded transition-all duration-200',
              isCustomer
                ? 'bg-transparent text-[#2C2C2C] border border-gray-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50',
            ].join(' ')}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch(TABS.STAFF)}
            className={[
              'flex-1 py-1.5 text-[0.65rem] font-medium rounded transition-all duration-200',
              !isCustomer
                ? 'bg-transparent text-[#2C2C2C] border border-gray-200 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50',
            ].join(' ')}
          >
            Staff &amp; Admin
          </button>
        </div>

        {/* Portal Label */}
        <p className="text-center text-xs text-gray-500 mb-8">
          {isCustomer ? 'Sign in to your account' : 'Sign in to your account (Staff)'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="login-email"
              className="block text-[0.65rem] font-medium text-gray-500 mb-1"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-0 py-2 border-0 border-b border-gray-400 bg-transparent
                text-sm focus:outline-none focus:ring-0 focus:border-gray-800 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[0.65rem] font-medium text-gray-500 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-0 py-2 pr-8 border-0 border-b border-gray-400 bg-transparent
                  text-sm focus:outline-none focus:ring-0 focus:border-gray-800 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-800 hover:text-black"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end -mt-3">
             <Link
               to="/forgot-password"
               className="text-[0.65rem] text-gray-500 hover:text-gray-800"
             >
               Forgot Password?
             </Link>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100
              rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-center mt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 py-2 bg-[#9ba58b] hover:bg-[#8A956D] text-white
                text-sm font-medium rounded-full transition-colors shadow-sm
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>

        {/* Footer links */}
        <div className="mt-8 text-center text-[0.65rem] text-gray-500">
            {isCustomer ? 'New to ANAYA? ' : 'Create a staff account? '}
            <Link
              to="/signup"
              className="text-gray-500 hover:text-gray-800 underline decoration-gray-400 underline-offset-2 ml-1"
            >
              Create an Account
            </Link>
        </div>
      </div>
    </AuthLayout>
  )
}

export default LoginPage

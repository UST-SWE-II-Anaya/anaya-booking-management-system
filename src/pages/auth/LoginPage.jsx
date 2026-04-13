// src/pages/auth/LoginPage.jsx
import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { signIn, getProfile } from '../../services/authService'
import useAuthStore from '../../store/authStore'

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
    <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

        {/* Logo / Brand */}
        <div className="mb-6 text-center">
          <h1 className="font-serif text-2xl font-semibold text-[#2C2C2C]">
            Anaya
          </h1>
          <p className="text-xs text-gray-400 mt-1 tracking-wide">
            Aesthetic Studio
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => handleTabSwitch(TABS.CUSTOMER)}
            className={[
              'flex-1 py-2 text-xs font-medium rounded-md transition-all duration-200',
              isCustomer
                ? 'bg-white text-[#2C2C2C] shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch(TABS.STAFF)}
            className={[
              'flex-1 py-2 text-xs font-medium rounded-md transition-all duration-200',
              !isCustomer
                ? 'bg-white text-[#2C2C2C] shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            Staff &amp; Admin
          </button>
        </div>

        {/* Portal Label */}
        <p className="text-center text-sm text-gray-500 mb-6">
          {isCustomer ? 'Sign in to your account' : 'Staff & Admin Portal'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-[#4A4A4A] mb-1"
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg
                text-sm focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
                focus:border-[#8A956D] transition-colors"
              placeholder={
                isCustomer ? 'you@example.com' : 'you@anaya.com'
              }
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-[#4A4A4A] mb-1"
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
                className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg
                  text-sm focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
                  focus:border-[#8A956D] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                  hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100
              rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#8A956D] hover:bg-[#7a8560] text-white
              text-sm font-medium rounded-lg transition-colors
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Customer-only footer links */}
        {isCustomer && (
          <div className="mt-5 text-center space-y-2">
            <p className="text-xs text-gray-500">
              Don&apos;t have an account?{' '}
              <Link
                to="/signup"
                className="text-[#8A956D] hover:text-[#7a8560] font-medium
                  underline underline-offset-2"
              >
                Create one
              </Link>
            </p>
            <Link
              to="/forgot-password"
              className="block text-xs text-gray-400 hover:text-gray-600"
            >
              Forgot password?
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoginPage

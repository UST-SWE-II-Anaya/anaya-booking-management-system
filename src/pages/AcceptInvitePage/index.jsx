import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import Spinner from '../../components/common/Spinner'
import { updateUserPassword, updateProfile, signOut } from '../../services/authService'
import { supabase } from '../../services/supabaseClient'
import useAuthStore from '../../store/authStore'

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say']

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [user, setUser] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    let authSub = null

    const checkInitialSession = async () => {
      // 1. Check if we already have a session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && mounted) {
        setUser(session.user)
        setSessionReady(true)
        return true
      }
      return false
    }

    const init = async () => {
      // Try initial check
      if (await checkInitialSession()) return

      // 2. Listen for session (catches hash-based login)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user && mounted) {
          setUser(session.user)
          setSessionReady(true)
          if (authSub) authSub.unsubscribe()
        }
      })
      authSub = subscription

      // 3. Check for PKCE code
      const code = searchParams.get('code')
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            if (mounted) setSessionError('This invite link is invalid or has expired.')
          } else if (mounted) {
            setUser(data.session.user)
            setSessionReady(true)
          }
        } catch (err) {
          if (mounted) setSessionError('An unexpected error occurred.')
        }
        if (authSub) authSub.unsubscribe()
        return
      }

      // 4. Give it a few seconds to settle (hash processing)
      setTimeout(() => {
        if (mounted && !useAuthStore.getState().user && !searchParams.get('code')) {
          setSessionError('No invite code found. Please use the link from your email.')
        }
      }, 2000)
    }

    init()

    return () => {
      mounted = false
      if (authSub) authSub.unsubscribe()
    }
  }, [searchParams])

  const role = user?.user_metadata?.role ?? ''
  const firstName = user?.user_metadata?.first_name ?? ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (role === 'staff' && !gender) {
      setError('Please select your gender.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await updateUserPassword(password)
      if (role === 'staff') {
        await updateProfile(user.id, { gender })
      }
      // Sign out after setting password so they can log in fresh with new password
      await signOut()
      toast.success('Account activated! Please sign in.')
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Failed to activate account. Please try again.')
      setLoading(false)
    }
  }

  if (sessionError) {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8 gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-xl">
            ✕
          </div>
          <p className="text-sm text-red-500">{sessionError}</p>
        </div>
      </AuthLayout>
    )
  }

  if (!sessionReady) {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
          <Spinner />
          <p className="text-sm text-gray-500">Verifying your invite link…</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout imageSrc="/flower-single.png">
      <span className="bg-[#f0f4e8] text-[#8A956D] text-[10px] tracking-widest uppercase px-3 py-1 rounded-full mb-4">
        {role === 'admin' ? 'Admin Invite' : 'Staff Invite'}
      </span>
      <h1 className="text-xl font-serif mt-2 mb-2 text-center tracking-wide text-anaya-text w-full">
        Welcome, {firstName}!
      </h1>
      <p className="text-xs text-gray-600 mb-8 text-center">
        You've been invited as a{' '}
        <span className="font-medium text-[#8A956D]">
          {role === 'admin' ? 'Admin' : 'Staff'}
        </span>{' '}
        member.
        <br />
        Create a password to activate your account.
      </p>

      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        <InputField
          label="New Password"
          type="password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError('')
          }}
        />
        <InputField
          label="Confirm Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            setError('')
          }}
        />

        {role === 'staff' && (
          <div className="w-full mb-6">
            <label className="block text-xs font-medium mb-1 tracking-wide text-gray-700">
              Gender*
            </label>
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value)
                setError('')
              }}
              required
              className="w-full bg-transparent border-0 border-b border-gray-800 outline-none pb-1 text-sm text-gray-900 focus:border-anaya-green"
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-anaya-error text-[0.65rem] mb-4 self-start">{error}</p>
        )}

        <div className="mt-2 w-full flex justify-center">
          <Button type="submit" disabled={loading}>
            {loading ? 'Activating…' : 'Activate Account'}
          </Button>
        </div>
      </form>

      <div className="w-full flex items-center justify-center space-x-2 my-8">
        <div className="h-px bg-gray-300 w-16"></div>
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px bg-gray-300 w-16"></div>
      </div>

      <Link to="/login" className="text-xs underline hover:text-gray-900 transition-colors">
        Back to Login
      </Link>
    </AuthLayout>
  )
}

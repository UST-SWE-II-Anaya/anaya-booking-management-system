import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import { updateUserPassword } from '../../services/authService'
import { supabase } from '../../services/supabaseClient'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          setSessionError('This reset link is invalid or has expired. Please request a new one.')
        } else {
          setSessionReady(true)
        }
      })
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSessionReady(true)
        } else {
          setSessionError('No valid reset session. Please request a new password reset link.')
        }
      })
    }
  }, [searchParams])

  const handleUpdate = async (e) => {
    if (e) e.preventDefault()

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setLoading(true)

    try {
      await updateUserPassword(password)
      toast.success('Password updated successfully! Redirecting...')
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('different from the old')) {
        setError('New password must be different from your current one.')
      } else if (msg.includes('Lock broken')) {
        toast.success('Update completed, please sign in.')
        navigate('/login')
      } else {
        setError(msg || 'Failed to update password. Please try again.')
      }
      setLoading(false)
    }
  }

  if (sessionError) {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <p className="text-sm text-red-500 mb-6">{sessionError}</p>
          <Link
            to="/forgot-password"
            className="text-xs text-[#8A956D] hover:text-[#7a8560] underline underline-offset-2"
          >
            Request a new reset link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (!sessionReady) {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <p className="text-sm text-gray-500">Verifying reset link...</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout imageSrc="/flower-single.png">
      <h1 className="text-xl font-serif mt-10 mb-2 text-center tracking-wide text-anaya-text w-full">Change Password</h1>
      <p className="text-xs text-gray-600 mb-10 text-center">Enter your new password below</p>

      <form onSubmit={handleUpdate} className="w-full flex flex-col items-center">
        <InputField
          label="New Password"
          type="password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError('')
          }}
          error={error && error.includes('match') ? '' : error}
        />

        <InputField
          label="Confirm New Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            setError('')
          }}
          error={error && error.includes('match') ? error : ''}
        />

        <div className="mt-4 w-full flex justify-center">
          <Button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
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

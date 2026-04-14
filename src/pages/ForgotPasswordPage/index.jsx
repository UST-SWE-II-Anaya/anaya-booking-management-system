import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import { sendPasswordResetEmail } from '../../services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleReset = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address.')
      return
    }
    setError('')
    setLoading(true)
    
    try {
      await sendPasswordResetEmail(email)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <svg
              className="w-7 h-7 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="font-serif text-xl text-anaya-text mb-2">
            Check your inbox!
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xs mb-6">
            If an account exists for <span className="font-medium text-gray-700">{email}</span>, you will receive an email with instructions on how to reset your password.
          </p>
          <Link
            to="/login"
            className="text-xs text-[#8A956D] hover:text-[#7a8560] underline underline-offset-2"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout imageSrc="/flower-single.png">
      <h1 className="text-xl font-serif mt-10 mb-2 text-center tracking-wide text-anaya-text w-full">Forgot Password</h1>
      <p className="text-xs text-gray-600 mb-10 text-center">Enter your registered email to receive a password reset link.</p>

      <form onSubmit={handleReset} className="w-full flex flex-col items-center">
        <InputField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
          }}
          error={error}
        />

        <div className="mt-4 w-full flex justify-center">
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
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

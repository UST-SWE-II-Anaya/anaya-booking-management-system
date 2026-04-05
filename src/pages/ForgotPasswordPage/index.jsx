import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const handleReset = (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address.')
      return
    }
    setError('')
    console.log('Reset password for:', email)
  }

  return (
    <AuthLayout imageSrc="/flower-single.png">
      <h1 className="text-xl font-serif mt-10 mb-2 text-center tracking-wide text-anaya-text w-full">Forgot Password</h1>
      <p className="text-xs text-gray-600 mb-10 text-center">Enter your registered email</p>

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
          <Button type="submit">
            Reset Password
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

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'

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
    confirmPassword: '',
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  // 'none' | 'confirm_email' | 'auto_confirmed'
  const [successState, setSuccessState] = useState('none')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear field-level error on type
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    setServerError('')
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = 'Please enter a valid email address.'
    if (!formData.firstName)
      newErrors.firstName = 'First Name is required.'
    if (!formData.lastName)
      newErrors.lastName = 'Last Name is required.'
    if (!formData.dob)
      newErrors.dob = 'Date of birth is required.'
    if (!formData.password || formData.password.length < 8)
      newErrors.password = 'Password must be at least 8 characters.'
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match.'
    return newErrors
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setServerError('')

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    try {
      const data = await signUp(formData.email, formData.password, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phone,
        date_of_birth: formData.dob,
      })
      // session is null when Supabase requires email confirmation
      if (data.session === null) {
        setSuccessState('confirm_email')
      } else {
        setSuccessState('auto_confirmed')
        setTimeout(() => navigate('/login'), 2500)
      }
    } catch (err) {
      setServerError(
        err.message || 'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Email confirmation required — show inbox prompt
  if (successState === 'confirm_email') {
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
            We&apos;ve sent a confirmation email to{' '}
            <span className="font-medium text-gray-700">{formData.email}</span>.
            Click the link in the email to activate your account.
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

  // Auto-confirmed (no email verification needed)
  if (successState === 'auto_confirmed') {
    return (
      <AuthLayout imageSrc="/flower-single.png">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg
              className="w-7 h-7 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="font-serif text-xl text-anaya-text mb-2">
            Account Created!
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
            Your account has been successfully created. Redirecting you to
            sign in…
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout imageSrc="/flower-single.png">
      <h1 className="text-2xl font-serif mb-8 text-center tracking-wide text-anaya-text w-full">
        Create your Account
      </h1>

      {serverError && (
        <div className="w-full mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {serverError}
        </div>
      )}

      <form
        onSubmit={handleRegister}
        className="w-full flex flex-col items-center"
      >
        <InputField
          label="Email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />

        <InputField
          label="Phone number (optional)"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
        />

        <InputField
          label="First Name"
          name="firstName"
          required
          value={formData.firstName}
          onChange={handleChange}
          error={errors.firstName}
        />

        <InputField
          label="Last Name"
          name="lastName"
          required
          value={formData.lastName}
          onChange={handleChange}
          error={errors.lastName}
        />

        <InputField
          label="Date of Birth"
          name="dob"
          type="date"
          required
          value={formData.dob}
          onChange={handleChange}
          error={errors.dob}
        />

        <InputField
          label="Password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
        />

        <InputField
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />



        <Button type="submit" disabled={loading}>
          {loading ? 'Creating Account…' : 'Create an Account'}
        </Button>
      </form>



      <div className="mt-4 text-xs text-gray-500 text-center">
        Already have an account?{' '}
        <Link to="/login" className="underline hover:text-gray-900 ml-1">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  )
}

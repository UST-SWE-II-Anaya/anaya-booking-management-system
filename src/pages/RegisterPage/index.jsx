import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import GoogleButton from '../../components/GoogleButton'

export default function RegisterPage() {
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // clear error on type
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleRegister = (e) => {
    e.preventDefault()
    
    // Mock Validation matching screenshots
    const newErrors = {}
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address.'
    if (!formData.firstName) newErrors.firstName = 'First Name is required.'
    if (!formData.lastName) newErrors.lastName = 'Last Name is required.'
    if (!formData.dob) newErrors.dob = 'Invalid date format.'
    if (!formData.password || formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters.'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    console.log('Register attempt:', formData)
  }

  return (
    <AuthLayout imageSrc="/flower-single.png">
      <h1 className="text-2xl font-serif mb-8 text-center tracking-wide text-anaya-text w-full">Create your Account</h1>

      <form onSubmit={handleRegister} className="w-full flex flex-col items-center max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
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
          placeholder="mm/dd/yyyy"
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

        {/* reCAPTCHA placeholder */}
        <div className="w-full sm:w-2/3 border border-gray-200 bg-white rounded flex justify-between items-center p-2 mb-6 shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 border-2 border-gray-300 rounded-sm"></div>
            <span className="text-[0.65rem] text-gray-600">I am human</span>
          </div>
          <div className="flex flex-col items-center">
            {/* Visual placeholder for generic reCaptcha logo */}
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
               <span className="text-blue-500 font-bold text-[10px]">C</span>
            </div>
            <span className="text-[0.4rem] text-gray-400 mt-1">reCAPTCHA</span>
            <span className="text-[0.4rem] text-gray-400">Privacy - Terms</span>
          </div>
        </div>

        <Button type="submit">
          Create an Account
        </Button>
      </form>

      <div className="w-full flex items-center justify-center space-x-2 my-6">
        <div className="h-px bg-gray-300 w-16"></div>
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px bg-gray-300 w-16"></div>
      </div>

      <GoogleButton onClick={() => console.log('Google Sign In')} />
    </AuthLayout>
  )
}

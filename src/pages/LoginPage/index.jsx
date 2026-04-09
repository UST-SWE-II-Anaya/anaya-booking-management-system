import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import GoogleButton from '../../components/GoogleButton'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hasError, setHasError] = useState(false)

  const handleSignIn = (e) => {
    e.preventDefault()
    // Mock login failure to demonstrate error state from screenshots
    if (!email || !password) {
      setHasError(true)
      return
    }
    // Proceed to mock success
    setHasError(false)
    console.log('Login attempt:', { email, password })
  }

  return (
    <AuthLayout imageSrc="/flower-bouquet.png">
      {/* Top Logo */}
      <div className="flex flex-col items-center mb-6 w-full">
        <img src="/logo.png" alt="ANAYA Aesthetic Studio" className="h-16 md:h-20 object-contain invert mix-blend-darken" />
      </div>

      <h1 className="text-sm font-medium mb-8 text-center tracking-wide">Welcome to ANAYA</h1>

      {hasError && (
        <div className="w-full text-xs text-anaya-error mb-4">
          Invalid email or password. Please try again.
        </div>
      )}

      <form onSubmit={handleSignIn} className="w-full flex flex-col items-center">
        <InputField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setHasError(false)
          }}
          error={hasError ? ' ' : ''} // Pass a space to trigger error styling without specific field message
        />

        <InputField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setHasError(false)
          }}
          error={hasError ? ' ' : ''}
        />

        <div className="w-full flex justify-end -mt-4 mb-6">
          <Link to="/forgot-password" className="text-[0.65rem] text-gray-500 hover:text-gray-800 transition-colors">
            Forget password?
          </Link>
        </div>

        <Button type="submit">
          Sign In
        </Button>
      </form>

      <div className="w-full flex items-center justify-center space-x-2 my-8">
        <div className="h-px bg-gray-300 w-16"></div>
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px bg-gray-300 w-16"></div>
      </div>

      <GoogleButton onClick={() => console.log('Google Sign In')} className="mb-8" />

      <div className="text-[0.7rem] text-gray-600">
        New to ANAYA? <Link to="/signup" className="underline hover:text-gray-900 ml-1">Create an Account</Link>
      </div>
    </AuthLayout>
  )
}

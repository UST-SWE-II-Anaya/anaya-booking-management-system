import { useNavigate } from 'react-router-dom'
import { Lock, Facebook, Mail } from 'lucide-react'
import Navbar from '../../components/Navbar'
import useAuthStore from '../../store/authStore'
import { signOut } from '../../services/authService'

const AccountInactivePage = () => {
  const navigate = useNavigate()
  const { profile, clear } = useAuthStore()

  const handleGoHome = async () => {
    try {
      await signOut()
    } catch {
      // ignore — clear local state regardless of server response
    }
    clear()
    navigate('/')
  }

  const isBanned = profile?.account_status === 'banned'
  const heading = isBanned
    ? 'Your account has been deactivated'
    : 'Your account has been suspended'
  const reason = profile?.deactivation_reason ||
    'No specific reason was provided. Please contact support for details.'

  return (
    <div className="min-h-screen bg-[#f9f8f6] flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
              <Lock size={24} className="text-amber-500" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-[#2C2C2C] mb-2">{heading}</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your access to Anaya has been restricted.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-1">Due to this reason:</p>
            <p className="text-sm text-[#4A4A4A]">{reason}</p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-700">
              Contact Anaya customer support to reactivate your account.
            </p>
          </div>

          <div className="flex gap-3 justify-center mb-6">
            <a
              href="#"
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg
                bg-[#1877F2] text-white hover:opacity-90 transition-opacity"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Anaya on Facebook"
            >
              <Facebook size={16} />
              Facebook
            </a>
            <a
              href="mailto:support@anaya.ph"
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg
                bg-[#8A956D] text-white hover:bg-[#7a8560] transition-colors"
              aria-label="Email Anaya support"
            >
              <Mail size={16} />
              Email Us
            </a>
          </div>

          <button
            onClick={handleGoHome}
            className="px-6 py-2 text-sm border border-gray-300 rounded-full
              text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Go Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountInactivePage

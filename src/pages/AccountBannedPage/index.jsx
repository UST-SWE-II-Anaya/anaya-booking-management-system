import { useNavigate } from 'react-router-dom'
import { ShieldOff, Mail } from 'lucide-react'
import Navbar from '../../components/Navbar'
import useAuthStore from '../../store/authStore'
import { signOut } from '../../services/authService'

const AccountBannedPage = () => {
  const navigate = useNavigate()
  const { profile, clear } = useAuthStore()

  const handleGoHome = async () => {
    try {
      await signOut()
    } catch {
      // ignore — clear local state regardless
    }
    clear()
    navigate('/')
  }

  const reason = profile?.deactivation_reason ||
    'No specific reason was provided. Please contact support for details.'

  return (
    <div className="min-h-screen bg-[#f9f8f6] flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <ShieldOff size={24} className="text-red-500" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-[#2C2C2C] mb-2">
            Your account has been banned
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Your access to Anaya has been permanently revoked.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-1">Due to this reason:</p>
            <p className="text-sm text-[#4A4A4A]">{reason}</p>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">
              This ban is permanent. If you believe this is a mistake, contact Anaya support.
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

export default AccountBannedPage

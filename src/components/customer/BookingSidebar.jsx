import { Link } from 'react-router-dom'
import useBookingStore from '../../store/bookingStore'
import { formatDuration } from '../../utils/bookingUtils'

const BookingSidebar = ({ onContinue, continueDisabled }) => {
  const { cart } = useBookingStore()
  const subtotal = cart.reduce((sum, s) => sum + Number(s.price), 0)
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0)
  const downPayment = subtotal * 0.1

  return (
    <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl p-5 h-fit sticky top-6 shadow-sm">
      <h2 className="font-semibold text-lg mb-4 text-anaya-text">Your Booking</h2>
      {cart.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">No Services Selected</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {cart.map((s) => (
            <li key={s.id} className="flex justify-between text-sm text-anaya-text">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-gray-400">
                  {formatDuration(s.duration_minutes)} with any professional
                </p>
              </div>
              <span className="font-medium shrink-0 ml-2">
                ₱{Number(s.price).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-gray-100 pt-3 space-y-2 text-sm mb-5">
        <div className="flex justify-between text-anaya-text">
          <span>Total:</span>
          <span className="font-semibold">₱{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Down Payment<br />(10% of Total):</span>
          <span>₱{downPayment.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Total Duration:</span>
          <span>
            {totalDuration > 0
              ? `Est. ${formatDuration(totalDuration)}`
              : 'Est. 0 Hours'}
          </span>
        </div>
      </div>
      <button
        onClick={onContinue}
        disabled={continueDisabled}
        className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  )
}

export default BookingSidebar

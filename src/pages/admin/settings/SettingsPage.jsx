// src/pages/admin/settings/SettingsPage.jsx
import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { getAllSettings, upsertSetting } from '../../../services/settingsService'
import Spinner from '../../../components/common/Spinner'
import useAuthStore from '../../../store/authStore'

const Section = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
    <h2 className="font-semibold text-[#2C2C2C] mb-5">{title}</h2>
    {children}
  </div>
)

const inputClass = `px-3 py-2 border border-gray-200 rounded-lg text-sm
  focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

const SettingsPage = () => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [hours, setHours] = useState({ start: '09:00', end: '19:30' })
  const [downpayment, setDownpayment] = useState(10)
  const [cancellation, setCancellation] = useState(12)
  const [paymentDeadline, setPaymentDeadline] = useState(12)
  const [slotDuration, setSlotDuration] = useState(30)
  const [contact, setContact] = useState({ phone: '', email: '', address: '' })

  useEffect(() => {
    getAllSettings()
      .then((s) => {
        if (s.operating_hours) setHours(s.operating_hours)
        if (s.downpayment_rate) setDownpayment(s.downpayment_rate.percentage)
        if (s.cancellation_window) setCancellation(s.cancellation_window.hours)
        if (s.payment_deadline_hours) setPaymentDeadline(s.payment_deadline_hours.hours)
        if (s.slot_duration) setSlotDuration(s.slot_duration.minutes)
        if (s.contact_info) setContact(s.contact_info)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await Promise.all([
        upsertSetting('operating_hours', hours, user.id),
        upsertSetting('downpayment_rate', { percentage: Number(downpayment) }, user.id),
        upsertSetting('cancellation_window', { hours: Number(cancellation) }, user.id),
        upsertSetting('payment_deadline_hours', { hours: Number(paymentDeadline) }, user.id),
        upsertSetting('slot_duration', { minutes: Number(slotDuration) }, user.id),
        upsertSetting('contact_info', contact, user.id),
      ])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Settings</h1>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] text-white
            text-sm rounded-lg hover:bg-[#7a8560] transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
          Settings saved successfully.
        </p>
      )}

      <Section title="Operating Hours">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Opening Time</label>
            <input
              type="time"
              className={inputClass}
              value={hours.start}
              onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Closing Time</label>
            <input
              type="time"
              className={inputClass}
              value={hours.end}
              onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))}
            />
          </div>
        </div>
      </Section>

      <Section title="Booking Rules">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Downpayment (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              className={inputClass + ' w-full'}
              value={downpayment}
              onChange={(e) => setDownpayment(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Currently {downpayment}% of total
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Cancellation Window (hrs)
            </label>
            <input
              type="number"
              min="1"
              className={inputClass + ' w-full'}
              value={cancellation}
              onChange={(e) => setCancellation(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Customer can cancel up to {cancellation}h before
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Payment Deadline (hrs)
            </label>
            <input
              type="number"
              min="1"
              className={inputClass + ' w-full'}
              value={paymentDeadline}
              onChange={(e) => setPaymentDeadline(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Hours to submit downpayment
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Slot Duration (min)
            </label>
            <input
              type="number"
              min="15"
              step="15"
              className={inputClass + ' w-full'}
              value={slotDuration}
              onChange={(e) => setSlotDuration(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Appointment intervals
            </p>
          </div>
        </div>
      </Section>

      <Section title="Contact Information">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
            <input
              className={inputClass + ' w-full'}
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              placeholder="+63 912 345 6789"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email Address</label>
            <input
              type="email"
              className={inputClass + ' w-full'}
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
              placeholder="contact@anaya.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Address / Location Description
            </label>
            <textarea
              rows={3}
              className={inputClass + ' w-full'}
              value={contact.address}
              onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))}
              placeholder="Unit 1, Example Bldg, Street, City"
            />
          </div>
        </div>
      </Section>
    </form>
  )
}

export default SettingsPage

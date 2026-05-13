// src/components/admin/bookings/ExportBookingsModal.jsx
import { useState } from 'react'
import { Download } from 'lucide-react'
import Modal from '../../common/Modal'
import { exportBookings } from '../../../services/bookingService'
import { buildCsv, downloadCsv } from '../../../utils/bookingsCsv'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'finished', label: 'Finished' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void
 * }} props
 */
const ExportBookingsModal = ({ open, onClose }) => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await exportBookings({
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      downloadCsv(buildCsv(data))
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Custom Export" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase
            tracking-wide mb-2">
            Date Range
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3
                  py-2 text-sm text-[#4A4A4A] focus:outline-none
                  focus:ring-2 focus:ring-[#8A956D]/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3
                  py-2 text-sm text-[#4A4A4A] focus:outline-none
                  focus:ring-2 focus:ring-[#8A956D]/30"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase
            tracking-wide mb-2">
            Booking Status
          </p>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2
              text-sm text-[#4A4A4A] focus:outline-none
              focus:ring-2 focus:ring-[#8A956D]/30"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3
            py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm
              text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#8A956D]
              text-white rounded-lg text-sm font-medium
              hover:bg-[#7a8560] transition-colors disabled:opacity-50
              disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {loading ? 'Exporting…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ExportBookingsModal

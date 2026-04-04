// src/pages/admin/inquiries/InquiriesPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { Mail, Archive } from 'lucide-react'
import { getInquiries, markRead, archiveInquiry } from '../../../services/inquiryService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import Modal from '../../../components/common/Modal'

const STATUS_FILTERS = ['unread', 'read', 'archived']

const InquiriesPage = () => {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('unread')
  const [selected, setSelected] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getInquiries({ status: statusFilter })
      .then(setInquiries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const openInquiry = async (inq) => {
    setSelected(inq)
    if (inq.status === 'unread') {
      try {
        await markRead(inq.id)
        load()
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleArchive = async (id) => {
    setActionLoading(id)
    try {
      await archiveInquiry(id)
      setSelected(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Inquiries</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium
                transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-[#8A956D] text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : inquiries.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={`No ${statusFilter} inquiries`}
            message="Your inbox is clear."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {inquiries.map((inq) => (
              <div
                key={inq.id}
                className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50/50
                  cursor-pointer transition-colors"
                onClick={() => openInquiry(inq)}
              >
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  inq.status === 'unread' ? 'bg-[#CE845D]' : 'bg-transparent'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${
                      inq.status === 'unread'
                        ? 'font-semibold text-[#2C2C2C]'
                        : 'font-medium text-[#4A4A4A]'
                    }`}>
                      {inq.first_name} {inq.last_name}
                    </p>
                    <span className="text-xs text-gray-400">{inq.email}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                    {inq.message}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-400">
                    {new Date(inq.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Inquiry"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-1">From</p>
                <p className="font-medium text-[#4A4A4A]">
                  {selected.first_name} {selected.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Email</p>
                <p className="text-[#4A4A4A]">{selected.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Received</p>
                <p className="text-[#4A4A4A]">
                  {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <Badge variant={selected.status} label={selected.status} />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Message</p>
              <p className="text-sm text-[#4A4A4A] whitespace-pre-wrap">
                {selected.message}
              </p>
            </div>

            {selected.status !== 'archived' && (
              <div className="flex justify-end">
                <button
                  onClick={() => handleArchive(selected.id)}
                  disabled={actionLoading === selected.id}
                  className="flex items-center gap-2 px-4 py-2 text-sm border
                    border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50
                    transition-colors disabled:opacity-50"
                >
                  <Archive size={13} />
                  {actionLoading === selected.id ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default InquiriesPage

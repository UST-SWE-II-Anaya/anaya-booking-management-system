// src/pages/admin/qr-payment/QRPaymentPage.jsx
import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Upload, Trash2 } from 'lucide-react'
import { uploadQRCode, removeQRCode, getQRCodeUrls } from '../../../services/qrPaymentService'
import Spinner from '../../../components/common/Spinner'
import useAuthStore from '../../../store/authStore'

const QRSlot = ({ slot, label, url, onUpload, onRemove, loading }) => {
  const inputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB.')
      return
    }
    onUpload(slot, file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
        {url ? (
          <img 
            src={url} 
            alt={label} 
            className="w-full h-full object-contain"
            onError={(e) => { e.target.style.display = 'none' }} 
          />
        ) : (
          <p className="text-xs text-gray-400 text-center px-4">No QR image uploaded</p>
        )}
      </div>
      <p className="text-sm font-medium text-[#2C2C2C]">{label}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8A956D] text-white
            text-xs rounded-lg hover:bg-[#7a8560] transition-colors disabled:opacity-50"
        >
          <Upload size={12} />
          {url ? 'Replace' : 'Upload'}
        </button>
        {url && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onRemove(slot)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600
              text-xs rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} />
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

const QRPaymentPage = () => {
  const { user } = useAuthStore()
  const [urls, setUrls] = useState({ qr1: null, qr2: null })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    getQRCodeUrls()
      .then(setUrls)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleUpload = async (slot, file) => {
    setActionLoading(true)
    try {
      const url = await uploadQRCode(slot, file, user.id)
      setUrls((prev) => ({ ...prev, [`qr${slot}`]: url }))
      toast.success(`GCash QR #${slot} updated.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemove = async (slot) => {
    setActionLoading(true)
    try {
      await removeQRCode(slot, user.id)
      setUrls((prev) => ({ ...prev, [`qr${slot}`]: null }))
      toast.success(`GCash QR #${slot} removed.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-[#2C2C2C] mb-1">QR Payment</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage the GCash QR codes shown to customers during payment.
        Slots with no image will appear as unavailable.
      </p>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
        <div className="flex gap-12 justify-center flex-wrap">
          <QRSlot
            slot={1}
            label="GCash QR #1"
            url={urls.qr1}
            onUpload={handleUpload}
            onRemove={handleRemove}
            loading={actionLoading}
          />
          <QRSlot
            slot={2}
            label="GCash QR #2"
            url={urls.qr2}
            onUpload={handleUpload}
            onRemove={handleRemove}
            loading={actionLoading}
          />
        </div>
      </div>
    </div>
  )
}

export default QRPaymentPage

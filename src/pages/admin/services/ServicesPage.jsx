// src/pages/admin/services/ServicesPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import {
  getServicesByCategory,
  getCategories,
  createService,
  updateService,
  deleteService,
} from '../../../services/servicesCmsService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const ServiceForm = ({ open, onClose, onSaved, initial, categoryId }) => {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    duration_minutes: initial?.duration_minutes ?? 30,
    price: initial?.price ?? '',
    image_url: initial?.image_url ?? '',
    is_popular: initial?.is_popular ?? false,
    is_active: initial?.is_active ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        duration_minutes: parseInt(form.duration_minutes, 10),
        price: parseFloat(form.price),
        category_id: categoryId,
      }
      if (initial?.id) await updateService(initial.id, payload)
      else await createService(payload)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Service' : 'Add Service'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Service Name</label>
          <input className={inputClass} value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={set('description')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="15"
              step="15"
              className={inputClass}
              value={form.duration_minutes}
              onChange={set('duration_minutes')}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Price (₱)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={form.price}
              onChange={set('price')}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Image URL</label>
          <input className={inputClass} value={form.image_url} onChange={set('image_url')} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[#4A4A4A]">
            <input
              type="checkbox"
              checked={form.is_popular}
              onChange={(e) => setForm((f) => ({ ...f, is_popular: e.target.checked }))}
              className="accent-[#8A956D]"
            />
            Mark as Popular
          </label>
          <label className="flex items-center gap-2 text-sm text-[#4A4A4A]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="accent-[#8A956D]"
            />
            Active (visible to customers)
          </label>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border
            border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm
            bg-[#8A956D] text-white rounded-lg hover:bg-[#7a8560] disabled:opacity-50">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const ServicesPage = () => {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const [services, setServices] = useState([])
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formTarget, setFormTarget] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      getServicesByCategory(categoryId),
      getCategories(),
    ])
      .then(([svcs, cats]) => {
        setServices(svcs)
        const cat = cats.find((c) => c.id === categoryId)
        setCategoryName(cat?.name ?? 'Services')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [categoryId])

  const handleDelete = async () => {
    try {
      await deleteService(deleteId)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/services')} aria-label="Back">
            <ArrowLeft size={18} className="text-gray-400 hover:text-gray-600" />
          </button>
          <h1 className="text-xl font-semibold text-[#2C2C2C]">{categoryName}</h1>
        </div>
        <button
          onClick={() => setFormTarget({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] text-white
            text-sm rounded-lg hover:bg-[#7a8560] transition-colors"
        >
          <Plus size={15} /> Add Service
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : services.length === 0 ? (
        <EmptyState title="No services in this category" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {['Name', 'Duration', 'Price', 'Popular', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-medium text-gray-400
                    uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {services.map((svc) => (
                <tr key={svc.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#4A4A4A]">{svc.name}</p>
                    {svc.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {svc.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {svc.duration_minutes} min
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    ₱{Number(svc.price).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {svc.is_popular ? '★ Yes' : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={svc.is_active ? 'active' : 'cancelled'}
                      label={svc.is_active ? 'Active' : 'Inactive'}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormTarget(svc)}
                        className="p-1.5 text-gray-400 hover:text-[#8A956D] rounded
                          hover:bg-gray-100"
                        aria-label="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(svc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded
                          hover:bg-gray-100"
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formTarget !== null && (
        <ServiceForm
          open
          onClose={() => setFormTarget(null)}
          onSaved={load}
          initial={formTarget.id ? formTarget : null}
          categoryId={categoryId}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Service"
        message="This will permanently delete the service."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

export default ServicesPage

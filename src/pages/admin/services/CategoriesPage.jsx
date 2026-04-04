// src/pages/admin/services/CategoriesPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Scissors } from 'lucide-react'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../../services/servicesCmsService'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import Modal from '../../../components/common/Modal'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const CategoryForm = ({ open, onClose, onSaved, initial }) => {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    image_url: initial?.image_url ?? '',
    display_order: initial?.display_order ?? 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (initial?.id) await updateCategory(initial.id, form)
      else await createCategory(form)
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
      title={initial ? 'Edit Category' : 'Add Category'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">Image URL</label>
          <input className={inputClass} value={form.image_url} onChange={set('image_url')} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Display Order</label>
          <input
            type="number"
            className={inputClass}
            value={form.display_order}
            onChange={(e) =>
              setForm((f) => ({ ...f, display_order: parseInt(e.target.value, 10) || 0 }))
            }
          />
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

const CategoriesPage = () => {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formTarget, setFormTarget] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const load = () => {
    setLoading(true)
    getCategories()
      .then(setCategories)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    try {
      await deleteCategory(deleteId)
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
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Service Categories</h1>
        <button
          onClick={() => setFormTarget({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] text-white
            text-sm rounded-lg hover:bg-[#7a8560] transition-colors"
        >
          <Plus size={15} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : categories.length === 0 ? (
        <EmptyState icon={Scissors} title="No categories yet" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm
                overflow-hidden group"
            >
              {cat.image_url && (
                <div className="h-36 overflow-hidden bg-gray-100">
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#2C2C2C]">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setFormTarget(cat)}
                      className="p-1.5 text-gray-400 hover:text-[#8A956D] rounded-lg
                        hover:bg-gray-100 transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(cat.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg
                        hover:bg-gray-100 transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/admin/services/${cat.id}`)}
                  className="mt-3 w-full text-xs text-[#CE845D] hover:underline text-left"
                >
                  Manage services →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget !== null && (
        <CategoryForm
          open
          onClose={() => setFormTarget(null)}
          onSaved={load}
          initial={formTarget.id ? formTarget : null}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message="This will delete the category and all services within it. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

export default CategoriesPage

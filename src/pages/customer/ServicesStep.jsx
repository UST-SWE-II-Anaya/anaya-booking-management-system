import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import { getAllActiveServices } from '../../services/servicesCmsService'
import { formatDuration } from '../../utils/bookingUtils'
import BookingSidebar from '../../components/customer/BookingSidebar'

const ServicesStep = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { cart, addToCart, removeFromCart } = useBookingStore()
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState(null)

  useEffect(() => {
    getAllActiveServices().then((data) => {
      setServices(data)
      const cats = ['All', ...new Set(data.map((s) => s.category_name))]
      setCategories(cats)
      setLoading(false)
      const preselect = searchParams.get('service')
      if (preselect) {
        const svc = data.find((s) => s.id === preselect)
        if (svc && !cart.find((c) => c.id === svc.id)) addToCart(svc)
      }
    })
  }, [])

  const filtered = services.filter((s) => {
    const matchCat =
      selectedCategory === 'All' || s.category_name === selectedCategory
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const isInCart = (id) => cart.some((c) => c.id === id)

  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.category_name]) acc[s.category_name] = []
    acc[s.category_name].push(s)
    return acc
  }, {})

  if (loading) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500">Loading services...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          to="/"
          className="text-sm text-gray-500 hover:underline mb-4 inline-block"
        >
          ← Go Back to Previous Page
        </Link>
        <div className="flex gap-8 items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-1">
              Our Services
            </h1>
            <p className="text-gray-500 mb-6">
              Choose your treatments to create your perfect appointment.
            </p>

            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search for a service..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-anaya-accent"
              />
            </div>

            <div className="flex gap-2 flex-wrap mb-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={clsx(
                    'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    selectedCategory === cat
                      ? 'bg-anaya-accent text-white border-anaya-accent'
                      : 'bg-white text-anaya-text border-gray-200 hover:border-anaya-accent'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {Object.entries(grouped).map(([category, svcs]) => (
              <div key={category} className="mb-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {category}
                </h2>
                <div className="space-y-2">
                  {svcs.map((svc) => {
                    const inCart = isInCart(svc.id)
                    return (
                      <div
                        key={svc.id}
                        className={clsx(
                          'bg-white rounded-lg border p-4 flex items-center justify-between',
                          inCart ? 'border-anaya-accent' : 'border-gray-200'
                        )}
                      >
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedService(svc)}
                        >
                          <p className="font-medium text-anaya-text">
                            {svc.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            🕐 {formatDuration(svc.duration_minutes)}
                          </p>
                          <p className="text-sm font-semibold mt-1">
                            ₱{Number(svc.price).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            inCart
                              ? removeFromCart(svc.id)
                              : addToCart(svc)
                          }
                          className={clsx(
                            'ml-4 px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors shrink-0',
                            inCart
                              ? 'bg-anaya-accent text-white border-anaya-accent'
                              : 'bg-white text-anaya-text border-gray-300 hover:border-anaya-accent'
                          )}
                        >
                          {inCart ? '✓ Added' : '+ Add'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <BookingSidebar
            onContinue={() => navigate('/booking/staff')}
            continueDisabled={cart.length === 0}
          />
        </div>
      </div>

      {selectedService && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="bg-white rounded-xl max-w-sm w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedService(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-anaya-text mb-1">
              {selectedService.name}
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {selectedService.category_name}
            </p>
            <p className="text-lg font-bold text-anaya-text mb-1">
              ₱{Number(selectedService.price).toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              🕐 {formatDuration(selectedService.duration_minutes)}
            </p>
            <button
              onClick={() => {
                if (!isInCart(selectedService.id)) addToCart(selectedService)
                setSelectedService(null)
              }}
              className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-2.5 rounded-lg font-medium"
            >
              {isInCart(selectedService.id) ? 'Already Added' : 'Add to Booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServicesStep

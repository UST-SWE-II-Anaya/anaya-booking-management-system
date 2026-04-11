import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import { getAllActiveServices } from '../../services/servicesCmsService'
import { formatDuration } from '../../utils/bookingUtils'
import BookingSidebar from '../../components/customer/BookingSidebar'

// Categories whose names start with "Packages - " are grouped under a "Package" filter pill
const isPackageCategory = (cat) => cat.startsWith('Packages - ')
const packageSubname = (cat) => cat.replace('Packages - ', '')

const ServicesStep = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { cart, addToCart, removeFromCart } = useBookingStore()
  const [services, setServices] = useState([])
  const [filterPills, setFilterPills] = useState([])
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState(null)

  useEffect(() => {
    getAllActiveServices().then((data) => {
      setServices(data)

      // Build filter pills: All + unique category names, collapsing all "Packages - *" into "Package"
      const seen = new Set()
      const pills = ['All']
      data.forEach((s) => {
        const pill = isPackageCategory(s.category_name) ? 'Package' : s.category_name
        if (!seen.has(pill)) {
          seen.add(pill)
          pills.push(pill)
        }
      })
      setFilterPills(pills)
      setLoading(false)

      const preselect = searchParams.get('service')
      if (preselect) {
        const svc = data.find((s) => s.id === preselect)
        if (svc && !cart.find((c) => c.id === svc.id)) addToCart(svc)
      }
    })
  }, [])

  const matchesFilter = (svc) => {
    if (selectedFilter === 'All') return true
    if (selectedFilter === 'Package') return isPackageCategory(svc.category_name)
    return svc.category_name === selectedFilter
  }

  const filtered = services.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    return matchesFilter(s) && matchSearch
  })

  const isInCart = (id) => cart.some((c) => c.id === id)

  // Group by category_name preserving order
  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.category_name]) acc[s.category_name] = []
    acc[s.category_name].push(s)
    return acc
  }, {})

  // For rendering: group "Packages - *" categories under a "Package" parent heading
  const renderGroups = () => {
    const entries = Object.entries(grouped)
    const result = []
    let packageGroup = null

    entries.forEach(([category, svcs]) => {
      if (isPackageCategory(category)) {
        if (!packageGroup) {
          packageGroup = { label: 'Package', subcategories: [] }
          result.push({ type: 'package-parent', data: packageGroup })
        }
        packageGroup.subcategories.push({ subname: packageSubname(category), svcs })
      } else {
        result.push({ type: 'category', label: category, svcs })
      }
    })
    return result
  }

  if (loading) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500">Loading services...</p>
    </div>
  )

  const groups = renderGroups()

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
          {/* Left: service list */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-1">
              Our Services
            </h1>
            <p className="text-gray-500 mb-6">
              Choose your treatments to create your perfect appointment.
            </p>

            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search for a service..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-anaya-accent"
              />
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap mb-6">
              {filterPills.map((pill) => (
                <button
                  key={pill}
                  onClick={() => setSelectedFilter(pill)}
                  className={clsx(
                    'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    selectedFilter === pill
                      ? 'bg-anaya-accent text-white border-anaya-accent'
                      : 'bg-white text-anaya-text border-gray-200 hover:border-anaya-accent'
                  )}
                >
                  {pill}
                </button>
              ))}
            </div>

            {/* Service groups */}
            {groups.length === 0 && (
              <p className="text-gray-400 text-sm">No services found.</p>
            )}

            {groups.map((group, i) => {
              if (group.type === 'package-parent') {
                return (
                  <div key="package-parent" className="mb-6">
                    <h2 className="text-base font-bold text-anaya-text mb-3">
                      {group.data.label}
                    </h2>
                    {group.data.subcategories.map(({ subname, svcs }) => (
                      <div key={subname} className="mb-5">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                          {subname}
                        </h3>
                        <div className="space-y-2">
                          {svcs.map((svc) => (
                            <ServiceCard
                              key={svc.id}
                              svc={svc}
                              inCart={isInCart(svc.id)}
                              onInfo={() => setSelectedService(svc)}
                              onToggle={() =>
                                isInCart(svc.id) ? removeFromCart(svc.id) : addToCart(svc)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }

              return (
                <div key={group.label} className="mb-6">
                  <h2 className="text-base font-bold text-anaya-text mb-3">
                    {group.label}
                  </h2>
                  <div className="space-y-2">
                    {group.svcs.map((svc) => (
                      <ServiceCard
                        key={svc.id}
                        svc={svc}
                        inCart={isInCart(svc.id)}
                        onInfo={() => setSelectedService(svc)}
                        onToggle={() =>
                          isInCart(svc.id) ? removeFromCart(svc.id) : addToCart(svc)
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: booking sidebar */}
          <BookingSidebar
            onContinue={() => navigate('/booking/staff')}
            continueDisabled={cart.length === 0}
          />
        </div>
      </div>

      {/* Service detail modal */}
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
              {isPackageCategory(selectedService.category_name)
                ? packageSubname(selectedService.category_name)
                : selectedService.category_name}
            </p>
            <p className="text-lg font-bold text-anaya-text mb-1">
              ₱{Number(selectedService.price).toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 flex items-center gap-1 mb-6">
              <span>🕐</span>
              <span>{formatDuration(selectedService.duration_minutes)}</span>
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

const ServiceCard = ({ svc, inCart, onInfo, onToggle }) => (
  <div
    className={clsx(
      'bg-white rounded-lg border p-4 flex items-center justify-between',
      inCart ? 'border-anaya-accent' : 'border-gray-200'
    )}
  >
    <div className="flex-1 cursor-pointer" onClick={onInfo}>
      <p className="font-medium text-anaya-text">{svc.name}</p>
      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
        <span>🕐</span>
        <span>{formatDuration(svc.duration_minutes)}</span>
      </p>
      <p className="text-sm font-semibold mt-1">
        ₱{Number(svc.price).toLocaleString()}
      </p>
    </div>
    <button
      onClick={onToggle}
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

export default ServicesStep

import { useState, useEffect, useMemo } from 'react'
import PublicLayout from '../../components/PublicLayout'
import ServiceFilterPills from '../../components/ServiceFilterPills'
import BookableServiceCard from '../../components/BookableServiceCard'
import { getAllActiveServices } from '../../services/servicesCmsService'
import Spinner from '../../components/common/Spinner'

const isPackageCategory = (cat) => cat.startsWith('Packages - ')
const packageSubname = (cat) => cat.replace('Packages - ', '')

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('Package') // Default per screenshots
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllActiveServices()
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Map raw data into an easily filterable/groupable format
  const mappedServices = useMemo(() => {
    return services.map(s => {
      // Create UI-friendly category and group names
      const uiCategory = isPackageCategory(s.category_name) ? 'Package' : s.category_name
      const uiGroup = isPackageCategory(s.category_name) ? packageSubname(s.category_name) : s.category_name
      
      return {
        ...s,
        uiCategory,
        uiGroup,
      }
    })
  }, [services])

  const allCategories = useMemo(() => {
    return [...new Set(mappedServices.map(s => s.uiCategory))]
  }, [mappedServices])

  // Filter the list based on pill selected and search query
  const filteredServices = useMemo(() => {
    return mappedServices.filter(service => {
      const matchesCategory = service.uiCategory === activeFilter
      
      const safeName = service.name ? service.name.toLowerCase() : ''
      const safeDesc = service.description ? service.description.toLowerCase() : ''
      const safeQuery = searchQuery.toLowerCase()

      const matchesSearch = safeName.includes(safeQuery) || safeDesc.includes(safeQuery)
      return matchesCategory && matchesSearch
    })
  }, [activeFilter, searchQuery, mappedServices])

  // Group the filtered services exactly as shown in the mockup under subtitle headers
  const groupedServices = useMemo(() => {
    return filteredServices.reduce((acc, curr) => {
      const groupName = curr.uiGroup || 'Other'
      if (!acc[groupName]) acc[groupName] = []
      acc[groupName].push(curr)
      return acc
    }, {})
  }, [filteredServices])

  if (loading) {
    return (
      <PublicLayout>
        <div className="w-full min-h-[70vh] flex items-center justify-center bg-anaya-bg pt-32">
          <Spinner />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="w-full bg-anaya-light pt-32 pb-24 px-4 sm:px-8 md:px-16 min-h-screen">
        
        <div className="max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="flex justify-between items-end mb-8">
            <h1 className="text-2xl font-serif font-bold text-gray-900 tracking-wide">Our Services</h1>
          </div>
          
          {/* Global Search */}
          <div className="relative mb-10">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder="Search for a service..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-3 pl-10 pr-4 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-anaya-accent focus:ring-1 focus:ring-anaya-accent shadow-sm"
            />
          </div>

          <ServiceFilterPills 
            categories={allCategories} 
            activeFilter={activeFilter} 
            onFilterChange={setActiveFilter} 
          />

          {/* Grouped Service Lists Output */}
          {Object.entries(groupedServices).map(([groupName, groupList]) => (
            <div key={groupName} className="mb-12">
              <h3 className="font-bold text-gray-900 mb-4">{groupName}</h3>
              <div className="flex flex-col space-y-4 shadow-sm bg-white border border-gray-100 rounded-lg p-2 sm:p-4">
                {groupList.map(service => (
                  <BookableServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          ))}

          {/* Empty State Fallback */}
          {filteredServices.length === 0 && (
             <div className="w-full text-center py-12 text-gray-500 text-sm">
                No services found matching your criteria.
             </div>
          )}

        </div>
      </div>
    </PublicLayout>
  )
}

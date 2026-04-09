import { useState, useMemo } from 'react'
import PublicLayout from '../../components/PublicLayout'
import ServiceFilterPills from '../../components/ServiceFilterPills'
import BookableServiceCard from '../../components/BookableServiceCard'
import { BOOKABLE_SERVICES } from '../../utils/mockData'

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('Package') // Default per screenshots

  // Derive all unique categories from the mock array so the pills dynamic generated
  const allCategories = useMemo(() => {
    return [...new Set(BOOKABLE_SERVICES.map(s => s.categoryName))]
  }, [])

  // Filter the list based on pill selected and search query
  const filteredServices = useMemo(() => {
    return BOOKABLE_SERVICES.filter(service => {
      const matchesCategory = service.categoryName === activeFilter
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            service.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [activeFilter, searchQuery])

  // Group the filtered services exactly as shown in the mockup under subtitle headers
  const groupedServices = useMemo(() => {
    return filteredServices.reduce((acc, curr) => {
      const groupName = curr.groupName || 'Other'
      if (!acc[groupName]) acc[groupName] = []
      acc[groupName].push(curr)
      return acc
    }, {})
  }, [filteredServices])

  return (
    <PublicLayout>
      <div className="w-full bg-anaya-light pt-32 pb-24 px-4 sm:px-8 md:px-16 min-h-screen">
        
        <div className="max-w-4xl mx-auto w-full">
          {/* Header */}
          <h1 className="text-2xl font-serif font-bold text-gray-900 tracking-wide mb-8">Our Services</h1>
          
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
          {Object.entries(groupedServices).map(([groupName, services]) => (
            <div key={groupName} className="mb-12">
              <h3 className="font-bold text-gray-900 mb-4">{groupName}</h3>
              <div className="flex flex-col space-y-4 shadow-sm bg-white border border-gray-100 rounded-lg p-2 sm:p-4">
                {services.map(service => (
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

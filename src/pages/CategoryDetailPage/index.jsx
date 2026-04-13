import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import { getCategories, getServicesByCategory } from '../../services/servicesCmsService'
import Spinner from '../../components/common/Spinner'

export default function CategoryDetailPage() {
  const { slug } = useParams()
  
  const [category, setCategory] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const categories = await getCategories()
        const validCategory = categories.find(c => c.id === slug)
        
        if (!validCategory) {
          setError(true)
          return
        }
        
        setCategory(validCategory)
        const categoryServices = await getServicesByCategory(validCategory.id)
        setServices(categoryServices)
      } catch (err) {
        console.error(err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [slug])

  if (error) {
    return <Navigate to="/categories" replace />
  }

  if (loading || !category) {
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
      <div className="w-full bg-anaya-light pt-32 pb-24 px-8 md:px-16 lg:px-32 flex flex-col min-h-screen">
        
        <div className="max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-wide mb-2">{category.name}</h1>
            <h2 className="text-xs text-gray-600 font-medium tracking-wider">Explore our offerings</h2>
          </div>

          {/* Hero Image */}
          <div className="w-full aspect-[21/9] bg-gray-200 overflow-hidden shadow-sm mb-12 relative flex items-center justify-center">
            {/* Fallback pattern */}
            <span className="absolute text-gray-400 text-xs tracking-widest">{category.name}</span>
            {category.image_url && (
            <img 
              src={category.image_url} 
              alt={category.name} 
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => e.target.style.opacity = '0'}
            />
            )}
          </div>

          {/* Category Overview */}
          <div className="mb-12 max-w-4xl">
            <h3 className="font-bold text-sm tracking-wide text-gray-900 mb-6">Category Overview</h3>
            <p className="text-[0.7rem] leading-relaxed text-gray-700">{category.description}</p>
          </div>

          {/* Services Checklist */}
          {services.length > 0 && (
          <div className="max-w-4xl">
            <h3 className="font-bold text-sm tracking-wide text-gray-900 mb-6">Services under this Category</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              {services.map((service) => (
                <div key={service.id} className="flex items-center">
                  {/* Leaf Icon snippet (mimicking the custom bullet) */}
                  <svg className="w-4 h-4 mr-3 text-anaya-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10.96 4.397A1.5 1.5 0 009.04 4.4C6.541 7.228 5 10.957 5 15a1 1 0 001 1h8a1 1 0 001-1c0-4.043-1.54-7.772-4.04-10.603z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.7rem] text-gray-800">{service.name}</span>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>

      </div>
    </PublicLayout>
  )
}

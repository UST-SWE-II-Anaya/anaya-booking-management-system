import { useParams, Navigate } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import { CATEGORIES, NAIL_CARE_DETAILS } from '../../utils/mockData'

// Dummy fallback for unimplemented categories perfectly requested via prompt
const generateLoremDetail = (category) => ({
  id: category.id,
  title: category.name,
  subtitle: 'Lorem Ipsum Dolor Sit Amet',
  description: 'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper.',
  services: [
    'Service Item Alpha',
    'Service Item Beta',
    'Service Item Gamma',
    'Service Item Delta'
  ],
  // Fallback to exactly what they imported if no hero exists
  heroImage: category.id === 'nail-care' ? '/detail-nail-care.png' : category.image 
})

export default function CategoryDetailPage() {
  const { slug } = useParams()
  
  // Find category or redirect if broken slug
  const validCategory = CATEGORIES.find(c => c.id === slug)
  if (!validCategory) return <Navigate to="/categories" replace />

  // Branch data: Use true mock if Nail care, else use generic Lorem fallback
  const detailData = slug === 'nail-care' 
    ? NAIL_CARE_DETAILS 
    : generateLoremDetail(validCategory)

  return (
    <PublicLayout>
      <div className="w-full bg-anaya-light pt-32 pb-24 px-8 md:px-16 lg:px-32 flex flex-col min-h-screen">
        
        <div className="max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-wide mb-2">{detailData.title}</h1>
            <h2 className="text-xs text-gray-600 font-medium tracking-wider">{detailData.subtitle}</h2>
          </div>

          {/* Hero Image */}
          <div className="w-full aspect-[21/9] bg-gray-200 overflow-hidden shadow-sm mb-12 relative flex items-center justify-center">
            {/* Fallback pattern */}
            <span className="absolute text-gray-400 text-xs tracking-widest">{detailData.heroImage}</span>
            <img 
              src={detailData.heroImage} 
              alt={detailData.title} 
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => e.target.style.opacity = '0'}
            />
          </div>

          {/* Category Overview */}
          <div className="mb-12 max-w-4xl">
            <h3 className="font-bold text-sm tracking-wide text-gray-900 mb-6">Category Overview</h3>
            <p className="text-[0.7rem] leading-relaxed text-gray-700">{detailData.description}</p>
          </div>

          {/* Services Checklist */}
          <div className="max-w-4xl">
            <h3 className="font-bold text-sm tracking-wide text-gray-900 mb-6">Services under this Category</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              {detailData.services.map((service, idx) => (
                <div key={idx} className="flex items-center">
                  {/* Leaf Icon snippet (mimicking the custom bullet) */}
                  <svg className="w-4 h-4 mr-3 text-anaya-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10.96 4.397A1.5 1.5 0 009.04 4.4C6.541 7.228 5 10.957 5 15a1 1 0 001 1h8a1 1 0 001-1c0-4.043-1.54-7.772-4.04-10.603z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[0.7rem] text-gray-800">{service}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </PublicLayout>
  )
}

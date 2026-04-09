import { Link } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'
import { CATEGORIES } from '../../utils/mockData'

export default function CategoriesPage() {
  return (
    <PublicLayout>
      <div className="w-full bg-anaya-green-dark pt-32 pb-24 px-8 text-center">
         <h1 className="text-4xl text-white font-serif tracking-widest drop-shadow-sm">Our Services</h1>
      </div>

      <div className="w-full bg-anaya-bg py-16 px-8 md:px-16 lg:px-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {CATEGORIES.map((category) => (
            <Link key={category.id} to={`/category/${category.id}`} className="group drop-shadow-md">
              <div className="relative w-full aspect-square overflow-hidden bg-white">
                {/* Fallback pattern if image is not placed yet */}
                <div className="absolute inset-0 bg-anaya-accent/10 flex items-center justify-center">
                  <span className="text-gray-400 text-xs italic tracking-widest">{category.image}</span>
                </div>
                
                {/* Image */}
                <img 
                  src={category.image} 
                  alt={category.name} 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => e.target.style.opacity = '0'} // Hide broken icon to show fallback text
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none"></div>
                
                {/* Text overlay */}
                <div className="absolute bottom-4 left-6 text-white pointer-events-none">
                  <h3 className="font-bold text-sm tracking-widest mb-1">{category.name}</h3>
                  <span className="text-xs font-light flex items-center group-hover:underline opacity-90">
                    Learn more <span className="ml-1 leading-none">&gt;</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}

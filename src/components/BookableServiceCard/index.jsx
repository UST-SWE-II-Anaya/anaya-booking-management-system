import { useNavigate } from 'react-router-dom'

export default function BookableServiceCard({ service }) {
  const navigate = useNavigate()
  
  const handleBook = () => {
    // For unauthenticated public view, clicking Book redirects to login.
    // In the future, this might check an auth context first.
    navigate('/login')
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:shadow-md transition-shadow">
      
      <div className="flex flex-col flex-1 pb-4 sm:pb-0 pr-4">
        <h4 className="font-bold text-gray-900 text-sm mb-1 tracking-wide">{service.name}</h4>
        
        {/* Clock icon and duration */}
        <div className="flex items-center text-[0.65rem] text-gray-500 mb-2">
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {service.duration}
        </div>
        
        <p className="text-[0.7rem] text-gray-700 leading-relaxed max-w-md">
          {service.description}
        </p>
      </div>

      <div className="flex items-center w-full justify-between sm:w-auto sm:justify-end sm:flex-col sm:items-end border-t border-gray-100 sm:border-0 pt-4 sm:pt-0">
        <span className="font-semibold text-gray-900 text-sm sm:mb-3">
          ₱ {service.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        
        <button 
          onClick={handleBook}
          className="flex items-center justify-center px-4 py-1.5 rounded-full border border-anaya-accent text-anaya-accent hover:bg-anaya-accent hover:text-white transition-colors group"
        >
          <span className="mr-1 text-lg leading-none font-light">+</span> 
          <span className="text-xs font-medium tracking-wide">Book</span>
        </button>
      </div>

    </div>
  )
}

import { Link } from 'react-router-dom'
import PublicLayout from '../../components/PublicLayout'

const ValuePropCard = ({ title, description }) => (
  <div className="flex flex-col mb-8 md:mb-0 pr-4">
    <h3 className="font-bold text-sm tracking-wide leading-tight mb-2">{title}</h3>
    <p className="text-[0.65rem] leading-relaxed text-gray-800">{description}</p>
  </div>
)

const ServiceCard = ({ title, catId, imgUrl }) => (
  <Link to={catId ? `/category/${catId}` : '#'} className="relative group w-full aspect-square md:aspect-[4/3] overflow-hidden cursor-pointer shadow-md block bg-white">
    {/* Generic background placeholder if image missing */}
    <div className="absolute inset-0 bg-anaya-accent/20 flex flex-col items-center justify-center p-4">
      {!imgUrl && (
        <>
          <svg className="w-8 h-8 text-white/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-white/60 text-[0.65rem] text-center italic">Image placeholder<br/>(To be loaded from Supabase)</span>
        </>
      )}
    </div>
    
    {imgUrl && (
      <img 
        src={imgUrl} 
        alt={title} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    )}
    {/* Gradient Overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none"></div>
    {/* Text Content */}
    <div className="absolute bottom-4 left-6 text-white pointer-events-none">
      <h3 className="font-medium text-sm tracking-wide mb-1">{title}</h3>
      <span className="text-xs flex items-center group-hover:underline opacity-90">
        Learn more <span className="ml-1 leading-none">&gt;</span>
      </span>
    </div>
  </Link>
)

export default function HomePage() {
  return (
    <PublicLayout>
      {/* 1. Hero Section */}
      <section className="relative w-full h-[85vh] min-h-[600px] flex flex-col items-center justify-center pt-20 overflow-hidden z-0">
        {/* Hero Background */}
        <div className="absolute inset-0 bg-neutral-900 -z-10">
           <img 
              src="/hero.png" 
              alt="Manicure hero"
              className="w-full h-full object-cover opacity-60"
           />
           {/* Dark Gradient Overlay for text readability */}
           <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80"></div>
        </div>

        <h1 className="relative text-4xl md:text-5xl font-serif text-white tracking-widest text-center mb-6 drop-shadow-md z-10">
          Your Everyday Reset
        </h1>
        <p className="relative text-white text-xs md:text-sm text-center max-w-lg mb-12 drop-shadow leading-relaxed px-4 z-10">
          We combine advanced aesthetic techniques with personalized care to help you look and feel your absolute best. Start your journey today.
        </p>

        <Link to="/services" className="relative z-10">
          <button className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-sm font-medium py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105">
            View Services & Book
          </button>
        </Link>
      </section>

      {/* 2. Value Propositions */}
      <section className="w-full bg-anaya-light py-16 px-8 md:px-16 lg:px-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          <ValuePropCard 
            title="Certified Professionals" 
            description="Our team of licensed aestheticians and medical staff follows the highest standards for safety and results. Your care is our priority." 
          />
          <ValuePropCard 
            title={<>Tailored<br/>Treatment Plans</>} 
            description="We believe beauty is personal. Each service starts with a private consultation to create a plan that fits your unique goals." 
          />
          <ValuePropCard 
            title={<>Serene Studio<br/>Environment</>} 
            description="Step into a modern, calming space designed for your comfort and privacy. Your aesthetic journey should be a relaxing escape." 
          />
          <ValuePropCard 
            title={<>Simple Online<br/>Scheduling</>} 
            description="Book, reschedule, or manage your appointments anytime, anywhere. Your journey to radiance is just a few clicks away." 
          />
        </div>
      </section>
      
      {/* 3. Popular Services */}
      <section className="w-full bg-anaya-bg py-24 px-8 md:px-16 lg:px-32">
        <h2 className="text-3xl font-serif text-center tracking-wide mb-16 text-anaya-text">
          Our most popular services
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 max-w-7xl mx-auto">
          {/* Using text/icon placeholders as requested for backend integration later */}
          <ServiceCard title="Facial Care" />
          <ServiceCard title="Hand Care" />
          <ServiceCard title="Nail Care" />
        </div>
      </section>

      {/* 4. Studio Location / Visit Us */}
      <section className="w-full bg-anaya-green py-24 px-8 md:px-16 lg:px-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-serif text-white tracking-wide mb-12">
            Visit Us at Our Studio
          </h2>

          <div className="flex flex-col lg:flex-row gap-12 relative z-10 items-center">
            {/* Map Area */}
            <div className="w-full lg:w-2/3 h-[400px] rounded-3xl overflow-hidden shadow-2xl bg-white flex items-center justify-center p-2 relative">
               <div className="w-full h-full bg-gray-200 rounded-2xl overflow-hidden relative">
                 {/* Placeholder graphic for the Map. When ready, replace entire div with <iframe src="...">*/}
                 <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&auto=format&fit=crop&q=60" alt="Map View Placeholder" className="w-full h-full object-cover blur-[2px] opacity-60" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-black/50 text-white px-4 py-2 rounded-full text-xs font-medium tracking-wide">Interactive Map Placeholder</span>
                 </div>
               </div>
            </div>

            {/* Organic Contact Info Blob */}
            <div className="w-full lg:w-1/3 flex justify-center lg:justify-end relative">
              {/* CSS approximation of the organic peach blob shape from the design */}
              <div className="bg-anaya-accent text-white p-10 md:p-14 shadow-xl" 
                   style={{
                     borderRadius: '40% 64% 45% 42% / 54% 42% 64% 45%', // Creates the organic shape
                     minWidth: '320px',
                     maxWidth: '400px'
                   }}>
                <h3 className="font-bold text-lg mb-8 tracking-wide">Contact and Find Us Here</h3>
                
                <div className="flex flex-col space-y-6 text-sm">
                  {/* Location Pin */}
                  <div className="flex items-start">
                    <svg className="w-5 h-5 flex-shrink-0 mr-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <p className="leading-tight">3rd Floor, The ONE Building, M.F.,<br/>Jhocson St., Manila, Philippines</p>
                  </div>
                  
                  {/* Phone */}
                  <div className="flex items-center">
                    <svg className="w-5 h-5 flex-shrink-0 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <p>+63 945 977 8163</p>
                  </div>
                  
                  {/* Email */}
                  <div className="flex items-center">
                    <svg className="w-5 h-5 flex-shrink-0 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <p>anayesthetic.studio@gmail.com</p>
                  </div>

                  {/* Clock */}
                  <div className="flex items-center">
                    <svg className="w-5 h-5 flex-shrink-0 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p>9:00 AM - 6:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}

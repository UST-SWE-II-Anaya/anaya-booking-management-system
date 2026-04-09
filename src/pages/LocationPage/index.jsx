import PublicLayout from '../../components/PublicLayout'

const ContactCard = ({ title, content }) => (
  <div className="bg-[#B9C6DF] rounded-sm py-12 px-6 flex flex-col items-center justify-center text-center shadow-sm w-full min-h-[200px]">
    <h3 className="font-bold text-gray-900 mb-6 text-lg tracking-wide">{title}</h3>
    <p className="text-gray-800 text-sm">{content}</p>
  </div>
)

export default function LocationPage() {
  return (
    <PublicLayout>
      <div className="w-full bg-anaya-light pt-32 min-h-screen">
        
        {/* Top Header */}
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 md:px-16 mb-16 text-center">
          <h1 className="text-3xl font-bold tracking-wide text-gray-900 mb-12">Get in touch</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <ContactCard 
              title="Address" 
              content={<>The ONE Building,<br/>M.F., Jhocson St.,<br/>Manila, Philippines</>} 
            />
            <ContactCard 
              title="Phone" 
              content="+63 945 977 8163" 
            />
            <ContactCard 
              title="Email" 
              content={<>anayaaesthetic.studio<br/>@gmail.com</>} 
            />
          </div>
        </div>

        {/* Full-width Map Area */}
        <div className="w-full h-[400px] bg-gray-300 relative overflow-hidden flex items-center justify-center border-y border-gray-300 shadow-sm">
           <span className="absolute text-gray-500 z-0 text-xs tracking-widest bg-white/70 px-4 py-2 rounded-full">/location-map.png (Google Maps Image)</span>
           <img 
             src="/location-map.png" 
             alt="Map Location of ANAYA Aesthetic Studio" 
             className="absolute inset-0 w-full h-full object-cover z-10"
             onError={(e) => e.target.style.opacity = '0'} // Hide broken icon
           />
        </div>

        {/* Contact Form Section */}
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 md:px-16 py-20 flex flex-col md:flex-row gap-16">
          
          {/* Left Text */}
          <div className="w-full md:w-1/3">
            <h2 className="text-2xl font-bold tracking-wide text-gray-900 mb-4">We're Here to Help</h2>
            <p className="text-[0.65rem] text-gray-700 leading-relaxed max-w-xs pr-4">
              Whether you have a question about our services, need assistance with a booking, or want to share your experience at Anaya, we'd love to hear from you. Fill out the form and our team will get back to you within 24 hours.
            </p>
          </div>

          {/* Right Form */}
          <div className="w-full md:w-2/3">
            <form className="flex flex-col space-y-6" onSubmit={(e) => e.preventDefault()}>
              
              {/* Name Field (First & Last) */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2">Name</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full">
                    <input 
                      type="text" 
                      className="w-full border border-gray-400 bg-white rounded-md p-2 text-sm focus:outline-none focus:border-anaya-accent"
                    />
                    <label className="block text-[0.65rem] text-gray-500 mt-1">First</label>
                  </div>
                  <div className="w-full">
                    <input 
                      type="text" 
                      className="w-full border border-gray-400 bg-white rounded-md p-2 text-sm focus:outline-none focus:border-anaya-accent"
                    />
                    <label className="block text-[0.65rem] text-gray-500 mt-1">Last</label>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2">Email</label>
                <input 
                  type="email" 
                  className="w-full border border-gray-400 bg-white rounded-md p-2 text-sm focus:outline-none focus:border-anaya-accent"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-2">Comments</label>
                <textarea 
                  rows="5"
                  className="w-full border border-gray-400 bg-white rounded-md p-2 text-sm focus:outline-none focus:border-anaya-accent resize-y"
                ></textarea>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-xs font-bold py-3 px-8 rounded-full shadow-sm transition-colors"
                >
                  Send Message
                </button>
              </div>

            </form>
          </div>

        </div>

      </div>
    </PublicLayout>
  )
}

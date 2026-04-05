import Navbar from '../Navbar'

export default function AuthLayout({ children, imageSrc }) {
  return (
    <div className="min-h-screen flex flex-col bg-anaya-bg">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[1000px] min-h-[600px] flex shadow-2xl overflow-hidden">
          
          {/* Left Panel - Image Area */}
          <div className="hidden md:flex w-1/2 bg-anaya-green relative overflow-hidden items-center justify-center">
            {imageSrc ? (
              <img 
                src={imageSrc} 
                alt="Decorative floral artwork" 
                className="absolute w-full h-full object-cover opacity-90 mix-blend-multiply"
              />
            ) : (
              <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center opacity-80 mix-blend-multiply">
                <div className="w-64 h-64 rounded-full border border-white/20 blur-sm"></div>
                <div className="absolute w-40 h-40 bg-white/10 rounded-full blur-md"></div>
                <span className="text-white/30 text-sm absolute bottom-10 tracking-widest">FLOWER ARTWORK PLACEHOLDER</span>
              </div>
            )}
          </div>

          {/* Right Panel - Form Area */}
          <div className="w-full md:w-1/2 bg-anaya-light relative flex flex-col items-center justify-center px-10 py-12">
            {/* The Form Content goes here */}
            <div className="w-full max-w-sm mx-auto flex flex-col items-center">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

import Navbar from '../Navbar'
import Footer from '../Footer'

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col font-sans relative">
      {/* 
        The Navbar is absolute to overlay onto the Hero image of the Home Page,
        but functions normally for standard layout scrolling.
      */}
      <div className="absolute top-0 w-full z-50 bg-anaya-green/80 backdrop-blur-sm">
        <Navbar />
      </div>
      
      <main className="flex-1 w-full flex flex-col bg-anaya-bg">
        {children}
      </main>

      <Footer />
    </div>
  )
}

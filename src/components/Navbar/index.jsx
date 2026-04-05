import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="w-full h-20 bg-anaya-green flex items-center justify-between px-8 md:px-16 static top-0 z-50">
      {/* Brand / Logo placeholder */}
      <Link to="/" className="flex items-center no-underline">
        <img src="/logo.png" alt="ANAYA Aesthetic Studio" className="h-8 md:h-10 object-contain" />
      </Link>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center space-x-8 text-white text-sm font-medium">
        <Link to="#" className="hover:opacity-80 transition-opacity">Services</Link>
        <Link to="#" className="hover:opacity-80 transition-opacity">About us</Link>
        <Link to="#" className="hover:opacity-80 transition-opacity">Location</Link>
        <Link to="/login" className="hover:opacity-80 transition-opacity">Log in</Link>
        <Link to="/signup" className="hover:opacity-80 transition-opacity">Sign up</Link>
      </div>
    </nav>
  )
}

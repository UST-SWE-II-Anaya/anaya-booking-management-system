import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="w-full bg-anaya-green-dark text-white py-12 px-8 flex flex-col md:flex-row justify-between items-start md:items-center">
      <div className="flex flex-col mb-8 md:mb-0">
        <Link to="/" className="mb-4">
          <img src="/logo.png" alt="ANAYA Aesthetic Studio" className="h-10 object-contain" />
        </Link>
        <div className="flex flex-col space-y-2 mt-4 text-xs font-medium">
          <Link to="#" className="hover:opacity-80 transition-opacity">Services</Link>
          <Link to="#" className="hover:opacity-80 transition-opacity">About us</Link>
          <Link to="#" className="hover:opacity-80 transition-opacity">Location</Link>
          <Link to="#" className="hover:opacity-80 transition-opacity">Book an appointment</Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:space-x-24 text-[0.65rem] opacity-90">
        <div className="flex flex-col space-y-4 mb-8 md:mb-0 max-w-xs">
          <div>
            <h4 className="font-bold mb-1 uppercase tracking-wider">Contacts & Address</h4>
            <p>The ONE Building, M.F., Jhocson St., Manila, Philippines</p>
          </div>
          <p>+63 945 977 8163</p>
          <p>anayesthetic.studio@gmail.com</p>
          <div>
            <h4 className="font-bold mt-2 mb-1 uppercase tracking-wider">Hours</h4>
            <p>9 am - 6 pm</p>
          </div>
        </div>

        <div className="flex flex-col space-y-2 mt-8 md:mt-0">
          <h4 className="font-bold mb-1 uppercase tracking-wider">Follow Us</h4>
          <a href="#" className="hover:underline">Facebook</a>
          <a href="#" className="hover:underline">Instagram</a>
        </div>
      </div>
    </footer>
  )
}

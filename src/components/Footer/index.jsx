import { Link } from 'react-router-dom'
import useSiteSettings from '../../hooks/useSiteSettings'

export default function Footer() {
  const { settings } = useSiteSettings()

  const contact = {
    address: settings?.contact_info?.address || 'The ONE Building, M.F., Jhocson St., Manila, Philippines',
    phone: settings?.contact_info?.phone || '+63 945 977 8163',
    email: settings?.contact_info?.email || 'anayesthetic.studio@gmail.com',
  }

  const hours = {
    start: settings?.operating_hours?.start || '09:00',
    end: settings?.operating_hours?.end || '18:00',
  }

  const formatTime = (time) => {
    if (!time) return ''
    const [h, m] = time.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const disp = hour % 12 || 12
    return `${disp}${parseInt(m, 10) ? `:${m}` : ''} ${ampm}`
  }

  return (
    <footer className="w-full bg-anaya-green-dark text-white py-12 px-8 flex flex-col md:flex-row justify-between items-start md:items-center">
      <div className="flex flex-col mb-8 md:mb-0">
        <Link to="/" className="mb-4">
          <img src="/logo.png" alt="ANAYA Aesthetic Studio" className="h-10 object-contain" />
        </Link>
        <div className="flex flex-col space-y-2 mt-4 text-xs font-medium">
          <Link to="/categories" className="hover:opacity-80 transition-opacity">Services</Link>
          <Link to="/about" className="hover:opacity-80 transition-opacity">About us</Link>
          <Link to="/location" className="hover:opacity-80 transition-opacity">Location</Link>
          <Link to="/services" className="hover:opacity-80 transition-opacity">Book an appointment</Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:space-x-24 text-[0.65rem] opacity-90">
        <div className="flex flex-col space-y-4 mb-8 md:mb-0 max-w-xs">
          <div>
            <h4 className="font-bold mb-1 uppercase tracking-wider">Contacts & Address</h4>
            <p>{contact.address}</p>
          </div>
          <p>{contact.phone}</p>
          <p>{contact.email}</p>
          <div>
            <h4 className="font-bold mt-2 mb-1 uppercase tracking-wider">Hours</h4>
            <p>{formatTime(hours.start)} - {formatTime(hours.end)}</p>
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

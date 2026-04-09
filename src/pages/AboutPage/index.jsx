import PublicLayout from '../../components/PublicLayout'
import { TEAM_MEMBERS } from '../../utils/mockData'

const TeamCard = ({ member }) => (
  <div className="bg-white rounded-lg p-6 flex flex-col md:flex-row items-center border border-gray-100 shadow-sm md:justify-start">
    {/* Avatar / Photo */}
    <div className="w-20 h-20 rounded-full flex-shrink-0 bg-anaya-light overflow-hidden mb-4 md:mb-0 md:mr-6 flex items-center justify-center shadow-inner relative">
      <div className="absolute inset-0 bg-anaya-accent/10 flex flex-col items-center justify-center p-1">
        <svg className="w-6 h-6 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <img
        src={member.image}
        alt={member.name}
        className="w-full h-full object-cover relative z-10"
        onError={(e) => e.target.style.opacity = '0'} // Fallback to placeholder if missing
      />
    </div>
    
    <div className="text-center md:text-left">
      <h4 className="font-bold text-sm tracking-wide text-gray-900 mb-1">{member.name}</h4>
      <p className="text-[0.65rem] text-gray-500 font-medium tracking-widest uppercase">{member.role}</p>
    </div>
  </div>
)

export default function AboutPage() {
  return (
    <PublicLayout>
      <div className="w-full bg-anaya-light pt-32 pb-24 px-4 sm:px-8 md:px-16 min-h-screen">
        <div className="max-w-5xl mx-auto w-full">
          
          <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-wide mb-10">Our Story & Our Team</h1>
          
          {/* Top Section: Team Photo + Mission/Vision */}
          <div className="flex flex-col lg:flex-row gap-12 mb-16">
            
            {/* Left Image Placeholder */}
            <div className="w-full lg:w-1/2 aspect-video lg:aspect-auto min-h-[250px] bg-gray-200 shadow-md relative flex items-center justify-center overflow-hidden">
               <span className="absolute text-gray-400 text-xs tracking-widest z-0">/about-team-photo.png</span>
               <img 
                 src="/about-team-photo.png" 
                 alt="The ANAYA Team" 
                 className="absolute inset-0 w-full h-full object-cover z-10"
                 onError={(e) => e.target.style.opacity = '0'}
               />
            </div>

            {/* Right Text Blocks */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-10 lg:pl-4">
              <div>
                <h3 className="text-lg font-bold tracking-wide text-gray-900 mb-2">Mission</h3>
                <p className="text-xs text-gray-700 leading-relaxed max-w-sm">
                  To provide comprehensive services with tailored treatment plans done by highly skilled professional
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-bold tracking-wide text-gray-900 mb-2">Vision</h3>
                <p className="text-xs text-gray-700 leading-relaxed max-w-sm">
                  To be a top aesthetic clinic, both locally and internationally who is committed to offer top-notch services with the latest technology, and staying updated with industry trends.
                </p>
              </div>
            </div>
            
          </div>

          {/* Bottom Section: Meet the Team */}
          <div>
            <h3 className="text-xl font-bold tracking-wide text-gray-900 mb-8">Meet the Team</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {TEAM_MEMBERS.map(member => (
                <TeamCard key={member.id} member={member} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  )
}

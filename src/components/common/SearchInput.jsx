// src/components/common/SearchInput.jsx
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

const SearchInput = ({ value, onChange, placeholder = 'Search…', debounceMs = 300 }) => {
  const [local, setLocal] = useState(value)

  useEffect(() => { setLocal(value) }, [value])

  useEffect(() => {
    const t = setTimeout(() => onChange(local), debounceMs)
    return () => clearTimeout(t)
  }, [local])

  return (
    <div className="relative">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64
          focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
          focus:border-[#8A956D]"
      />
    </div>
  )
}

export default SearchInput

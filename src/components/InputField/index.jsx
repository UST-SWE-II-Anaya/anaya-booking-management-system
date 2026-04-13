import { useState } from 'react'
import clsx from 'clsx'

export default function InputField({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  required
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const currentType = isPassword && showPassword ? 'text' : type

  return (
    <div className="w-full mb-6">
      <label className={clsx(
        "block text-xs font-medium mb-1 tracking-wide",
        error ? "text-anaya-error" : "text-gray-700"
      )}>
        {label}{required && '*'}
      </label>
      <div className="relative">
        <input
          name={name}
          type={currentType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={clsx(
            "w-full bg-transparent border-0 border-b outline-none pb-1 transition-colors text-sm",
            error 
              ? "border-anaya-error text-anaya-error placeholder-anaya-error/50" 
              : "border-gray-800 text-gray-900 focus:border-anaya-green"
          )}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-0 bottom-1 text-gray-500 hover:text-gray-800"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {/* Simple eye icon placeholder */}
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="text-anaya-error text-[0.65rem] mt-1">{error}</p>
      )}
    </div>
  )
}

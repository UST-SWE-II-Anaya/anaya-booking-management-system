import clsx from 'clsx'

export default function Button({
  children,
  type = 'button',
  onClick,
  className,
  disabled
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "w-full sm:w-2/3 md:w-1/2 py-2.5 rounded-full text-white text-sm font-medium transition-colors shadow-sm",
        disabled 
          ? "bg-gray-400 cursor-not-allowed" 
          : "bg-anaya-button hover:bg-anaya-button-hover active:scale-[0.98]",
        className
      )}
    >
      {children}
    </button>
  )
}

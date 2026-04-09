import clsx from 'clsx'

export default function ServiceFilterPills({ categories, activeFilter, onFilterChange }) {
  // Ensure "Package" is always first if it exists
  const sortedCategories = ['Package', ...categories.filter(c => c !== 'Package')]

  return (
    <div className="w-full flex justify-center mb-8 px-4">
      <div className="flex flex-wrap justify-center gap-3 max-w-4xl">
        {sortedCategories.map((cat) => {
          const isActive = activeFilter === cat
          return (
            <button
              key={cat}
              onClick={() => onFilterChange(cat)}
              className={clsx(
                "px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all border",
                isActive 
                  ? "bg-anaya-accent text-white border-anaya-accent shadow-md" 
                  : "bg-white text-anaya-accent border-anaya-accent/30 hover:border-anaya-accent hover:bg-anaya-accent/5"
              )}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}

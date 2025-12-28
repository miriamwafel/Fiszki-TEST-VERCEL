export default function ExercisesLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-56" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-10 bg-gray-100 rounded w-full mb-4" />
        <div className="h-10 bg-primary-100 rounded w-32" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-5/6" />
              <div className="h-4 bg-gray-100 rounded w-4/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

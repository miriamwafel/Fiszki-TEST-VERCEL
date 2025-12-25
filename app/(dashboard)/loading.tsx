export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-64" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
            <div className="flex gap-2">
              <div className="h-6 bg-gray-100 rounded-full w-16" />
              <div className="h-6 bg-gray-100 rounded-full w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

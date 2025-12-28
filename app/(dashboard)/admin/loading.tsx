export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-64" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-4 gap-4">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b">
            <div className="grid grid-cols-4 gap-4">
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
              <div className="h-8 bg-gray-100 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

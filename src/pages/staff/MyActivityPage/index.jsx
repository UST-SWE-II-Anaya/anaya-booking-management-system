import React, { useState, useEffect } from 'react'
import { getMyAuditLogs } from '../../../services/auditService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'

export default function MyActivityPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    actionType: '',
    startDate: '',
    endDate: '',
  })

  const loadLogs = async () => {
    setLoading(true)
    try {
      const { data, count } = await getMyAuditLogs({
        page: filters.page,
        pageSize: filters.pageSize,
        actionType: filters.actionType || undefined,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      })
      setLogs(data)
      setTotalCount(count)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [filters.page, filters.pageSize])

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setFilters(prev => ({ ...prev, page: 1 }))
    loadLogs()
  }

  const resetFilters = () => {
    setFilters({
      page: 1,
      pageSize: 20,
      actionType: '',
      startDate: '',
      endDate: '',
    })
    setTimeout(() => {
      loadLogs()
    }, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">My Activity</h1>
      </div>

      <form onSubmit={handleSearch} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Action Type</label>
            <input type="text" name="actionType" value={filters.actionType} onChange={handleFilterChange} placeholder="e.g. booking.claimed" className="w-full rounded border-gray-300 p-2 border" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full rounded border-gray-300 p-2 border" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full rounded border-gray-300 p-2 border" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={resetFilters} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg">Reset</button>
          <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg">Apply Filters</button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Date/Time</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Entity</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Description</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-900">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {logs.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-500">No logs found</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-mono text-xs">{log.action_type}</td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{log.entity_reference || log.entity_type}</td>
                    <td className="px-6 py-4 text-gray-900 max-w-xs truncate" title={log.description}>{log.description}</td>
                    <td className="px-6 py-4 text-right">
                      {(log.old_data || log.new_data || log.metadata) && (
                        <details className="text-left inline-block">
                          <summary className="text-indigo-600 hover:text-indigo-900 cursor-pointer text-xs">View</summary>
                          <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 shadow-lg rounded-lg p-4 z-10">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify({ old: log.old_data, new: log.new_data, meta: log.metadata }, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filters.page === 1} className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Previous</button>
            <button onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} disabled={filters.page * filters.pageSize >= totalCount} className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Next</button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(filters.page - 1) * filters.pageSize + 1}</span> to <span className="font-medium">{Math.min(filters.page * filters.pageSize, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
              </p>
            </div>
            <div className="flex gap-4 items-center">
              <select value={filters.pageSize} onChange={e => setFilters(f => ({ ...f, pageSize: Number(e.target.value), page: 1 }))} className="text-sm border-gray-300 rounded-md">
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filters.page === 1} className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">Prev</button>
                <button onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} disabled={filters.page * filters.pageSize >= totalCount} className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">Next</button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

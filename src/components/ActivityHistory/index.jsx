import React, { useEffect, useState } from 'react'
import { getEntityAuditLogs } from '../../services/auditService'
import clsx from 'clsx'

export default function ActivityHistory({ entityType, entityId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const limit = 50

  const fetchLogs = async (currentOffset) => {
    try {
      setLoading(true)
      const { data, error } = await getEntityAuditLogs({
        entityType,
        entityId,
        limit,
        offset: currentOffset,
      })
      if (error) throw error
      
      if (currentOffset === 0) {
        setLogs(data)
      } else {
        setLogs(prev => [...prev, ...data])
      }
      setHasMore(data.length === limit)
    } catch (err) {
      console.error('Failed to fetch activity history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (entityType && entityId) {
      setOffset(0)
      fetchLogs(0)
    }
  }, [entityType, entityId])

  const handleLoadMore = () => {
    const nextOffset = offset + limit
    setOffset(nextOffset)
    fetchLogs(nextOffset)
  }

  if (loading && offset === 0) {
    return <div className="text-gray-500 py-4">Loading activity history...</div>
  }

  if (!logs.length) {
    return <div className="text-gray-500 py-4">No activity recorded.</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Activity History</h3>
      <div className="flow-root">
        <ul className="-mb-8">
          {logs.map((log, logIdx) => (
            <li key={log.id}>
              <div className="relative pb-8">
                {logIdx !== logs.length - 1 ? (
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                      <span className="text-xs text-gray-500 font-medium">
                        {log.actor_name?.charAt(0) || '?'}
                      </span>
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-500">
                        {log.description}{' '}
                        <span className="font-medium text-gray-900">by {log.actor_name}</span>
                        <span className={clsx(
                          "ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          log.actor_role === 'admin' ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                        )}>
                          {log.actor_role}
                        </span>
                      </p>
                      {log.new_data && (
                        <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">
                          <details>
                            <summary className="cursor-pointer text-gray-500 text-xs">View details</summary>
                            <pre className="mt-2 whitespace-pre-wrap text-xs">
                              {JSON.stringify({ old: log.old_data, new: log.new_data }, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <time dateTime={log.created_at}>
                        {new Date(log.created_at).toLocaleString()}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="mt-4 w-full py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

// src/test/mocks/supabaseMock.js
import { vi } from 'vitest'

export const createQueryBuilder = (resolvedValue = { data: null, error: null }) => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  }
  // make the builder itself awaitable (for queries that don't end in .single())
  builder[Symbol.for('nodejs.util.inspect.custom')] = undefined
  Object.assign(builder, Promise.resolve(resolvedValue))
  builder.then = (resolve, reject) =>
    Promise.resolve(resolvedValue).then(resolve, reject)
  return builder
}

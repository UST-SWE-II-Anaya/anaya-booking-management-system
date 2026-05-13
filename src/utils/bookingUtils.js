/**
 * @param {Array<{start_time: string, duration_minutes: number}>} blockedIntervals
 * @param {{ start?: string, end?: string, stepMinutes?: number }} options
 *   start/end are "HH:MM" strings (default "09:00" / "19:30")
 *   stepMinutes is the slot interval in minutes (default 30)
 */
export const generateTimeSlots = (
  blockedIntervals = [],
  { start = '09:00', end = '19:30', stepMinutes = 30 } = {}
) => {
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startTotal = startH * 60 + startM
  const endTotal = endH * 60 + endM

  const slots = []
  for (
    let totalMins = startTotal;
    totalMins <= endTotal;
    totalMins += stepMinutes
  ) {
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const isBlocked = blockedIntervals.some(
      ({ start_time, duration_minutes }) => {
        const [bh, bm] = start_time.split(':').map(Number)
        const blockStart = bh * 60 + bm
        const blockEnd = blockStart + duration_minutes
        return totalMins >= blockStart && totalMins < blockEnd
      }
    )
    slots.push({ time, blocked: isBlocked })
  }
  return slots
}

export const formatDuration = (minutes) => {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins} mins`
  if (mins === 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`
  return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} mins`
}

export const to12h = (time24) => {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export const professionalLabel = (pref) => {
  if (pref === 'any_female') return 'any female professional'
  if (pref === 'any_male') return 'any male professional'
  if (pref === 'specific') return 'specific professional'
  return 'any professional'
}

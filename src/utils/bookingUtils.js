export const generateTimeSlots = (blockedIntervals = []) => {
  const slots = []
  for (let totalMins = 9 * 60; totalMins <= 19 * 60 + 30; totalMins += 30) {
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const isBlocked = blockedIntervals.some(({ start_time, duration_minutes }) => {
      const [bh, bm] = start_time.split(':').map(Number)
      const blockStart = bh * 60 + bm
      const blockEnd = blockStart + duration_minutes
      return totalMins >= blockStart && totalMins < blockEnd
    })
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

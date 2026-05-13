const HEADERS = [
  'Ref ID', 'Customer Name', 'Email', 'Phone',
  'Appointment Date', 'Start Time', 'Services',
  'Subtotal', 'Downpayment Amount', 'Remaining Balance',
  'Booking Status', 'Payment Status', 'Staff', 'Notes', 'Created At',
]

const escape = (val) => {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const buildCsv = (bookings) => {
  const rows = bookings.map((b) => [
    b.reference_id,
    b.customer
      ? `${b.customer.first_name} ${b.customer.last_name}`
      : '',
    b.customer?.email ?? '',
    b.customer?.phone_number ?? '',
    b.appointment_date,
    b.start_time ?? '',
    (b.booking_services ?? [])
      .map((bs) => bs.services?.name ?? '')
      .filter(Boolean)
      .join('; '),
    b.subtotal ?? '',
    b.downpayment_amount ?? '',
    b.remaining_balance ?? '',
    b.booking_status,
    b.downpayment_status,
    b.staff
      ? `${b.staff.first_name} ${b.staff.last_name}`
      : 'Unassigned',
    b.booking_notes ?? '',
    b.created_at,
  ].map(escape).join(','))

  return [HEADERS.map(escape).join(','), ...rows].join('\n')
}

export const downloadCsv = (csv) => {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bookings-export-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

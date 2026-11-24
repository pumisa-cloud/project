export function Badge({ status }) {
  const map = {
    'Not Started': 'gray',
    'In Progress': 'blue',
    Blocked: 'amber',
    Done: 'green',
    Skipped: 'gray',
    Overdue: 'red',
    Active: 'blue',
    Completed: 'green',
    Draft: 'gray',
    'On Hold': 'amber',
    Cancelled: 'red'
  }
  return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>
}

export function Progress({ value, green }) {
  return (
    <div>
      <div className={`progress${green ? ' green' : ''}`}>
        <div style={{ width: value + '%' }} />
      </div>
      <div className="progress-label">{value}%</div>
    </div>
  )
}

export const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-')

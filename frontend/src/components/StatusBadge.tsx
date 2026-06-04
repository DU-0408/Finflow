export default function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase() || 'UNKNOWN';
  return <span className={`badge badge-${s}`}>{s}</span>;
}

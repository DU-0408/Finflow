/**
 * Format a number as Indian Rupees: ₹1,23,456.78
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format large amounts into Cr/L shorthand
 */
export function formatINRCompact(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return formatINR(amount);
}

/**
 * Relative time: "2m ago", "1h ago", "3d ago"
 */
export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Format ISO timestamp to readable local time
 */
export function formatTimestamp(date: string | Date): string {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format duration in seconds to "1.23s" or "456ms"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0.001) return '<1ms';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(2)}s`;
}

/**
 * Truncate UUID: "abc12345-..." → "abc12...f789"
 */
export function truncateId(id: string | null | undefined, chars: number = 8): string {
  if (!id) return 'N/A';
  if (id.length <= chars * 2) return id;
  return `${id.slice(0, chars)}...${id.slice(-4)}`;
}

/**
 * Format a number with commas
 */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0';
  return new Intl.NumberFormat('en-IN').format(n);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

'use client';

import { useState } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { useWebSocket } from '@/hooks/useWebSocket';
import { usePolling } from '@/hooks/usePolling';
import { fetchAPI } from '@/lib/api';
import { formatINR, formatTimestamp, truncateId } from '@/lib/formatters';

interface Transaction {
  transaction_id: string;
  timestamp: string;
  account_id: string;
  account_type: string;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  merchant_name: string;
  merchant_category: string;
  channel: string;
  is_international: boolean;
  is_suspicious: boolean;
  fraud_score: number | null;
  location_country: string;
  location_city: string;
  location_lat: number;
  location_lon: number;
  ip_address: string;
  device_fingerprint: string;
}

export default function TransactionsPage() {
  const [page, setPage] = useState(0);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const limit = 30;

  const { messages: wsTxns, isConnected } = useWebSocket('/ws/transactions');

  const { data: apiData, isLoading } = usePolling<{ transactions: Transaction[]; total: number }>(
    () => fetchAPI(`/api/proxy/transactions?limit=${limit}&offset=${page * limit}`),
    { interval: 15_000 }
  );

  const transactions = apiData?.transactions || [];
  const totalCount = apiData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  // Merge WS transactions on top (only for page 0)
  const wsTransactions = page === 0
    ? (wsTxns as { transaction_id?: string; status?: string; amount?: number }[])
        .filter((m) => m.transaction_id && m.status === 'processed')
        .slice(0, 10)
    : [];

  const filteredTransactions = transactions.filter((tx) => {
    if (statusFilter && tx.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        tx.transaction_id?.toLowerCase().includes(q) ||
        tx.account_id?.toLowerCase().includes(q) ||
        tx.merchant_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Compute visible page numbers with ellipsis
  const getPageNumbers = (): (number | '...')[] => {
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const pages: (number | '...')[] = [];
    // Always show first page
    pages.push(0);
    // Start range around current page
    let start = Math.max(1, page - 1);
    let end = Math.min(totalPages - 2, page + 1);
    // Ensure we show at least `maxVisible - 2` middle pages
    if (end - start < maxVisible - 3) {
      if (start <= 1) {
        end = Math.min(totalPages - 2, start + maxVisible - 3);
      } else {
        start = Math.max(1, end - maxVisible + 3);
      }
    }
    if (start > 1) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 2) pages.push('...');
    // Always show last page
    pages.push(totalPages - 1);
    return pages;
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Live Transactions</h1>
            <p>Real-time transaction feed with filtering</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: isConnected ? 'var(--success)' : 'var(--danger)' }}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected ? 'Live' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="input"
          placeholder="Search by ID, account, or merchant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 250 }}
        />
        <select
          className="input select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="FLAGGED">Flagged</option>
          <option value="DECLINED">Declined</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Transaction ID</th>
              <th>Account</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Merchant</th>
              <th>Channel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !transactions.length ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                  ))}
                </tr>
              ))
            ) : (
              filteredTransactions.map((tx) => (
                <tr
                  key={tx.transaction_id}
                  onClick={() => setSelectedTx(tx)}
                  className={wsTransactions.some(w => (w as { transaction_id?: string }).transaction_id === tx.transaction_id) ? 'highlight' : ''}
                >
                  <td style={{ color: 'var(--text-3)' }}>{formatTimestamp(tx.timestamp)}</td>
                  <td className="font-mono" style={{ fontSize: '0.8rem' }}>{truncateId(tx.transaction_id)}</td>
                  <td>{tx.account_id}</td>
                  <td>{tx.transaction_type}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-1)' }}>{formatINR(tx.amount)}</td>
                  <td>{tx.merchant_name}</td>
                  <td><span className="badge" style={{ background: 'var(--bg-4)', color: 'var(--text-2)' }}>{tx.channel}</span></td>
                  <td><StatusBadge status={tx.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — hidden when only 1 page */}
      {totalPages > 1 && (
        <div className="pagination">
          {/* First */}
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0}
            onClick={() => setPage(0)}
            title="First page"
          >
            «
          </button>
          {/* Prev */}
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            title="Previous page"
          >
            ‹
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--text-4)', fontSize: '0.8rem', userSelect: 'none' }}>
                …
              </span>
            ) : (
              <button
                key={p}
                className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPage(p)}
                style={{
                  minWidth: 36,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {p + 1}
              </button>
            )
          )}

          {/* Next */}
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            title="Next page"
          >
            ›
          </button>
          {/* Last */}
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            title="Last page"
          >
            »
          </button>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-4)', marginLeft: 8 }}>
            {totalCount.toLocaleString('en-IN')} transactions
          </span>
        </div>
      )}

      {/* Transaction Detail Drawer */}
      {selectedTx && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedTx(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Transaction Detail</h2>
              <button onClick={() => setSelectedTx(null)} style={{ color: 'var(--text-3)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-lg)' }}>
              <StatusBadge status={selectedTx.status} />
              {selectedTx.is_international && <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>INTERNATIONAL</span>}
              {selectedTx.is_suspicious && <span className="badge badge-FLAGGED">SUSPICIOUS</span>}
            </div>

            <div className="drawer-section">
              <h3>Financial</h3>
              <div className="drawer-row"><span className="label">Amount</span><span className="value">{formatINR(selectedTx.amount)}</span></div>
              <div className="drawer-row"><span className="label">Currency</span><span className="value">{selectedTx.currency}</span></div>
              <div className="drawer-row"><span className="label">Type</span><span className="value">{selectedTx.transaction_type}</span></div>
            </div>

            <div className="drawer-section">
              <h3>Account</h3>
              <div className="drawer-row"><span className="label">Account ID</span><span className="value">{selectedTx.account_id}</span></div>
              <div className="drawer-row"><span className="label">Account Type</span><span className="value">{selectedTx.account_type}</span></div>
            </div>

            <div className="drawer-section">
              <h3>Merchant</h3>
              <div className="drawer-row"><span className="label">Name</span><span className="value">{selectedTx.merchant_name}</span></div>
              <div className="drawer-row"><span className="label">Category</span><span className="value">{selectedTx.merchant_category}</span></div>
              <div className="drawer-row"><span className="label">Channel</span><span className="value">{selectedTx.channel}</span></div>
            </div>

            <div className="drawer-section">
              <h3>Location</h3>
              <div className="drawer-row"><span className="label">Country</span><span className="value">{selectedTx.location_country}</span></div>
              <div className="drawer-row"><span className="label">City</span><span className="value">{selectedTx.location_city}</span></div>
              <div className="drawer-row"><span className="label">Coordinates</span><span className="value font-mono" style={{ fontSize: '0.8rem' }}>{selectedTx.location_lat}, {selectedTx.location_lon}</span></div>
            </div>

            {selectedTx.fraud_score != null && (
              <div className="drawer-section">
                <h3>Risk Assessment</h3>
                <div className="drawer-row">
                  <span className="label">Fraud Score</span>
                  <span className="value" style={{
                    color: selectedTx.fraud_score >= 0.8 ? 'var(--danger)' : selectedTx.fraud_score >= 0.5 ? 'var(--warning)' : 'var(--success)',
                    fontWeight: 700,
                  }}>
                    {(selectedTx.fraud_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            <div className="drawer-section">
              <h3>Metadata</h3>
              <div className="drawer-row"><span className="label">Transaction ID</span><span className="value font-mono" style={{ fontSize: '0.72rem' }}>{selectedTx.transaction_id}</span></div>
              <div className="drawer-row"><span className="label">Timestamp</span><span className="value">{formatTimestamp(selectedTx.timestamp)}</span></div>
              <div className="drawer-row"><span className="label">IP Address</span><span className="value font-mono">{selectedTx.ip_address || 'N/A'}</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

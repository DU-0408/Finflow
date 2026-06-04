export const COLORS = {
  // Primary palette
  primary:     'hsl(217, 91%, 60%)',
  primaryDark: 'hsl(217, 91%, 45%)',
  primaryLight:'hsl(217, 91%, 75%)',

  // Status colors
  success:     'hsl(152, 69%, 45%)',
  successBg:   'hsla(152, 69%, 45%, 0.12)',
  warning:     'hsl(38, 92%, 55%)',
  warningBg:   'hsla(38, 92%, 55%, 0.12)',
  danger:      'hsl(0, 84%, 60%)',
  dangerBg:    'hsla(0, 84%, 60%, 0.12)',
  info:        'hsl(199, 89%, 48%)',
  infoBg:      'hsla(199, 89%, 48%, 0.12)',

  // Backgrounds (dark)
  bg0: 'hsl(222, 47%, 5%)',
  bg1: 'hsl(222, 47%, 8%)',
  bg2: 'hsl(222, 35%, 12%)',
  bg3: 'hsl(222, 30%, 16%)',
  bg4: 'hsl(222, 25%, 20%)',

  // Text
  text1: 'hsl(210, 40%, 98%)',
  text2: 'hsl(215, 20%, 75%)',
  text3: 'hsl(215, 15%, 55%)',

  // Borders
  border1: 'hsla(215, 20%, 40%, 0.25)',
  border2: 'hsla(215, 20%, 40%, 0.12)',

  // Glass
  glass:       'hsla(222, 35%, 12%, 0.6)',
  glassBorder: 'hsla(215, 20%, 50%, 0.15)',
} as const;

export const SERVICE_URLS = {
  apiGateway:   process.env.API_GATEWAY_URL          || 'http://localhost:8000',
  fraudService: process.env.FRAUD_SERVICE_URL        || 'http://localhost:8001',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8002',
  prometheus:   process.env.PROMETHEUS_URL            || 'http://localhost:9090',
} as const;

export const PROMETHEUS_QUERIES = {
  // Stat panels
  totalTransactions:   'transactions_generated_total',
  fraudDetected:       'fraud_detected_total',
  fraudRate:           'fraud_transactions_total / transactions_generated_total',
  generatorErrors:     'generator_errors_total',
  // Time-series panels
  tps:                 'rate(transactions_generated_total[1m])',
  fraudDetectionRate:  'rate(fraud_detected_total[1m])',
  fraudChecksRate:     'rate(fraud_checks_total[1m])',
  analysisP95:         'histogram_quantile(0.95, rate(fraud_analysis_duration_seconds_bucket[5m]))',
  analysisP50:         'histogram_quantile(0.50, rate(fraud_analysis_duration_seconds_bucket[5m]))',
  rulesTrigger:        'rate(fraud_rule_trigger_total[1m])',
  apiRequestRate:      'rate(api_requests_total[1m])',
  apiResponseP95:      'histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m]))',
  apiResponseP50:      'histogram_quantile(0.50, rate(api_request_duration_seconds_bucket[5m]))',
  alertsSent:          'rate(alerts_sent_total[1m])',
  alertsFailed:        'rate(alerts_failed_total[1m])',
} as const;

export const FRAUD_RULES: Record<string, { label: string; description: string; color: string }> = {
  high_value:                { label: 'High Value',              description: 'Amount > ₹1,00,000',                    color: '#f59e0b' },
  geo_anomaly:               { label: 'Geo Anomaly',             description: 'High-risk country or intl + savings',   color: '#ef4444' },
  card_testing:              { label: 'Card Testing',            description: 'Amount < ₹50 on ONLINE channel',         color: '#8b5cf6' },
  odd_hours:                 { label: 'Odd Hours',               description: 'Transaction between 1am–4am',           color: '#6366f1' },
  international_high_amount: { label: 'International High',      description: 'International + amount > ₹50,000',       color: '#ec4899' },
  refund_abuse:              { label: 'Refund Abuse',            description: 'Refund > ₹10,000',                       color: '#f97316' },
  velocity:                  { label: 'Velocity',               description: '>10 txns per account in 60s',            color: '#14b8a6' },
};

export const REFRESH_INTERVALS = {
  stats:  10_000,  // 10s
  charts: 30_000,  // 30s
  health: 15_000,  // 15s
} as const;

export const TIME_RANGES = [
  { label: '5m',  value: 5 * 60 },
  { label: '15m', value: 15 * 60 },
  { label: '30m', value: 30 * 60 },
  { label: '1h',  value: 60 * 60 },
  { label: '6h',  value: 6 * 60 * 60 },
  { label: '24h', value: 24 * 60 * 60 },
] as const;

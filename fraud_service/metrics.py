from prometheus_client import Counter, Histogram

FRAUD_CHECKS_TOTAL = Counter(
    "fraud_checks_total",
    "Total transactions analyzed by fraud engine"
)

FRAUD_DETECTED_TOTAL = Counter(
    "fraud_detected_total",
    "Total transactions flagged as fraudulent"
)

RULE_TRIGGER_COUNT = Counter(
    "fraud_rule_trigger_total",
    "Times each fraud rule was triggered",
    ["rule_name"]
)

ANALYSIS_DURATION = Histogram(
    "fraud_analysis_duration_seconds",
    "Time taken to analyze a transaction",
    buckets=[0.001, 0.005, 0.010, 0.025, 0.050, 0.100]
)
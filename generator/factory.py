from __future__ import annotations

import os
import random
import hashlib

from faker import Faker
from dotenv import load_dotenv

from .models import (
    Transaction, TransactionType, TransactionStatus,
    MerchantCategory, GeoLocation,
)

load_dotenv()
fake = Faker("en_IN")

# ── Weighted distributions ────────────────────────────────────────────────────

TRANSACTION_TYPE_WEIGHTS = {
    TransactionType.PURCHASE:         0.45,
    TransactionType.ONLINE_TRANSFER:  0.20,
    TransactionType.BILL_PAYMENT:     0.15,
    TransactionType.ATM_WITHDRAWAL:   0.10,
    TransactionType.REFUND:           0.05,
    TransactionType.INTERNATIONAL:    0.05,
}

MERCHANT_CATEGORY_WEIGHTS = {
    MerchantCategory.GROCERY:         0.20,
    MerchantCategory.RESTAURANT:      0.15,
    MerchantCategory.ONLINE:          0.15,
    MerchantCategory.FUEL:            0.10,
    MerchantCategory.UTILITIES:       0.10,
    MerchantCategory.ENTERTAINMENT:   0.08,
    MerchantCategory.HEALTHCARE:      0.07,
    MerchantCategory.ELECTRONICS:     0.05,
    MerchantCategory.TRAVEL:          0.05,
    MerchantCategory.EDUCATION:       0.03,
    MerchantCategory.ATM:             0.01,
    MerchantCategory.INTERNATIONAL:   0.01,
}

AMOUNT_RANGES = {
    TransactionType.PURCHASE:         (50,      15_000),
    TransactionType.ONLINE_TRANSFER:  (500,    200_000),
    TransactionType.BILL_PAYMENT:     (100,     50_000),
    TransactionType.ATM_WITHDRAWAL:   (500,     20_000),
    TransactionType.REFUND:           (50,      10_000),
    TransactionType.INTERNATIONAL:    (1_000,  500_000),
}

DOMESTIC_LOCATIONS = [
    ("India", "Bengaluru",  12.9716,  77.5946),
    ("India", "Mumbai",     19.0760,  72.8777),
    ("India", "Delhi",      28.6139,  77.2090),
    ("India", "Hyderabad",  17.3850,  78.4867),
    ("India", "Chennai",    13.0827,  80.2707),
    ("India", "Jaipur",     26.9124,  75.7873),
    ("India", "Pune",       18.5204,  73.8567),
    ("India", "Kolkata",    22.5726,  88.3639),
]

INTERNATIONAL_LOCATIONS = [
    ("USA",       "New York",   40.7128, -74.0060),
    ("UK",        "London",     51.5074,  -0.1278),
    ("Singapore", "Singapore",   1.3521, 103.8198),
    ("UAE",       "Dubai",      25.2048,  55.2708),
    ("Germany",   "Frankfurt",  50.1109,   8.6821),
]

MERCHANT_NAMES = {
    MerchantCategory.GROCERY:       ["BigBazaar", "DMart", "Reliance Fresh", "Spencer's"],
    MerchantCategory.RESTAURANT:    ["Zomato", "Swiggy", "Dominos", "McDonald's", "Haldiram's"],
    MerchantCategory.ONLINE:        ["Amazon IN", "Flipkart", "Myntra", "Nykaa"],
    MerchantCategory.FUEL:          ["Indian Oil", "BPCL", "HPCL", "Shell"],
    MerchantCategory.UTILITIES:     ["BESCOM", "Airtel", "Jio", "BWSSB"],
    MerchantCategory.ENTERTAINMENT: ["BookMyShow", "Netflix", "PVR Cinemas", "Hotstar"],
    MerchantCategory.HEALTHCARE:    ["Apollo Pharmacy", "MedPlus", "1mg", "Practo"],
    MerchantCategory.ELECTRONICS:   ["Croma", "Samsung Store", "Apple Store", "Vijay Sales"],
    MerchantCategory.TRAVEL:        ["MakeMyTrip", "IRCTC", "IndiGo", "OYO"],
    MerchantCategory.EDUCATION:     ["Byju's", "Unacademy", "Coursera", "Udemy"],
    MerchantCategory.ATM:           ["SBI ATM", "HDFC ATM", "ICICI ATM", "Axis ATM"],
    MerchantCategory.INTERNATIONAL: ["Visa International", "Mastercard Global"],
}

CHANNELS       = ["POS", "ATM", "ONLINE", "MOBILE"]
CHANNEL_WEIGHTS = [0.35,  0.10,   0.30,    0.25]


# ── Account pool ──────────────────────────────────────────────────────────────

class AccountPool:
    """Pre-generates a fixed pool of accounts so transactions look consistent."""

    def __init__(self, size: int = 500):
        self.accounts = [self._make() for _ in range(size)]

    @staticmethod
    def _make() -> dict:
        home = random.choice(DOMESTIC_LOCATIONS)
        bban = fake.bban()
        return {
            "account_id":     f"ACC{fake.numerify('########')}",
            "account_number": f"XXXX-XXXX-XXXX-{bban[-4:]}",
            "account_type":   random.choice(["SAVINGS", "CURRENT", "CREDIT"]),
            "home_city":      home,
            "risk_profile":   random.choices(
                ["LOW", "MEDIUM", "HIGH"], weights=[0.75, 0.20, 0.05]
            )[0],
        }

    def pick(self) -> dict:
        return random.choice(self.accounts)


# ── Factory ───────────────────────────────────────────────────────────────────

class TransactionFactory:

    def __init__(self, fraud_rate: float = float(os.getenv("FRAUD_RATE", "0.02"))):
        self.fraud_rate = fraud_rate
        self.pool = AccountPool()

    # helpers
    @staticmethod
    def _weighted_choice(mapping: dict):
        keys    = list(mapping.keys())
        weights = list(mapping.values())
        return random.choices(keys, weights=weights, k=1)[0]

    @staticmethod
    def _generate_amount(tx_type: TransactionType) -> float:
        lo, hi = AMOUNT_RANGES[tx_type]
        raw    = random.lognormvariate(0, 1)
        amount = lo + (raw / 8) * (hi - lo)
        return round(max(lo, min(hi, amount)), 2)

    @staticmethod
    def _generate_location(tx_type: TransactionType, account: dict) -> GeoLocation:
        if tx_type == TransactionType.INTERNATIONAL:
            loc = random.choice(INTERNATIONAL_LOCATIONS)
        elif random.random() < 0.90:
            loc = account["home_city"]
        else:
            loc = random.choice(DOMESTIC_LOCATIONS)

        return GeoLocation(
            country=loc[0], city=loc[1],
            latitude=round(loc[2]  + random.uniform(-0.05, 0.05), 6),
            longitude=round(loc[3] + random.uniform(-0.05, 0.05), 6),
        )

    @staticmethod
    def _get_merchant(category: MerchantCategory) -> tuple[str, str]:
        name = random.choice(MERCHANT_NAMES[category])
        mid  = "MRC" + hashlib.md5(name.encode()).hexdigest()[:8].upper()
        return mid, name

    def _inject_fraud(self, tx: Transaction) -> Transaction:
        pattern = random.choice(["high_value", "geo_anomaly", "card_testing"])

        if pattern == "high_value":
            tx.amount       = round(random.uniform(200_000, 999_999), 2)
            tx.is_high_value = True

        elif pattern == "geo_anomaly":
            tx.location      = GeoLocation(
                country="Nigeria", city="Lagos",
                latitude=6.5244, longitude=3.3792
            )
            tx.is_international = True

        elif pattern == "card_testing":
            tx.amount           = round(random.uniform(1, 50), 2)
            tx.merchant_category = MerchantCategory.ONLINE
            tx.channel          = "ONLINE"

        tx.is_suspicious = True
        tx.status        = TransactionStatus.FLAGGED
        return tx

    # public
    def generate(self, force_fraud: bool = False) -> Transaction:
        account  = self.pool.pick()
        tx_type  = self._weighted_choice(TRANSACTION_TYPE_WEIGHTS)
        category = self._weighted_choice(MERCHANT_CATEGORY_WEIGHTS)
        mid, mname = self._get_merchant(category)

        currency = (
            random.choice(["USD", "GBP", "EUR", "SGD"])
            if tx_type == TransactionType.INTERNATIONAL else "INR"
        )

        tx = Transaction(
            account_id=account["account_id"],
            account_number=account["account_number"],
            account_type=account["account_type"],
            transaction_type=tx_type,
            amount=self._generate_amount(tx_type),
            currency=currency,
            merchant_id=mid,
            merchant_name=mname,
            merchant_category=category,
            location=self._generate_location(tx_type, account),
            is_international=(tx_type == TransactionType.INTERNATIONAL),
            channel=random.choices(CHANNELS, weights=CHANNEL_WEIGHTS, k=1)[0],
            device_fingerprint=hashlib.sha256(fake.uuid4().encode()).hexdigest()[:32],
            ip_address=fake.ipv4_public(),
        )

        if force_fraud or random.random() < self.fraud_rate:
            tx = self._inject_fraud(tx)
        elif tx.amount > 100_000:
            tx.is_high_value = True

        return tx

    def generate_batch(self, n: int) -> list[Transaction]:
        return [self.generate() for _ in range(n)]

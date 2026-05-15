from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class TransactionType(str, Enum):
    PURCHASE = "PURCHASE"
    ATM_WITHDRAWAL = "ATM_WITHDRAWAL"
    ONLINE_TRANSFER = "ONLINE_TRANSFER"
    BILL_PAYMENT = "BILL_PAYMENT"
    REFUND = "REFUND"
    INTERNATIONAL = "INTERNATIONAL"


class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DECLINED = "DECLINED"
    FLAGGED = "FLAGGED"


class MerchantCategory(str, Enum):
    GROCERY = "GROCERY"
    FUEL = "FUEL"
    RESTAURANT = "RESTAURANT"
    ELECTRONICS = "ELECTRONICS"
    HEALTHCARE = "HEALTHCARE"
    TRAVEL = "TRAVEL"
    ENTERTAINMENT = "ENTERTAINMENT"
    UTILITIES = "UTILITIES"
    EDUCATION = "EDUCATION"
    ATM = "ATM"
    ONLINE = "ONLINE"
    INTERNATIONAL = "INTERNATIONAL"


class GeoLocation(BaseModel):
    country: str
    city: str
    latitude: float
    longitude: float


class Transaction(BaseModel):
    transaction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Account
    account_id: str
    account_number: str
    account_type: str           # SAVINGS | CURRENT | CREDIT

    # Transaction
    transaction_type: TransactionType
    amount: float
    currency: str
    status: TransactionStatus = TransactionStatus.PENDING

    # Merchant
    merchant_id: str
    merchant_name: str
    merchant_category: MerchantCategory

    # Location
    location: GeoLocation

    # Risk flags
    is_international: bool = False
    is_high_value: bool = False
    is_suspicious: bool = False
    fraud_score: Optional[float] = None

    # Metadata
    channel: str = "POS"        # POS | ATM | ONLINE | MOBILE
    device_fingerprint: Optional[str] = None
    ip_address: Optional[str] = None
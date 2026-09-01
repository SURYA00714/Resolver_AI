# FILE: domain/money.py
"""Centralized currency and money handling module (§5).

CRITICAL INVARIANTS:
1. No floating-point arithmetic for financial amounts. Always use Decimal.
2. Safe conversion between major (e.g. INR Rupees) and minor units (e.g. Paise).
3. Strict currency validation against supported currency whitelist.
4. Fail-closed on unsupported currencies or negative amounts.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Union
from domain.errors import ResolverError


class InvalidAmountError(ResolverError):
    """Raised when an invalid financial amount is provided."""
    pass


class UnsupportedCurrencyError(ResolverError):
    """Raised when an unsupported currency code is specified."""
    pass


# Supported ISO 4217 Currency Codes
SUPPORTED_CURRENCIES = {"INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW"}

# Currencies with 0 decimal places (no minor units)
ZERO_DECIMAL_CURRENCIES = {"JPY", "KRW"}


def validate_currency(currency: str) -> str:
    """Validate and normalize currency string to uppercase ISO format."""
    if not currency or not isinstance(currency, str):
        raise UnsupportedCurrencyError("Currency code must be a non-empty string.")
    
    code = currency.strip().upper()
    if code not in SUPPORTED_CURRENCIES:
        raise UnsupportedCurrencyError(f"Currency '{code}' is not supported. Allowed: {sorted(SUPPORTED_CURRENCIES)}")
    return code


def to_decimal_amount(val: Union[int, float, str, Decimal]) -> Decimal:
    """Safely convert any numeric input to a 2-decimal place Decimal amount."""
    if isinstance(val, float):
        # Convert float via str to prevent binary float representation inaccuracy
        d = Decimal(str(val))
    elif isinstance(val, (int, str)):
        d = Decimal(str(val))
    elif isinstance(val, Decimal):
        d = val
    else:
        raise InvalidAmountError(f"Cannot convert type '{type(val).__name__}' to Decimal amount.")

    if d.is_nan() or d.is_infinite():
        raise InvalidAmountError("Financial amount cannot be NaN or Infinite.")

    # Quantize to 2 decimal places (standard for supported currencies)
    return d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def minor_units_to_decimal(minor_units: int, currency: str = "INR") -> Decimal:
    """Convert minor units (e.g. paise / cents) to major unit Decimal amount.
    
    Example: 1000 paise -> Decimal('10.00') INR
    """
    currency_code = validate_currency(currency)
    if minor_units < 0:
        raise InvalidAmountError("Minor units amount cannot be negative.")

    if currency_code in ZERO_DECIMAL_CURRENCIES:
        return Decimal(str(minor_units)).quantize(Decimal("1.00"))
    
    return (Decimal(str(minor_units)) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def decimal_to_minor_units(amount: Decimal, currency: str = "INR") -> int:
    """Convert major unit Decimal amount to minor units integer (e.g. paise / cents).
    
    Example: Decimal('10.50') INR -> 1050 paise
    """
    currency_code = validate_currency(currency)
    if amount < Decimal("0.00"):
        raise InvalidAmountError("Amount cannot be negative.")

    if currency_code in ZERO_DECIMAL_CURRENCIES:
        return int(amount)

    return int((amount * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def validate_positive_amount(amount: Decimal) -> Decimal:
    """Ensure amount is strictly positive (> 0.00)."""
    if amount <= Decimal("0.00"):
        raise InvalidAmountError(f"Financial amount must be strictly positive (> 0.00). Got: {amount}")
    return amount

# FILE: razorpay/client.py
"""Razorpay Async Client with bounded retries and exponential backoff (§11, 20)."""
import logging
import sys
from typing import Any, Dict, Optional

import httpx

import config
from domain.errors import RazorpayAPIError

logger = logging.getLogger("resolverai.razorpay")


class RazorpayClient:
    """Async client for interacting with Razorpay REST APIs in Test or Production Mode."""

    def __init__(
        self,
        key_id: Optional[str] = None,
        key_secret: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 10.0,
        max_retries: int = 3,
        backoff_factor: float = 1.0,
    ):
        self.key_id = key_id or config.RAZORPAY_KEY_ID
        self.key_secret = key_secret or config.RAZORPAY_KEY_SECRET
        self.base_url = (base_url or config.RAZORPAY_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.max_retries = max(1, max_retries)
        self.backoff_factor = backoff_factor

    def _get_auth(self) -> tuple[str, str]:
        return (self.key_id, self.key_secret)

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Perform sanitized HTTP request to Razorpay API with bounded retries."""
        if not self.key_id or not self.key_secret:
            raise RazorpayAPIError(
                "Razorpay API credentials missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
                status_code=401,
            )

        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        auth = self._get_auth()
        headers = {"User-Agent": "ResolverAI-PaymentIntegrity/2.0"}
        if idempotency_key:
            headers["X-Payout-Idempotency"] = idempotency_key

        last_exception = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info("RAZORPAY %s %s (attempt %d/%d)", method, url, attempt, self.max_retries)
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        auth=auth,
                        json=data,
                        params=params,
                        headers=headers,
                    )

                if response.status_code < 400:
                    return response.json()

                # Handle retryable status codes (429, 502, 503, 504)
                if response.status_code in (429, 502, 503, 504) and attempt < self.max_retries:
                    retry_after = response.headers.get("Retry-After")
                    wait = float(retry_after) if retry_after else self.backoff_factor * (2 ** (attempt - 1))
                    logger.warning("RAZORPAY %s — retrying in %.1fs (attempt %d)", response.status_code, wait, attempt)
                    await asyncio_sleep(wait)
                    continue

                error_msg = f"Razorpay API HTTP {response.status_code}: {response.text}"
                logger.error("RAZORPAY_ERROR: %s", error_msg)
                raise RazorpayAPIError(
                    message=error_msg,
                    status_code=response.status_code,
                    response_body=response.text,
                )

            except httpx.TimeoutException as e:
                logger.warning("RAZORPAY timeout attempt %d: %s", attempt, e)
                last_exception = e
                if attempt < self.max_retries:
                    wait = self.backoff_factor * (2 ** (attempt - 1))
                    await asyncio_sleep(wait)
                    continue
                raise RazorpayAPIError(message=f"Razorpay API timeout after {self.max_retries} attempts: {e}", status_code=504)
            except httpx.RequestError as e:
                logger.warning("RAZORPAY network error attempt %d: %s", attempt, e)
                last_exception = e
                if attempt < self.max_retries:
                    wait = self.backoff_factor * (2 ** (attempt - 1))
                    await asyncio_sleep(wait)
                    continue
                raise RazorpayAPIError(message=f"Razorpay API network error after {self.max_retries} attempts: {e}", status_code=503)

        raise RazorpayAPIError(message=f"Razorpay API failed after {self.max_retries} attempts: {last_exception}", status_code=500)


async def asyncio_sleep(seconds: float):
    import asyncio
    await asyncio.sleep(seconds)


# Shared client instance
_client: Optional[RazorpayClient] = None


def get_razorpay_client() -> RazorpayClient:
    global _client
    if _client is None:
        _client = RazorpayClient()
    return _client

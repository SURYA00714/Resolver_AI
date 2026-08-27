# FILE: razorpay/client.py
"""Razorpay Async Client using httpx (§11, 20)."""
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
    ):
        self.key_id = key_id or config.RAZORPAY_KEY_ID
        self.key_secret = key_secret or config.RAZORPAY_KEY_SECRET
        self.base_url = (base_url or config.RAZORPAY_BASE_URL).rstrip("/")
        self.timeout = timeout

    def _get_auth(self) -> tuple[str, str]:
        return (self.key_id, self.key_secret)

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Perform sanitized HTTP request to Razorpay API."""
        if not self.key_id or not self.key_secret:
            raise RazorpayAPIError(
                "Razorpay API credentials missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
                status_code=401,
            )

        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        auth = self._get_auth()

        # Sanitize logging — never log auth headers or secrets
        print(f"[RAZORPAY_CLIENT] {method} {url}", file=sys.stderr)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    auth=auth,
                    json=data,
                    params=params,
                    headers={"User-Agent": "ResolverAI-PaymentIntegrity/1.0"},
                )

                if response.status_code >= 400:
                    error_msg = f"Razorpay API HTTP {response.status_code}: {response.text}"
                    print(f"[RAZORPAY_CLIENT] Error response: {error_msg}", file=sys.stderr)
                    raise RazorpayAPIError(
                        message=error_msg,
                        status_code=response.status_code,
                        response_body=response.text,
                    )

                return response.json()

            except httpx.TimeoutException as e:
                print(f"[RAZORPAY_CLIENT] Timeout contacting Razorpay API: {e}", file=sys.stderr)
                raise RazorpayAPIError(message=f"Razorpay API timeout: {e}", status_code=504)
            except httpx.RequestError as e:
                print(f"[RAZORPAY_CLIENT] Network error contacting Razorpay API: {e}", file=sys.stderr)
                raise RazorpayAPIError(message=f"Razorpay API network error: {e}", status_code=503)


# Shared client instance
_client: Optional[RazorpayClient] = None


def get_razorpay_client() -> RazorpayClient:
    global _client
    if _client is None:
        _client = RazorpayClient()
    return _client

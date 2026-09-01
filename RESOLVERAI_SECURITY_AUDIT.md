# RESOLVERAI — SECURITY RED-TEAM AUDIT

## 1. Vulnerability & Threat Matrix

| Finding ID | Severity | File & Location | Vulnerability Description | Impact | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **HIGH** | `config.py:13` | Default JWT secret fallback (`resolverai_production_jwt_secret_key_change_me`). | Potential token forgery if deployed without `.env`. | Enforce strict startup exception if `JWT_SECRET_KEY` matches default value in production. |
| **SEC-02** | **MEDIUM**| `config.py:65` | Liberal default CORS settings if env is missing. | Cross-origin request exploitation. | Whitelist exact domain list per merchant deployment. |
| **SEC-03** | **MEDIUM**| `api/webhook_receiver.py:27` | Soft fallback when `RAZORPAY_WEBHOOK_SECRET` is missing in non-production. | Webhook forgery in staging environments. | Always enforce signature validation regardless of environment. |
| **SEC-04** | **LOW** | `config.py:19` | Default admin credentials (`admin/admin123`). | Brute-force/Unauthorized access if unchanged. | Mandate password change on first login. |

## 2. Webhook Security Verification
- **Raw Bytes:** Handled properly via `await request.body()`.
- **HMAC Calculation:** `hmac.new(key=webhook_secret, msg=raw_body, digestmod=sha256).hexdigest()`.
- **Comparison:** Uses `hmac.compare_digest` for timing-attack resistance.

## 3. RBAC Enforcement
- Server-side RBAC is strictly enforced via FastAPI dependencies (`require_permission("...")`).
- Roles: `viewer`, `operator`, `admin`.
- Non-authorized requests return HTTP 403 Forbidden.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://resolver-ai-l3ks.onrender.com';

let _token = typeof window !== 'undefined' ? localStorage.getItem('resolverai_token') : null;

export function setToken(token) {
  _token = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('resolverai_token', token);
    } else {
      localStorage.removeItem('resolverai_token');
    }
  }
}

export function getToken() {
  return _token;
}

export function clearToken() {
  _token = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('resolverai_token');
  }
}

async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };
  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      clearToken();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      let detail = 'API Error';
      if (errData && errData.detail) {
        if (typeof errData.detail === 'object') {
          detail = errData.detail.message || JSON.stringify(errData.detail);
        } else {
          detail = errData.detail;
        }
      } else if (errData && errData.message) {
        detail = errData.message;
      }
      throw new Error(detail || `API error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[ResolverAI API] ${endpoint}:`, err.message);
    throw err;
  }
}

export const api = {
  setToken,
  getToken,
  clearToken,
  // ── Auth ──────────────────────────────────────────
  login: (username, password, role) => fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  }),
  getAuthMe: () => fetchApi('/auth/me'),
  getRoles: () => fetchApi('/auth/roles'),

  // ── Core dashboard ────────────────────────────────
  getStats: () => fetchApi('/dashboard/stats'),
  getHealth: () => fetchApi('/health'),
  getIntegrationHealth: () => fetchApi('/integrations/health'),

  // ── Payments ──────────────────────────────────────
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchApi(`/payments${q ? `?${q}` : ''}`);
  },
  getPayment: (id) => fetchApi(`/payments/${id}`),
  getPaymentTimeline: (id) => fetchApi(`/payments/${id}/timeline`),
  reconcilePayment: (id) => fetchApi(`/payments/${id}/reconcile`, { method: 'POST' }),
  verifyWithRazorpay: (id) => fetchApi(`/payments/${id}/verify`),

  // ── Orders (real Razorpay) ────────────────────────
  createOrder: (body) => fetchApi('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getOrder: (razorpayOrderId) => fetchApi(`/orders/${razorpayOrderId}`),

  // ── Webhooks ──────────────────────────────────────
  getWebhooks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchApi(`/webhooks${q ? `?${q}` : ''}`);
  },
  getWebhook: (id) => fetchApi(`/webhooks/${id}`),
  replayWebhook: (id) => fetchApi(`/webhooks/${id}/replay`, { method: 'POST' }),
  getDeadLetters: () => fetchApi('/outbox/dead-letters'),

  // ── Reconciliation cases ──────────────────────────
  getCases: (status) => fetchApi(`/cases${status ? `?status=${status}` : ''}`),
  getCase: (id) => fetchApi(`/cases/${id}`),
  resolveCase: (id, body) => fetchApi(`/cases/${id}/manual-resolve`, { method: 'POST', body: JSON.stringify(body) }),

  // ── Audit ─────────────────────────────────────────
  getAuditTrail: (limit = 50) => fetchApi(`/audit?limit=${limit}`),
};

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
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      let detail = 'API Error';
      let errCode = null;
      if (errData && errData.detail) {
        if (typeof errData.detail === 'object') {
          detail = errData.detail.message || JSON.stringify(errData.detail);
          errCode = errData.detail.error;
        } else {
          detail = errData.detail;
        }
      } else if (errData && errData.message) {
        detail = errData.message;
      }

      if (res.status === 401 && errCode !== 'invalid_checkout_signature' && !endpoint.includes('/auth/login')) {
        clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
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

  // ── Core dashboard & Diagnostics ──────────────────
  getStats: () => fetchApi('/dashboard/stats'),
  getHealth: () => fetchApi('/health'),
  getIntegrationHealth: () => fetchApi('/integrations/health'),
  getWebhookDiagnostics: () => fetchApi('/webhook/diagnostics'),

  // ── Payments & Resolution ─────────────────────────
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchApi(`/payments${q ? `?${q}` : ''}`);
  },
  getPayment: (id) => fetchApi(`/payments/${id}`),
  getPaymentTimeline: (id) => fetchApi(`/payments/${id}/timeline`),
  getPaymentEvidence: (id) => fetchApi(`/payments/evidence/${id}`),
  getPaymentInvestigation: (id) => fetchApi(`/payments/${id}/investigation`),
  reconcilePayment: (id) => fetchApi(`/payments/${id}/reconcile`, { method: 'POST' }),
  resolvePayment: (id) => fetchApi(`/payments/${id}/resolve`, { method: 'POST' }),
  verifyWithRazorpay: (id) => fetchApi(`/payments/${id}/verify`),

  // ── Orders (real Razorpay Checkout) ───────────────
  createOrder: (body) => fetchApi('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getOrder: (razorpayOrderId) => fetchApi(`/orders/${razorpayOrderId}`),
  verifyPayment: (body) => fetchApi('/orders/verify_payment', { method: 'POST', body: JSON.stringify(body) }),
  reportFailure: (body) => fetchApi('/orders/report_failure', { method: 'POST', body: JSON.stringify(body) }),

  // ── Webhooks & Dead Letters ───────────────────────
  getWebhooks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchApi(`/webhooks${q ? `?${q}` : ''}`);
  },
  getWebhook: (id) => fetchApi(`/webhooks/${id}`),
  replayWebhook: (id) => fetchApi(`/webhooks/${id}/replay`, { method: 'POST' }),
  getDeadLetters: () => fetchApi('/outbox/dead-letters'),

  // ── Reconciliation cases & Forensic Replay ────────
  getCases: (status) => fetchApi(`/cases${status ? `?status=${status}` : ''}`),
  getCase: (id) => fetchApi(`/cases/${id}`),
  resolveCase: (id, body) => fetchApi(`/cases/${id}/manual-resolve`, { method: 'POST', body: JSON.stringify(body) }),
  forensicReplayCase: (paymentIntentId) => fetchApi(`/cases/replay/${paymentIntentId}`, { method: 'POST' }),

  // ── Audit ─────────────────────────────────────────
  getAuditTrail: (limit = 50) => fetchApi(`/audit?limit=${limit}`),

  // ── Chaos / Engineering ───────────────────────────
  injectChaos: (type) => fetchApi(`/engineering/chaos/${type}`, { method: 'POST' }),

  // ── AI Test Lab ───────────────────────────────────
  getTestLabStatus: () => fetchApi('/ai-test-lab/status'),
  getTestLabScenarios: () => fetchApi('/ai-test-lab/scenarios'),
  runTestLabSuite: (body = {}) => fetchApi('/ai-test-lab/run', { method: 'POST', body: JSON.stringify(body) }),
  stopTestLabRun: (runId) => fetchApi(`/ai-test-lab/run/${runId}/stop`, { method: 'POST' }),
  getTestLabRuns: (limit = 20) => fetchApi(`/ai-test-lab/runs?limit=${limit}`),
  getTestLabRun: (runId) => fetchApi(`/ai-test-lab/runs/${runId}`),
  getTestLabResult: (resultId) => fetchApi(`/ai-test-lab/results/${resultId}`),
  generateAiScenarios: (body = {}) => fetchApi('/ai-test-lab/generate', { method: 'POST', body: JSON.stringify(body) }),
  runAiAdversarialSuite: (body = {}) => fetchApi('/ai-test-lab/adversarial-run', { method: 'POST', body: JSON.stringify(body) }),
  resetDemoEnvironment: () => fetchApi('/dashboard/reset-demo', { method: 'POST' }),
};



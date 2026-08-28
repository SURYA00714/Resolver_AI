const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errData.detail || `API error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

// API functions
export const api = {
  getStats: () => fetchApi('/dashboard/stats'),
  getPayments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/payments${query ? `?${query}` : ''}`);
  },
  getPayment: (id) => fetchApi(`/payments/${id}`),
  getPaymentTimeline: (id) => fetchApi(`/payments/${id}/timeline`),
  reconcilePayment: (id) => fetchApi(`/payments/${id}/reconcile`, { method: 'POST' }),
  getCases: (status) => fetchApi(`/cases${status ? `?status=${status}` : ''}`),
  getCase: (id) => fetchApi(`/cases/${id}`),
  resolveCase: (id, body) => fetchApi(`/cases/${id}/manual-resolve`, { method: 'POST', body: JSON.stringify(body) }),
  createDemoPayment: () => fetchApi('/demo/payment', { method: 'POST' }),
  injectChaos: (type) => fetchApi(`/demo/chaos/${type}`, { method: 'POST' }),
  getFinancialSummary: () => fetchApi('/demo/financial-summary'),
  getAuditTrail: (limit = 50) => fetchApi(`/audit?limit=${limit}`),
  getHealth: () => fetchApi('/health'),
};

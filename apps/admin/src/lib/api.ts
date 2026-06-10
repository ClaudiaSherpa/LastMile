// Tiny typed fetch client with token persistence + auto-refresh.
const BASE = '/api';
const ACCESS = 'sherpa_ops_access';
const REFRESH = 'sherpa_ops_refresh';

export const auth = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS, tokens.accessToken);
    localStorage.setItem(REFRESH, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (auth.access) headers.Authorization = `Bearer ${auth.access}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && retry && auth.refresh) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refresh }),
    });
    if (!res.ok) return false;
    const tokens = await res.json();
    auth.set(tokens);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ sub: string; role: string; email?: string }>('/auth/me'),
  overview: () => request<any>('/overview'),
  drivers: () => request<any[]>('/drivers'),
  applications: () => request<any[]>('/applications'),
  // approvals
  queue: () => request<any[]>('/approvals/queue'),
  approval: (id: string) => request<any>(`/approvals/${id}`),
  decide: (id: string, outcome: 'pass' | 'fail' | 'return', reason?: string) =>
    request<any>(`/approvals/${id}/decision`, { method: 'POST', body: JSON.stringify({ outcome, reason }) }),
  securityCheck: (id: string, check: string, result: string) =>
    request<any>(`/approvals/${id}/security-check`, { method: 'POST', body: JSON.stringify({ check, result }) }),
  workflows: () => request<any[]>('/workflows'),
  // compliance
  compliance: (within = 60) => request<any[]>(`/compliance?within=${within}`),
  runScan: () => request<any>('/compliance/scan', { method: 'POST' }),
  renewDoc: (id: string, expiryDate: string) =>
    request<any>(`/compliance/documents/${id}/renew`, { method: 'POST', body: JSON.stringify({ expiryDate }) }),
};

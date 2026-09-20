const BASE = '/api';
const KEY = 'sherpa_driver_app';

export interface AppRef { id: string; token: string }

export const session = {
  get(): AppRef | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  },
  set(ref: AppRef) {
    localStorage.setItem(KEY, JSON.stringify(ref));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || `HTTP ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// ── driver authenticated session (phone + password login) ──────
const AUTH_KEY = 'pasarex_driver_auth';
export interface DriverAuth { accessToken: string; driverId?: string; name?: string; phone?: string }
export const driverAuth = {
  get(): DriverAuth | null {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
  },
  set(a: DriverAuth) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); },
  clear() { localStorage.removeItem(AUTH_KEY); },
};

function decodeDriverId(token: string): string | undefined {
  try { return JSON.parse(atob(token.split('.')[1])).driverId; } catch { return undefined; }
}

// authed fetch using the stored driver JWT
async function aj<T>(path: string, init?: RequestInit): Promise<T> {
  const a = driverAuth.get();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(a ? { Authorization: `Bearer ${a.accessToken}` } : {}), ...(init?.headers || {}) },
  });
  if (res.status === 401) { driverAuth.clear(); throw new Error('Session expired'); }
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message || `HTTP ${res.status}`); }
  return res.status === 204 ? (undefined as T) : res.json();
}

export interface DocType {
  key: string; nameEs: string; nameEn: string; required: boolean; tracksExpiry: boolean; sortOrder: number;
}
export interface Zone { slug: string; nameEs: string; nameEn: string; lng: number; lat: number }

export const api = {
  health: () => fetch(`${BASE}/health`).then((r) => r.ok),
  track: (token: string) => j<any>(`/track/${token}`),
  submitRating: (token: string, stars: number, feedback?: string) =>
    j<any>('/ratings', { method: 'POST', body: JSON.stringify({ token, stars, feedback }) }),
  documentTypes: () => j<DocType[]>('/document-types'),
  operatingAreas: () => j<Zone[]>('/operating-areas'),
  create: () => j<{ id: string; reference: string; resumeToken: string }>('/applications', { method: 'POST' }),
  get: (id: string, token: string) => j<any>(`/applications/${id}?token=${encodeURIComponent(token)}`),
  patch: (id: string, token: string, patch: Record<string, any>) =>
    j<any>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ token, patch }) }),
  submit: (id: string, token: string, password?: string) =>
    j<any>(`/applications/${id}/submit`, { method: 'POST', body: JSON.stringify({ token, password }) }),
  uploadDocument: async (id: string, token: string, docKey: string, file: File) => {
    const fd = new FormData();
    fd.append('token', token);
    fd.append('docKey', docKey);
    fd.append('file', file);
    const res = await fetch(`${BASE}/applications/${id}/documents`, { method: 'POST', body: fd });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // ── driver operational (authenticated) ──
  login: async (username: string, password: string): Promise<DriverAuth> => {
    const r = await j<any>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    const a: DriverAuth = { accessToken: r.accessToken, driverId: decodeDriverId(r.accessToken), name: r.user?.fullName, phone: r.user?.phone };
    driverAuth.set(a);
    return a;
  },
  myTenders: () => aj<any[]>('/driver/plan-tenders'),
  acceptTender: (id: string) => aj<any>(`/plan-tenders/${id}/accept`, { method: 'POST' }),
  declineTender: (id: string) => aj<any>(`/plan-tenders/${id}/decline`, { method: 'POST' }),
  myDeliveries: () => aj<any[]>('/driver/deliveries'),
  advanceDelivery: (id: string, status: string) => aj<any>(`/deliveries/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  getProfile: () => aj<any>('/driver/profile'),
  updateProfile: (b: any) => aj<any>('/driver/profile', { method: 'PATCH', body: JSON.stringify(b) }),
  // ── driver documents (re-upload / renew after onboarding) ──
  myDocuments: () => aj<any[]>('/driver/documents'),
  uploadMyDocument: async (docKey: string, file: File, dates?: { issueDate?: string; expiryDate?: string }) => {
    const a = driverAuth.get();
    const fd = new FormData();
    fd.append('docKey', docKey);
    if (dates?.issueDate) fd.append('issueDate', dates.issueDate);
    if (dates?.expiryDate) fd.append('expiryDate', dates.expiryDate);
    fd.append('file', file);
    const res = await fetch(`${BASE}/driver/documents`, {
      method: 'POST',
      headers: a ? { Authorization: `Bearer ${a.accessToken}` } : {},
      body: fd,
    });
    if (res.status === 401) { driverAuth.clear(); throw new Error('Session expired'); }
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.message || `HTTP ${res.status}`); }
    return res.json();
  },
  getDay: (date?: string) => aj<any>(`/driver/day${date ? `?date=${date}` : ''}`),
  dayCheckIn: (b: any) => aj<any>('/driver/day/checkin', { method: 'POST', body: JSON.stringify(b) }),
  dayCheckOut: (b: any) => aj<any>('/driver/day/checkout', { method: 'POST', body: JSON.stringify(b) }),
};

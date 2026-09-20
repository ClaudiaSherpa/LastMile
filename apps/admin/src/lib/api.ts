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
  // staff users + invites (admin)
  listUsers: () => request<any[]>('/users'),
  inviteUser: (phone: string, role: string) => request<any>('/users/invite', { method: 'POST', body: JSON.stringify({ phone, role }) }),
  revokeUser: (id: string) => request<any>(`/users/${id}`, { method: 'DELETE' }),
  getInvite: (token: string) => request<{ phone?: string; role: string }>(`/users/invite/${token}`),
  acceptInvite: (token: string, body: { firstName: string; lastName: string; email?: string; password: string }) =>
    request<any>(`/users/invite/${token}/accept`, { method: 'POST', body: JSON.stringify(body) }),
  overview: () => request<any>('/overview'),
  dashboard: (period: 'day' | 'week' | 'month', groupId?: string, date?: string) =>
    request<any>(`/dashboard?period=${period}${groupId ? `&groupId=${groupId}` : ''}${date ? `&date=${date}` : ''}`),
  drivers: () => request<any[]>('/drivers'),
  driverStats: (id: string) =>
    request<{ driverId: string; assigned: number; delivered: number; pending: number; failed: number }>(
      `/drivers/${id}/delivery-stats`,
    ),
  driverDocuments: (id: string) =>
    request<{
      driverId: string;
      driver: { name?: string; phone?: string; email?: string; address?: string };
      terms: { acceptedAt: string | null; version: string | null };
      documents: { id: string; key: string; name: string; status: string; expiryDate?: string; issueDate?: string; hasFile: boolean }[];
    }>(`/drivers/${id}/documents`),
  driverDayStats: (id: string) => request<any>(`/drivers/${id}/day-stats`),
  driverPlans: (id: string) => request<any[]>(`/drivers/${id}/plans`),
  // document review queue (admin + security officer)
  documentReviews: () => request<any[]>('/document-reviews'),
  documentReviewCount: () => request<{ pending: number }>('/document-reviews/count'),
  approveDocument: (id: string) => request<any>(`/documents/${id}/approve`, { method: 'POST' }),
  rejectDocument: (id: string, reason: string) => request<any>(`/documents/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  // Ops driver record management (admin + security officer)
  getDriver: (id: string) => request<any>(`/drivers/${id}`),
  updateDriver: (id: string, body: Record<string, any>) =>
    request<any>(`/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  applications: () => request<any[]>('/applications'),
  // approvals
  queue: () => request<any[]>('/approvals/queue'),
  approval: (id: string) => request<any>(`/approvals/${id}`),
  // fetch a submitted document's raw file (auth header can't ride an <img src>, so we blob it)
  documentFileBlob: async (id: string, retry = true): Promise<Blob> => {
    const res = await fetch(`${BASE}/documents/${id}/file`, {
      headers: auth.access ? { Authorization: `Bearer ${auth.access}` } : {},
    });
    if (res.status === 401 && retry && auth.refresh && (await tryRefresh())) {
      return api.documentFileBlob(id, false);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  },
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
  zones: () => request<any[]>('/operating-areas'),
  live: () => request<any[]>('/tracking/live'),
  // ── admin config console ──
  cfgDocTypes: () => request<any[]>('/config/document-types'),
  cfgCreateDocType: (b: any) => request<any>('/config/document-types', { method: 'POST', body: JSON.stringify(b) }),
  cfgUpdateDocType: (id: string, b: any) => request<any>(`/config/document-types/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  cfgDeleteDocType: (id: string) => request<any>(`/config/document-types/${id}`, { method: 'DELETE' }),
  cfgTemplates: () => request<any[]>('/config/templates'),
  cfgUpdateTemplate: (id: string, b: any) => request<any>(`/config/templates/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  cfgAreas: () => request<any[]>('/config/operating-areas'),
  cfgUpdateArea: (id: string, b: any) => request<any>(`/config/operating-areas/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  cfgWorkflow: () => request<any>('/config/workflow'),
  cfgUpdateStage: (id: string, b: any) => request<any>(`/config/workflow/stages/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  cfgReorder: (order: string[]) => request<any>('/config/workflow/reorder', { method: 'POST', body: JSON.stringify({ order }) }),
  scoringConfig: () => request<any>('/scoring/config'),
  scoringUpdate: (b: any) => request<any>('/scoring/config', { method: 'POST', body: JSON.stringify(b) }),
  // ── delivery plans ──
  plans: () => request<any[]>('/delivery-plans'),
  plan: (id: string) => request<any>(`/delivery-plans/${id}`),
  eligibleDrivers: () => request<any[]>('/delivery-plans/eligible-drivers'),
  dayPlan: (date?: string) => request<any>(`/delivery-plans/day${date ? `?date=${date}` : ''}`),
  createPlan: (b: any) => request<any>('/delivery-plans', { method: 'POST', body: JSON.stringify(b) }),
  broadcastPlan: (id: string) => request<any>(`/delivery-plans/${id}/broadcast`, { method: 'POST' }),
  rebroadcastPlan: (id: string) => request<any>(`/delivery-plans/${id}/rebroadcast`, { method: 'POST' }),
  // ── WhatsApp (Evolution) ──
  whatsappMessages: () => request<any[]>('/whatsapp/messages'),
  whatsappSend: (to: string, text: string, driverId?: string) =>
    request<any>('/whatsapp/send', { method: 'POST', body: JSON.stringify({ to, text, driverId }) }),
  // messaging + driver groups
  sendDriverMessage: (driverId: string, text: string) =>
    request<any>(`/messages/driver/${driverId}`, { method: 'POST', body: JSON.stringify({ text }) }),
  broadcast: (text: string, groupId?: string) =>
    request<any>('/messages/broadcast', { method: 'POST', body: JSON.stringify({ text, groupId }) }),
  driverGroups: () => request<any[]>('/driver-groups'),
  createGroup: (b: { name: string; color?: string; driverIds?: string[] }) =>
    request<any>('/driver-groups', { method: 'POST', body: JSON.stringify(b) }),
  updateGroup: (id: string, b: { name?: string; color?: string; driverIds?: string[] }) =>
    request<any>(`/driver-groups/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteGroup: (id: string) => request<any>(`/driver-groups/${id}`, { method: 'DELETE' }),
};

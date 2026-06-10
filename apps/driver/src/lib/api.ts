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

export interface DocType {
  key: string; nameEs: string; nameEn: string; required: boolean; tracksExpiry: boolean; sortOrder: number;
}
export interface Zone { slug: string; nameEs: string; nameEn: string; lng: number; lat: number }

export const api = {
  health: () => fetch(`${BASE}/health`).then((r) => r.ok),
  documentTypes: () => j<DocType[]>('/document-types'),
  operatingAreas: () => j<Zone[]>('/operating-areas'),
  create: () => j<{ id: string; reference: string; resumeToken: string }>('/applications', { method: 'POST' }),
  get: (id: string, token: string) => j<any>(`/applications/${id}?token=${encodeURIComponent(token)}`),
  patch: (id: string, token: string, patch: Record<string, any>) =>
    j<any>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ token, patch }) }),
  submit: (id: string, token: string) =>
    j<any>(`/applications/${id}/submit`, { method: 'POST', body: JSON.stringify({ token }) }),
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
};

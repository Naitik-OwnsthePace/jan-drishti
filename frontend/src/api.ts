import type { Report, PressKitData } from './types';
import { getAlignedCivicPhoto } from './utils/civicPhotos';

const API_BASE = 'http://127.0.0.1:8000';

// Client-side in-memory + localStorage cache for instant (0ms) Press & RTI Dossiers
const pressKitMemoryCache: Record<string, PressKitData> = {};
const PRESS_KIT_STORAGE_KEY = 'jandrishti_presskit_cache_v3';

function getStoredPressKit(clusterId: string): PressKitData | null {
  if (pressKitMemoryCache[clusterId]) {
    return pressKitMemoryCache[clusterId];
  }
  try {
    const raw = localStorage.getItem(PRESS_KIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, PressKitData>;
    if (parsed[clusterId]) {
      pressKitMemoryCache[clusterId] = parsed[clusterId];
      return parsed[clusterId];
    }
  } catch {
    // ignore storage parse error
  }
  return null;
}

function saveStoredPressKit(clusterId: string, data: PressKitData) {
  pressKitMemoryCache[clusterId] = data;
  try {
    const raw = localStorage.getItem(PRESS_KIT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PressKitData>) : {};
    parsed[clusterId] = data;
    localStorage.setItem(PRESS_KIT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore quota error
  }
}

export function clearPressKitCache() {
  Object.keys(pressKitMemoryCache).forEach((k) => delete pressKitMemoryCache[k]);
  try {
    localStorage.removeItem(PRESS_KIT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Replace any external stock photo or SVG cartoon with our real local /evidence/*.jpg photos
// while preserving real citizen-uploaded base64 JPEG photos
export function sanitizeReportPhotos(rep: Report): Report {
  const aligned = getAlignedCivicPhoto(rep);
  const isUserUploadedBefore = rep.image_url?.startsWith('data:image/jpeg') || rep.image_url?.startsWith('data:image/png');
  const isUserUploadedAfter = rep.after_image_url?.startsWith('data:image/jpeg') || rep.after_image_url?.startsWith('data:image/png');
  const isLocalEvidenceBefore = rep.image_url?.startsWith('/evidence/');
  const isLocalEvidenceAfter = rep.after_image_url?.startsWith('/evidence/');

  return {
    ...rep,
    is_live_upload: rep.is_live_upload || isUserUploadedBefore,
    image_url: isUserUploadedBefore
      ? rep.image_url
      : isLocalEvidenceBefore
      ? rep.image_url
      : aligned.beforeUrl,
    after_image_url:
      rep.status === 'RESOLVED' || rep.after_image_url
        ? isUserUploadedAfter
          ? rep.after_image_url
          : isLocalEvidenceAfter && rep.after_image_url
          ? rep.after_image_url
          : aligned.afterUrl
        : null,
  };
}

export async function fetchReports(): Promise<Report[]> {
  const res = await fetch(`${API_BASE}/api/reports`);
  if (!res.ok) {
    throw new Error(`Failed to fetch reports: ${res.statusText}`);
  }
  const data: Report[] = await res.json();
  return data.map(sanitizeReportPhotos);
}

export async function resetBackendDemoData(): Promise<Report[]> {
  clearPressKitCache();
  try {
    const res = await fetch(`${API_BASE}/api/demo/reset`, { method: 'POST' });
    if (res.ok) {
      const data: Report[] = await res.json();
      return data.map(sanitizeReportPhotos);
    }
  } catch {
    // fallback to fetchReports
  }
  return fetchReports();
}

export async function submitReport(formData: FormData): Promise<{ report: Report; forensics: any }> {
  const res = await fetch(`${API_BASE}/api/reports/analyze-and-submit`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Truth Engine Analysis Failed');
  }
  const result = await res.json();
  if (result.report) {
    result.report = sanitizeReportPhotos({ ...result.report, is_live_upload: true });
  }
  return result;
}

export async function verifyReport(
  id: string,
  action: 'ESCALATE' | 'REJECT' | 'DISPUTE' | 'MERGE_HOTSPOT'
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/reports/${id}/verify?action=${action}`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    throw new Error(`Verification action failed: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveReport(id: string, file: File): Promise<Report> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/reports/${id}/resolve`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Resolution proof submission failed: ${res.statusText}`);
  }
  const updated = await res.json();
  return sanitizeReportPhotos(updated);
}

export function buildInstantClientPressKit(clusterId: string, allReports: Report[]): PressKitData {
  const matched = allReports.filter(
    (r) => r.cluster_id === clusterId || r.id === clusterId
  );
  const reportsToUse = matched.length > 0 ? matched.map(sanitizeReportPhotos) : allReports.slice(0, 1).map(sanitizeReportPhotos);
  const first = reportsToUse[0];
  const locality = first?.locality || 'Knowledge Park III';
  const category = first?.category || 'Electrical Hazard';
  const maxSeverity = reportsToUse.length > 0 ? Math.max(...reportsToUse.map((r) => r.severity)) : 9.2;
  const avgLat =
    reportsToUse.length > 0
      ? (reportsToUse.reduce((s, r) => s + r.lat, 0) / reportsToUse.length).toFixed(4)
      : '28.4748';
  const avgLng =
    reportsToUse.length > 0
      ? (reportsToUse.reduce((s, r) => s + r.lng, 0) / reportsToUse.length).toFixed(4)
      : '77.4820';

  const brief = `# Investigative Press Brief: Corroborated ${category} Hotspot at ${locality}

## 1. Executive Summary & Public Safety Alert
- **Location:** ${locality}, Greater Noida (${avgLat}°N, ${avgLng}°E)
- **Corroborated Submissions:** ${reportsToUse.length} independent citizen reports within a 200m Haversine radius
- **Assessed Public Safety Risk:** ${maxSeverity}/10
- **Headline Issue:** ${first?.title || 'Unresolved Municipal Infrastructure Hazard'}

## 2. Geo-Forensic & Cryptographic Verification
${reportsToUse
  .map(
    (r, idx) =>
      `${idx + 1}. **Case #${r.id.substring(0, 8)}** — Captured via **${
        r.exif_metadata?.device || 'Verified Citizen Camera'
      }** at ${r.lat.toFixed(4)}°N, ${r.lng.toFixed(4)}°E. SHA-256 Seal: **${r.evidence_hash.substring(0, 24)}...**`
  )
  .join('\n')}

## 3. Statutory Accountability & GNIDA SLA Mandate
- **Responsible Wing:** Greater Noida Industrial Development Authority (GNIDA), Plot No. 01, Knowledge Park-IV (Official Helpline / WhatsApp: **8800203912**)
- **Mandated Action:** Immediate on-site engineering remediation and publication of geo-verified After-photo proof prior to ticket closure.`;

  return {
    cluster_id: clusterId,
    report_count: reportsToUse.length,
    reports: reportsToUse,
    investigative_brief: brief,
  };
}

export async function fetchPressKit(
  clusterId: string,
  fallbackReports: Report[] = []
): Promise<PressKitData> {
  // 1. Check 0ms memory / localStorage cache first
  const cached = getStoredPressKit(clusterId);
  if (cached) {
    return cached;
  }

  // 2. Fetch with 3-second AbortController timeout and immediate client-side fallback
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${API_BASE}/api/clusters/${clusterId}/press-kit`, {
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`Failed to generate press kit: ${res.statusText}`);
    }
    const data: PressKitData = await res.json();
    const sanitized: PressKitData = {
      ...data,
      reports: (data.reports || []).map(sanitizeReportPhotos),
    };
    saveStoredPressKit(clusterId, sanitized);
    return sanitized;
  } catch {
    window.clearTimeout(timer);
    const instant = buildInstantClientPressKit(clusterId, fallbackReports);
    saveStoredPressKit(clusterId, instant);
    return instant;
  }
}

export async function translateToHindi(text: string): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${API_BASE}/api/translate-hindi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) {
      throw new Error('Hindi translation failed');
    }
    const data = await res.json();
    return data.translated || text;
  } catch {
    window.clearTimeout(timer);
    return text;
  }
}

export async function translateBatchToHindi(texts: string[]): Promise<string[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${API_BASE}/api/translate-hindi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) {
      throw new Error('Batch Hindi translation failed');
    }
    const data = await res.json();
    return data.texts || texts;
  } catch {
    window.clearTimeout(timer);
    return texts;
  }
}

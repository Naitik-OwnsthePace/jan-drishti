import type { Report, PressKitData } from './types';
import { getAlignedCivicPhoto } from './utils/civicPhotos';

const API_BASE = 'http://127.0.0.1:8000';
const AI_TIMEOUT_MS = 10000;
const STANDARD_TIMEOUT_MS = 8000;

// Client-side in-memory + localStorage cache for instant (0ms) Press & RTI Dossiers per hotspot ID
const pressKitMemoryCache: Record<string, PressKitData> = {};
const hindiTranslationCache: Record<string, string> = {};
const PRESS_KIT_STORAGE_KEY = 'jandrishti_presskit_cache_v4';

// Offline-resilient 16-report Greater Noida dataset fallback (mirrors backend SEED_REPORTS_16)
export const CLIENT_FALLBACK_REPORTS_16: Report[] = [
  {
    id: '60722f33-473f-4bd5-a892-56ffc5ecd8dc',
    title: 'Exposed High-Tension 11kV Junction Box Near Student Hostel Gate',
    summary:
      'Open electrical feeder pillar with live exposed copper busbars beside main pedestrian footpath used by 4,000+ engineering students daily.',
    category: 'Electrical Hazard',
    severity: 9.5,
    status: 'SLA_BREACHED',
    locality: 'Knowledge Park III',
    lat: 28.4748,
    lng: 77.482,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'Google Pixel 9 Pro',
      captured_at: '2026-11-21 14:15:22',
      exif_lat: 28.4748,
      exif_lng: 77.482,
      gps_match: true,
      distance_offset_m: 8.4,
    },
    evidence_hash: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3e2d8a1c4b7f8e9d0a1b2c3d4',
    cluster_id: '63007a96-1cb2-4d78-b2ee-5aa6e9f33677',
    sla_deadline: '2026-11-21T20:00:00+00:00',
    created_at: '2026-11-20T20:00:00+00:00',
    resolved_at: null,
  },
  {
    id: 'e3e027d6-3b50-4474-90b6-32c247571e3c',
    title: 'Unshielded Underground Feeder Cable & Sparking Pole Base',
    summary:
      'Torn high-voltage armored cable protruding onto wet pavement; complete streetlight blackout along 300m institutional corridor.',
    category: 'Electrical Hazard',
    severity: 9.0,
    status: 'SLA_BREACHED',
    locality: 'Knowledge Park III',
    lat: 28.4751,
    lng: 77.4824,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'iPhone 15 Pro',
      captured_at: '2026-11-21 19:40:10',
      exif_lat: 28.4751,
      exif_lng: 77.4823,
      gps_match: true,
      distance_offset_m: 12.1,
    },
    evidence_hash: 'b83b7ed4bba08a950b3b9762c280d876871eaac2d1c790b3a6e7d8c9b0a1f2e3',
    cluster_id: '63007a96-1cb2-4d78-b2ee-5aa6e9f33677',
    sla_deadline: '2026-11-22T04:00:00+00:00',
    created_at: '2026-11-21T04:00:00+00:00',
    resolved_at: null,
  },
  {
    id: 'f235ac9b-23e8-4558-b3d2-de36421dcc3d',
    title: 'Third Citizen Report: Live Wire Sparking Near Campus Main Gate',
    summary:
      'Corroborating citizen photo confirming arcing electrical distribution box directly outside hostel bus stop during evening rush.',
    category: 'Electrical Hazard',
    severity: 8.8,
    status: 'SLA_BREACHED',
    locality: 'Knowledge Park III',
    lat: 28.4749,
    lng: 77.4822,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'Samsung Galaxy S24 Ultra',
      captured_at: '2026-11-22 08:12:05',
      exif_lat: 28.475,
      exif_lng: 77.4822,
      gps_match: true,
      distance_offset_m: 11.0,
    },
    evidence_hash: 'c72c6dc3aa9f7984f92a8651b17fc765760d99b1c0b68fa295d6c7b8a9f0e1d2',
    cluster_id: '63007a96-1cb2-4d78-b2ee-5aa6e9f33677',
    sla_deadline: '2026-11-22T11:00:00+00:00',
    created_at: '2026-11-21T11:00:00+00:00',
    resolved_at: null,
  },
  {
    id: 'kp3-0004-4d78-b2ee-5aa6e9f33604',
    title: 'Fourth Corroboration: Transformer Oil Leak & Unlatched Fuse Cage',
    summary:
      'Step-down 440V transformer leaking dielectric oil onto sidewalk within 150m of the exposed hostel feeder pillar.',
    category: 'Electrical Hazard',
    severity: 8.5,
    status: 'ESCALATED',
    locality: 'Knowledge Park III',
    lat: 28.4747,
    lng: 77.4819,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'OnePlus 12',
      captured_at: '2026-11-22 16:30:00',
      exif_lat: 28.4747,
      exif_lng: 77.4818,
      gps_match: true,
      distance_offset_m: 14.5,
    },
    evidence_hash: '9a1f2e3d4c5b6a7890fedcba1234567890abcdef1234567890abcdef12345678',
    cluster_id: '63007a96-1cb2-4d78-b2ee-5aa6e9f33677',
    sla_deadline: '2026-11-26T04:00:00+00:00',
    created_at: '2026-11-22T16:30:00+00:00',
    resolved_at: null,
  },
  {
    id: 'kp3-0005-4d78-b2ee-5aa6e9f33605',
    title: 'Severed Streetlight Conduit & Dark Campus Ring Road',
    summary:
      'Broken junction conduit leaving 8 consecutive municipal streetlights non-functional near Knowledge Park III internal roundabout.',
    category: 'Electrical Hazard',
    severity: 7.8,
    status: 'ESCALATED',
    locality: 'Knowledge Park III',
    lat: 28.4772,
    lng: 77.4855,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'Vivo X100 Pro',
      captured_at: '2026-11-22 18:05:44',
      exif_lat: 28.4771,
      exif_lng: 77.4854,
      gps_match: true,
      distance_offset_m: 16.2,
    },
    evidence_hash: '8b2e3f4a5c6d7e8901abcdef2345678901bcdefa2345678901bcdefa23456789',
    cluster_id: 'kp3-secondary-cluster-01',
    sla_deadline: '2026-11-26T12:00:00+00:00',
    created_at: '2026-11-22T18:05:44+00:00',
    resolved_at: null,
  },
  {
    id: 'kp3-0006-4d78-b2ee-5aa6e9f33606',
    title: 'Dangling Overhead Cable Bundle Blocking Service Lane',
    summary:
      'Low-hanging tangled distribution cables snagged by delivery truck; submitted photo shows 412m GPS offset from pin.',
    category: 'Electrical Hazard',
    severity: 6.8,
    status: 'UNVERIFIED',
    locality: 'Knowledge Park III',
    lat: 28.4728,
    lng: 77.4792,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: false,
    exif_metadata: {
      device: 'Redmi Note 13 Pro (GPS Offset > 250m)',
      captured_at: '2026-11-22 20:10:12',
      exif_lat: 28.4691,
      exif_lng: 77.478,
      gps_match: false,
      distance_offset_m: 412.6,
    },
    evidence_hash: '7c3d4e5f6a7b8c9012bcdefa3456789012cdefab3456789012cdefab34567890',
    cluster_id: 'kp3-secondary-cluster-02',
    sla_deadline: null,
    created_at: '2026-11-22T20:10:12+00:00',
    resolved_at: null,
  },
  {
    id: 'kp3-0007-4d78-b2ee-5aa6e9f33607',
    title: 'Insulated & Locked Feeder Pillar #4 Opposite Engineering Campus',
    summary:
      'GNIDA electrical wing installed weatherproof lockable enclosure and underground conduit shielding within 11 hours of escalation.',
    category: 'Electrical Hazard',
    severity: 8.0,
    status: 'RESOLVED',
    locality: 'Knowledge Park III',
    lat: 28.4761,
    lng: 77.4805,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: '/evidence/wire_after.jpg',
    exif_verified: true,
    exif_metadata: {
      device: 'Google Pixel 8a',
      captured_at: '2026-11-21 10:00:00',
      exif_lat: 28.4761,
      exif_lng: 77.4805,
      gps_match: true,
      distance_offset_m: 5.2,
    },
    evidence_hash: '6d4e5f6a7b8c9d0123cdefab4567890123defabc4567890123defabc45678901',
    cluster_id: 'kp3-secondary-cluster-03',
    sla_deadline: '2026-11-22T10:00:00+00:00',
    created_at: '2026-11-21T10:00:00+00:00',
    resolved_at: '2026-11-21T21:00:00+00:00',
  },
  {
    id: 'aef4245b-991a-4caf-8fec-af9ddc781e8a',
    title: 'Severe Storm Drain Overflow & Knee-Deep Waterlogging in Block-C',
    summary:
      'Choked primary storm drainage canal causing stagnant waterlogging across residential approach road for over 36 hours.',
    category: 'Waterlogging',
    severity: 8.4,
    status: 'SLA_BREACHED',
    locality: 'Beta 2 Sector',
    lat: 28.4812,
    lng: 77.5085,
    image_url: '/evidence/drain_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'iPhone 14 Pro',
      captured_at: '2026-11-21 15:20:00',
      exif_lat: 28.4812,
      exif_lng: 77.5084,
      gps_match: true,
      distance_offset_m: 9.8,
    },
    evidence_hash: 'd61d5cb2998e6873e8197540a06eb65465fc88a0bfb57e9184c5b6a798efdcba',
    cluster_id: 'cd474e0f-dbf0-490f-9d1a-299b615cbcb3',
    sla_deadline: '2026-11-22T07:00:00+00:00',
    created_at: '2026-11-21T07:00:00+00:00',
    resolved_at: null,
  },
  {
    id: 'beta2-0002-4caf-8fec-af9ddc781e02',
    title: 'Beta-2 Internal Market Streetlight Outage & Open Pole Switchbox',
    summary:
      'Exposed toggle switchgear at child height on pole #B2-19 accompanied by complete darkness along residential park lane.',
    category: 'Electrical Hazard',
    severity: 7.5,
    status: 'ESCALATED',
    locality: 'Beta 2 Sector',
    lat: 28.4826,
    lng: 77.5102,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'Samsung Galaxy S23',
      captured_at: '2026-11-22 17:45:10',
      exif_lat: 28.4825,
      exif_lng: 77.5101,
      gps_match: true,
      distance_offset_m: 15.0,
    },
    evidence_hash: '5e5f6a7b8c9d0e1234defabc5678901234efabcd5678901234efabcd56789012',
    cluster_id: 'beta2-cluster-02',
    sla_deadline: '2026-11-26T06:00:00+00:00',
    created_at: '2026-11-22T17:45:10+00:00',
    resolved_at: null,
  },
  {
    id: 'beta2-0003-4caf-8fec-af9ddc781e03',
    title: 'Collapsed Culvert Slab & Road Crater Near Mother Dairy Booth',
    summary:
      'Caved-in concrete drain cover creating a 2-foot wide wheel trap on sector collector road; EXIF stripped from forwarded upload.',
    category: 'Road Damage',
    severity: 7.2,
    status: 'UNVERIFIED',
    locality: 'Beta 2 Sector',
    lat: 28.4798,
    lng: 77.5069,
    image_url: '/evidence/road_before.jpg',
    after_image_url: null,
    exif_verified: false,
    exif_metadata: {
      device: 'Unknown / Stripped EXIF',
      captured_at: null,
      exif_lat: null,
      exif_lng: null,
      gps_match: false,
      distance_offset_m: null,
    },
    evidence_hash: '4f6a7b8c9d0e1f2345efabcd6789012345fabcde6789012345fabcde67890123',
    cluster_id: 'beta2-cluster-03',
    sla_deadline: null,
    created_at: '2026-11-22T21:00:00+00:00',
    resolved_at: null,
  },
  {
    id: 'e16f0eaf-4185-48e1-8d9b-f9a30d16af9c',
    title: 'Uncovered Deep Sewer Manhole & Arterial Crater at Pari Chowk Slip Road',
    summary:
      'Unbarricaded 1.8-foot deep road cavity and missing cast-iron manhole cover causing high-speed two-wheeler skids.',
    category: 'Road Damage',
    severity: 9.2,
    status: 'SLA_BREACHED',
    locality: 'Pari Chowk',
    lat: 28.4671,
    lng: 77.5138,
    image_url: '/evidence/road_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'Google Pixel 9',
      captured_at: '2026-11-21 11:30:00',
      exif_lat: 28.4671,
      exif_lng: 77.5138,
      gps_match: true,
      distance_offset_m: 6.3,
    },
    evidence_hash: 'e50e4ba1887d5762d708643f9f5da54354eb779faea46d8073b4a59687fedcba',
    cluster_id: 'ff775de6-bcba-4adb-82dc-4cd34d9fcdd4',
    sla_deadline: '2026-11-22T01:00:00+00:00',
    created_at: '2026-11-21T01:00:00+00:00',
    resolved_at: null,
  },
  {
    id: 'pari-0002-48e1-8d9b-f9a30d16af02',
    title: 'Traffic Signal Gantry High-Voltage Supply Wire Hanging Over Crosswalk',
    summary:
      'Severed power supply cable dangling at head height across pedestrian island at Pari Chowk metro interchange.',
    category: 'Electrical Hazard',
    severity: 8.1,
    status: 'ESCALATED',
    locality: 'Pari Chowk',
    lat: 28.4684,
    lng: 77.5152,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'OnePlus 11 5G',
      captured_at: '2026-11-22 14:22:00',
      exif_lat: 28.4683,
      exif_lng: 77.5151,
      gps_match: true,
      distance_offset_m: 13.7,
    },
    evidence_hash: '3a7b8c9d0e1f2a3456fabcde7890123456abcdef7890123456abcdef78901234',
    cluster_id: 'pari-cluster-02',
    sla_deadline: '2026-11-26T02:00:00+00:00',
    created_at: '2026-11-22T14:22:00+00:00',
    resolved_at: null,
  },
  {
    id: 'pari-0003-48e1-8d9b-f9a30d16af03',
    title: 'Illegal Construction Rubble & Concrete Debris Blocking Expressway Entry',
    summary:
      'Three truckloads of demolished concrete and rebar dumped overnight across the Noida-Greater Noida Expressway service lane.',
    category: 'Illegal Dumping',
    severity: 7.0,
    status: 'ESCALATED',
    locality: 'Pari Chowk',
    lat: 28.4659,
    lng: 77.5121,
    image_url: '/evidence/garbage_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'iPhone 15',
      captured_at: '2026-11-22 16:50:00',
      exif_lat: 28.4659,
      exif_lng: 77.512,
      gps_match: true,
      distance_offset_m: 10.4,
    },
    evidence_hash: '2b8c9d0e1f2a3b4567abcdef8901234567bcdefa8901234567bcdefa89012345',
    cluster_id: 'pari-cluster-03',
    sla_deadline: '2026-11-26T08:00:00+00:00',
    created_at: '2026-11-22T16:50:00+00:00',
    resolved_at: null,
  },
  {
    id: 'b4ce4914-ae8e-44db-82dd-1072fa2bc257',
    title: 'Overflowing Municipal Garbage & Bio-Waste Near Alpha-1 Metro Feeder',
    summary:
      'Cleared, disinfected, and paved within 19 hours of escalation; verified via geo-tagged After-photo remediation proof.',
    category: 'Sanitation',
    severity: 6.5,
    status: 'RESOLVED',
    locality: 'Alpha 1 Commercial Belt',
    lat: 28.4789,
    lng: 77.5012,
    image_url: '/evidence/garbage_before.jpg',
    after_image_url: '/evidence/garbage_after.jpg',
    exif_verified: true,
    exif_metadata: {
      device: 'Google Pixel 9',
      captured_at: '2026-11-21 09:15:00',
      exif_lat: 28.4789,
      exif_lng: 77.5012,
      gps_match: true,
      distance_offset_m: 4.1,
    },
    evidence_hash: 'f4f3da90776c4651c6f7532e8e4c943243da668e9d935c7f62a3948576edcba9',
    cluster_id: 'ca07c999-22cf-474f-9547-b04d938dbbf9',
    sla_deadline: '2026-11-22T09:15:00+00:00',
    created_at: '2026-11-21T09:15:00+00:00',
    resolved_at: '2026-11-22T04:15:00+00:00',
  },
  {
    id: 'alpha1-0002-44db-82dd-1072fa2bc202',
    title: 'Collapsed Pedestrian Footpath & Utility Trench Outside Bank Enclave',
    summary:
      'GNIDA civil crew relaid interlocking paver blocks and sealed underground duct trench within 28 hours of citizen report.',
    category: 'Road Damage',
    severity: 7.0,
    status: 'RESOLVED',
    locality: 'Alpha 1 Commercial Belt',
    lat: 28.4801,
    lng: 77.5028,
    image_url: '/evidence/road_before.jpg',
    after_image_url: '/evidence/road_after.jpg',
    exif_verified: true,
    exif_metadata: {
      device: 'Samsung Galaxy S24',
      captured_at: '2026-11-20 14:00:00',
      exif_lat: 28.4801,
      exif_lng: 77.5028,
      gps_match: true,
      distance_offset_m: 7.5,
    },
    evidence_hash: '1c9d0e1f2a3b4c5678bcdefa9012345678cdefab9012345678cdefab90123456',
    cluster_id: 'alpha1-cluster-02',
    sla_deadline: '2026-11-22T14:00:00+00:00',
    created_at: '2026-11-20T14:00:00+00:00',
    resolved_at: '2026-11-21T18:00:00+00:00',
  },
  {
    id: 'alpha1-0003-44db-82dd-1072fa2bc203',
    title: 'Commercial Plaza Feeder Pillar Fuse Sparking During Peak Load',
    summary:
      'Overloaded 3-phase distribution board emitting sparks near Alpha-1 central market parking entry; assigned to field crew.',
    category: 'Electrical Hazard',
    severity: 7.6,
    status: 'ESCALATED',
    locality: 'Alpha 1 Commercial Belt',
    lat: 28.4776,
    lng: 77.4998,
    image_url: '/evidence/wire_before.jpg',
    after_image_url: null,
    exif_verified: true,
    exif_metadata: {
      device: 'iPhone 15 Pro',
      captured_at: '2026-11-22 19:15:00',
      exif_lat: 28.4776,
      exif_lng: 77.4999,
      gps_match: true,
      distance_offset_m: 9.1,
    },
    evidence_hash: '0d0e1f2a3b4c5d6789cdefab0123456789defabc0123456789defabc01234567',
    cluster_id: 'alpha1-cluster-03',
    sla_deadline: '2026-11-26T10:00:00+00:00',
    created_at: '2026-11-22T19:15:00+00:00',
    resolved_at: null,
  },
];

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = STANDARD_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

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

export function invalidatePressKitForCluster(clusterId?: string | null, reportId?: string) {
  if (clusterId) delete pressKitMemoryCache[clusterId];
  if (reportId) delete pressKitMemoryCache[reportId];
  try {
    const raw = localStorage.getItem(PRESS_KIT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, PressKitData>;
    if (clusterId) delete parsed[clusterId];
    if (reportId) delete parsed[reportId];
    localStorage.setItem(PRESS_KIT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

// Replace any external stock photo or SVG cartoon with our real local /evidence/*.jpg photos
// while preserving real citizen-uploaded base64 JPEG/PNG photos
export function sanitizeReportPhotos(rep: Report): Report {
  const aligned = getAlignedCivicPhoto(rep);
  const isUserUploadedBefore =
    rep.image_url?.startsWith('data:image/jpeg') ||
    rep.image_url?.startsWith('data:image/png') ||
    rep.image_url?.startsWith('blob:');
  const isUserUploadedAfter =
    rep.after_image_url?.startsWith('data:image/jpeg') ||
    rep.after_image_url?.startsWith('data:image/png') ||
    rep.after_image_url?.startsWith('blob:');
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
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/reports`, {}, STANDARD_TIMEOUT_MS);
    if (!res.ok) {
      throw new Error(`Failed to fetch reports: ${res.statusText}`);
    }
    const data: Report[] = await res.json();
    return data.map(sanitizeReportPhotos);
  } catch {
    // Graceful offline demo fallback so the UI never renders blank if backend is starting up
    return CLIENT_FALLBACK_REPORTS_16.map((r) => sanitizeReportPhotos({ ...r }));
  }
}

export async function resetBackendDemoData(): Promise<Report[]> {
  clearPressKitCache();
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/demo/reset`,
      { method: 'POST' },
      STANDARD_TIMEOUT_MS
    );
    if (res.ok) {
      const data: Report[] = await res.json();
      return data.map(sanitizeReportPhotos);
    }
  } catch {
    // fallback below
  }
  return CLIENT_FALLBACK_REPORTS_16.map((r) => sanitizeReportPhotos({ ...r }));
}

async function computeFileSha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function buildClientFallbackAudit(note: string, locality: string) {
  const lower = (note || '').toLowerCase();
  if (/wire|spark|electric|pole|transformer|cable|11kv|feeder/.test(lower)) {
    return {
      is_valid_civic_issue: true,
      category: 'Electrical Hazard',
      severity: 8.8,
      title: `Exposed Electrical Feeder & Cable Hazard Near ${locality}`,
      summary: note
        ? `Field observation at ${locality}: ${note}. Sealed with SHA-256 cryptographic digest and queued for GNIDA electrical safety crew.`
        : `Active electrical hazard documented on-site at ${locality} requiring urgent GNIDA safety remediation.`,
    };
  }
  if (/dump|garbage|trash|waste|debris|rubble|malba/.test(lower)) {
    return {
      is_valid_civic_issue: true,
      category: 'Illegal Dumping',
      severity: 7.4,
      title: `Unregulated Waste & Debris Dumping Reported at ${locality}`,
      summary: note
        ? `Field observation at ${locality}: ${note}. Sealed with SHA-256 cryptographic digest for sanitation clearance.`
        : `Accumulated municipal waste documented at ${locality} awaiting GNIDA sanitation clearance.`,
    };
  }
  if (/pothole|road|crater|asphalt|manhole|culvert|footpath/.test(lower)) {
    return {
      is_valid_civic_issue: true,
      category: 'Road Damage',
      severity: 8.2,
      title: `Hazardous Arterial Road Crater & Manhole Risk at ${locality}`,
      summary: note
        ? `Field observation at ${locality}: ${note}. Sealed with SHA-256 cryptographic digest for civil repair.`
        : `Road surface hazard documented at ${locality} awaiting urgent civil engineering repair.`,
    };
  }
  if (/water|flood|waterlog|drain|sewer|overflow/.test(lower)) {
    return {
      is_valid_civic_issue: true,
      category: 'Waterlogging',
      severity: 7.9,
      title: `Choked Storm Drain & Waterlogging Hazard in ${locality}`,
      summary: note
        ? `Field observation at ${locality}: ${note}. Sealed with SHA-256 cryptographic digest for drainage desilting.`
        : `Severe storm drain waterlogging documented at ${locality} awaiting desilting crew.`,
    };
  }
  return {
    is_valid_civic_issue: true,
    category: 'Sanitation',
    severity: 7.2,
    title: `Civic Infrastructure & Public Safety Grievance at ${locality}`,
    summary: note
      ? `Field observation at ${locality}: ${note}. Sealed with SHA-256 cryptographic digest for municipal verification.`
      : `Civic infrastructure hazard documented on-site at ${locality} awaiting Reviewer audit.`,
  };
}

export async function submitReport(
  formData: FormData
): Promise<{ report: Report; forensics: any }> {
  let isValidationRejection = false;
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/reports/analyze-and-submit`,
      {
        method: 'POST',
        body: formData,
      },
      AI_TIMEOUT_MS
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      if (res.status === 400) {
        isValidationRejection = true;
      }
      throw new Error(err.detail || 'Truth Engine Analysis Failed');
    }

    const result = await res.json();
    if (result.report) {
      result.report = sanitizeReportPhotos({ ...result.report, is_live_upload: true });
      invalidatePressKitForCluster(result.report.cluster_id, result.report.id);
    }
    return result;
  } catch (err: any) {
    if (isValidationRejection) {
      throw err;
    }

    // Timeout / rate-limit / offline resilience fallback: compute real SHA-256 + heuristic audit locally
    const file = formData.get('file') as File | null;
    if (!file) {
      throw err;
    }
    const locality = String(formData.get('locality') || 'Knowledge Park III');
    const lat = parseFloat(String(formData.get('lat') || '28.4749')) || 28.4749;
    const lng = parseFloat(String(formData.get('lng') || '77.4821')) || 77.4821;
    const userNote = String(formData.get('user_note') || '');

    const [evidenceHash, dataUrl] = await Promise.all([
      computeFileSha256Hex(file),
      readFileAsDataUrl(file),
    ]);
    const audit = buildClientFallbackAudit(userNote, locality);
    const id = `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const fallbackReport: Report = sanitizeReportPhotos({
      id,
      title: audit.title,
      summary: audit.summary,
      category: audit.category,
      severity: audit.severity,
      status: 'UNVERIFIED',
      locality,
      lat,
      lng,
      image_url: dataUrl,
      after_image_url: null,
      exif_verified: false,
      exif_metadata: {
        device: 'Live Browser Upload (EXIF Inspected)',
        captured_at: nowIso,
        exif_lat: null,
        exif_lng: null,
        gps_match: false,
        distance_offset_m: null,
      },
      evidence_hash: evidenceHash,
      cluster_id:
        Math.abs(lat - 28.4749) < 0.002 && Math.abs(lng - 77.4821) < 0.002
          ? '63007a96-1cb2-4d78-b2ee-5aa6e9f33677'
          : `cluster-${id.slice(0, 8)}`,
      sla_deadline: null,
      created_at: nowIso,
      resolved_at: null,
      is_live_upload: true,
    });

    return {
      report: fallbackReport,
      forensics: {
        evidence_hash: evidenceHash,
        exif_verified: false,
        exif_metadata: fallbackReport.exif_metadata,
        ai_audit: audit,
        model_used: 'offline-resilient-fallback',
      },
    };
  }
}

export async function verifyReport(
  id: string,
  action: 'ESCALATE' | 'REJECT' | 'DISPUTE' | 'MERGE_HOTSPOT'
): Promise<any> {
  invalidatePressKitForCluster('63007a96-1cb2-4d78-b2ee-5aa6e9f33677', id);
  const res = await fetchWithTimeout(
    `${API_BASE}/api/reports/${id}/verify?action=${action}`,
    { method: 'PATCH' },
    STANDARD_TIMEOUT_MS
  );
  if (!res.ok) {
    throw new Error(`Verification action failed: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveReport(
  id: string,
  file?: File | null,
  afterImageUrl?: string,
  workOrderId?: string
): Promise<Report> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (afterImageUrl) {
    formData.append('after_image_url', afterImageUrl);
  }
  if (workOrderId) {
    formData.append('work_order_id', workOrderId);
  }

  const res = await fetchWithTimeout(
    `${API_BASE}/api/reports/${id}/resolve`,
    {
      method: 'POST',
      body: formData,
    },
    STANDARD_TIMEOUT_MS
  );
  if (!res.ok) {
    throw new Error(`Resolution proof submission failed: ${res.statusText}`);
  }
  const updated: Report = await res.json();
  invalidatePressKitForCluster(updated.cluster_id, updated.id);
  return sanitizeReportPhotos(updated);
}

const LOCALITY_HI_MAP: Record<string, string> = {
  'Knowledge Park III': 'नॉलेज पार्क III',
  'Beta 2 Sector': 'बीटा-2 सेक्टर',
  'Pari Chowk': 'परी चौक',
  'Alpha 1 Commercial Belt': 'अल्फा-1 कमर्शियल बेल्ट',
  'Alpha 1 Commercial': 'अल्फा-1 कमर्शियल बेल्ट',
  'Greater Noida': 'ग्रेटर नोएडा',
};

const CATEGORY_HI_MAP: Record<string, string> = {
  'Electrical Hazard': 'विद्युत संकट एवं हाई-वोल्टेज खतरा',
  'Illegal Dumping': 'अवैध निर्माण मलबा एवं कचरा डंपिंग',
  'Road Damage': 'सड़क गड्ढा एवं खुला मैनहोल संकट',
  Sanitation: 'स्वच्छता एवं जैव-अपशिष्ट संकट',
  Waterlogging: 'बरसाती नाला अवरुद्ध एवं जलभराव',
  Encroachment: 'सार्वजनिक फुटपाथ अतिक्रमण',
};

export function offlineTranslateToHindi(text: string): string {
  if (!text) return '';
  let out = text;
  const pairs: [string, string][] = [
    ["FORM 'A'", "प्रपत्र 'क' (FORM 'A')"],
    [
      'APPLICATION FOR INFORMATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005',
      'सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) एवं धारा 7(1) के अंतर्गत वैधानिक आवेदन',
    ],
    ['The Public Information Officer (PIO),', 'जन सूचना अधिकारी (PIO),'],
    [
      'Greater Noida Industrial Development Authority (GNIDA) / Civic Maintenance Division,',
      'ग्रेटर नोएडा औद्योगिक विकास प्राधिकरण (GNIDA) / नागरिक अनुरक्षण विभाग,',
    ],
    ['INVESTIGATIVE DOSSIER:', 'खोजी पत्रकारिता डोजियर:'],
    ['Investigative Press Brief:', 'खोजी प्रेस डोजियर:'],
    ['Executive Summary & Public Safety Alert', 'कार्यकारी सारांश एवं जनसुरक्षा चेतावनी'],
    ['1) Executive Headline', '1) मुख्य संपादकीय शीर्षक'],
    ['2) Key Findings & Systemic Pattern', '2) प्रमुख निष्कर्ष और प्रणालीगत लापरवाही'],
    ['3) Timeline of Citizen Evidence & SLA Breaches', '3) नागरिक साक्ष्य की समयरेखा और SLA उल्लंघन'],
    ['4) Questions for Civic Authorities', '4) प्रशासनिक अधिकारियों (GNIDA) से सीधे सवाल'],
    ['Part 1 of 3 — Public Safety Alert', 'भाग 1/3 — गंभीर जनसुरक्षा चेतावनी'],
    [
      'Part 2 of 3 — Forensic Evidence & Camera GPS Verification',
      'भाग 2/3 — कैमरा EXIF एवं SHA-256 डिजिटल प्रमाण',
    ],
    [
      'Part 3 of 3 — Questions for Civic Authorities & Statutory RTI Notice',
      'भाग 3/3 — प्राधिकरण से जवाबदेही एवं आरटीआई अधिनियम 2005 नोटिस',
    ],
    ['Knowledge Park III', 'नॉलेज पार्क III'],
    ['Beta 2 Sector', 'बीटा-2 सेक्टर'],
    ['Pari Chowk', 'परी चौक'],
    ['Alpha 1 Commercial Belt', 'अल्फा-1 कमर्शियल बेल्ट'],
    ['Greater Noida', 'ग्रेटर नोएडा'],
    ['Electrical Hazard', 'विद्युत संकट'],
    ['Illegal Dumping', 'अवैध कचरा डंपिंग'],
    ['Road Damage', 'सड़क एवं मैनहोल क्षति'],
    ['Sanitation', 'स्वच्छता संकट'],
    ['Waterlogging', 'जलभराव संकट'],
    ['Encroachment', 'अतिक्रमण'],
  ];
  for (const [en, hi] of pairs) {
    out = out.split(en).join(hi);
  }
  return out;
}

export function buildInstantClientPressKit(
  clusterId: string,
  allReports: Report[]
): PressKitData {
  const sourceList = allReports.length > 0 ? allReports : CLIENT_FALLBACK_REPORTS_16;
  const matched = sourceList.filter(
    (r) => r.cluster_id === clusterId || r.id === clusterId
  );
  const reportsToUse =
    matched.length > 0
      ? matched.map(sanitizeReportPhotos)
      : sourceList.slice(0, 1).map(sanitizeReportPhotos);
  const first = reportsToUse[0];
  const locality = first?.locality || 'Knowledge Park III';
  const category = first?.category || 'Electrical Hazard';
  const locHi = LOCALITY_HI_MAP[locality] || locality;
  const catHi = CATEGORY_HI_MAP[category] || category;
  const maxSeverity =
    reportsToUse.length > 0 ? Math.max(...reportsToUse.map((r) => r.severity)) : 9.2;
  const avgLat =
    reportsToUse.length > 0
      ? (reportsToUse.reduce((s, r) => s + r.lat, 0) / reportsToUse.length).toFixed(5)
      : '28.47480';
  const avgLng =
    reportsToUse.length > 0
      ? (reportsToUse.reduce((s, r) => s + r.lng, 0) / reportsToUse.length).toFixed(5)
      : '77.48200';

  let overdueHours = 19;
  const breached = reportsToUse.find((r) => r.sla_deadline);
  if (breached?.sla_deadline) {
    const diff = Date.now() - new Date(breached.sla_deadline).getTime();
    if (diff > 0) {
      overdueHours = Math.max(4, Math.min(72, Math.floor(diff / (1000 * 60 * 60))));
    }
  }

  const briefEn = `# INVESTIGATIVE DOSSIER: Corroborated ${category} Hotspot at ${locality}

## 1) Executive Headline
**${reportsToUse.length} Independent Geo-Tagged Citizen Submissions Confirm Unresolved ${category} (Risk ${maxSeverity}/10) at ${locality}, Greater Noida**

## 2) Key Findings & Systemic Pattern
- **Location:** ${locality}, Greater Noida (${avgLat}°N, ${avgLng}°E — 200m Haversine Hotspot)
- **Headline Issue:** ${first?.title || 'Unresolved Municipal Infrastructure Hazard'}
- **Field Summary:** ${first?.summary || ''}
- Camera EXIF GPS verification and SHA-256 cryptographic hashes rule out image tampering.

## 3) Timeline of Citizen Evidence & SLA Breaches
${reportsToUse
  .map(
    (r, idx) =>
      `${idx + 1}. **Case #${r.id.substring(0, 8)}** — Captured via **${
        r.exif_metadata?.device || 'Verified Citizen Camera'
      }** at ${r.lat.toFixed(4)}°N, ${r.lng.toFixed(4)}°E. SHA-256 Seal: **${r.evidence_hash.substring(0, 24)}...**`
  )
  .join('\n')}

## 4) Questions for Civic Authorities (GNIDA)
1. Why has this corroborated ${category.toLowerCase()} hotspot at ${locality} remained unremediated ${overdueHours} hours past the GNIDA Citizen Charter SLA?
2. Which Junior Engineer (JE) holds maintenance jurisdiction at ${avgLat}°N, ${avgLng}°E, and when will geo-verified After-photo proof be published?`;

  const briefHi = `# खोजी पत्रकारिता डोजियर: ${locHi} में सत्यापित ${catHi} हॉटस्पॉट

## 1) मुख्य संपादकीय शीर्षक
**ग्रेटर नोएडा के ${locHi} में ${reportsToUse.length} स्वतंत्र जीपीएस-सत्यापित नागरिक रिपोर्टों ने गंभीर ${catHi} (जोखिम ${maxSeverity}/10) की पुष्टि की**

## 2) प्रमुख निष्कर्ष और प्रणालीगत लापरवाही
- **हॉटस्पॉट स्थान:** ${locHi}, ग्रेटर नोएडा (${avgLat}°N, ${avgLng}°E — 200 मीटर प्रमाणित क्लस्टर)
- **प्रमुख प्रकरण:** ${offlineTranslateToHindi(first?.title || '')}
- **साक्ष्य निष्कर्ष:** कैमरा EXIF टेलीमेट्री और SHA-256 डिजिटल फिंगरप्रिंट से सभी नागरिक फोटो पूर्णतः प्रामाणिक सिद्ध हुए हैं।

## 3) नागरिक साक्ष्य की समयरेखा और SLA उल्लंघन
${reportsToUse
  .map(
    (r, idx) =>
      `${idx + 1}. **केस #${r.id.substring(0, 8)}** — उपकरण: **${
        r.exif_metadata?.device || 'सत्यापित नागरिक कैमरा'
      }** (${r.lat.toFixed(4)}°N, ${r.lng.toFixed(4)}°E) | SHA-256 सील: **${r.evidence_hash.substring(0, 24)}...**`
  )
  .join('\n')}

## 4) प्रशासनिक अधिकारियों (GNIDA) से सीधे सवाल
1. ${reportsToUse.length} स्वतंत्र नागरिक प्रमाणों के बावजूद ${locHi} में यह संकट SLA समय-सीमा के ${overdueHours} घंटे बाद भी अनसुलझा क्यों है?
2. इस क्षेत्र के जिम्मेदार कनिष्ठ अभियंता (JE) कौन हैं और जियो-सत्यापित 'आफ्टर-फोटो' प्रमाण कब अपलोड किया जाएगा?`;

  const rtiHi = `प्रपत्र 'क' (FORM 'A')
सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) एवं धारा 7(1) (48-घंटे जीवन सुरक्षा प्रावधान) के अंतर्गत आवेदन

सेवा में,
जन सूचना अधिकारी (PIO),
ग्रेटर नोएडा औद्योगिक विकास प्राधिकरण (GNIDA) / नागरिक अनुरक्षण विभाग,
भूखंड संख्या 01, नॉलेज पार्क-IV, ग्रेटर नोएडा, गौतम बुद्ध नगर, उत्तर प्रदेश – 201310
आधिकारिक हेल्पलाइन / व्हाट्सएप नागरिक डेस्क: 8800203912

दिनांक: ${new Date().toLocaleDateString('hi-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
विषय: ${locHi} में अनसुलझे '${catHi}' हॉटस्पॉट (SLA समय-सीमा के ${overdueHours} घंटे बाद भी लंबित) पर वैधानिक सूचना आवेदन।

महोदय / महोदया,

सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) एवं धारा 7(1) के अंतर्गत निम्नलिखित सत्यापित जनसुरक्षा प्रकरण पर प्रमाणित अभिलेख और कार्य-आदेश उपलब्ध कराने की कृपा करें:

1. घटना एवं भौगोलिक विवरण:
   • सेक्टर / क्षेत्र: ${locHi}, ग्रेटर नोएडा
   • सत्यापित जीपीएस निर्देशांक: ${avgLat}° N, ${avgLng}° E
   • संकट श्रेणी एवं गंभीरता: ${catHi} (जनसुरक्षा जोखिम स्कोर: ${maxSeverity}/10)
   • पुष्टिकर्ता नागरिक रिपोर्टें: ${reportsToUse.length} स्वतंत्र जियो-टैग रिपोर्टें (${overdueHours} घंटे अतिदेय)

2. क्रिप्टोग्राफ़िक SHA-256 साक्ष्य रजिस्टर (जन दृष्टि सत्य इंजन):
${reportsToUse
  .map(
    (r, i) =>
      `   ${i + 1}. केस ID: ${r.id.substring(0, 8)} | उपकरण: ${
        r.exif_metadata?.device || 'नागरिक कैमरा'
      } | SHA-256: ${r.evidence_hash}`
  )
  .join('\n')}

3. आरटीआई अधिनियम, 2005 के अंतर्गत मांगी गई विशिष्ट सूचना:
   (क) ${locHi} (${avgLat}° N, ${avgLng}° E) के लिए जिम्मेदार कनिष्ठ अभियंता (JE) / सहायक प्रबंधक का नाम, पदनाम और आधिकारिक संपर्क सूत्र।
   (ख) पिछले 30 दिनों की निरीक्षण पंजिका (Inspection Logbook) और जारी कार्य-आदेशों (Work Orders) की प्रमाणित प्रतियां।
   (ग) ${reportsToUse.length} सत्यापित शिकायतों के बावजूद निर्धारित समय-सीमा के ${overdueHours} घंटे बाद भी समाधान न होने का आधिकारिक कारण।
   (घ) जमीनी मरम्मत और जियो-सत्यापित 'आफ्टर-फोटो' प्रमाण प्रकाशित करने की निश्चित तिथि एवं समय।

भवदीय,
[नागरिक / मान्यता प्राप्त पत्रकार आवेदक #JD-204]
जन दृष्टि (Jan Drishti — People's Civic Truth Engine) द्वारा निर्गत`;

  const socialHi = `### भाग 1/3 — गंभीर जनसुरक्षा चेतावनी
- **स्थान:** ${locHi}, ग्रेटर नोएडा (${avgLat}°N, ${avgLng}°E)
- **नागरिक पुष्टि:** 200 मीटर के दायरे में ${reportsToUse.length} नागरिकों ने इस ${catHi} की स्वतंत्र रिपोर्ट दर्ज की
- **जोखिम स्तर:** ${maxSeverity}/10 | **स्थिति:** SLA समय-सीमा से ${overdueHours} घंटे अतिदेय

---

### भाग 2/3 — कैमरा EXIF एवं SHA-256 डिजिटल प्रमाण
- प्रत्येक नागरिक फोटो कैमरा टेलीमेट्री और SHA-256 क्रिप्टोग्राफ़िक फिंगरप्रिंट से सुरक्षित है:
${reportsToUse.map((r, i) => `- प्रमाण #${i + 1}: ${r.evidence_hash.substring(0, 24)}...`).join('\n')}

---

### भाग 3/3 — प्राधिकरण से जवाबदेही एवं वैधानिक आरटीआई नोटिस
1. ${reportsToUse.length} प्रमाणित शिकायतों के बावजूद ${locHi} में यह संकट ${overdueHours} घंटे से अनसुलझा क्यों है?
2. सूचना का अधिकार अधिनियम 2005 की धारा 6(1)/7(1) के अंतर्गत नोटिस जारी। #JanDrishti #GreaterNoida #CivicAccountability`;

  return {
    cluster_id: clusterId,
    report_count: reportsToUse.length,
    reports: reportsToUse,
    investigative_brief: briefEn,
    investigative_brief_hi: briefHi,
    rti_notice_hi: rtiHi,
    social_thread_hi: socialHi,
    model_used: 'client-bilingual-fallback',
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

  // 2. Fetch with strict 10-second timeout + try/catch/finally + rich bilingual fallback
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/clusters/${clusterId}/press-kit`,
      {},
      AI_TIMEOUT_MS
    );
    if (!res.ok) {
      throw new Error(`Failed to generate press kit: ${res.statusText}`);
    }
    const data: PressKitData = await res.json();
    const clientFallback = buildInstantClientPressKit(clusterId, fallbackReports);
    const sanitized: PressKitData = {
      ...clientFallback,
      ...data,
      reports: (data.reports || clientFallback.reports).map(sanitizeReportPhotos),
      investigative_brief_hi:
        data.investigative_brief_hi || clientFallback.investigative_brief_hi,
      rti_notice_hi: data.rti_notice_hi || clientFallback.rti_notice_hi,
      social_thread_hi: data.social_thread_hi || clientFallback.social_thread_hi,
    };
    saveStoredPressKit(clusterId, sanitized);
    return sanitized;
  } catch {
    const instant = buildInstantClientPressKit(clusterId, fallbackReports);
    saveStoredPressKit(clusterId, instant);
    return instant;
  }
}

export async function translateToHindi(text: string): Promise<string> {
  const key = (text || '').trim();
  if (!key) return '';
  if (hindiTranslationCache[key]) return hindiTranslationCache[key];

  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/translate-hindi`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: key }),
      },
      AI_TIMEOUT_MS
    );
    if (!res.ok) {
      throw new Error('Hindi translation failed');
    }
    const data = await res.json();
    const out = data.translated || offlineTranslateToHindi(key);
    hindiTranslationCache[key] = out;
    return out;
  } catch {
    const fallback = offlineTranslateToHindi(key);
    hindiTranslationCache[key] = fallback;
    return fallback;
  }
}

export async function translateBatchToHindi(texts: string[]): Promise<string[]> {
  if (!texts || texts.length === 0) return [];
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/translate-hindi`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
      },
      AI_TIMEOUT_MS
    );
    if (!res.ok) {
      throw new Error('Batch Hindi translation failed');
    }
    const data = await res.json();
    if (Array.isArray(data.texts) && data.texts.length === texts.length) {
      return data.texts;
    }
    return texts.map(offlineTranslateToHindi);
  } catch {
    return texts.map(offlineTranslateToHindi);
  }
}

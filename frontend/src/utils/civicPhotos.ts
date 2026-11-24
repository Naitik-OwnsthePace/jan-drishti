// Incident-Specific Photographic Evidence Mapping (/evidence/*.jpg) + Client Canvas JPEG Compression
// Every unique physical incident maps 1-to-1 to its own Before/After pair; only corroborating
// duplicates within the same cluster share that incident's pair. Custom user uploads are never overwritten.

export const LOCAL_EVIDENCE_PHOTOS = {
  wire_cables_before: '/evidence/wire_cables_before.jpg',
  wire_cables_after: '/evidence/wire_cables_after.jpg',
  wire_box_before: '/evidence/wire_box_before.jpg',
  wire_box_after: '/evidence/wire_box_after.jpg',
  wire_streetlight_before: '/evidence/wire_streetlight_before.jpg',
  wire_streetlight_after: '/evidence/wire_streetlight_after.jpg',
  wire_pillar_before: '/evidence/wire_pillar_before.jpg',
  wire_pillar_after: '/evidence/wire_pillar_after.jpg',
  wire_switchbox_before: '/evidence/wire_switchbox_before.jpg',
  wire_switchbox_after: '/evidence/wire_switchbox_after.jpg',
  wire_gantry_before: '/evidence/wire_gantry_before.jpg',
  wire_gantry_after: '/evidence/wire_gantry_after.jpg',
  wire_fuse_before: '/evidence/wire_fuse_before.jpg',
  wire_fuse_after: '/evidence/wire_fuse_after.jpg',
  road_pothole_before: '/evidence/road_pothole_before.jpg',
  road_pothole_after: '/evidence/road_pothole_after.jpg',
  road_footpath_before: '/evidence/road_footpath_before.jpg',
  road_footpath_after: '/evidence/road_footpath_after.jpg',
  drain_overflow_before: '/evidence/drain_overflow_before.jpg',
  drain_overflow_after: '/evidence/drain_overflow_after.jpg',
  drain_manhole_before: '/evidence/drain_manhole_before.jpg',
  drain_manhole_after: '/evidence/drain_manhole_after.jpg',
  garbage_dump_before: '/evidence/garbage_dump_before.jpg',
  garbage_dump_after: '/evidence/garbage_dump_after.jpg',
  garbage_debris_before: '/evidence/garbage_debris_before.jpg',
  garbage_debris_after: '/evidence/garbage_debris_after.jpg',
} as const;

export function isCustomUploadedDataUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith('data:image/') || url.startsWith('blob:');
}

/**
 * Compress any user-uploaded image File on an offscreen HTML5 Canvas
 * (max-width: 900px, JPEG quality: 0.8) and return a persistent Data URL.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxWidth: number = 900,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let targetWidth = img.naturalWidth || img.width || maxWidth;
        let targetHeight = img.naturalHeight || img.height || maxWidth;

        if (targetWidth > maxWidth) {
          const ratio = maxWidth / targetWidth;
          targetWidth = maxWidth;
          targetHeight = Math.max(1, Math.round(targetHeight * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context unavailable');
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);
        resolve(jpegDataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        // Fallback to direct FileReader Data URL if canvas encoding fails
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read uploaded image file'));
        reader.readAsDataURL(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to decode uploaded image file'));
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

interface IncidentPhotoPair {
  beforeUrl: string;
  afterUrl: string;
  sceneLabel: string;
}

const PHOTO_PAIRS: Record<string, IncidentPhotoPair> = {
  wire_box: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_box_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_box_after,
    sceneLabel: '11kV Hostel Gate Junction Box & Transformer Evidence',
  },
  wire_cables: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_cables_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_cables_after,
    sceneLabel: 'Overhead Tangled Electrical Cables Evidence',
  },
  wire_streetlight: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_streetlight_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_streetlight_after,
    sceneLabel: 'Campus Ring Road Streetlight Conduit Evidence',
  },
  wire_pillar: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_pillar_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_pillar_after,
    sceneLabel: 'Feeder Pillar #4 Enclosure Remediation Evidence',
  },
  wire_switchbox: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_switchbox_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_switchbox_after,
    sceneLabel: 'Market Pole Switchbox Safety Evidence',
  },
  wire_gantry: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_gantry_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_gantry_after,
    sceneLabel: 'Traffic Signal Gantry Supply Wire Evidence',
  },
  wire_fuse: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_fuse_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_fuse_after,
    sceneLabel: 'Commercial Plaza 3-Phase Distribution Board Evidence',
  },
  road_pothole: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.road_pothole_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.road_pothole_after,
    sceneLabel: 'Deep Arterial Asphalt Pothole Evidence',
  },
  road_footpath: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.road_footpath_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.road_footpath_after,
    sceneLabel: 'Collapsed Pedestrian Footpath & Curb Evidence',
  },
  drain_overflow: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.drain_overflow_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.drain_overflow_after,
    sceneLabel: 'Overflowing Roadside Storm Drain Evidence',
  },
  drain_manhole: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.drain_manhole_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.drain_manhole_after,
    sceneLabel: 'Uncovered Sewer Manhole & Drain Chamber Evidence',
  },
  garbage_dump: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.garbage_dump_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.garbage_dump_after,
    sceneLabel: 'Uncollected Municipal Garbage Pile Evidence',
  },
  garbage_debris: {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.garbage_debris_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.garbage_debris_after,
    sceneLabel: 'Blocked Expressway Lane Construction Debris Evidence',
  },
};

// Exact seeded Cluster ID & Report ID mapping (ONLY the 4 KP3 corroboration reports share wire_box)
const INCIDENT_PHOTO_MAP: Record<string, IncidentPhotoPair> = {
  // Cluster 63007a96-1cb2-4d78-b2ee-5aa6e9f33677 (4 corroborating reports of same Hostel Gate 11kV box)
  '63007a96-1cb2-4d78-b2ee-5aa6e9f33677': PHOTO_PAIRS.wire_box,
  '60722f33-473f-4bd5-a892-56ffc5ecd8dc': PHOTO_PAIRS.wire_box,
  'e3e027d6-3b50-4474-90b6-32c247571e3c': PHOTO_PAIRS.wire_box,
  'f235ac9b-23e8-4558-b3d2-de36421dcc3d': PHOTO_PAIRS.wire_box,
  'kp3-0004-4d78-b2ee-5aa6e9f33604': PHOTO_PAIRS.wire_box,
  // Distinct KP3 Electrical Incidents
  'kp3-secondary-cluster-01': PHOTO_PAIRS.wire_streetlight,
  'kp3-0005-4d78-b2ee-5aa6e9f33605': PHOTO_PAIRS.wire_streetlight,
  'kp3-secondary-cluster-02': PHOTO_PAIRS.wire_cables,
  'kp3-0006-4d78-b2ee-5aa6e9f33606': PHOTO_PAIRS.wire_cables,
  'kp3-secondary-cluster-03': PHOTO_PAIRS.wire_pillar,
  'kp3-0007-4d78-b2ee-5aa6e9f33607': PHOTO_PAIRS.wire_pillar,
  // Distinct Beta 2 Sector Incidents
  'cd474e0f-dbf0-490f-9d1a-299b615cbcb3': PHOTO_PAIRS.drain_overflow,
  'aef4245b-991a-4caf-8fec-af9ddc781e8a': PHOTO_PAIRS.drain_overflow,
  'beta2-cluster-02': PHOTO_PAIRS.wire_switchbox,
  'beta2-0002-4caf-8fec-af9ddc781e02': PHOTO_PAIRS.wire_switchbox,
  'beta2-cluster-03': PHOTO_PAIRS.drain_manhole,
  'beta2-0003-4caf-8fec-af9ddc781e03': PHOTO_PAIRS.drain_manhole,
  // Distinct Pari Chowk Incidents
  'ff775de6-bcba-4adb-82dc-4cd34d9fcdd4': PHOTO_PAIRS.road_pothole,
  'e16f0eaf-4185-48e1-8d9b-f9a30d16af9c': PHOTO_PAIRS.road_pothole,
  'pari-cluster-02': PHOTO_PAIRS.wire_gantry,
  'pari-0002-48e1-8d9b-f9a30d16af02': PHOTO_PAIRS.wire_gantry,
  'pari-cluster-03': PHOTO_PAIRS.garbage_debris,
  'pari-0003-48e1-8d9b-f9a30d16af03': PHOTO_PAIRS.garbage_debris,
  // Distinct Alpha 1 Commercial Belt Incidents
  'ca07c999-22cf-474f-9547-b04d938dbbf9': PHOTO_PAIRS.garbage_dump,
  'b4ce4914-ae8e-44db-82dd-1072fa2bc257': PHOTO_PAIRS.garbage_dump,
  'alpha1-cluster-02': PHOTO_PAIRS.road_footpath,
  'alpha1-0002-44db-82dd-1072fa2bc202': PHOTO_PAIRS.road_footpath,
  'alpha1-cluster-03': PHOTO_PAIRS.wire_fuse,
  'alpha1-0003-44db-82dd-1072fa2bc203': PHOTO_PAIRS.wire_fuse,
};

export function getAlignedCivicPhoto(report: {
  id?: string;
  cluster_id?: string | null;
  category?: string;
  title?: string;
  summary?: string;
}): IncidentPhotoPair {
  // Priority 1: Exact seeded report ID or corroborated cluster ID mapping
  if (report.id && INCIDENT_PHOTO_MAP[report.id]) {
    return INCIDENT_PHOTO_MAP[report.id];
  }
  if (report.cluster_id && INCIDENT_PHOTO_MAP[report.cluster_id]) {
    return INCIDENT_PHOTO_MAP[report.cluster_id];
  }

  // Priority 2: Sub-incident keyword matching for any newly submitted / dynamic reports
  const cat = (report.category || '').toLowerCase();
  const text = `${report.title || ''} ${report.summary || ''}`.toLowerCase();
  const combined = `${cat} ${text}`;

  if (/\b(manhole|sewer|chamber)\b/.test(combined)) {
    return PHOTO_PAIRS.drain_manhole;
  }
  if (/drain|waterlog|flood|overflow|canal|storm/.test(combined)) {
    return PHOTO_PAIRS.drain_overflow;
  }
  if (/footpath|curb|kerb|sidewalk|paver|trench|enclave/.test(combined)) {
    return PHOTO_PAIRS.road_footpath;
  }
  if (/road|pothole|asphalt|crater|slip road/.test(combined)) {
    return PHOTO_PAIRS.road_pothole;
  }
  if (/debris|rubble|concrete|rebar|alley|malba|illegal dumping/.test(combined)) {
    return PHOTO_PAIRS.garbage_debris;
  }
  if (/garbage|waste|trash|bio-waste|sanitation|bin/.test(combined)) {
    return PHOTO_PAIRS.garbage_dump;
  }
  if (/junction box|11kv|transformer|busbar/.test(combined)) {
    return PHOTO_PAIRS.wire_box;
  }
  if (/streetlight|ring road|conduit|blackout/.test(combined)) {
    return PHOTO_PAIRS.wire_streetlight;
  }
  if (/switchbox|switchgear/.test(combined)) {
    return PHOTO_PAIRS.wire_switchbox;
  }
  if (/gantry|traffic signal|crosswalk/.test(combined)) {
    return PHOTO_PAIRS.wire_gantry;
  }
  if (/fuse|distribution board|3-phase/.test(combined)) {
    return PHOTO_PAIRS.wire_fuse;
  }
  if (/pillar #4|feeder pillar|locked feeder/.test(combined)) {
    return PHOTO_PAIRS.wire_pillar;
  }

  return PHOTO_PAIRS.wire_cables;
}

const VARIED_RESOLUTION_HOURS = ['4h', '11h', '19h', '28h', '36h'] as const;

const REPORT_RESOLUTION_OVERRIDES: Record<string, string> = {
  'kp3-0007-4d78-b2ee-5aa6e9f33607': '11h',
  'b4ce4914-ae8e-44db-82dd-1072fa2bc257': '19h',
  'alpha1-0002-44db-82dd-1072fa2bc202': '28h',
  '60722f33-473f-4bd5-a892-56ffc5ecd8dc': '4h',
  'e3e027d6-3b50-4474-90b6-32c247571e3c': '36h',
  'f235ac9b-23e8-4558-b3d2-de36421dcc3d': '11h',
  'aef4245b-991a-4caf-8fec-af9ddc781e8a': '19h',
  'e16f0eaf-4185-48e1-8d9b-f9a30d16af9c': '28h',
};

export function getResolutionDurationLabel(report: {
  id?: string;
  created_at?: string;
  resolved_at?: string | null;
}): string {
  if (report.id && REPORT_RESOLUTION_OVERRIDES[report.id]) {
    return REPORT_RESOLUTION_OVERRIDES[report.id];
  }
  if (report.created_at && report.resolved_at) {
    const diffMs =
      new Date(report.resolved_at).getTime() - new Date(report.created_at).getTime();
    if (diffMs > 0) {
      const hrs = Math.max(2, Math.round(diffMs / (1000 * 60 * 60)));
      if (hrs <= 60) return `${hrs}h`;
    }
  }
  const idStr = report.id || 'default';
  let sum = 0;
  for (let i = 0; i < idStr.length; i++) {
    sum += idStr.charCodeAt(i);
  }
  return VARIED_RESOLUTION_HOURS[sum % VARIED_RESOLUTION_HOURS.length];
}

const SEED_REPORT_IDS = new Set([
  '60722f33-473f-4bd5-a892-56ffc5ecd8dc',
  'e3e027d6-3b50-4474-90b6-32c247571e3c',
  'f235ac9b-23e8-4558-b3d2-de36421dcc3d',
  'kp3-0004-4d78-b2ee-5aa6e9f33604',
  'kp3-0005-4d78-b2ee-5aa6e9f33605',
  'kp3-0006-4d78-b2ee-5aa6e9f33606',
  'kp3-0007-4d78-b2ee-5aa6e9f33607',
  'aef4245b-991a-4caf-8fec-af9ddc781e8a',
  'beta2-0002-4caf-8fec-af9ddc781e02',
  'beta2-0003-4caf-8fec-af9ddc781e03',
  'e16f0eaf-4185-48e1-8d9b-f9a30d16af9c',
  'pari-0002-48e1-8d9b-f9a30d16af02',
  'pari-0003-48e1-8d9b-f9a30d16af03',
  'b4ce4914-ae8e-44db-82dd-1072fa2bc257',
  'alpha1-0002-44db-82dd-1072fa2bc202',
  'alpha1-0003-44db-82dd-1072fa2bc203',
]);

export function isLiveUserUpload(report: {
  id?: string;
  image_url?: string;
  is_live_upload?: boolean;
}): boolean {
  if (report.is_live_upload) return true;
  if (isCustomUploadedDataUrl(report.image_url)) return true;
  if (report.id && !SEED_REPORT_IDS.has(report.id)) return true;
  return false;
}

export function getEvidenceSourceLabel(report: {
  id?: string;
  image_url?: string;
  is_live_upload?: boolean;
}): 'Live Camera EXIF / GPS' | 'Demo Dataset • GNIDA Grid' {
  return isLiveUserUpload(report)
    ? 'Live Camera EXIF / GPS'
    : 'Demo Dataset • GNIDA Grid';
}

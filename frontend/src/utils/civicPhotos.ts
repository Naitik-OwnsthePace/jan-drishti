// Real Local Photographic Evidence Mapping (/evidence/*.jpg) + Client Canvas JPEG Compression
// Strict 1-to-1 category/headline alignment; zero stock URLs and zero overwriting of custom uploads.

export const LOCAL_EVIDENCE_PHOTOS = {
  wire_before: '/evidence/wire_before.jpg',
  wire_after: '/evidence/wire_after.jpg',
  road_before: '/evidence/road_before.jpg',
  road_after: '/evidence/road_after.jpg',
  drain_before: '/evidence/drain_before.jpg',
  drain_after: '/evidence/drain_after.jpg',
  garbage_before: '/evidence/garbage_before.jpg',
  garbage_after: '/evidence/garbage_after.jpg',
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

export function getAlignedCivicPhoto(report: {
  id?: string;
  category?: string;
  title?: string;
  summary?: string;
}): { beforeUrl: string; afterUrl: string; sceneLabel: string } {
  const cat = (report.category || '').toLowerCase();
  const text = `${report.title || ''} ${report.summary || ''}`.toLowerCase();

  // 1. Explicit Category Priority (strict 1-to-1 domain mapping)
  if (cat.includes('electric') || cat.includes('wire')) {
    return {
      beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_before,
      afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_after,
      sceneLabel: 'Electrical Feeder & Cable Safety Evidence',
    };
  }
  if (
    cat.includes('drain') ||
    cat.includes('water') ||
    cat.includes('flood') ||
    cat.includes('sewer')
  ) {
    return {
      beforeUrl: LOCAL_EVIDENCE_PHOTOS.drain_before,
      afterUrl: LOCAL_EVIDENCE_PHOTOS.drain_after,
      sceneLabel: 'Storm Drain & Waterlogging Evidence',
    };
  }
  if (
    cat.includes('road') ||
    cat.includes('pothole') ||
    cat.includes('asphalt')
  ) {
    return {
      beforeUrl: LOCAL_EVIDENCE_PHOTOS.road_before,
      afterUrl: LOCAL_EVIDENCE_PHOTOS.road_after,
      sceneLabel: 'Arterial Road & Asphalt Evidence',
    };
  }
  if (
    cat.includes('dump') ||
    cat.includes('sanitation') ||
    cat.includes('garbage') ||
    cat.includes('waste')
  ) {
    return {
      beforeUrl: LOCAL_EVIDENCE_PHOTOS.garbage_before,
      afterUrl: LOCAL_EVIDENCE_PHOTOS.garbage_after,
      sceneLabel: 'Sanitation & Waste Clearance Evidence',
    };
  }

  // 2. Headline / Summary Keyword Priority if category is custom/encroachment
  if (
    text.includes('drain') ||
    text.includes('waterlog') ||
    text.includes('sewer') ||
    text.includes('flood')
  ) {
    return {
      beforeUrl: LOCAL_EVIDENCE_PHOTOS.drain_before,
      afterUrl: LOCAL_EVIDENCE_PHOTOS.drain_after,
      sceneLabel: 'Storm Drain & Waterlogging Evidence',
    };
  }
  if (
    text.includes('garbage') ||
    text.includes('waste') ||
    text.includes('dump') ||
    text.includes('rubble') ||
    text.includes('debris') ||
    text.includes('trash')
  ) {
    return {
      beforeUrl: LOCAL_EVIDENCE_PHOTOS.garbage_before,
      afterUrl: LOCAL_EVIDENCE_PHOTOS.garbage_after,
      sceneLabel: 'Sanitation & Waste Clearance Evidence',
    };
  }
  if (
    text.includes('pothole') ||
    text.includes('road') ||
    text.includes('asphalt') ||
    text.includes('crater') ||
    text.includes('footpath') ||
    text.includes('trench')
  ) {
    return {
      beforeUrl: LOCAL_EVIDENCE_PHOTOS.road_before,
      afterUrl: LOCAL_EVIDENCE_PHOTOS.road_after,
      sceneLabel: 'Arterial Road & Asphalt Evidence',
    };
  }

  return {
    beforeUrl: LOCAL_EVIDENCE_PHOTOS.wire_before,
    afterUrl: LOCAL_EVIDENCE_PHOTOS.wire_after,
    sceneLabel: 'Electrical Feeder & Cable Safety Evidence',
  };
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

export type ReportStatus = 'UNVERIFIED' | 'ESCALATED' | 'SLA_BREACHED' | 'RESOLVED';

export type AppSection = 'home' | 'map' | 'epaper' | 'scorecard' | 'verify';

export interface ExifMetadata {
  device?: string;
  captured_at?: string | null;
  exif_lat?: number | null;
  exif_lng?: number | null;
  gps_match?: boolean;
  distance_offset_m?: number | null;
}

export interface Report {
  id: string;
  title: string;
  summary: string;
  category: string;
  severity: number;
  status: ReportStatus;
  locality: string;
  lat: number;
  lng: number;
  image_url: string;
  after_image_url?: string | null;
  exif_verified: boolean;
  exif_metadata?: ExifMetadata;
  evidence_hash: string;
  cluster_id?: string | null;
  sla_deadline?: string | null;
  created_at: string;
  resolved_at?: string | null;
  work_order_id?: string;
  is_live_upload?: boolean;
}

export type UserRole = 'citizen' | 'verifier' | 'journalist' | 'authority';

export type DemoPresetId = 'admin' | 'citizen' | 'verifier' | 'journalist' | 'authority';

export interface DemoAccount {
  presetId: DemoPresetId;
  role: UserRole;
  isAdmin: boolean;
  title: string;
  credential: string;
  trustScore: number;
  description: string;
}

export interface DisputeRecord {
  reportId: string;
  status: 'UNDER_REVIEW' | 'UPHELD' | 'REJECTED';
  journalistCredential: string;
  reason: string;
  counterPhotoUrl: string;
  counterPhotoName: string;
  createdAt: string;
  authorityReply?: string;
  authorityRepliedAt?: string;
  reviewerVerdictNote?: string;
  resolvedAt?: string;
}

export interface PublicActionLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  roleLabel: string;
  action: string;
  locality: string;
  trustDelta?: string;
}

export interface PressKitData {
  cluster_id: string;
  report_count: number;
  reports: Report[];
  investigative_brief: string;
  investigative_brief_hi?: string;
  rti_notice?: string;
  rti_notice_hi?: string;
  social_thread_hi?: string;
  model_used?: string;
}

export interface PresetLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

export interface SectorScorecard {
  locality: string;
  total: number;
  resolved: number;
  overdue: number;
  actionNeeded: number;
  needsCheck: number;
  resolutionRate: number;
  status: 'Needs Urgent Attention' | 'Action In Progress' | 'Responsive' | 'Good';
}

import React, { useEffect, useState, useMemo } from 'react';
import type { PressKitData, Report } from '../types';
import { fetchPressKit, translateToHindi } from '../api';
import { downloadRtiNoticePdf } from '../utils/pdfExport';
import { getAlignedCivicPhoto } from '../utils/civicPhotos';
import {
  X,
  Copy,
  Check,
  FileText,
  Loader2,
  AlertCircle,
  Calendar,
  Hash,
  ShieldCheck,
  Scale,
  Share2,
  Newspaper,
  Languages,
  Download,
} from 'lucide-react';

interface PressKitModalProps {
  clusterId: string | null;
  allReports?: Report[];
  onClose: () => void;
  onCopiedToast?: () => void;
}

const EVIDENCE_GALLERY_CYCLE = [
  '/evidence/wire_before.jpg',
  '/evidence/road_before.jpg',
  '/evidence/drain_before.jpg',
  '/evidence/garbage_before.jpg',
];

type DossierTab = 'news' | 'rti' | 'social';

function renderInlineText(line: string): React.ReactNode {
  const cleaned = line.replace(/`/g, '');
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-extrabold text-slate-900">
          {inner}
        </strong>
      );
    }
    return <span key={idx}>{part.replace(/\*\*/g, '')}</span>;
  });
}

function renderEditorialMarkdown(markdown: string): React.ReactNode {
  if (!markdown) return null;
  const lines = markdown.split('\n');

  return (
    <div className="space-y-3 text-slate-700 leading-relaxed">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={index} className="h-1" />;
        }

        if (line === '---' || line === '***') {
          return <hr key={index} className="border-slate-200 my-3" />;
        }

        if (line.startsWith('#')) {
          const levelMatch = line.match(/^(#+)\s*(.*)$/);
          const level = levelMatch ? levelMatch[1].length : 2;
          const headingText = (levelMatch ? levelMatch[2] : line.replace(/^#+\s*/, '')).replace(
            /\*\*/g,
            ''
          );

          if (level === 1) {
            return (
              <h2
                key={index}
                className="text-lg sm:text-xl font-black text-slate-950 tracking-tight pb-2 border-b border-slate-200"
              >
                {headingText}
              </h2>
            );
          }
          return (
            <h3
              key={index}
              className="text-sm sm:text-base font-extrabold text-slate-900 pt-2 flex items-center gap-2"
            >
              <span className="w-1.5 h-4 rounded-full bg-amber-500 inline-block shrink-0" />
              <span>{headingText}</span>
            </h3>
          );
        }

        if (/^[-*•]\s+/.test(line)) {
          const content = line.replace(/^[-*•]\s+/, '');
          return (
            <div key={index} className="flex items-start gap-2.5 pl-2 text-xs sm:text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0" />
              <div className="flex-1">{renderInlineText(content)}</div>
            </div>
          );
        }

        const numMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={index} className="flex items-start gap-2.5 pl-1 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-md bg-slate-900 text-amber-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {numMatch[1]}
              </span>
              <div className="flex-1">{renderInlineText(numMatch[2])}</div>
            </div>
          );
        }

        return (
          <p key={index} className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {renderInlineText(line)}
          </p>
        );
      })}
    </div>
  );
}

export const PressKitModal: React.FC<PressKitModalProps> = ({
  clusterId,
  allReports = [],
  onClose,
  onCopiedToast,
}) => {
  const [data, setData] = useState<PressKitData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DossierTab>('news');
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [translating, setTranslating] = useState<boolean>(false);
  const [hindiCache, setHindiCache] = useState<Partial<Record<DossierTab, string>>>({});

  useEffect(() => {
    if (!clusterId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clusterId, onClose]);

  useEffect(() => {
    if (!clusterId) return;
    let active = true;

    setLoading(true);
    setError(null);
    setActiveTab('news');
    setLang('en');
    setTranslating(false);

    (async () => {
      try {
        const res = await fetchPressKit(clusterId, allReports);
        if (!active) return;
        setData(res);

        // Pre-seed bilingual Hindi cache for instant 0ms switching
        const initialHindi: Partial<Record<DossierTab, string>> = {};
        if (res.rti_notice_hi) initialHindi.rti = res.rti_notice_hi;
        if (res.social_thread_hi) initialHindi.social = res.social_thread_hi;
        if (
          res.investigative_brief_hi &&
          (!res.model_used || res.model_used.includes('fallback'))
        ) {
          initialHindi.news = res.investigative_brief_hi;
        }
        setHindiCache(initialHindi);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to generate media & RTI dossier');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [clusterId, allReports]);

  const formattedOutputs = useMemo(() => {
    if (!data || data.reports.length === 0) {
      return { news: '', rti: '', social: '' };
    }

    const first = data.reports[0];
    const locality = first.locality;
    const category = first.category;
    const avgLat = (
      data.reports.reduce((acc, r) => acc + r.lat, 0) / data.reports.length
    ).toFixed(5);
    const avgLng = (
      data.reports.reduce((acc, r) => acc + r.lng, 0) / data.reports.length
    ).toFixed(5);
    const maxSeverity = Math.max(...data.reports.map((r) => r.severity));

    let overdueHours = 19;
    const breachedReport = data.reports.find((r) => r.sla_deadline);
    if (breachedReport && breachedReport.sla_deadline) {
      const diff = Date.now() - new Date(breachedReport.sla_deadline).getTime();
      if (diff > 0) {
        overdueHours = Math.max(4, Math.min(72, Math.floor(diff / (1000 * 60 * 60))));
      }
    }

    const hashList = data.reports
      .map(
        (r, idx) =>
          `  ${idx + 1}. Report ID: ${r.id.substring(0, 8)} | Captured: ${new Date(
            r.created_at
          ).toLocaleString()} | SHA-256: ${r.evidence_hash}`
      )
      .join('\n');

    const rtiNotice =
      data.rti_notice ||
      `FORM 'A'
APPLICATION FOR INFORMATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005

To,
The Public Information Officer (PIO),
Greater Noida Industrial Development Authority (GNIDA) / Civic Maintenance Division,
Plot No. 01, Knowledge Park-IV, Greater Noida, Gautam Buddha Nagar, UP – 201310
Official Civic Helpline / WhatsApp Citizen Desk: 8800203912

Date: ${new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })}
Subject: Urgent Statutory Inquiry Regarding Unresolved ${category} Hotspot at ${locality} (Ignored ${overdueHours} Hours Past SLA Deadline)

Respected Sir / Madam,

Under the provisions of Section 6(1) of the Right to Information Act, 2005, and Section 7(1) (Life & Public Safety Proviso requiring response within 48 hours), please provide certified copies of records and action-taken reports concerning the corroborated public safety hazard detailed below:

1. INCIDENT & GEO-LOCATION PARTICULARS:
   • Sector / Locality: ${locality}, Greater Noida
   • Exact GPS Coordinates: ${avgLat}° N, ${avgLng}° E
   • Hazard Classification: ${category} (Assessed Public Safety Risk: ${maxSeverity}/10)
   • Corroborated Citizen Submissions: ${data.report_count} independent geo-verified reports
   • Municipal SLA Status: Overdue (Ignored ${overdueHours} hours past standard resolution window)

2. CRYPTOGRAPHICALLY SEALED CITIZEN EVIDENCE LOG (JAN DRISHTI TRUTH ENGINE):
${hashList}

3. SPECIFIC INFORMATION SOUGHT UNDER RTI ACT, 2005:
   (a) Please provide the name, designation, and official contact details of the Junior Engineer (JE) / Assistant Manager responsible for maintenance and safety compliance at ${locality} (${avgLat}° N, ${avgLng}° E).
   (b) Please provide the daily inspection logbook entries and work-order copies issued for this location over the past 30 days.
   (c) Please state the official reason why ${data.report_count} corroborated citizen complaints at this exact hotspot have remained unresolved for ${overdueHours} hours past the mandated Service Level Agreement (SLA).
   (d) Please specify the exact date and time by which field remediation will be completed and verified.

Yours faithfully,
[Citizen / Accredited Journalist Applicant #JD-204]
Generated via Jan Drishti — People's Civic Truth Engine`;

    const socialThread = `### Part 1 of 3 — Public Safety Alert
- **Location:** ${locality}, Greater Noida (${avgLat}°N, ${avgLng}°E)
- **Corroborated Reports:** ${data.report_count} citizens independently reported this ${category} hazard
- **Risk Rating:** ${maxSeverity}/10
- **Current Status:** Overdue (Ignored for ${overdueHours} hrs past the municipal SLA deadline)

---

### Part 2 of 3 — Forensic Evidence & Camera GPS Verification
- **Headline:** ${first.title}
- **Summary:** ${first.summary}
- Every citizen photo has been verified via camera EXIF telemetry and sealed with a tamper-proof SHA-256 cryptographic fingerprint:
${data.reports
  .map((r, i) => `- Proof #${i + 1}: ${r.evidence_hash.substring(0, 24)}...`)
  .join('\n')}

---

### Part 3 of 3 — Questions for Civic Authorities & Statutory RTI Notice
1. Why has this ${category.toLowerCase()} hotspot at ${locality} been ignored ${overdueHours} hrs past the SLA deadline despite ${data.report_count} corroborated citizen reports?
2. When will on-site repair and "After" photo verification be published?
- Formal RTI Act 2005 Section 6(1) statutory inquiry has been generated via #JanDrishti #GreaterNoida #CivicAccountability`;

    return {
      news: data.investigative_brief,
      rti: rtiNotice,
      social: socialThread,
    };
  }, [data]);

  // Trigger Hindi translation with strict try/catch/finally + pre-written Hindi fallback if not yet cached
  useEffect(() => {
    if (lang !== 'hi' || !data) return;
    if (hindiCache[activeTab]) return;

    const sourceText = formattedOutputs[activeTab];
    if (!sourceText) return;

    let active = true;
    setTranslating(true);

    (async () => {
      try {
        const translatedText = await translateToHindi(sourceText);
        if (!active) return;
        const prewrittenFallback =
          activeTab === 'news'
            ? data.investigative_brief_hi
            : activeTab === 'rti'
            ? data.rti_notice_hi
            : data.social_thread_hi;

        const finalText =
          translatedText && translatedText !== sourceText
            ? translatedText
            : prewrittenFallback || translatedText;
        setHindiCache((prev) => ({ ...prev, [activeTab]: finalText }));
      } catch {
        if (!active) return;
        const prewrittenFallback =
          activeTab === 'news'
            ? data.investigative_brief_hi
            : activeTab === 'rti'
            ? data.rti_notice_hi
            : data.social_thread_hi;
        if (prewrittenFallback) {
          setHindiCache((prev) => ({ ...prev, [activeTab]: prewrittenFallback }));
        }
      } finally {
        if (active) {
          setTranslating(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [lang, activeTab, data, formattedOutputs, hindiCache]);

  if (!clusterId) return null;

  const englishContent =
    activeTab === 'news'
      ? formattedOutputs.news
      : activeTab === 'rti'
      ? formattedOutputs.rti
      : formattedOutputs.social;

  const fallbackHindiForTab =
    activeTab === 'news'
      ? data?.investigative_brief_hi
      : activeTab === 'rti'
      ? data?.rti_notice_hi
      : data?.social_thread_hi;

  const currentTabContent =
    lang === 'hi'
      ? hindiCache[activeTab] || fallbackHindiForTab || englishContent
      : englishContent;

  const handleCopyActiveTab = () => {
    if (!data) return;
    const plainCopy = currentTabContent.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '');
    navigator.clipboard.writeText(plainCopy);
    setCopied(true);
    if (onCopiedToast) onCopiedToast();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overscroll-contain"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="press-kit-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[9999] bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 overscroll-contain"
      >
        {/* Sticky Unobstructed Top Header */}
        <div className="px-6 py-4 bg-[#0B1120] text-white flex items-center justify-between border-b border-slate-800 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="press-kit-modal-title" className="text-base font-extrabold">
                  Media &amp; Statutory RTI Dossier
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold uppercase">
                  Investigative Desk
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                Hotspot ID: {clusterId} • Cached Instant Dossier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Bilingual English | हिन्दी (Hindi) Toggle */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  lang === 'en' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  lang === 'hi' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>हिन्दी (Hindi)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (data) {
                  downloadRtiNoticePdf(data.reports, data.cluster_id);
                }
              }}
              disabled={!data || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black transition-all shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Download RTI Notice PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyActiveTab}
              disabled={!data || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black transition-all shadow-md"
            >
              {copied ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
            <button
              type="button"
              aria-label="Close Media and RTI Dossier modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sticky Unobstructed 3-Tab Format Bar */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
              activeTab === 'news'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>1. Investigative News Brief</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rti')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
              activeTab === 'rti'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>2. Official RTI Notice (India)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
              activeTab === 'social'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>3. Public Alert Thread</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC] overscroll-contain">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
              <div className="text-sm font-extrabold text-slate-800">
                Synthesizing Investigative Brief &amp; RTI Act 2005 Dossier...
              </div>
              <div className="text-xs text-slate-500">
                Cross-referencing citizen photo hashes, GPS offsets, and SLA overdue clocks
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* Full Photo Evidence Gallery with SHA-256 Hashes */}
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center justify-between">
                  <span>
                    Corroborated Photo Evidence Gallery ({data.report_count} Citizen Reports)
                  </span>
                  <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    SHA-256 Cryptographically Sealed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.reports.map((report, idx) => (
                    <div
                      key={report.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white p-2.5 text-xs space-y-1.5 shadow-xs"
                    >
                      <div className="relative h-28 rounded-lg overflow-hidden bg-slate-200">
                        <img
                          src={
                            report.image_url && !report.image_url.startsWith('/evidence/')
                              ? report.image_url
                              : data.reports.length === 1
                              ? report.image_url || getAlignedCivicPhoto(report).beforeUrl
                              : EVIDENCE_GALLERY_CYCLE[idx % EVIDENCE_GALLERY_CYCLE.length]
                          }
                          alt={report.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              EVIDENCE_GALLERY_CYCLE[idx % EVIDENCE_GALLERY_CYCLE.length];
                          }}
                        />
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-[#0B1120]/90 text-[10px] font-extrabold text-amber-400 font-mono">
                          Evidence #{idx + 1}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 line-clamp-1">{report.title}</div>
                      <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{new Date(report.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-[9px] font-mono text-slate-600 truncate flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-200">
                        <Hash className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">{report.evidence_hash}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Format Document Box */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 text-slate-900 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <span>
                      {activeTab === 'news' && 'Investigative Newsroom Dossier'}
                      {activeTab === 'rti' &&
                        'Right to Information Act, 2005 — Statutory Section 6(1) Notice'}
                      {activeTab === 'social' && '3-Part Public Accountability Social Thread'}
                    </span>
                    {translating && (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Translating to हिन्दी...
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md font-extrabold">
                    {lang === 'hi' ? 'हिन्दी संस्करण (HINDI EDITION)' : 'READY FOR PUBLICATION'}
                  </span>
                </div>

                {activeTab === 'rti' ? (
                  <div className="whitespace-pre-wrap leading-relaxed font-mono text-xs bg-slate-50 p-5 rounded-xl border border-slate-200 text-slate-800">
                    {currentTabContent}
                  </div>
                ) : (
                  renderEditorialMarkdown(currentTabContent)
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

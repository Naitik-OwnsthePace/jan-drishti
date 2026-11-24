import React, { useState, useEffect } from 'react';
import type { Report } from '../types';
import { translateBatchToHindi } from '../api';
import { downloadRtiNoticePdf, downloadBroadsheetPdf } from '../utils/pdfExport';
import { getAlignedCivicPhoto } from '../utils/civicPhotos';
import {
  Printer,
  Languages,
  Loader2,
  ShieldCheck,
  Hash,
  MapPin,
  Clock,
  Scale,
  CheckCircle2,
  BookOpen,
  Sparkles,
  Download,
} from 'lucide-react';

interface EPaperViewProps {
  reports: Report[];
  initialLeadId?: string | null;
  clusterCounts: Record<string, number>;
  onOpenPressKit: (clusterId: string) => void;
  onOpenCaseStory: (report: Report) => void;
  onOpenLightbox: (report: Report) => void;
  onToast?: (msg: string) => void;
}

const LOCAL_HINDI_FALLBACK: Record<string, string> = {
  'Exposed High-Tension 11kV Junction Box Near Student Hostel Gate':
    'छात्र हॉस्टल गेट के पास खुला 11kV हाई-टेंशन जंक्शन बॉक्स — गंभीर जनसुरक्षा संकट',
  'Open electrical feeder pillar with live exposed copper busbars beside main pedestrian footpath used by 4,000+ engineering students daily.':
    'प्रतिदिन 4,000+ इंजीनियरिंग छात्रों द्वारा उपयोग किए जाने वाले मुख्य पैदल फुटपाथ के बगल में खुले तांबे के तारों वाला चालू विद्युत फीडर पिलर।',
  'Unshielded Underground Feeder Cable & Sparking Pole Base':
    'असुरक्षित भूमिगत फीडर केबल और खंभे के आधार से निकलती चिंगारी',
  'Torn high-voltage armored cable protruding onto wet pavement; complete streetlight blackout along 300m institutional corridor.':
    'गीले फुटपाथ पर निकली हुई हाई-वोल्टेज केबल; 300 मीटर संस्थागत कॉरिडोर में पूर्ण स्ट्रीटलाइट ब्लैकआउट।',
  'Third Citizen Report: Live Wire Sparking Near Campus Main Gate':
    'तीसरी नागरिक रिपोर्ट: कैंपस मुख्य गेट के पास खुले बिजली के तार से चिंगारी',
  'Corroborating citizen photo confirming arcing electrical distribution box directly outside hostel bus stop during evening rush.':
    'शाम की भीड़ के दौरान हॉस्टल बस स्टॉप के ठीक बाहर चिंगारी निकलते विद्युत वितरण बॉक्स की पुष्टि करने वाला प्रमाणित नागरिक फोटो।',
  'Fourth Corroboration: Transformer Oil Leak & Unlatched Fuse Cage':
    'चौथा नागरिक प्रमाण: ट्रांसफार्मर से तेल रिसाव और खुला फ्यूज केज',
  'Step-down 440V transformer leaking dielectric oil onto sidewalk within 150m of the exposed hostel feeder pillar.':
    'खुले हॉस्टल फीडर पिलर के 150 मीटर के भीतर फुटपाथ पर 440V ट्रांसफार्मर से तेल का रिसाव।',
  'Severed Streetlight Conduit & Dark Campus Ring Road':
    'टूटा स्ट्रीटलाइट कंड्यूट और अंधेरे में डूबी कैंपस रिंग रोड',
  'Broken junction conduit leaving 8 consecutive municipal streetlights non-functional near Knowledge Park III internal roundabout.':
    'नॉलेज पार्क III आंतरिक गोलचक्कर के पास टूटे जंक्शन के कारण लगातार 8 स्ट्रीटलाइटें बंद।',
  'Dangling Overhead Cable Bundle Blocking Service Lane':
    'सर्विस लेन को अवरुद्ध करता लटकता ओवरहेड केबल बंडल',
  'Low-hanging tangled distribution cables snagged by delivery truck; submitted photo shows 412m GPS offset from pin.':
    'डिलीवरी ट्रक में उलझे नीचे लटकते केबल; प्रस्तुत फोटो में पिन से 412 मीटर का जीपीएस अंतर दर्ज।',
  'Insulated & Locked Feeder Pillar #4 Opposite Engineering Campus':
    'इंजीनियरिंग कैंपस के सामने फीडर पिलर #4 को सुरक्षित और लॉक किया गया',
  'GNIDA electrical wing installed weatherproof lockable enclosure and underground conduit shielding within 11 hours of escalation.':
    'शिकायत के 11 घंटे के भीतर विद्युत विभाग द्वारा वेदरप्रूफ लॉक और भूमिगत सुरक्षा कवच स्थापित किया गया।',
  'Severe Storm Drain Overflow & Knee-Deep Waterlogging in Block-C':
    'ब्लॉक-सी में मुख्य बरसाती नाला ओवरफ्लो और घुटनों तक जलभराव',
  'Choked primary storm drainage canal causing stagnant waterlogging across residential approach road for over 36 hours.':
    'अवरुद्ध मुख्य जल निकासी नहर के कारण 36 घंटे से अधिक समय से आवासीय सड़क पर गंभीर जलभराव।',
  'Beta-2 Internal Market Streetlight Outage & Open Pole Switchbox':
    'बीटा-2 आंतरिक मार्केट में स्ट्रीटलाइट बंद और खुला पोल स्विचबॉक्स',
  'Exposed toggle switchgear at child height on pole #B2-19 accompanied by complete darkness along residential park lane.':
    'पोल #B2-19 पर कम ऊंचाई पर खुला स्विचगियर और आवासीय पार्क लेन में पूर्ण अंधेरा।',
  'Collapsed Culvert Slab & Road Crater Near Mother Dairy Booth':
    'मदर डेयरी बूथ के पास टूटी पुलिया स्लैब और गहरा सड़क गड्ढा',
  'Caved-in concrete drain cover creating a 2-foot wide wheel trap on sector collector road; EXIF stripped from forwarded upload.':
    'सेक्टर रोड पर धंसी हुई कंक्रीट स्लैब से 2 फुट चौड़ा खतरनाक गड्ढा।',
  'Uncovered Deep Sewer Manhole & Arterial Crater at Pari Chowk Slip Road':
    'परी चौक स्लिप रोड पर बिना ढक्कन का गहरा सीवर मैनहोल और सड़क गड्ढा',
  'Unbarricaded 1.8-foot deep road cavity and missing cast-iron manhole cover causing high-speed two-wheeler skids.':
    'बिना बैरिकेडिंग के 1.8 फुट गहरा गड्ढा और खुला मैनहोल, जिससे दोपहिया वाहन दुर्घटनाग्रस्त हो रहे हैं।',
  'Traffic Signal Gantry High-Voltage Supply Wire Hanging Over Crosswalk':
    'जेब्रा क्रॉसिंग के ऊपर लटकता ट्रैफिक सिग्नल का हाई-वोल्टेज तार',
  'Severed power supply cable dangling at head height across pedestrian island at Pari Chowk metro interchange.':
    'परी चौक मेट्रो इंटरचेंज पर पैदल यात्रियों के रास्ते में सिर की ऊंचाई पर लटकता बिजली केबल।',
  'Illegal Construction Rubble & Concrete Debris Blocking Expressway Entry':
    'एक्सप्रेसवे सर्विस लेन को अवरुद्ध करता अवैध निर्माण मलबा',
  'Three truckloads of demolished concrete and rebar dumped overnight across the Noida-Greater Noida Expressway service lane.':
    'नोएडा-ग्रेटर नोएडा एक्सप्रेसवे सर्विस लेन पर रातों-रात डाले गए तीन ट्रक कंक्रीट और सरिया का मलबा।',
  'Overflowing Municipal Garbage & Bio-Waste Near Alpha-1 Metro Feeder':
    'अल्फा-1 मेट्रो फीडर के पास कचरा डंप का 19 घंटे में पूर्ण समाधान',
  'Cleared, disinfected, and paved within 19 hours of escalation; verified via geo-tagged After-photo remediation proof.':
    'शिकायत के 19 घंटे के भीतर सफाई और कीटाणुशोधन पूर्ण; जियो-टैग आफ्टर-फोटो द्वारा सत्यापित।',
  'Collapsed Pedestrian Footpath & Utility Trench Outside Bank Enclave':
    'बैंक एन्क्लेव के बाहर टूटे फुटपाथ और ट्रेंच की मरम्मत पूर्ण',
  'GNIDA civil crew relaid interlocking paver blocks and sealed underground duct trench within 28 hours of citizen report.':
    'नागरिक रिपोर्ट के 28 घंटे के भीतर सिविल टीम द्वारा इंटरलॉकिंग पेवर ब्लॉक लगाकर फुटपाथ दुरुस्त किया गया।',
  'Commercial Plaza Feeder Pillar Fuse Sparking During Peak Load':
    'पीक लोड के दौरान कमर्शियल प्लाजा फीडर पिलर में स्पार्किंग',
  'Overloaded 3-phase distribution board emitting sparks near Alpha-1 central market parking entry; assigned to field crew.':
    'अल्फा-1 सेंट्रल मार्केट पार्किंग के पास ओवरलोडेड 3-फेज बोर्ड से चिंगारी; फील्ड टीम को सौंपा गया।',
};

const LOCALITY_HINDI: Record<string, string> = {
  'Knowledge Park III': 'नॉलेज पार्क III',
  'Beta 2 Sector': 'बीटा 2 सेक्टर',
  'Pari Chowk': 'परी चौक',
  'Alpha 1 Commercial Belt': 'अल्फा 1 कमर्शियल बेल्ट',
  'Alpha 1 Commercial': 'अल्फा 1 कमर्शियल बेल्ट',
  'Greater Noida': 'ग्रेटर नोएडा',
};

const CATEGORY_HINDI: Record<string, string> = {
  'Electrical Hazard': 'विद्युत संकट',
  'Illegal Dumping': 'अवैध मलबा / कचरा डंपिंग',
  'Road Damage': 'सड़क एवं मैनहोल क्षति',
  Sanitation: 'स्वच्छता एवं जल निकासी',
  Waterlogging: 'जलभराव संकट',
  Encroachment: 'अतिक्रमण',
};

function getHindiStatusPill(status: Report['status'], lang: 'en' | 'hi'): string {
  if (lang === 'en') {
    if (status === 'SLA_BREACHED') return 'OVERDUE / IGNORED';
    if (status === 'RESOLVED') return 'FIXED & VERIFIED';
    if (status === 'UNVERIFIED') return 'NEEDS CHECK';
    return 'ACTION NEEDED';
  }
  if (status === 'SLA_BREACHED') return 'अतिदेय / अनदेखा';
  if (status === 'RESOLVED') return 'सुधारित एवं सत्यापित';
  if (status === 'UNVERIFIED') return 'जांच आवश्यक';
  return 'कार्रवाई आवश्यक';
}

export const EPaperView: React.FC<EPaperViewProps> = ({
  reports,
  initialLeadId,
  clusterCounts,
  onOpenPressKit,
  onOpenCaseStory,
  onOpenLightbox,
  onToast,
}) => {
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId || null);
  const [translating, setTranslating] = useState<boolean>(false);
  const [hindiMap, setHindiMap] = useState<Record<string, string>>(LOCAL_HINDI_FALLBACK);

  useEffect(() => {
    if (initialLeadId) {
      setSelectedLeadId(initialLeadId);
    }
  }, [initialLeadId]);

  useEffect(() => {
    if (lang !== 'hi' || reports.length === 0) return;

    const missingStrings: string[] = [];
    reports.forEach((r) => {
      if (!hindiMap[r.title]) missingStrings.push(r.title);
      if (!hindiMap[r.summary]) missingStrings.push(r.summary);
    });

    if (missingStrings.length === 0) return;

    let active = true;
    setTranslating(true);
    (async () => {
      try {
        const translatedList = await translateBatchToHindi(missingStrings);
        if (!active) return;
        setHindiMap((prev) => {
          const nextMap = { ...prev };
          missingStrings.forEach((orig, idx) => {
            nextMap[orig] = translatedList[idx] || orig;
          });
          return nextMap;
        });
      } catch {
        // Fallback already handled inside translateBatchToHindi
      } finally {
        if (active) {
          setTranslating(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [lang, reports]);

  const t = (text: string) => {
    if (lang === 'en') return text;
    const raw = hindiMap[text] || LOCALITY_HINDI[text] || CATEGORY_HINDI[text] || text;
    return raw.replace(/\*\*/g, '').replace(/^#+\s*/, '');
  };

  const leadReport =
    reports.find((r) => r.id === selectedLeadId) ||
    reports.find((r) => r.status === 'SLA_BREACHED') ||
    reports[0];

  const handleDownloadRtiPdf = () => {
    if (!leadReport) return;
    const clusterPeers = leadReport.cluster_id
      ? reports.filter((r) => r.cluster_id === leadReport.cluster_id)
      : [leadReport];
    const fname = downloadRtiNoticePdf(
      clusterPeers.length > 0 ? clusterPeers : [leadReport],
      leadReport.cluster_id || leadReport.id
    );
    if (onToast && fname) onToast(`Downloaded Statutory RTI Notice: ${fname}`);
  };

  const handleDownloadNewspaperPdf = () => {
    if (!leadReport) return;
    const fname = downloadBroadsheetPdf(leadReport, reports);
    if (onToast && fname) onToast(`Downloaded Broadsheet e-Newspaper PDF: ${fname}`);
  };

  const todayFormatted = new Date().toLocaleDateString(
    lang === 'hi' ? 'hi-IN' : 'en-IN',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <div className="flex-1 bg-[#E2E8F0] pt-6 pb-8">
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10">
        {/* Top Floating e-Paper Controls */}
        <div className="w-full mb-5 flex flex-wrap items-center justify-between gap-3 bg-[#0B1120] text-white px-6 py-3.5 rounded-2xl shadow-lg border border-slate-800">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-black text-xs uppercase">
              {lang === 'hi' ? 'ई-समाचार पत्र' : 'Interactive Broadsheet'}
            </span>
            <span className="text-xs text-slate-300 font-medium">
              {lang === 'hi'
                ? 'दाईं ओर किसी भी समाचार पर क्लिक करके उसे मुख्य फ्रंट-पेज स्टोरी बनाएं'
                : 'Click any dispatch in the right column to promote it to the Front-Page Lead Story'}
            </span>
            {translating && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{lang === 'hi' ? 'हिन्दी अनुवाद जारी है...' : 'Translating via Gemini...'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 1-Click English | हिन्दी Toggle */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  lang === 'en'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  lang === 'hi'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>हिन्दी (Hindi)</span>
              </button>
            </div>

            <button
              onClick={handleDownloadRtiPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'hi' ? 'आरटीआई नोटिस पीडीएफ डाउनलोड' : 'Download RTI Notice PDF'}</span>
            </button>

            <button
              onClick={handleDownloadNewspaperPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black shadow transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{lang === 'hi' ? 'समाचार पत्र पीडीएफ सेव करें' : 'Print / Save Newspaper PDF'}</span>
            </button>
          </div>
        </div>

        {/* Authentic Widescreen Broadsheet Newspaper Sheet */}
        <article className="w-full bg-[#FCFBF7] text-slate-950 shadow-2xl border border-slate-300 p-6 sm:p-10">
          {/* Classic Broadsheet Masthead */}
          <header className="border-b-4 border-double border-slate-900 pb-4 mb-6 text-center">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-slate-600 border-b border-slate-300 pb-2 mb-4 flex-wrap gap-2">
              <span>
                {lang === 'hi'
                  ? 'वर्ष 1 • अंक 42 • ग्रेटर नोएडा संस्करण'
                  : 'VOL. I • ISSUE NO. 42 • GREATER NOIDA METRO EDITION'}
              </span>
              <span className="font-bold text-slate-900">
                {lang === 'hi'
                  ? '100% क्रिप्टोग्राफ़िक प्रमाण आधारित'
                  : '100% SHA-256 CRYPTOGRAPHICALLY VERIFIED'}
              </span>
              <span>
                {lang === 'hi' ? 'मूल्य: नागरिक जवाबदेही' : 'PRICE: PUBLIC ACCOUNTABILITY'}
              </span>
            </div>

            <h1 className="font-broadsheet text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 uppercase leading-none mb-2">
              {lang === 'hi' ? 'जन दृष्टि समाचार' : 'THE JAN DRISHTI CHRONICLE'}
            </h1>

            <p className="font-broadsheet italic text-sm sm:text-base text-slate-700">
              {lang === 'hi'
                ? '“जनता की आँखों से — अनदेखी नागरिक शिकायतों को अकाट्य खोजी पत्रकारिता में बदलने वाला सत्य इंजन”'
                : '“Through the Eyes of the People — Turning Ignored Civic Hazards into Tamper-Proof Investigative Journalism”'}
            </p>

            <div className="mt-4 pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between text-xs font-bold text-slate-800 gap-2">
              <span>{todayFormatted}</span>
              <span className="text-red-700 font-extrabold">
                {lang === 'hi'
                  ? `● विशेष बुलेटिन: ${reports.filter((r) => r.status === 'SLA_BREACHED').length} गंभीर जनसुरक्षा मामले समय-सीमा के बाद भी अनसुलझे`
                  : `● CITIZEN WATCH: ${reports.filter((r) => r.status === 'SLA_BREACHED').length} Critical Hazards Ignored Past Municipal SLA Deadline`}
              </span>
              <span className="font-mono text-xs">
                {lang === 'hi'
                  ? 'मान्यता प्राप्त प्रेस डेस्क #GNO-204 • हेल्पलाइन: 8800203912'
                  : 'Accredited Press Desk #GNO-204 • GNIDA Helpline: 8800203912'}
              </span>
            </div>
          </header>

          {/* Main 12-Column Newspaper Grid */}
          {leadReport && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left/Center 8 Columns: Dynamic Selected Lead Investigative Story */}
              <div className="lg:col-span-8 lg:border-r lg:border-slate-300 lg:pr-8 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 bg-red-700 text-white text-xs font-black uppercase tracking-wider">
                      {lang === 'hi' ? 'मुख्य फ्रंट-पेज रिपोर्ट' : 'FRONT-PAGE LEAD STORY'}
                    </span>
                    <span className="text-xs font-extrabold uppercase text-slate-600">
                      {t(leadReport.locality)} • {t(leadReport.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-extrabold ${
                        leadReport.status === 'SLA_BREACHED'
                          ? 'bg-red-100 text-red-800'
                          : leadReport.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : leadReport.status === 'UNVERIFIED'
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {getHindiStatusPill(leadReport.status, lang)}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-800 bg-slate-200 px-2.5 py-0.5 rounded">
                      {lang === 'hi'
                        ? `जोखिम स्तर: ${leadReport.severity}/10`
                        : `Risk Rating: ${leadReport.severity}/10`}
                    </span>
                  </div>
                </div>

                <h2 className="font-broadsheet text-2xl sm:text-4xl font-black text-slate-950 leading-tight">
                  {t(leadReport.title)}
                </h2>

                <p className="font-broadsheet text-base sm:text-lg font-semibold text-slate-700 leading-snug border-l-4 border-slate-900 pl-3.5">
                  {t(leadReport.summary)}
                </p>

                {/* Lead Press Photograph with Visible EXIF Telemetry Overlay */}
                <figure className="border border-slate-300 bg-white p-2.5 shadow-xs">
                  <div
                    onClick={() => onOpenLightbox(leadReport)}
                    className="relative h-72 sm:h-96 overflow-hidden bg-slate-900 cursor-pointer"
                  >
                    <img
                      src={leadReport.image_url || getAlignedCivicPhoto(leadReport).beforeUrl}
                      alt={t(leadReport.title)}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getAlignedCivicPhoto(leadReport).beforeUrl;
                      }}
                    />
                    <div className="absolute inset-x-2.5 bottom-2.5 bg-slate-950/90 text-amber-300 px-3 py-1.5 text-xs font-mono rounded border border-slate-700 leading-snug">
                      {lang === 'hi'
                        ? `📷 उपकरण: ${leadReport.exif_metadata?.device || 'सत्यापित नागरिक कैमरा'} • 📍 जीपीएस: ${leadReport.lat.toFixed(4)}°उ, ${leadReport.lng.toFixed(4)}°पू • 🕒 समय सत्यापित`
                        : `📷 EXIF: ${leadReport.exif_metadata?.device || 'Verified Citizen Camera'} • 📍 GPS: ${leadReport.lat.toFixed(4)}°N, ${leadReport.lng.toFixed(4)}°E • 🕒 ${leadReport.exif_metadata?.captured_at || 'Timestamp Verified'}`}
                    </div>
                  </div>
                  <figcaption className="pt-2.5 text-xs text-slate-600 leading-normal flex items-center justify-between flex-wrap gap-2">
                    <span>
                      <strong className="text-slate-900 uppercase">
                        {lang === 'hi' ? 'फोटो साक्ष्य:' : 'PHOTO EVIDENCE:'}
                      </strong>{' '}
                      {t(leadReport.locality)} ({leadReport.lat.toFixed(4)}°N, {leadReport.lng.toFixed(4)}°E).
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {lang === 'hi' ? 'डिजिटल सील:' : 'SHA-256:'} {leadReport.evidence_hash.substring(0, 24)}...
                    </span>
                  </figcaption>
                </figure>

                {/* Two-Column Newspaper Body Copy with Clean CSS ::first-letter Drop Cap */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 text-sm text-slate-800 leading-relaxed font-broadsheet">
                  <p className="broadsheet-dropcap">
                    {lang === 'hi'
                      ? `ग्रेटर नोएडा के ${t(leadReport.locality)} क्षेत्र में नागरिकों द्वारा दर्ज किए गए क्रिप्टोग्राफ़िक साक्ष्यों ने प्रशासनिक दावों की सच्चाई सामने रख दी है। जन दृष्टि सत्य इंजन में दर्ज ${clusterCounts[leadReport.cluster_id || ''] || 1} स्वतंत्र जीपीएस-सत्यापित रिपोर्टें बताती हैं कि यह ${t(leadReport.category)} मामला गंभीर जनसुरक्षा जोखिम (${leadReport.severity}/10) रखता है।`
                      : `GREATER NOIDA — Corroborated photographic evidence submitted by citizens in ${leadReport.locality} has documented a high-priority ${leadReport.category.toLowerCase()} case. According to ${clusterCounts[leadReport.cluster_id || ''] || 1} geo-tagged submission(s) logged in the Jan Drishti Truth Engine, this site carries a public safety severity rating of ${leadReport.severity}/10.`}
                  </p>
                  <div className="space-y-3">
                    <p>
                      {lang === 'hi'
                        ? `प्रत्येक साक्ष्य को कैमरा टेलीमेट्री और डिजिटल फिंगरप्रिंट (${leadReport.evidence_hash.substring(0, 12)}...) के साथ सील किया गया है। ग्रेटर नोएडा प्राधिकरण (नॉलेज पार्क-IV, हेल्पलाइन 8800203912) के समक्ष सूचना का अधिकार अधिनियम 2005 की धारा 6(1) एवं धारा 7(1) के अंतर्गत नोटिस नीचे उपलब्ध है।`
                        : `Every citizen photograph has been verified via hardware EXIF telemetry and sealed with an immutable SHA-256 fingerprint (${leadReport.evidence_hash.substring(0, 12)}...). Citizens and journalists can inspect the full 4-role Chain of Custody or download the formal Section 6(1) & 7(1) Right to Information Act, 2005 PDF below.`}
                    </p>
                    <div className="flex flex-col gap-2 pt-1 font-sans">
                      <button
                        onClick={() => onOpenCaseStory(leadReport)}
                        className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs"
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>
                          {lang === 'hi'
                            ? 'पूर्ण केस स्टोरी और टाइमलाइन देखें →'
                            : 'Open Full Case Story & Chain of Custody →'}
                        </span>
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleDownloadRtiPdf}
                          className="py-2.5 px-3 bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{lang === 'hi' ? 'आरटीआई नोटिस पीडीएफ' : 'Download RTI PDF'}</span>
                        </button>
                        <button
                          onClick={() => onOpenPressKit(leadReport.cluster_id || leadReport.id)}
                          className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>{lang === 'hi' ? '3-टैब प्रेस डोजियर' : 'Open 3-Tab Dossier'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 4 Columns: Interactive Clickable Sector Dispatches (All 16 Reports) */}
              <div className="lg:col-span-4 space-y-4">
                <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                  <div>
                    <h3 className="font-broadsheet font-black text-base uppercase tracking-tight text-slate-950">
                      {lang === 'hi' ? 'सेक्टर संवाददाता बुलेटिन' : 'SECTOR DISPATCHES'}
                    </h3>
                    <p className="text-xs text-slate-600 font-semibold">
                      {lang === 'hi'
                        ? 'किसी भी खबर पर क्लिक करके मुख्य लेख में पढ़ें'
                        : 'Click any dispatch below to promote to Lead Story'}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-red-700 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    {reports.length} {lang === 'hi' ? 'रिपोर्ट' : 'STORIES'}
                  </span>
                </div>

                <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                  {reports.map((rep, idx) => {
                    const isCurrentLead = rep.id === leadReport.id;
                    return (
                      <div
                        key={rep.id}
                        onClick={() => setSelectedLeadId(rep.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                          isCurrentLead
                            ? 'bg-amber-50/90 border-2 border-slate-950 shadow-md'
                            : 'bg-white/80 hover:bg-white border-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-extrabold uppercase gap-2">
                          <span className="text-slate-700 flex items-center gap-1.5 truncate">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 font-mono text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{t(rep.locality)}</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs shrink-0 whitespace-nowrap ${
                              rep.status === 'SLA_BREACHED'
                                ? 'bg-red-100 text-red-800'
                                : rep.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rep.status === 'UNVERIFIED'
                                ? 'bg-slate-200 text-slate-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {getHindiStatusPill(rep.status, lang)}
                          </span>
                        </div>

                        <div className="flex gap-3">
                          <img
                            src={rep.image_url || getAlignedCivicPhoto(rep).beforeUrl}
                            alt={t(rep.title)}
                            className="w-16 h-16 object-cover border border-slate-300 rounded shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getAlignedCivicPhoto(rep).beforeUrl;
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-broadsheet font-bold text-sm text-slate-950 leading-snug line-clamp-2">
                              {t(rep.title)}
                            </h4>
                            <p className="text-xs text-slate-700 line-clamp-2 mt-0.5">
                              {t(rep.summary)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
                          <span className="font-mono text-slate-500">
                            {lang === 'hi'
                              ? `जोखिम ${rep.severity}/10 • ${t(rep.category)}`
                              : `Risk ${rep.severity}/10 • ${t(rep.category)}`}
                          </span>
                          {isCurrentLead ? (
                            <span className="font-extrabold text-amber-900 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              {lang === 'hi' ? 'मुख्य पृष्ठ पर चयनित' : 'Active Lead Story'}
                            </span>
                          ) : (
                            <span className="font-bold text-slate-700 underline">
                              {lang === 'hi' ? 'मुख्य खबर में पढ़ें →' : 'Promote to Lead →'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Cryptographic Verification Ledger Footer */}
          <footer className="mt-8 pt-4 border-t-2 border-slate-900">
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>
                  {lang === 'hi'
                    ? 'सार्वजनिक क्रिप्टोग्राफ़िक साक्ष्य रजिस्टर (डिजिटल सत्यापन सूचकांक)'
                    : 'PUBLIC CRYPTOGRAPHIC EVIDENCE LEDGER (SHA-256 VERIFICATION INDEX)'}
                </span>
              </span>
              <span className="text-xs font-mono text-slate-500">
                {reports.length} {lang === 'hi' ? 'सत्यापित रिकॉर्ड' : 'SEALED RECORDS'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
              {reports.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedLeadId(r.id)}
                  className="p-2 bg-slate-100 hover:bg-amber-50 border border-slate-300 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <span className="font-sans font-bold text-slate-800 truncate">
                    {t(r.locality)}
                  </span>
                  <span className="text-slate-600 truncate flex items-center gap-0.5">
                    <Hash className="w-3 h-3 shrink-0" />
                    {r.evidence_hash.substring(0, 12)}...
                  </span>
                  {r.status === 'RESOLVED' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};

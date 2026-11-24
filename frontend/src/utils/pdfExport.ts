import { jsPDF } from 'jspdf';
import type { Report } from '../types';

export function downloadRtiNoticePdf(reports: Report[], clusterId?: string) {
  if (!reports || reports.length === 0) return;

  const lead = reports[0];
  const localitySlug = lead.locality.replace(/[^a-zA-Z0-9]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `RTI_JanDrishti_${localitySlug}_${dateStr}.pdf`;

  const avgLat = (reports.reduce((acc, r) => acc + r.lat, 0) / reports.length).toFixed(5);
  const avgLng = (reports.reduce((acc, r) => acc + r.lng, 0) / reports.length).toFixed(5);
  const maxSeverity = Math.max(...reports.map((r) => r.severity));
  const isLifeSafetyProviso = maxSeverity >= 8;

  let overdueHours = 19;
  const breached = reports.find((r) => r.sla_deadline);
  if (breached?.sla_deadline) {
    const diff = Date.now() - new Date(breached.sla_deadline).getTime();
    if (diff > 0) {
      overdueHours = Math.max(4, Math.floor(diff / (1000 * 60 * 60)));
    }
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = 46;

  // Header Banner
  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, pageWidth, 84, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('JAN DRISHTI TRUTH ENGINE • STATUTORY PUBLIC ACCOUNTABILITY RECORD', margin, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15.5);
  doc.text("FORM 'A' — RIGHT TO INFORMATION ACT, 2005 (SECTION 6(1) & 7(1))", margin, 48);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Case / Cluster Ref: ${clusterId || lead.id}  |  GNIDA Helpline / WhatsApp: 8800203912  |  Date: ${dateStr}`,
    margin,
    68
  );

  y = 108;
  doc.setTextColor(15, 23, 42);

  const writeLines = (text: string, fontSize = 10.5, isBold = false, lineSpacing = 15) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line: string) => {
      if (y > 780) {
        doc.addPage();
        y = 48;
      }
      doc.text(line, margin, y);
      y += lineSpacing;
    });
  };

  writeLines('To,', 10.5, true);
  writeLines('The Public Information Officer (PIO),', 10.5, true);
  writeLines(
    'Greater Noida Industrial Development Authority (GNIDA) / Civic Maintenance Division,\nPlot No. 01, Knowledge Park-IV, Greater Noida, Gautam Buddha Nagar, UP - 201310\nOfficial Civic Helpline / WhatsApp Citizen Desk: 8800203912',
    10.5,
    false
  );
  y += 8;

  const statutoryClauseText = isLifeSafetyProviso
    ? 'Section 6(1) & Section 7(1) (48-Hour Life & Physical Safety Proviso)'
    : 'Section 6(1) & Section 7(1) (30-Day Standard Statutory Window)';

  writeLines(
    `Subject: Statutory ${statutoryClauseText} Inquiry Regarding Unresolved ${lead.category} Hotspot at ${lead.locality} (Ignored ${overdueHours} Hours Past GNIDA Citizen Charter SLA Deadline)`,
    11,
    true,
    16
  );
  y += 6;

  writeLines('Respected Sir / Madam,', 10.5, false);
  y += 4;
  writeLines(
    `Under Section 6(1) and ${
      isLifeSafetyProviso
        ? 'the 48-hour Life & Physical Safety Proviso of Section 7(1)'
        : 'Section 7(1)'
    } of the Right to Information Act, 2005, please provide certified copies of inspection records, contractor work orders, and accountability logs concerning the corroborated civic hazard detailed below:`,
    10.5,
    false
  );
  y += 8;

  // Section 1 Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 106, 6, 6, 'FD');
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. INCIDENT & GEO-FORENSIC PARTICULARS', margin + 12, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`• Sector / Locality: ${lead.locality}, Greater Noida (GNIDA Knowledge Park-IV Jurisdiction)`, margin + 12, y);
  y += 14;
  doc.text(`• Verified GPS Coordinates: ${avgLat}° N, ${avgLng}° E`, margin + 12, y);
  y += 14;
  doc.text(
    `• Hazard Category & Risk Rating: ${lead.category} (Public Safety Risk Score: ${maxSeverity}/10)`,
    margin + 12,
    y
  );
  y += 14;
  doc.text(
    `• Corroborated Citizen Reports: ${reports.length} independent geo-tagged submissions (Overdue by ${overdueHours} hrs)`,
    margin + 12,
    y
  );
  y += 14;
  doc.text(
    `• Statutory RTI Mandate: ${
      isLifeSafetyProviso
        ? '48-Hour Life & Liberty Proviso (Section 7(1))'
        : '30-Day Standard Statutory Window (Section 7(1))'
    } | Helpline: 8800203912`,
    margin + 12,
    y
  );
  y += 26;

  writeLines('2. CRYPTOGRAPHICALLY SEALED CITIZEN EVIDENCE TIMELINE (SHA-256 LEDGER):', 10.5, true);
  y += 2;

  reports.forEach((rep, idx) => {
    const line1 = `[Report #${idx + 1}] Case ID: ${rep.id.substring(0, 12)} | Captured: ${new Date(
      rep.created_at
    ).toLocaleString('en-IN')} | Device: ${rep.exif_metadata?.device || 'Citizen Camera'}`;
    const line2 = `Headline: ${rep.title}`;
    const line3 = `SHA-256 Seal: ${rep.evidence_hash}`;
    writeLines(line1, 9.5, true, 13);
    writeLines(line2, 9.5, false, 13);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.text(line3, margin, y);
    y += 16;
  });

  y += 6;
  writeLines('3. SPECIFIC INFORMATION SOUGHT UNDER RTI ACT, 2005:', 10.5, true);
  writeLines(
    `(a) Name, designation, and official contact of the Junior Engineer (JE) / Zonal Officer accountable for ${lead.locality} (${avgLat}° N, ${avgLng}° E).`,
    10,
    false
  );
  writeLines(
    `(b) Certified copies of daily inspection logbooks and contractor work orders issued for this location over the past 30 days.`,
    10,
    false
  );
  writeLines(
    `(c) Official recorded reasons why ${reports.length} corroborated citizen complaints have remained unresolved ${overdueHours} hours past the GNIDA Citizen Charter SLA.`,
    10,
    false
  );
  writeLines(
    `(d) Exact scheduled date and time for field remediation and publication of geo-verified After-photo proof.`,
    10,
    false
  );

  y += 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  writeLines(
    'Applicant: Accredited Press & Citizen Accountability Desk (#GNO-204)\nGenerated via Jan Drishti ("Through the Eyes of the People") • Manthankriti 2026 • Delhi Technical Campus',
    9.5,
    true,
    14
  );

  doc.save(filename);
  return filename;
}

export function downloadBroadsheetPdf(lead: Report, allReports: Report[]) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `JanDrishti_Chronicle_Broadsheet_${dateStr}.pdf`;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 48;

  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.text('THE JAN DRISHTI CHRONICLE', pageWidth / 2, y, { align: 'center' });
  y += 16;

  doc.setFont('times', 'italic');
  doc.setFontSize(10.5);
  doc.text(
    '"Through the Eyes of the People — Cryptographically Verified Civic Journalism • Greater Noida Edition"',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 12;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text(
    `FRONT-PAGE LEAD INVESTIGATION • ${lead.locality.toUpperCase()} • RISK ${lead.severity}/10`,
    margin,
    y
  );
  y += 18;

  doc.setTextColor(15, 23, 42);
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(lead.title, contentWidth);
  titleLines.forEach((l: string) => {
    doc.text(l, margin, y);
    y += 20;
  });

  y += 4;
  doc.setFont('times', 'normal');
  doc.setFontSize(11.5);
  const sumLines = doc.splitTextToSize(lead.summary, contentWidth);
  sumLines.forEach((l: string) => {
    doc.text(l, margin, y);
    y += 16;
  });

  y += 8;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(
    `EXIF Device: ${lead.exif_metadata?.device || 'Verified Camera'} | GPS: ${lead.lat.toFixed(4)}N, ${lead.lng.toFixed(4)}E | GNIDA Helpline: 8800203912`,
    margin,
    y
  );
  y += 13;
  doc.text(`SHA-256 Proof Seal: ${lead.evidence_hash}`, margin, y);
  y += 22;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`GREATER NOIDA SECTOR DISPATCHES (${allReports.length} VERIFIED REPORTS)`, margin, y);
  y += 16;

  allReports.slice(0, 10).forEach((rep, idx) => {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(
      `${idx + 1}. [${rep.locality}] ${rep.title} (Risk ${rep.severity}/10 • ${rep.status})`,
      margin,
      y
    );
    y += 13;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`   SHA-256: ${rep.evidence_hash}`, margin, y);
    y += 15;
  });

  doc.save(filename);
  return filename;
}

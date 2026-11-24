import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Report } from '../types';
import { RotateCcw, Moon, Sun, Radio } from 'lucide-react';

interface MapViewProps {
  reports: Report[];
  selectedReportId: string | null;
  hoveredReportId?: string | null;
  onSelectReport: (id: string) => void;
  onOpenCaseStory: (report: Report) => void;
  flyToLocation: { lat: number; lng: number } | null;
}

const DEFAULT_CENTER: [number, number] = [28.4744, 77.5040];
const DEFAULT_ZOOM = 13;

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MapView: React.FC<MapViewProps> = ({
  reports,
  selectedReportId,
  hoveredReportId = null,
  onSelectReport,
  onOpenCaseStory,
  flyToLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const markerByIdRef = useRef<Record<string, { marker: L.Marker; lat: number; lng: number }>>({});
  const circlesRef = useRef<L.Circle[]>([]);

  const [mapStyle, setMapStyle] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const baseLayer = L.tileLayer(OSM_TILES, {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION,
      className: 'dark-map-tiles',
    }).addTo(map);

    mapRef.current = map;
    baseLayerRef.current = baseLayer;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tileContainer = baseLayerRef.current?.getContainer();
    if (tileContainer) {
      if (mapStyle === 'dark') {
        tileContainer.classList.add('dark-map-tiles');
      } else {
        tileContainer.classList.remove('dark-map-tiles');
      }
    }
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedReportId && markerByIdRef.current[selectedReportId]) {
      const target = markerByIdRef.current[selectedReportId];
      mapRef.current.flyTo([target.lat, target.lng], 16, {
        duration: 1.0,
      });
      setTimeout(() => {
        target.marker.openPopup();
      }, 350);
    } else if (flyToLocation) {
      mapRef.current.flyTo([flyToLocation.lat, flyToLocation.lng], 16, {
        duration: 1.0,
      });
    }
  }, [selectedReportId, flyToLocation]);

  const handleResetMap = () => {
    if (mapRef.current) {
      mapRef.current.closePopup();
      mapRef.current.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
        duration: 1.1,
      });
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    markerByIdRef.current = {};
    circlesRef.current.forEach((c) => c.remove());
    circlesRef.current = [];

    const clusterMap: Record<string, Report[]> = {};
    reports.forEach((r) => {
      const key = r.cluster_id || `${r.lat.toFixed(3)}_${r.lng.toFixed(3)}`;
      if (!clusterMap[key]) clusterMap[key] = [];
      clusterMap[key].push(r);
    });

    // Draw translucent 200m radius pulsing red dashed hotspot rings around multi-report clusters
    Object.entries(clusterMap).forEach(([_clusterId, clusterReports]) => {
      if (clusterReports.length >= 2) {
        const avgLat =
          clusterReports.reduce((sum, r) => sum + r.lat, 0) / clusterReports.length;
        const avgLng =
          clusterReports.reduce((sum, r) => sum + r.lng, 0) / clusterReports.length;

        const circle = L.circle([avgLat, avgLng], {
          radius: 200,
          color: '#EF4444',
          fillColor: '#EF4444',
          fillOpacity: mapStyle === 'dark' ? 0.22 : 0.15,
          weight: 2.5,
          dashArray: '6, 6',
        }).addTo(map);

        circle.bindTooltip(
          `<div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 800; color: #DC2626; padding: 2px 6px;">
            🔥 ${clusterReports.length} Citizens Reported Here (200m Corroborated Hotspot)
          </div>`,
          { sticky: true }
        );

        circlesRef.current.push(circle);
      }
    });

    // Apply deterministic ~25m spiral micro-offset so co-located pins inside the 200m cluster never overlap
    const displayCoords: Record<string, { lat: number; lng: number }> = {};
    Object.values(clusterMap).forEach((group) => {
      if (group.length === 1) {
        displayCoords[group[0].id] = { lat: group[0].lat, lng: group[0].lng };
      } else {
        const centerLat = group.reduce((s, r) => s + r.lat, 0) / group.length;
        const centerLng = group.reduce((s, r) => s + r.lng, 0) / group.length;
        const radiusDeg = 0.00055; // ~55m ring inside the 200m dashed circle
        group.forEach((r, idx) => {
          const angle = (2 * Math.PI * idx) / group.length + Math.PI / 4;
          displayCoords[r.id] = {
            lat: centerLat + radiusDeg * Math.sin(angle),
            lng: centerLng + radiusDeg * Math.cos(angle),
          };
        });
      }
    });

    reports.forEach((report, idx) => {
      const isSelected = report.id === selectedReportId || report.id === hoveredReportId;
      const coords = displayCoords[report.id] || { lat: report.lat, lng: report.lng };

      let pinColor = '#94A3B8';
      let glowShadow = '0 0 12px rgba(148, 163, 184, 0.7)';
      let ringClass = '';
      let statusLabel = 'Needs Check';

      if (report.status === 'SLA_BREACHED') {
        pinColor = '#EF4444';
        glowShadow = '0 0 18px rgba(239, 68, 68, 0.95)';
        ringClass = 'beacon-ring-crimson';
        statusLabel = 'Overdue (Ignored)';
      } else if (report.status === 'ESCALATED') {
        pinColor = '#F59E0B';
        glowShadow = '0 0 16px rgba(245, 158, 11, 0.85)';
        ringClass = 'beacon-ring-amber';
        statusLabel = 'Action Needed';
      } else if (report.status === 'RESOLVED') {
        pinColor = '#10B981';
        glowShadow = '0 0 14px rgba(16, 185, 129, 0.8)';
        statusLabel = 'Fixed & Verified';
      }

      const size = isSelected ? 26 : 22;

      const customIcon = L.divIcon({
        className: 'custom-tactical-beacon',
        html: `
          <div class="beacon-wrapper ${ringClass}" style="width: 38px; height: 38px; cursor: pointer;">
            <div style="
              width: ${size}px;
              height: ${size}px;
              background-color: ${pinColor};
              border: 2.5px solid #FFFFFF;
              border-radius: 50%;
              box-shadow: ${glowShadow};
              display: flex;
              align-items: center;
              justify-content: center;
              color: #FFFFFF;
              font-size: 10px;
              font-weight: 900;
              font-family: 'JetBrains Mono', monospace;
              transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
              ${isSelected ? 'transform: scale(1.22); outline: 3px solid #F59E0B;' : ''}
            ">${idx + 1}</div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([coords.lat, coords.lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : idx * 10,
      }).addTo(map);

      const popupHtml = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; width: 255px; padding: 4px;">
          <div style="position: relative; height: 112px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; background: #1E293B;">
            <img src="${report.image_url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />
            <span style="position: absolute; top: 6px; left: 6px; background: rgba(11,17,32,0.92); color: ${pinColor}; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              ● ${statusLabel}
            </span>
            <span style="position: absolute; top: 6px; right: 6px; background: #DC2626; color: #FFFFFF; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">
              Risk ${report.severity}/10
            </span>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(11,17,32,0.88); color: #FCD34D; font-family: monospace; font-size: 9.5px; padding: 2px 6px;">
              📷 ${report.exif_metadata?.device || 'Citizen Camera'} • ${report.lat.toFixed(4)}°N
            </div>
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #FFFFFF; line-height: 1.3; margin-bottom: 4px;">
            ${report.title}
          </div>
          <div style="font-size: 11px; color: #94A3B8; margin-bottom: 6px;">
            📍 ${report.locality} • ${report.category}
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.08); padding: 4px 7px; border-radius: 6px; margin-bottom: 8px; font-family: monospace; font-size: 10px; color: #CBD5E1;">
            <span>SHA-256: ${report.evidence_hash.substring(0, 14)}...</span>
            <button id="btn-copy-hash-${report.id}" style="background: #F59E0B; color: #0B1120; border: none; border-radius: 4px; padding: 1px 6px; font-weight: 800; font-size: 9.5px; cursor: pointer;">
              Copy
            </button>
          </div>
          <button id="btn-case-story-${report.id}" style="
            width: 100%;
            background: linear-gradient(135deg, #F59E0B, #D97706);
            color: #0B1120;
            border: none;
            padding: 8px 10px;
            font-size: 12px;
            font-weight: 900;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);
          ">
            Open Full Case Story →
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 275 });

      marker.on('click', () => {
        onSelectReport(report.id);
        map.flyTo([coords.lat, coords.lng], 16, { duration: 0.9 });
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-case-story-${report.id}`);
        if (btn) {
          btn.onclick = () => onOpenCaseStory(report);
        }
        const copyBtn = document.getElementById(`btn-copy-hash-${report.id}`);
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(report.evidence_hash);
            copyBtn.innerText = 'Copied!';
          };
        }
      });

      markersRef.current.push(marker);
      markerByIdRef.current[report.id] = { marker, lat: coords.lat, lng: coords.lng };
    });
  }, [reports, selectedReportId, hoveredReportId, onSelectReport, onOpenCaseStory, mapStyle]);

  return (
    <div className="relative w-full h-full bg-[#0B1120] overflow-hidden select-none">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top-Left Tactical Telemetry Pill + Live Updated Indicator (z-[450]) */}
      <div className="absolute top-3 left-3 z-[450] flex items-center gap-2.5 bg-[#0B1120]/90 backdrop-blur-md border border-slate-700/80 text-white px-3.5 py-2 rounded-xl shadow-xl">
        <Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
        <div>
          <div className="text-xs font-black tracking-wider uppercase text-slate-100 flex items-center gap-2">
            <span>Greater Noida Live Grid</span>
            <span className="text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
              {reports.length} Active Pins
            </span>
          </div>
          <div className="text-xs text-emerald-400 font-semibold">
            ● Last updated just now • Real-time GPS feed
          </div>
        </div>
      </div>

      {/* Top-Right Map Style Switcher (Dark Tactical / Light Street) + Reset (z-[450]) */}
      <div className="absolute top-3 right-3 z-[450] flex items-center gap-1.5">
        <div className="flex bg-[#0B1120]/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-xl">
          <button
            onClick={() => setMapStyle('dark')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mapStyle === 'dark'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark Tactical</span>
          </button>
          <button
            onClick={() => setMapStyle('light')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mapStyle === 'light'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light Street</span>
          </button>
        </div>

        <button
          onClick={handleResetMap}
          title="Reset Map to Greater Noida Overview"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B1120]/90 hover:bg-slate-800 backdrop-blur-md text-slate-200 border border-slate-700/80 text-xs font-bold shadow-xl transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline">Reset</span>
        </button>
      </div>

      {/* Bottom-Left Tactical Newsroom Legend (z-[450]) */}
      <div className="absolute bottom-4 left-3 z-[450] bg-[#0B1120]/90 backdrop-blur-md border border-slate-700/80 text-slate-100 rounded-2xl p-3.5 shadow-2xl max-w-xs">
        <div className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2">
          Civic Accountability Beacons (Click Any Pin)
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#EF4444] shadow-[0_0_8px_#EF4444] animate-pulse shrink-0"></span>
            <span className="text-slate-200">Overdue (Ignored)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B] shrink-0"></span>
            <span className="text-slate-200">Action Needed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] shrink-0"></span>
            <span className="text-slate-200">Fixed &amp; Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#94A3B8] shrink-0"></span>
            <span className="text-slate-300">Needs Check</span>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2 text-xs text-red-400 font-bold">
          <span className="w-3.5 h-3.5 rounded-full border border-dashed border-red-400 bg-red-500/20 inline-block shrink-0"></span>
          <span>200m Dashed Ring = 4-Citizen Hotspot</span>
        </div>
      </div>
    </div>
  );
};

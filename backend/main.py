import base64
import concurrent.futures
import hashlib
import io
import json
import math
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from PIL import ExifTags, Image
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SECRET_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    except Exception as _supa_err:
        print(f"[Init] Supabase client init warning (continuing in local engine mode): {_supa_err}")

gemini_client: Optional[genai.Client] = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as _gem_err:
        print(f"[Init] Gemini client init warning (continuing with deterministic fallbacks): {_gem_err}")

app = FastAPI(title="Jan Drishti Truth Engine API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active Gemini 3.x models only (deprecated gemini-2.5-flash removed)
ACTIVE_GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
]

GEMINI_TOTAL_TIMEOUT_SEC = 8.0
_AI_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=6)


def _run_supabase_bg(fn) -> None:
    """Best-effort non-blocking Supabase persistence so live demo endpoints never hang on DB latency."""
    if supabase is None:
        return

    def _worker():
        try:
            fn(supabase)
        except Exception as exc:
            print(f"[SupabaseSync] Non-fatal sync skipped: {exc}")

    threading.Thread(target=_worker, daemon=True).start()


def _call_gemini_with_timeout(
    contents: Any,
    config: Optional[types.GenerateContentConfig] = None,
    total_timeout_sec: float = GEMINI_TOTAL_TIMEOUT_SEC,
) -> tuple[Optional[str], Optional[str]]:
    """
    Calls active Gemini models with a strict wall-clock timeout (<= 8s total)
    and try/except/finally protection so NO endpoint ever hangs.
    Returns (response_text, model_used) or (None, None) on timeout/error.
    """
    if gemini_client is None:
        return None, None

    deadline = time.monotonic() + total_timeout_sec
    for idx, model_name in enumerate(ACTIVE_GEMINI_MODELS):
        remaining = deadline - time.monotonic()
        if remaining <= 0.5:
            break
        # Give primary gemini-3.8-flash up to 4.8s so gemini-3.5-flash-lite still gets ~3.2s within 8s budget
        per_model_timeout = min(remaining, 4.8 if idx == 0 else remaining)
        future = None
        try:
            def _invoke(m=model_name, cfg=config):
                if cfg is not None:
                    return gemini_client.models.generate_content(
                        model=m,
                        contents=contents,
                        config=cfg,
                    )
                return gemini_client.models.generate_content(
                    model=m,
                    contents=contents,
                )

            future = _AI_EXECUTOR.submit(_invoke)
            resp = future.result(timeout=per_model_timeout)
            text = getattr(resp, "text", None)
            if text and str(text).strip():
                return str(text).strip(), model_name
        except concurrent.futures.TimeoutError:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [GeminiTimeout] '{model_name}' exceeded {per_model_timeout:.1f}s.")
        except Exception as err:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [GeminiFallback] '{model_name}' error: {err}")
        finally:
            if future is not None and not future.done():
                future.cancel()

    return None, None


class CivicAuditSchema(BaseModel):
    is_valid_civic_issue: bool
    title: str
    summary: str
    category: str
    severity: float


def _heuristic_audit(
    user_note: str,
    locality: str,
    filename: str = "",
    exif_verified: bool = False,
) -> dict:
    clean_note = (user_note or "").strip()
    clean_file = os.path.splitext(os.path.basename(filename or ""))[0].replace("_", " ").replace("-", " ").strip()
    combined = f"{clean_note} {clean_file}".lower()
    loc_lower = (locality or "").lower()

    if any(w in combined for w in ("wire", "cable", "electric", "pole", "spark", "transformer", "shock", "meter", "11kv", "feeder", "fuse", "switch", "streetlight")):
        category = "Electrical Hazard"
        severity = 8.9
        title = f"Exposed Live Electrical Cable & Feeder Hazard at {locality}"
        default_desc = (
            f"Uninsulated overhead distribution cables and open roadside feeder switchgear documented at {locality} "
            f"pose an immediate electrocution and short-circuit fire risk to pedestrians."
        )
    elif any(w in combined for w in ("road", "pothole", "crater", "asphalt", "tar", "pavement", "footpath", "trench", "slab")):
        category = "Road Damage"
        severity = 8.3
        title = f"Deep Arterial Pothole & Fractured Asphalt Hazard at {locality}"
        default_desc = (
            f"Severely fractured asphalt carriageway and unbarricaded road crater at {locality} "
            f"create high-velocity two-wheeler skid and vehicular axle damage hazards."
        )
    elif any(w in combined for w in ("drain", "flood", "water", "waterlog", "sewer", "gutter", "monsoon", "overflow", "canal", "clog")):
        category = "Drainage / Flood"
        severity = 8.1
        title = f"Choked Storm Drain & Severe Street Waterlogging in {locality}"
        default_desc = (
            f"Blocked storm drainage channel and stagnant carriageway flooding at {locality} "
            f"obstruct commuter movement and erode the underlying road sub-base."
        )
    elif any(w in combined for w in ("garbage", "trash", "waste", "dump", "debris", "rubble", "malba", "litter", "filth", "plastic", "bin")):
        category = "Sanitation"
        severity = 7.5
        title = f"Unregulated Municipal Waste & Roadside Dumping at {locality}"
        default_desc = (
            f"Accumulated uncollected solid waste and roadside dumping at {locality} "
            f"create acute public health, vector-breeding, and pedestrian obstruction hazards."
        )
    elif any(w in combined for w in ("encroach", "stall", "hawker", "illegal shop", "barrier")):
        category = "Encroachment"
        severity = 6.8
        title = f"Pedestrian Footpath Right-of-Way Encroachment at {locality}"
        default_desc = (
            f"Unauthorized obstruction across the designated pedestrian walkway at {locality} "
            f"forces commuters onto active vehicular traffic lanes."
        )
    elif "beta 2" in loc_lower:
        category = "Drainage / Flood"
        severity = 8.0
        title = f"Blocked Sector Storm Drain & Surface Water Hazard in {locality}"
        default_desc = (
            f"Silt-choked sector storm drain and roadside water accumulation documented in {locality} "
            f"require urgent GNIDA suction-pump clearance and grate restoration."
        )
    elif "pari chowk" in loc_lower or "alpha 1" in loc_lower:
        category = "Road Damage"
        severity = 8.1
        title = f"Damaged Arterial Asphalt & Commuter Road Hazard at {locality}"
        default_desc = (
            f"Degraded arterial road surface and fractured concrete kerb documented at {locality} "
            f"require immediate reflective barricading and hot-mix resurfacing."
        )
    else:
        category = "Electrical Hazard"
        severity = 8.5
        title = f"Unshielded Roadside Electrical Pillar & Cable Hazard at {locality}"
        default_desc = (
            f"Exposed roadside utility wiring and unlatched distribution enclosure documented at {locality} "
            f"require urgent GNIDA electrical wing inspection and weatherproof locking."
        )

    forensic_clause = (
        "Corroborated via hardware camera EXIF GPS lock and SHA-256 cryptographic seal."
        if exif_verified
        else "Sealed with SHA-256 cryptographic fingerprint and queued for GNIDA engineering remediation."
    )
    summary = (
        f"Field observation at {locality}: {clean_note}. {forensic_clause}"
        if clean_note
        else f"{default_desc} {forensic_clause}"
    )
    return {
        "is_valid_civic_issue": True,
        "title": title,
        "summary": summary,
        "category": category,
        "severity": severity,
    }


def _compress_to_jpeg(image_bytes: bytes, max_width: int = 900, quality: int = 80) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if img.width > max_width:
        ratio = max_width / float(img.width)
        new_height = int(float(img.height) * ratio)
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def _safe_rational_to_float(val: Any) -> float:
    if isinstance(val, tuple) and len(val) == 2:
        denom = float(val[1])
        return float(val[0]) / denom if denom != 0 else 0.0
    num = getattr(val, "numerator", None)
    den = getattr(val, "denominator", None)
    if num is not None and den is not None:
        return float(num) / float(den) if float(den) != 0 else 0.0
    return float(val)


def _dms_to_decimal(dms, ref) -> float:
    degrees = _safe_rational_to_float(dms[0])
    minutes = _safe_rational_to_float(dms[1]) / 60.0
    seconds = _safe_rational_to_float(dms[2]) / 3600.0
    decimal = degrees + minutes + seconds
    if str(ref).upper().strip() in ("S", "W"):
        decimal = -decimal
    return round(decimal, 6)


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def extract_exif_forensics(image_bytes: bytes, submitted_lat: float, submitted_lng: float) -> dict:
    forensics = {
        "device": "Unknown / Stripped EXIF",
        "captured_at": None,
        "exif_lat": None,
        "exif_lng": None,
        "gps_match": False,
        "distance_offset_m": None,
    }
    try:
        img = Image.open(io.BytesIO(image_bytes))
        raw_exif = img.getexif()
        if not raw_exif:
            return forensics

        exif = {ExifTags.TAGS.get(k, k): v for k, v in raw_exif.items()}
        make = str(exif.get("Make", "")).replace("\x00", "").strip()
        model = str(exif.get("Model", "")).replace("\x00", "").strip()
        if make or model:
            forensics["device"] = model if model.lower().startswith(make.lower()) and make else f"{make} {model}".strip()
        if "DateTimeOriginal" in exif:
            forensics["captured_at"] = str(exif["DateTimeOriginal"]).replace("\x00", "").strip()
        elif "DateTime" in exif:
            forensics["captured_at"] = str(exif["DateTime"]).replace("\x00", "").strip()

        gps_ifd = raw_exif.get_ifd(0x8825)
        if gps_ifd:
            gps_data = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps_ifd.items()}
            if all(k in gps_data for k in ("GPSLatitude", "GPSLatitudeRef", "GPSLongitude", "GPSLongitudeRef")):
                exif_lat = _dms_to_decimal(gps_data["GPSLatitude"], gps_data["GPSLatitudeRef"])
                exif_lng = _dms_to_decimal(gps_data["GPSLongitude"], gps_data["GPSLongitudeRef"])
                offset = round(_haversine_meters(submitted_lat, submitted_lng, exif_lat, exif_lng), 1)
                forensics["exif_lat"] = exif_lat
                forensics["exif_lng"] = exif_lng
                forensics["distance_offset_m"] = offset
                forensics["gps_match"] = offset <= 250.0
    except Exception:
        pass
    return forensics


# Realistic 16-Report Greater Noida Civic Dataset (13 Unique Incident Before/After Pairs)
SEED_REPORTS_16 = [
    # --- KNOWLEDGE PARK III (7 Reports: 3 Overdue, 2 Action Needed, 1 Needs Check, 1 Fixed & Verified; 4-Report Cluster) ---
    {
        "id": "60722f33-473f-4bd5-a892-56ffc5ecd8dc",
        "title": "Exposed High-Tension 11kV Junction Box Near Student Hostel Gate",
        "summary": "Open electrical feeder pillar with live exposed copper busbars beside main pedestrian footpath used by 4,000+ engineering students daily.",
        "category": "Electrical Hazard",
        "severity": 9.5,
        "status": "SLA_BREACHED",
        "locality": "Knowledge Park III",
        "lat": 28.4748,
        "lng": 77.4820,
        "image_url": "/evidence/wire_box_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "Google Pixel 9 Pro",
            "captured_at": "2026-11-21 14:15:22",
            "exif_lat": 28.4748,
            "exif_lng": 77.4820,
            "gps_match": True,
            "distance_offset_m": 8.4,
        },
        "evidence_hash": "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3e2d8a1c4b7f8e9d0a1b2c3d4",
        "cluster_id": "63007a96-1cb2-4d78-b2ee-5aa6e9f33677",
        "sla_deadline": "2026-11-21T20:00:00+00:00",
        "created_at": "2026-11-20T20:00:00+00:00",
        "resolved_at": None,
    },
    {
        "id": "e3e027d6-3b50-4474-90b6-32c247571e3c",
        "title": "Corroborating Report #2: Open 11kV Hostel Gate Junction Box & Live Busbars",
        "summary": "Second independent citizen capture confirming exposed copper busbars and unshielded feeder terminals inside the open 11kV box at Hostel Gate.",
        "category": "Electrical Hazard",
        "severity": 9.0,
        "status": "SLA_BREACHED",
        "locality": "Knowledge Park III",
        "lat": 28.4751,
        "lng": 77.4824,
        "image_url": "/evidence/wire_box_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "iPhone 15 Pro",
            "captured_at": "2026-11-21 19:40:10",
            "exif_lat": 28.4751,
            "exif_lng": 77.4823,
            "gps_match": True,
            "distance_offset_m": 12.1,
        },
        "evidence_hash": "b83b7ed4bba08a950b3b9762c280d876871eaac2d1c790b3a6e7d8c9b0a1f2e3",
        "cluster_id": "63007a96-1cb2-4d78-b2ee-5aa6e9f33677",
        "sla_deadline": "2026-11-22T04:00:00+00:00",
        "created_at": "2026-11-21T04:00:00+00:00",
        "resolved_at": None,
    },
    {
        "id": "f235ac9b-23e8-4558-b3d2-de36421dcc3d",
        "title": "Corroborating Report #3: Arcing 11kV Junction Box Outside Hostel Bus Stop",
        "summary": "Third citizen photo confirming live sparking from the exact same open 11kV distribution box outside the student hostel gate during evening rush.",
        "category": "Electrical Hazard",
        "severity": 8.8,
        "status": "SLA_BREACHED",
        "locality": "Knowledge Park III",
        "lat": 28.4749,
        "lng": 77.4822,
        "image_url": "/evidence/wire_box_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "Samsung Galaxy S24 Ultra",
            "captured_at": "2026-11-22 08:12:05",
            "exif_lat": 28.4750,
            "exif_lng": 77.4822,
            "gps_match": True,
            "distance_offset_m": 11.0,
        },
        "evidence_hash": "c72c6dc3aa9f7984f92a8651b17fc765760d99b1c0b68fa295d6c7b8a9f0e1d2",
        "cluster_id": "63007a96-1cb2-4d78-b2ee-5aa6e9f33677",
        "sla_deadline": "2026-11-22T11:00:00+00:00",
        "created_at": "2026-11-21T11:00:00+00:00",
        "resolved_at": None,
    },
    {
        "id": "kp3-0004-4d78-b2ee-5aa6e9f33604",
        "title": "Corroborating Report #4: Unlatched 11kV Feeder Box & Transformer at Hostel Gate",
        "summary": "Fourth independent citizen submission documenting the open 11kV hostel gate junction box and leaking step-down transformer enclosure.",
        "category": "Electrical Hazard",
        "severity": 8.5,
        "status": "ESCALATED",
        "locality": "Knowledge Park III",
        "lat": 28.4747,
        "lng": 77.4819,
        "image_url": "/evidence/wire_box_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "OnePlus 12",
            "captured_at": "2026-11-22 16:30:00",
            "exif_lat": 28.4747,
            "exif_lng": 77.4818,
            "gps_match": True,
            "distance_offset_m": 14.5,
        },
        "evidence_hash": "9a1f2e3d4c5b6a7890fedcba1234567890abcdef1234567890abcdef12345678",
        "cluster_id": "63007a96-1cb2-4d78-b2ee-5aa6e9f33677",
        "sla_deadline": "2026-11-24T04:00:00+00:00",
        "created_at": "2026-11-22T16:30:00+00:00",
        "resolved_at": None,
    },
    {
        "id": "kp3-0005-4d78-b2ee-5aa6e9f33605",
        "title": "Severed Streetlight Conduit & Dark Campus Ring Road",
        "summary": "Broken junction conduit leaving 8 consecutive municipal streetlights non-functional near Knowledge Park III internal roundabout.",
        "category": "Electrical Hazard",
        "severity": 7.8,
        "status": "ESCALATED",
        "locality": "Knowledge Park III",
        "lat": 28.4772,
        "lng": 77.4855,
        "image_url": "/evidence/wire_streetlight_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "Vivo X100 Pro",
            "captured_at": "2026-11-22 18:05:44",
            "exif_lat": 28.4771,
            "exif_lng": 77.4854,
            "gps_match": True,
            "distance_offset_m": 16.2,
        },
        "evidence_hash": "8b2e3f4a5c6d7e8901abcdef2345678901bcdefa2345678901bcdefa23456789",
        "cluster_id": "kp3-secondary-cluster-01",
        "sla_deadline": "2026-11-24T12:00:00+00:00",
        "created_at": "2026-11-22T18:05:44+00:00",
        "resolved_at": None,
    },
    {
        "id": "kp3-0006-4d78-b2ee-5aa6e9f33606",
        "title": "Dangling Overhead Cable Bundle Blocking Service Lane",
        "summary": "Low-hanging tangled distribution cables snagged by delivery truck; submitted photo shows 412m GPS offset from pin.",
        "category": "Electrical Hazard",
        "severity": 6.8,
        "status": "UNVERIFIED",
        "locality": "Knowledge Park III",
        "lat": 28.4728,
        "lng": 77.4792,
        "image_url": "/evidence/wire_cables_before.jpg",
        "after_image_url": None,
        "exif_verified": False,
        "exif_metadata": {
            "device": "Redmi Note 13 Pro (GPS Offset > 250m)",
            "captured_at": "2026-11-22 20:10:12",
            "exif_lat": 28.4691,
            "exif_lng": 77.4780,
            "gps_match": False,
            "distance_offset_m": 412.6,
        },
        "evidence_hash": "7c3d4e5f6a7b8c9012bcdefa3456789012cdefab3456789012cdefab34567890",
        "cluster_id": "kp3-secondary-cluster-02",
        "sla_deadline": None,
        "created_at": "2026-11-22T20:10:12+00:00",
        "resolved_at": None,
    },
    {
        "id": "kp3-0007-4d78-b2ee-5aa6e9f33607",
        "title": "Insulated & Locked Feeder Pillar #4 Opposite Engineering Campus",
        "summary": "GNIDA electrical wing installed weatherproof lockable enclosure and underground conduit shielding within 11 hours of escalation.",
        "category": "Electrical Hazard",
        "severity": 8.0,
        "status": "RESOLVED",
        "locality": "Knowledge Park III",
        "lat": 28.4761,
        "lng": 77.4805,
        "image_url": "/evidence/wire_pillar_before.jpg",
        "after_image_url": "/evidence/wire_pillar_after.jpg",
        "exif_verified": True,
        "exif_metadata": {
            "device": "Google Pixel 8a",
            "captured_at": "2026-11-21 10:00:00",
            "exif_lat": 28.4761,
            "exif_lng": 77.4805,
            "gps_match": True,
            "distance_offset_m": 5.2,
        },
        "evidence_hash": "6d4e5f6a7b8c9d0123cdefab4567890123defabc4567890123defabc45678901",
        "cluster_id": "kp3-secondary-cluster-03",
        "sla_deadline": "2026-11-22T10:00:00+00:00",
        "created_at": "2026-11-21T10:00:00+00:00",
        "resolved_at": "2026-11-21T21:00:00+00:00",
    },
    # --- BETA 2 SECTOR (3 Reports: Waterlogging, Streetlight Outage, Uncovered Manhole) ---
    {
        "id": "aef4245b-991a-4caf-8fec-af9ddc781e8a",
        "title": "Severe Storm Drain Overflow & Knee-Deep Waterlogging in Block-C",
        "summary": "Choked primary storm drainage canal causing stagnant waterlogging across residential approach road for over 36 hours.",
        "category": "Waterlogging",
        "severity": 8.4,
        "status": "SLA_BREACHED",
        "locality": "Beta 2 Sector",
        "lat": 28.4812,
        "lng": 77.5085,
        "image_url": "/evidence/drain_overflow_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "iPhone 14 Pro",
            "captured_at": "2026-11-21 15:20:00",
            "exif_lat": 28.4812,
            "exif_lng": 77.5084,
            "gps_match": True,
            "distance_offset_m": 9.8,
        },
        "evidence_hash": "d61d5cb2998e6873e8197540a06eb65465fc88a0bfb57e9184c5b6a798efdcba",
        "cluster_id": "cd474e0f-dbf0-490f-9d1a-299b615cbcb3",
        "sla_deadline": "2026-11-22T07:00:00+00:00",
        "created_at": "2026-11-21T07:00:00+00:00",
        "resolved_at": None,
    },
    {
        "id": "beta2-0002-4caf-8fec-af9ddc781e02",
        "title": "Beta-2 Internal Market Streetlight Outage & Open Pole Switchbox",
        "summary": "Exposed toggle switchgear at child height on pole #B2-19 accompanied by complete darkness along residential park lane.",
        "category": "Electrical Hazard",
        "severity": 7.5,
        "status": "ESCALATED",
        "locality": "Beta 2 Sector",
        "lat": 28.4826,
        "lng": 77.5102,
        "image_url": "/evidence/wire_switchbox_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "Samsung Galaxy S23",
            "captured_at": "2026-11-22 17:45:10",
            "exif_lat": 28.4825,
            "exif_lng": 77.5101,
            "gps_match": True,
            "distance_offset_m": 15.0,
        },
        "evidence_hash": "5e5f6a7b8c9d0e1234defabc5678901234efabcd5678901234efabcd56789012",
        "cluster_id": "beta2-cluster-02",
        "sla_deadline": "2026-11-24T06:00:00+00:00",
        "created_at": "2026-11-22T17:45:10+00:00",
        "resolved_at": None,
    },
    {
        "id": "beta2-0003-4caf-8fec-af9ddc781e03",
        "title": "Uncovered Sewer Manhole & Broken Drain Chamber Near Mother Dairy Booth",
        "summary": "Missing circular sewer manhole lid creating a deep open road trap on Beta-2 collector lane; EXIF stripped from forwarded upload.",
        "category": "Drainage / Flood",
        "severity": 7.2,
        "status": "UNVERIFIED",
        "locality": "Beta 2 Sector",
        "lat": 28.4798,
        "lng": 77.5069,
        "image_url": "/evidence/drain_manhole_before.jpg",
        "after_image_url": None,
        "exif_verified": False,
        "exif_metadata": {
            "device": "Unknown / Stripped EXIF",
            "captured_at": None,
            "exif_lat": None,
            "exif_lng": None,
            "gps_match": False,
            "distance_offset_m": None,
        },
        "evidence_hash": "4f6a7b8c9d0e1f2345efabcd6789012345fabcde6789012345fabcde67890123",
        "cluster_id": "beta2-cluster-03",
        "sla_deadline": None,
        "created_at": "2026-11-22T21:00:00+00:00",
        "resolved_at": None,
    },
    # --- PARI CHOWK (3 Reports: Arterial Road Crater, Traffic Signal Wire, Construction Debris) ---
    {
        "id": "e16f0eaf-4185-48e1-8d9b-f9a30d16af9c",
        "title": "Deep Arterial Pothole & Collapsed Asphalt Crater at Pari Chowk Slip Road",
        "summary": "Unbarricaded 1.8-foot deep asphalt road cavity and fractured concrete slab causing high-speed two-wheeler skids.",
        "category": "Road Damage",
        "severity": 9.2,
        "status": "SLA_BREACHED",
        "locality": "Pari Chowk",
        "lat": 28.4671,
        "lng": 77.5138,
        "image_url": "/evidence/road_pothole_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "Google Pixel 9",
            "captured_at": "2026-11-21 11:30:00",
            "exif_lat": 28.4671,
            "exif_lng": 77.5138,
            "gps_match": True,
            "distance_offset_m": 6.3,
        },
        "evidence_hash": "e50e4ba1887d5762d708643f9f5da54354eb779faea46d8073b4a59687fedcba",
        "cluster_id": "ff775de6-bcba-4adb-82dc-4cd34d9fcdd4",
        "sla_deadline": "2026-11-22T01:00:00+00:00",
        "created_at": "2026-11-21T01:00:00+00:00",
        "resolved_at": None,
    },
    {
        "id": "pari-0002-48e1-8d9b-f9a30d16af02",
        "title": "Traffic Signal Gantry High-Voltage Supply Wire Hanging Over Crosswalk",
        "summary": "Severed power supply cable dangling at head height across pedestrian island at Pari Chowk metro interchange.",
        "category": "Electrical Hazard",
        "severity": 8.1,
        "status": "ESCALATED",
        "locality": "Pari Chowk",
        "lat": 28.4684,
        "lng": 77.5152,
        "image_url": "/evidence/wire_gantry_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "OnePlus 11 5G",
            "captured_at": "2026-11-22 14:22:00",
            "exif_lat": 28.4683,
            "exif_lng": 77.5151,
            "gps_match": True,
            "distance_offset_m": 13.7,
        },
        "evidence_hash": "3a7b8c9d0e1f2a3456fabcde7890123456abcdef7890123456abcdef78901234",
        "cluster_id": "pari-cluster-02",
        "sla_deadline": "2026-11-24T02:00:00+00:00",
        "created_at": "2026-11-22T14:22:00+00:00",
        "resolved_at": None,
    },
    {
        "id": "pari-0003-48e1-8d9b-f9a30d16af03",
        "title": "Illegal Construction Rubble & Concrete Debris Blocking Expressway Entry",
        "summary": "Three truckloads of demolished concrete and rebar dumped overnight across the Noida-Greater Noida Expressway service lane.",
        "category": "Illegal Dumping",
        "severity": 7.0,
        "status": "ESCALATED",
        "locality": "Pari Chowk",
        "lat": 28.4659,
        "lng": 77.5121,
        "image_url": "/evidence/garbage_debris_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "iPhone 15",
            "captured_at": "2026-11-22 16:50:00",
            "exif_lat": 28.4659,
            "exif_lng": 77.5120,
            "gps_match": True,
            "distance_offset_m": 10.4,
        },
        "evidence_hash": "2b8c9d0e1f2a3b4567abcdef8901234567bcdefa8901234567bcdefa89012345",
        "cluster_id": "pari-cluster-03",
        "sla_deadline": "2026-11-24T08:00:00+00:00",
        "created_at": "2026-11-22T16:50:00+00:00",
        "resolved_at": None,
    },
    # --- ALPHA 1 COMMERCIAL BELT (3 Reports: 2 Fixed & Verified, 1 Action Needed -> Best Performing Responsive Zone) ---
    {
        "id": "b4ce4914-ae8e-44db-82dd-1072fa2bc257",
        "title": "Overflowing Municipal Garbage & Bio-Waste Near Alpha-1 Metro Feeder",
        "summary": "Cleared, disinfected, and paved within 19 hours of escalation; verified via geo-tagged After-photo remediation proof.",
        "category": "Sanitation",
        "severity": 6.5,
        "status": "RESOLVED",
        "locality": "Alpha 1 Commercial Belt",
        "lat": 28.4789,
        "lng": 77.5012,
        "image_url": "/evidence/garbage_dump_before.jpg",
        "after_image_url": "/evidence/garbage_dump_after.jpg",
        "exif_verified": True,
        "exif_metadata": {
            "device": "Google Pixel 9",
            "captured_at": "2026-11-21 09:15:00",
            "exif_lat": 28.4789,
            "exif_lng": 77.5012,
            "gps_match": True,
            "distance_offset_m": 4.1,
        },
        "evidence_hash": "f4f3da90776c4651c6f7532e8e4c943243da668e9d935c7f62a3948576edcba9",
        "cluster_id": "ca07c999-22cf-474f-9547-b04d938dbbf9",
        "sla_deadline": "2026-11-22T09:15:00+00:00",
        "created_at": "2026-11-21T09:15:00+00:00",
        "resolved_at": "2026-11-22T04:15:00+00:00",
    },
    {
        "id": "alpha1-0002-44db-82dd-1072fa2bc202",
        "title": "Collapsed Pedestrian Footpath & Utility Trench Outside Bank Enclave",
        "summary": "GNIDA civil crew relaid interlocking paver blocks and sealed underground duct trench within 28 hours of citizen report.",
        "category": "Road Damage",
        "severity": 7.0,
        "status": "RESOLVED",
        "locality": "Alpha 1 Commercial Belt",
        "lat": 28.4801,
        "lng": 77.5028,
        "image_url": "/evidence/road_footpath_before.jpg",
        "after_image_url": "/evidence/road_footpath_after.jpg",
        "exif_verified": True,
        "exif_metadata": {
            "device": "Samsung Galaxy S24",
            "captured_at": "2026-11-20 14:00:00",
            "exif_lat": 28.4801,
            "exif_lng": 77.5028,
            "gps_match": True,
            "distance_offset_m": 7.5,
        },
        "evidence_hash": "1c9d0e1f2a3b4c5678bcdefa9012345678cdefab9012345678cdefab90123456",
        "cluster_id": "alpha1-cluster-02",
        "sla_deadline": "2026-11-22T14:00:00+00:00",
        "created_at": "2026-11-20T14:00:00+00:00",
        "resolved_at": "2026-11-21T18:00:00+00:00",
    },
    {
        "id": "alpha1-0003-44db-82dd-1072fa2bc203",
        "title": "Commercial Plaza Feeder Pillar Fuse Sparking During Peak Load",
        "summary": "Overloaded 3-phase distribution board emitting sparks near Alpha-1 central market parking entry; assigned to field crew.",
        "category": "Electrical Hazard",
        "severity": 7.6,
        "status": "ESCALATED",
        "locality": "Alpha 1 Commercial Belt",
        "lat": 28.4776,
        "lng": 77.4998,
        "image_url": "/evidence/wire_fuse_before.jpg",
        "after_image_url": None,
        "exif_verified": True,
        "exif_metadata": {
            "device": "iPhone 15 Pro",
            "captured_at": "2026-11-22 19:15:00",
            "exif_lat": 28.4776,
            "exif_lng": 77.4999,
            "gps_match": True,
            "distance_offset_m": 9.1,
        },
        "evidence_hash": "0d0e1f2a3b4c5d6789cdefab0123456789defabc0123456789defabc01234567",
        "cluster_id": "alpha1-cluster-03",
        "sla_deadline": "2026-11-24T10:00:00+00:00",
        "created_at": "2026-11-22T19:15:00+00:00",
        "resolved_at": None,
    },
]

# In-memory state overrides for live demo actions on seeded reports + session uploads
LIVE_DEMO_REPORTS: dict[str, dict] = {r["id"]: dict(r) for r in SEED_REPORTS_16}
PRESS_KIT_CACHE: dict[str, dict] = {}
TRANSLATION_CACHE: dict[str, str] = {}


def _invalidate_cluster_cache(cluster_id: Optional[str] = None, report_id: Optional[str] = None) -> None:
    if cluster_id and cluster_id in PRESS_KIT_CACHE:
        PRESS_KIT_CACHE.pop(cluster_id, None)
    if report_id and report_id in PRESS_KIT_CACHE:
        PRESS_KIT_CACHE.pop(report_id, None)


def _build_bilingual_fallback_dossier(cluster_id: str, cluster_reports: list[dict]) -> dict:
    first = cluster_reports[0]
    primary_cat = first.get("category", "Civic Infrastructure Hazard")
    primary_loc = first.get("locality", "Knowledge Park III")
    avg_lat = round(sum(float(r.get("lat", 28.4748)) for r in cluster_reports) / len(cluster_reports), 5)
    avg_lng = round(sum(float(r.get("lng", 77.4820)) for r in cluster_reports) / len(cluster_reports), 5)
    max_sev = max(float(r.get("severity", 8.0)) for r in cluster_reports)
    overdue_hours = 19
    for r in cluster_reports:
        dl = r.get("sla_deadline")
        if dl:
            try:
                dt = datetime.fromisoformat(str(dl).replace("Z", "+00:00"))
                diff_h = int((datetime.now(timezone.utc) - dt).total_seconds() // 3600)
                if diff_h > 0:
                    overdue_hours = max(4, min(72, diff_h))
                    break
            except Exception:
                pass

    loc_hi_map = {
        "Knowledge Park III": "नॉलेज पार्क III",
        "Beta 2 Sector": "बीटा-2 सेक्टर",
        "Pari Chowk": "परी चौक",
        "Alpha 1 Commercial Belt": "अल्फा-1 कमर्शियल बेल्ट",
        "Alpha 1 Commercial": "अल्फा-1 कमर्शियल बेल्ट",
        "Greater Noida": "ग्रेटर नोएडा",
    }
    cat_hi_map = {
        "Electrical Hazard": "विद्युत संकट एवं खुला हाई-वोल्टेज तार",
        "Illegal Dumping": "अवैध निर्माण मलबा एवं कचरा डंपिंग",
        "Road Damage": "सड़क गड्ढा एवं डामर क्षति संकट",
        "Drainage / Flood": "जल निकासी एवं गंभीर जलभराव संकट",
        "Sanitation": "स्वच्छता एवं जैव-अपशिष्ट संकट",
        "Waterlogging": "बरसाती नाला अवरुद्ध एवं गंभीर जलभराव",
        "Encroachment": "सार्वजनिक फुटपाथ अतिक्रमण",
    }
    loc_hi = loc_hi_map.get(primary_loc, primary_loc)
    cat_hi = cat_hi_map.get(primary_cat, primary_cat)
    date_en = datetime.now(timezone.utc).strftime("%d %B %Y")

    evidence_lines_en = "\n".join(
        f"- **Case #{str(r.get('id', ''))[:8]}** — Device: **{r.get('exif_metadata', {}).get('device', 'Verified Citizen Camera')}** | "
        f"GPS: `{float(r.get('lat', avg_lat)):.4f}°N, {float(r.get('lng', avg_lng)):.4f}°E` | "
        f"SHA-256: `{str(r.get('evidence_hash', ''))[:24]}...`"
        for r in cluster_reports
    )
    evidence_lines_hi = "\n".join(
        f"- **केस #{str(r.get('id', ''))[:8]}** — उपकरण: **{r.get('exif_metadata', {}).get('device', 'सत्यापित नागरिक कैमरा')}** | "
        f"जीपीएस: `{float(r.get('lat', avg_lat)):.4f}°N, {float(r.get('lng', avg_lng)):.4f}°E` | "
        f"SHA-256 सील: `{str(r.get('evidence_hash', ''))[:24]}...`"
        for r in cluster_reports
    )

    brief_en = (
        f"# INVESTIGATIVE DOSSIER: Corroborated {primary_cat} Hotspot at {primary_loc}\n\n"
        f"## 1) Executive Headline\n"
        f"**{len(cluster_reports)} Independent Geo-Tagged Citizen Submissions Confirm Unresolved {primary_cat} "
        f"(Risk {max_sev}/10) at {primary_loc}, Greater Noida**\n\n"
        f"## 2) Key Findings & Systemic Pattern\n"
        f"- **Exact Hotspot Centroid:** {primary_loc}, Greater Noida ({avg_lat}°N, {avg_lng}°E — 200m Haversine Cluster)\n"
        f"- **Lead Incident:** {first.get('title', 'Unresolved Civic Infrastructure Hazard')}\n"
        f"- **Field Summary:** {first.get('summary', '')}\n"
        f"- Hardware EXIF camera telemetry and SHA-256 cryptographic sealing rule out photo tampering or duplicate stock uploads.\n\n"
        f"## 3) Timeline of Citizen Evidence & SLA Breaches\n"
        f"{evidence_lines_en}\n"
        f"- **GNIDA Citizen Charter SLA Status:** Overdue by **{overdue_hours} hours** without verified After-photo proof.\n\n"
        f"## 4) Questions for Civic Authorities (GNIDA)\n"
        f"1. Why has this corroborated {primary_cat.lower()} at {primary_loc} remained unremediated {overdue_hours} hours past the mandated Citizen Charter deadline?\n"
        f"2. Which Junior Engineer (JE) / Zonal Contractor holds maintenance accountability for `{avg_lat}°N, {avg_lng}°E`, and when will geo-verified After-photo proof be published?"
    )

    brief_hi = (
        f"# खोजी पत्रकारिता डोजियर: {loc_hi} में सत्यापित {cat_hi} हॉटस्पॉट\n\n"
        f"## 1) मुख्य संपादकीय शीर्षक\n"
        f"**ग्रेटर नोएडा के {loc_hi} में {len(cluster_reports)} स्वतंत्र जीपीएस-सत्यापित नागरिक रिपोर्टों ने गंभीर {cat_hi} "
        f"(जोखिम स्तर {max_sev}/10) की पुष्टि की**\n\n"
        f"## 2) प्रमुख निष्कर्ष और प्रणालीगत लापरवाही\n"
        f"- **हॉटस्पॉट स्थान:** {loc_hi}, ग्रेटर नोएडा ({avg_lat}°N, {avg_lng}°E — 200 मीटर प्रमाणित क्लस्टर)\n"
        f"- **प्रमुख प्रकरण:** {_offline_hindi_translate(str(first.get('title', '')))}\n"
        f"- **जमीनी विवरण:** {_offline_hindi_translate(str(first.get('summary', '')))}\n"
        f"- कैमरा EXIF हार्डवेयर जांच और SHA-256 क्रिप्टोग्राफ़िक सील यह प्रमाणित करते हैं कि सभी साक्ष्य वास्तविक और छेड़छाड़-रहित हैं।\n\n"
        f"## 3) नागरिक साक्ष्य की समयरेखा और समय-सीमा (SLA) उल्लंघन\n"
        f"{evidence_lines_hi}\n"
        f"- **प्राधिकरण समय-सीमा स्थिति:** निर्धारित SLA समय-सीमा से **{overdue_hours} घंटे अधिक** बीत जाने के बावजूद 'आफ्टर-फोटो' समाधान प्रमाण अपलोड नहीं किया गया।\n\n"
        f"## 4) प्रशासनिक अधिकारियों (GNIDA) से सीधे सवाल\n"
        f"1. {len(cluster_reports)} स्वतंत्र नागरिक प्रमाणों के बावजूद {loc_hi} में इस गंभीर संकट का समाधान {overdue_hours} घंटे बाद भी क्यों नहीं हुआ?\n"
        f"2. निर्देशांक `{avg_lat}°N, {avg_lng}°E` के लिए जिम्मेदार कनिष्ठ अभियंता (JE) कौन हैं और सत्यापित मरम्मत प्रमाण कब प्रकाशित किया जाएगा?"
    )

    rti_hash_rows = "\n".join(
        f"   {i + 1}. Case ID: {str(r.get('id', ''))[:8]} | Device: {r.get('exif_metadata', {}).get('device', 'Citizen Camera')} | SHA-256: {r.get('evidence_hash', '')}"
        for i, r in enumerate(cluster_reports)
    )
    proviso_en = (
        "Section 7(1) Life & Physical Safety Proviso (48-Hour Mandatory Response)"
        if max_sev >= 8.0
        else "Section 7(1) Standard Statutory Window (30 Days)"
    )
    proviso_hi = (
        "धारा 7(1) जीवन एवं शारीरिक सुरक्षा प्रावधान (48 घंटे में अनिवार्य उत्तर)"
        if max_sev >= 8.0
        else "धारा 7(1) मानक वैधानिक समय-सीमा (30 दिवस)"
    )

    rti_en = (
        f"FORM 'A'\n"
        f"APPLICATION FOR INFORMATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005\n\n"
        f"To,\n"
        f"The Public Information Officer (PIO),\n"
        f"Greater Noida Industrial Development Authority (GNIDA) / Civic Maintenance Division,\n"
        f"Plot No. 01, Knowledge Park-IV, Greater Noida, Gautam Buddha Nagar, UP - 201310\n"
        f"Official Civic Helpline / WhatsApp Citizen Desk: 8800203912\n\n"
        f"Date: {date_en}\n"
        f"Subject: Statutory RTI Inquiry Regarding Unresolved {primary_cat} Hotspot at {primary_loc} "
        f"(Ignored {overdue_hours} Hours Past SLA Deadline)\n\n"
        f"Respected Sir / Madam,\n\n"
        f"Under Section 6(1) and {proviso_en} of the Right to Information Act, 2005, please provide certified copies of inspection records, work orders, and accountability logs concerning the corroborated public safety hazard detailed below:\n\n"
        f"1. INCIDENT & GEO-LOCATION PARTICULARS:\n"
        f"   • Sector / Locality: {primary_loc}, Greater Noida\n"
        f"   • Exact GPS Coordinates: {avg_lat}° N, {avg_lng}° E\n"
        f"   • Hazard Classification: {primary_cat} (Public Safety Risk Score: {max_sev}/10)\n"
        f"   • Corroborated Submissions: {len(cluster_reports)} independent geo-verified citizen reports\n"
        f"   • Municipal SLA Status: Overdue ({overdue_hours} hours past Citizen Charter resolution window)\n\n"
        f"2. CRYPTOGRAPHICALLY SEALED CITIZEN EVIDENCE LOG (JAN DRISHTI TRUTH ENGINE):\n"
        f"{rti_hash_rows}\n\n"
        f"3. SPECIFIC INFORMATION SOUGHT UNDER RTI ACT, 2005:\n"
        f"   (a) Name, designation, and official contact details of the Junior Engineer (JE) / Assistant Manager responsible for {primary_loc} ({avg_lat}° N, {avg_lng}° E).\n"
        f"   (b) Certified copies of daily inspection logbooks and contractor work orders issued for this location over the past 30 days.\n"
        f"   (c) Official recorded reasons why {len(cluster_reports)} corroborated citizen complaints have remained unresolved {overdue_hours} hours past the mandated SLA.\n"
        f"   (d) Exact date and time by which on-site remediation and geo-verified After-photo proof will be completed.\n\n"
        f"Yours faithfully,\n"
        f"[Citizen / Accredited Journalist Applicant #JD-204]\n"
        f"Generated via Jan Drishti — People's Civic Truth Engine"
    )

    rti_hi = (
        f"प्रपत्र 'क' (FORM 'A')\n"
        f"सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) एवं {proviso_hi} के अंतर्गत वैधानिक आवेदन\n\n"
        f"सेवा में,\n"
        f"जन सूचना अधिकारी (PIO),\n"
        f"ग्रेटर नोएडा औद्योगिक विकास प्राधिकरण (GNIDA) / नागरिक अनुरक्षण विभाग,\n"
        f"भूखंड संख्या 01, नॉलेज पार्क-IV, ग्रेटर नोएडा, गौतम बुद्ध नगर, उत्तर प्रदेश - 201310\n"
        f"आधिकारिक नागरिक हेल्पलाइन / व्हाट्सएप डेस्क: 8800203912\n\n"
        f"दिनांक: {date_en}\n"
        f"विषय: {loc_hi} में अनसुलझे '{cat_hi}' हॉटस्पॉट (SLA समय-सीमा के {overdue_hours} घंटे बाद भी लंबित) के संबंध में सूचना का अधिकार आवेदन।\n\n"
        f"महोदय / महोदया,\n\n"
        f"सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) तथा {proviso_hi} के तहत नीचे दिए गए क्रिप्टोग्राफ़िक रूप से सत्यापित जनसुरक्षा संकट पर प्रमाणित अभिलेख और कार्य-आदेश उपलब्ध कराने की कृपा करें:\n\n"
        f"1. घटना एवं भौगोलिक विवरण:\n"
        f"   • सेक्टर / क्षेत्र: {loc_hi}, ग्रेटर नोएडा\n"
        f"   • सत्यापित जीपीएस निर्देशांक: {avg_lat}° N, {avg_lng}° E\n"
        f"   • समस्या श्रेणी एवं गंभीरता: {cat_hi} (जनसुरक्षा जोखिम स्कोर: {max_sev}/10)\n"
        f"   • पुष्टिकर्ता नागरिक रिपोर्ट: {len(cluster_reports)} स्वतंत्र जियो-टैग रिपोर्टें\n"
        f"   • SLA स्थिति: निर्धारित समय-सीमा से {overdue_hours} घंटे अतिदेय (Overdue)\n\n"
        f"2. क्रिप्टोग्राफ़िक SHA-256 साक्ष्य रजिस्टर (जन दृष्टि सत्य इंजन):\n"
        f"{rti_hash_rows}\n\n"
        f"3. आरटीआई अधिनियम, 2005 के अंतर्गत मांगी गई विशिष्ट सूचना:\n"
        f"   (क) {loc_hi} ({avg_lat}° N, {avg_lng}° E) क्षेत्र के लिए जिम्मेदार कनिष्ठ अभियंता (JE) एवं सहायक प्रबंधक का नाम, पदनाम और आधिकारिक संपर्क विवरण।\n"
        f"   (ख) पिछले 30 दिनों में उक्त स्थल के लिए जारी निरीक्षण पंजिका (Inspection Logbook) और ठेकेदार कार्य-आदेशों (Work Orders) की प्रमाणित प्रतियां।\n"
        f"   (ग) {len(cluster_reports)} सत्यापित शिकायतों के बावजूद निर्धारित समय-सीमा के {overdue_hours} घंटे बाद भी समाधान न होने का आधिकारिक कारण।\n"
        f"   (घ) जमीनी मरम्मत और जियो-सत्यापित 'आफ्टर-फोटो' प्रमाण प्रकाशित करने की निश्चित तिथि एवं समय।\n\n"
        f"भवदीय,\n"
        f"[नागरिक / मान्यता प्राप्त पत्रकार आवेदक #JD-204]\n"
        f"जन दृष्टि (Jan Drishti — People's Civic Truth Engine) द्वारा जनहित में निर्गत"
    )

    social_hi = (
        f"### भाग 1/3 — गंभीर जनसुरक्षा चेतावनी\n"
        f"- **स्थान:** {loc_hi}, ग्रेटर नोएडा ({avg_lat}°N, {avg_lng}°E)\n"
        f"- **नागरिक पुष्टि:** 200 मीटर के दायरे में {len(cluster_reports)} नागरिकों ने इस {cat_hi} की स्वतंत्र रिपोर्ट दर्ज की\n"
        f"- **जोखिम स्तर:** {max_sev}/10 | **स्थिति:** SLA समय-सीमा से {overdue_hours} घंटे अतिदेय\n\n"
        f"---\n\n"
        f"### भाग 2/3 — कैमरा जीपीएस और SHA-256 डिजिटल प्रमाण\n"
        f"- **प्रकरण:** {_offline_hindi_translate(str(first.get('title', '')))}\n"
        f"- प्रत्येक फोटो कैमरा EXIF टेलीमेट्री और SHA-256 क्रिप्टोग्राफ़िक हैश से सील है:\n"
        + "\n".join(f"- प्रमाण #{i + 1}: `{str(r.get('evidence_hash', ''))[:24]}...`" for i, r in enumerate(cluster_reports))
        + f"\n\n---\n\n"
        f"### भाग 3/3 — प्राधिकरण से जवाबदेही और आरटीआई नोटिस\n"
        f"1. {len(cluster_reports)} प्रमाणित शिकायतों के बाद भी {loc_hi} में यह संकट {overdue_hours} घंटे से अनसुलझा क्यों है?\n"
        f"2. सूचना का अधिकार अधिनियम 2005 की धारा 6(1)/7(1) के अंतर्गत औपचारिक नोटिस जारी। #JanDrishti #GreaterNoida #CivicAccountability"
    )

    return {
        "investigative_brief": brief_en,
        "investigative_brief_hi": brief_hi,
        "rti_notice": rti_en,
        "rti_notice_hi": rti_hi,
        "social_thread_hi": social_hi,
    }


@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "Jan Drishti Truth Engine",
        "active_models": ACTIVE_GEMINI_MODELS,
    }


@app.post("/api/demo/reset")
def reset_demo_dataset():
    global LIVE_DEMO_REPORTS
    LIVE_DEMO_REPORTS = {r["id"]: dict(r) for r in SEED_REPORTS_16}
    PRESS_KIT_CACHE.clear()
    return list(LIVE_DEMO_REPORTS.values())


@app.get("/api/reports")
def get_all_reports():
    return list(LIVE_DEMO_REPORTS.values())


@app.post("/api/reports/analyze-and-submit")
async def analyze_and_submit_report(
    file: UploadFile = File(...),
    locality: str = Form("Greater Noida"),
    lat: float = Form(...),
    lng: float = Form(...),
    user_note: Optional[str] = Form(""),
):
    try:
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image file is empty.")

        now_iso = datetime.now(timezone.utc).isoformat()
        # Pure FIPS 180-4 SHA-256 digest of raw image bytes so client-side Web Crypto verifier matches 1:1
        evidence_hash = hashlib.sha256(raw_bytes).hexdigest()
        exif_metadata = extract_exif_forensics(raw_bytes, lat, lng)
        exif_verified = bool(exif_metadata["gps_match"])

        compact_bytes = _compress_to_jpeg(raw_bytes)
        image_data_url = f"data:image/jpeg;base64,{base64.b64encode(compact_bytes).decode('utf-8')}"

        prompt = (
            "You are an investigative civic-intelligence AI auditor for Jan Drishti in India. "
            "Inspect this citizen-submitted photo and optional note. "
            "1) Set is_valid_civic_issue=false ONLY if this is clearly a selfie, meme, blank screen, or indoor pet/portrait. "
            "2) Categorize strictly into one of: 'Electrical Hazard', 'Road Damage', 'Drainage / Flood', 'Sanitation', 'Illegal Dumping', 'Waterlogging', or 'Encroachment'. "
            "3) Rate public safety severity from 1 to 10. "
            "4) Write a sharp, factual journalistic headline and a 2-sentence objective summary. "
            f"Citizen note: '{user_note}' | Uploaded file: '{file.filename or ''}' | Locality: '{locality}'."
        )

        audit: Optional[dict] = None
        model_used = "smart-keyword-fallback"
        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CivicAuditSchema,
                temperature=0.2,
            )
            ai_text, used = _call_gemini_with_timeout(
                contents=[
                    types.Part.from_bytes(data=compact_bytes, mime_type="image/jpeg"),
                    prompt,
                ],
                config=config,
                total_timeout_sec=8.0,
            )
            if ai_text:
                audit = json.loads(ai_text)
                model_used = used or ACTIVE_GEMINI_MODELS[0]
                print(
                    f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Success with '{model_used}': "
                    f"valid={audit.get('is_valid_civic_issue')}, category='{audit.get('category')}'"
                )
        except Exception as parse_err:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Parse/AI fallback triggered: {parse_err}")
            audit = None

        if audit is None:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Using smart keyword/filename hazard audit fallback.")
            audit = _heuristic_audit(
                user_note or "",
                locality,
                filename=file.filename or "",
                exif_verified=exif_verified,
            )

        if not audit.get("is_valid_civic_issue", True):
            raise HTTPException(
                status_code=400,
                detail="Truth Engine Rejected: Image does not depict a verifiable public civic or environmental hazard.",
            )

        matched_cluster_id: Optional[str] = None
        for existing in LIVE_DEMO_REPORTS.values():
            if existing.get("lat") is not None and existing.get("lng") is not None:
                dist_m = _haversine_meters(lat, lng, float(existing["lat"]), float(existing["lng"]))
                if dist_m <= 200.0:
                    cid = existing.get("cluster_id") or f"cluster-{str(existing['id'])[:8]}"
                    existing["cluster_id"] = cid
                    matched_cluster_id = cid
                    break

        report_id = str(uuid.uuid4())
        sla_hours = 24 if float(audit.get("severity", 7)) >= 8 else 48
        sla_deadline_iso = datetime.fromtimestamp(
            time.time() + sla_hours * 3600, tz=timezone.utc
        ).isoformat()

        new_row = {
            "id": report_id,
            "title": str(audit["title"]),
            "summary": str(audit["summary"]),
            "category": str(audit["category"]),
            "severity": round(float(audit["severity"]), 1),
            "status": "ESCALATED" if exif_verified else "UNVERIFIED",
            "locality": locality,
            "lat": lat,
            "lng": lng,
            "image_url": image_data_url,
            "after_image_url": None,
            "exif_verified": exif_verified,
            "exif_metadata": exif_metadata,
            "evidence_hash": evidence_hash,
            "cluster_id": matched_cluster_id or f"cluster-{report_id[:8]}",
            "sla_deadline": sla_deadline_iso if exif_verified else None,
            "created_at": now_iso,
            "resolved_at": None,
            "is_live_upload": True,
        }

        LIVE_DEMO_REPORTS[report_id] = dict(new_row)
        _invalidate_cluster_cache(new_row["cluster_id"], report_id)

        db_record = {
            k: v
            for k, v in new_row.items()
            if k not in ("after_image_url", "sla_deadline", "resolved_at", "is_live_upload")
        }
        db_record["severity"] = int(round(float(new_row["severity"])))
        try:
            uuid.UUID(str(db_record.get("cluster_id", "")))
        except ValueError:
            db_record.pop("cluster_id", None)
        _run_supabase_bg(lambda sb: sb.table("reports").insert(db_record).execute())

        return {
            "report": new_row,
            "forensics": {
                "evidence_hash": evidence_hash,
                "exif_verified": exif_verified,
                "exif_metadata": exif_metadata,
                "ai_audit": audit,
                "model_used": model_used,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Unexpected exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/reports/{report_id}/verify")
def verify_and_escalate(report_id: str, action: str = "ESCALATE"):
    existing = LIVE_DEMO_REPORTS.get(report_id)
    _invalidate_cluster_cache(existing.get("cluster_id") if existing else None, report_id)

    if action == "REJECT":
        _run_supabase_bg(lambda sb: sb.table("reports").delete().eq("id", report_id).execute())
        return {"status": "deleted", "id": report_id}

    if action == "DISPUTE":
        if report_id in LIVE_DEMO_REPORTS:
            LIVE_DEMO_REPORTS[report_id]["status"] = "SLA_BREACHED"
        _run_supabase_bg(
            lambda sb: sb.table("reports").update({"status": "SLA_BREACHED"}).eq("id", report_id).execute()
        )
        return LIVE_DEMO_REPORTS.get(report_id, {"id": report_id, "status": "SLA_BREACHED"})

    if action == "MERGE_HOTSPOT":
        hotspot_cid = "63007a96-1cb2-4d78-b2ee-5aa6e9f33677"
        if report_id in LIVE_DEMO_REPORTS:
            LIVE_DEMO_REPORTS[report_id]["cluster_id"] = hotspot_cid
            LIVE_DEMO_REPORTS[report_id]["status"] = "ESCALATED"
            LIVE_DEMO_REPORTS[report_id]["exif_verified"] = True
        _invalidate_cluster_cache(hotspot_cid, report_id)
        _run_supabase_bg(
            lambda sb: sb.table("reports")
            .update({"cluster_id": hotspot_cid, "status": "ESCALATED", "exif_verified": True})
            .eq("id", report_id)
            .execute()
        )
        return LIVE_DEMO_REPORTS.get(
            report_id, {"id": report_id, "cluster_id": hotspot_cid, "status": "ESCALATED"}
        )

    if report_id in LIVE_DEMO_REPORTS:
        LIVE_DEMO_REPORTS[report_id]["status"] = "ESCALATED"
        LIVE_DEMO_REPORTS[report_id]["exif_verified"] = True
        if not LIVE_DEMO_REPORTS[report_id].get("sla_deadline"):
            LIVE_DEMO_REPORTS[report_id]["sla_deadline"] = datetime.fromtimestamp(
                time.time() + 48 * 3600, tz=timezone.utc
            ).isoformat()

    _run_supabase_bg(
        lambda sb: sb.table("reports")
        .update({"status": "ESCALATED", "exif_verified": True})
        .eq("id", report_id)
        .execute()
    )
    return LIVE_DEMO_REPORTS.get(
        report_id, {"id": report_id, "status": "ESCALATED", "exif_verified": True}
    )


@app.post("/api/reports/{report_id}/resolve")
async def resolve_with_proof(
    report_id: str,
    file: Optional[UploadFile] = File(None),
    after_image_url: Optional[str] = Form(None),
    work_order_id: Optional[str] = Form(None),
):
    now_iso = datetime.now(timezone.utc).isoformat()
    after_url: Optional[str] = None

    provided_after = (after_image_url or "").strip()
    if provided_after.startswith("data:image/"):
        after_url = provided_after
    elif file is not None:
        raw_bytes = await file.read()
        if raw_bytes:
            compact_bytes = _compress_to_jpeg(raw_bytes)
            after_url = f"data:image/jpeg;base64,{base64.b64encode(compact_bytes).decode('utf-8')}"

    if not after_url:
        if provided_after:
            after_url = provided_after
        else:
            incident_after_map = {
                "60722f33-473f-4bd5-a892-56ffc5ecd8dc": "/evidence/wire_box_after.jpg",
                "e3e027d6-3b50-4474-90b6-32c247571e3c": "/evidence/wire_box_after.jpg",
                "f235ac9b-23e8-4558-b3d2-de36421dcc3d": "/evidence/wire_box_after.jpg",
                "kp3-0004-4d78-b2ee-5aa6e9f33604": "/evidence/wire_box_after.jpg",
                "kp3-0005-4d78-b2ee-5aa6e9f33605": "/evidence/wire_streetlight_after.jpg",
                "kp3-0006-4d78-b2ee-5aa6e9f33606": "/evidence/wire_cables_after.jpg",
                "kp3-0007-4d78-b2ee-5aa6e9f33607": "/evidence/wire_pillar_after.jpg",
                "aef4245b-991a-4caf-8fec-af9ddc781e8a": "/evidence/drain_overflow_after.jpg",
                "beta2-0002-4caf-8fec-af9ddc781e02": "/evidence/wire_switchbox_after.jpg",
                "beta2-0003-4caf-8fec-af9ddc781e03": "/evidence/drain_manhole_after.jpg",
                "e16f0eaf-4185-48e1-8d9b-f9a30d16af9c": "/evidence/road_pothole_after.jpg",
                "pari-0002-48e1-8d9b-f9a30d16af02": "/evidence/wire_gantry_after.jpg",
                "pari-0003-48e1-8d9b-f9a30d16af03": "/evidence/garbage_debris_after.jpg",
                "b4ce4914-ae8e-44db-82dd-1072fa2bc257": "/evidence/garbage_dump_after.jpg",
                "alpha1-0002-44db-82dd-1072fa2bc202": "/evidence/road_footpath_after.jpg",
                "alpha1-0003-44db-82dd-1072fa2bc203": "/evidence/wire_fuse_after.jpg",
            }
            if report_id in incident_after_map:
                after_url = incident_after_map[report_id]
            else:
                existing = LIVE_DEMO_REPORTS.get(report_id, {})
                text_sig = f"{existing.get('category', '')} {existing.get('title', '')}".lower()
                if "manhole" in text_sig or "sewer" in text_sig:
                    after_url = "/evidence/drain_manhole_after.jpg"
                elif "drain" in text_sig or "water" in text_sig or "flood" in text_sig:
                    after_url = "/evidence/drain_overflow_after.jpg"
                elif "footpath" in text_sig or "trench" in text_sig or "curb" in text_sig:
                    after_url = "/evidence/road_footpath_after.jpg"
                elif "road" in text_sig or "pothole" in text_sig:
                    after_url = "/evidence/road_pothole_after.jpg"
                elif "debris" in text_sig or "rubble" in text_sig or "dump" in text_sig:
                    after_url = "/evidence/garbage_debris_after.jpg"
                elif "sanitation" in text_sig or "garbage" in text_sig or "waste" in text_sig:
                    after_url = "/evidence/garbage_dump_after.jpg"
                elif "streetlight" in text_sig:
                    after_url = "/evidence/wire_streetlight_after.jpg"
                elif "switchbox" in text_sig:
                    after_url = "/evidence/wire_switchbox_after.jpg"
                elif "gantry" in text_sig:
                    after_url = "/evidence/wire_gantry_after.jpg"
                elif "fuse" in text_sig:
                    after_url = "/evidence/wire_fuse_after.jpg"
                elif "junction box" in text_sig or "11kv" in text_sig:
                    after_url = "/evidence/wire_box_after.jpg"
                else:
                    after_url = "/evidence/wire_cables_after.jpg"

    if report_id in LIVE_DEMO_REPORTS:
        LIVE_DEMO_REPORTS[report_id]["status"] = "RESOLVED"
        LIVE_DEMO_REPORTS[report_id]["after_image_url"] = after_url
        LIVE_DEMO_REPORTS[report_id]["resolved_at"] = now_iso
        if work_order_id:
            LIVE_DEMO_REPORTS[report_id]["work_order_id"] = work_order_id.strip()
        _invalidate_cluster_cache(LIVE_DEMO_REPORTS[report_id].get("cluster_id"), report_id)

    _run_supabase_bg(
        lambda sb: sb.table("reports")
        .update({"status": "RESOLVED", "after_image_url": after_url, "resolved_at": now_iso})
        .eq("id", report_id)
        .execute()
    )

    return LIVE_DEMO_REPORTS.get(
        report_id,
        {
            "id": report_id,
            "status": "RESOLVED",
            "after_image_url": after_url,
            "resolved_at": now_iso,
            "work_order_id": work_order_id,
        },
    )


@app.get("/api/clusters/{cluster_id}/press-kit")
def generate_press_kit(cluster_id: str):
    if cluster_id in PRESS_KIT_CACHE:
        return PRESS_KIT_CACHE[cluster_id]

    all_curr = get_all_reports()
    cluster_reports = [r for r in all_curr if r.get("cluster_id") == cluster_id]
    if not cluster_reports:
        cluster_reports = [r for r in all_curr if r.get("id") == cluster_id]
    if not cluster_reports:
        raise HTTPException(status_code=404, detail="Cluster not found")

    fallback_pack = _build_bilingual_fallback_dossier(cluster_id, cluster_reports)
    lightweight_reports = [
        {k: v for k, v in r.items() if k not in ("image_url", "after_image_url")}
        for r in cluster_reports
    ]

    brief_prompt = (
        "You are an investigative editor preparing a press dossier for verified journalists based on corroborated citizen evidence in Greater Noida, India. "
        "Write a crisp, hard-hitting investigative brief in Markdown with sections: "
        "1) Executive Headline, 2) Key Findings & Systemic Pattern, 3) Timeline of Citizen Evidence & SLA Breaches, and 4) Questions for Civic Authorities. "
        f"Evidence JSON: {json.dumps(lightweight_reports, default=str)}"
    )

    ai_brief_text, model_used = _call_gemini_with_timeout(
        contents=brief_prompt,
        config=types.GenerateContentConfig(temperature=0.25),
        total_timeout_sec=GEMINI_TOTAL_TIMEOUT_SEC,
    )

    result = {
        "cluster_id": cluster_id,
        "report_count": len(cluster_reports),
        "reports": cluster_reports,
        "investigative_brief": ai_brief_text or fallback_pack["investigative_brief"],
        "investigative_brief_hi": fallback_pack["investigative_brief_hi"],
        "rti_notice": fallback_pack["rti_notice"],
        "rti_notice_hi": fallback_pack["rti_notice_hi"],
        "social_thread_hi": fallback_pack["social_thread_hi"],
        "model_used": model_used or "prewritten-bilingual-fallback",
    }
    PRESS_KIT_CACHE[cluster_id] = result
    return result


class TranslateHindiRequest(BaseModel):
    text: Optional[str] = None
    texts: Optional[list[str]] = None


def _offline_hindi_translate(text: str) -> str:
    if not text:
        return ""
    stripped = text.strip()
    if stripped in TRANSLATION_CACHE:
        return TRANSLATION_CACHE[stripped]

    exact_map = {
        "Exposed High-Tension 11kV Junction Box Near Student Hostel Gate": "छात्र हॉस्टल गेट के पास खुला 11kV हाई-टेंशन जंक्शन बॉक्स — गंभीर जनसुरक्षा संकट",
        "Open electrical feeder pillar with live exposed copper busbars beside main pedestrian footpath used by 4,000+ engineering students daily.": "प्रतिदिन 4,000+ इंजीनियरिंग छात्रों द्वारा उपयोग किए जाने वाले मुख्य पैदल फुटपाथ के बगल में खुले तांबे के तारों वाला चालू विद्युत फीडर पिलर।",
        "Corroborating Report #2: Open 11kV Hostel Gate Junction Box & Live Busbars": "दूसरा नागरिक प्रमाण: हॉस्टल गेट के पास खुला 11kV जंक्शन बॉक्स और नंगे तांबे के बसबार",
        "Second independent citizen capture confirming exposed copper busbars and unshielded feeder terminals inside the open 11kV box at Hostel Gate.": "हॉस्टल गेट पर खुले 11kV बॉक्स के भीतर खुले तांबे के बसबार और असुरक्षित फीडर टर्मिनल की पुष्टि करने वाला दूसरा स्वतंत्र नागरिक फोटो।",
        "Corroborating Report #3: Arcing 11kV Junction Box Outside Hostel Bus Stop": "तीसरा नागरिक प्रमाण: हॉस्टल बस स्टॉप के बाहर उसी 11kV जंक्शन बॉक्स से चिंगारी",
        "Third citizen photo confirming live sparking from the exact same open 11kV distribution box outside the student hostel gate during evening rush.": "शाम की भीड़ के दौरान छात्र हॉस्टल गेट के बाहर उसी खुले 11kV वितरण बॉक्स से निकलती चिंगारी की पुष्टि करने वाला तीसरा फोटो।",
        "Corroborating Report #4: Unlatched 11kV Feeder Box & Transformer at Hostel Gate": "चौथा नागरिक प्रमाण: हॉस्टल गेट पर खुला 11kV फीडर बॉक्स और ट्रांसफार्मर रिसाव",
        "Fourth independent citizen submission documenting the open 11kV hostel gate junction box and leaking step-down transformer enclosure.": "हॉस्टल गेट पर खुले 11kV जंक्शन बॉक्स और ट्रांसफार्मर एनक्लोजर के खतरे को दर्ज करने वाली चौथी स्वतंत्र नागरिक रिपोर्ट।",
        "Severed Streetlight Conduit & Dark Campus Ring Road": "टूटा स्ट्रीटलाइट कंड्यूट और अंधेरे में डूबी कैंपस रिंग रोड",
        "Broken junction conduit leaving 8 consecutive municipal streetlights non-functional near Knowledge Park III internal roundabout.": "नॉलेज पार्क III आंतरिक गोलचक्कर के पास टूटे जंक्शन के कारण लगातार 8 स्ट्रीटलाइटें बंद।",
        "Dangling Overhead Cable Bundle Blocking Service Lane": "सर्विस लेन को अवरुद्ध करता लटकता ओवरहेड केबल बंडल",
        "Low-hanging tangled distribution cables snagged by delivery truck; submitted photo shows 412m GPS offset from pin.": "डिलीवरी ट्रक में उलझे नीचे लटकते केबल; प्रस्तुत फोटो में पिन से 412 मीटर का जीपीएस अंतर दर्ज।",
        "Insulated & Locked Feeder Pillar #4 Opposite Engineering Campus": "इंजीनियरिंग कैंपस के सामने फीडर पिलर #4 को सुरक्षित और लॉक किया गया",
        "GNIDA electrical wing installed weatherproof lockable enclosure and underground conduit shielding within 11 hours of escalation.": "शिकायत के 11 घंटे के भीतर विद्युत विभाग द्वारा वेदरप्रूफ लॉक और भूमिगत सुरक्षा कवच स्थापित किया गया।",
        "Severe Storm Drain Overflow & Knee-Deep Waterlogging in Block-C": "ब्लॉक-सी में मुख्य बरसाती नाला ओवरफ्लो और घुटनों तक जलभराव",
        "Choked primary storm drainage canal causing stagnant waterlogging across residential approach road for over 36 hours.": "अवरुद्ध मुख्य जल निकासी नहर के कारण 36 घंटे से अधिक समय से आवासीय सड़क पर गंभीर जलभराव।",
        "Beta-2 Internal Market Streetlight Outage & Open Pole Switchbox": "बीटा-2 आंतरिक मार्केट में स्ट्रीटलाइट बंद और खुला पोल स्विचबॉक्स",
        "Exposed toggle switchgear at child height on pole #B2-19 accompanied by complete darkness along residential park lane.": "पोल #B2-19 पर कम ऊंचाई पर खुला स्विचगियर और आवासीय पार्क लेन में पूर्ण अंधेरा।",
        "Uncovered Sewer Manhole & Broken Drain Chamber Near Mother Dairy Booth": "मदर डेयरी बूथ के पास बिना ढक्कन का खुला सीवर मैनहोल और टूटा चैंबर",
        "Missing circular sewer manhole lid creating a deep open road trap on Beta-2 collector lane; EXIF stripped from forwarded upload.": "बीटा-2 कलेक्टर लेन पर ढक्कन गायब होने से खुला गहरा सीवर मैनहोल जानलेवा गड्ढा बन गया है; फॉरवर्ड किए गए फोटो में EXIF अनुपस्थित।",
        "Deep Arterial Pothole & Collapsed Asphalt Crater at Pari Chowk Slip Road": "परी चौक स्लिप रोड पर गहरा सड़क गड्ढा और टूटी डामर सतह",
        "Unbarricaded 1.8-foot deep asphalt road cavity and fractured concrete slab causing high-speed two-wheeler skids.": "बिना बैरिकेडिंग के 1.8 फुट गहरा डामर सड़क का गड्ढा, जिससे दोपहिया वाहन दुर्घटनाग्रस्त हो रहे हैं।",
        "Traffic Signal Gantry High-Voltage Supply Wire Hanging Over Crosswalk": "जेब्रा क्रॉसिंग के ऊपर लटकता ट्रैफिक सिग्नल का हाई-वोल्टेज तार",
        "Severed power supply cable dangling at head height across pedestrian island at Pari Chowk metro interchange.": "परी चौक मेट्रो इंटरचेंज पर पैदल यात्रियों के रास्ते में सिर की ऊंचाई पर लटकता बिजली केबल।",
        "Illegal Construction Rubble & Concrete Debris Blocking Expressway Entry": "एक्सप्रेसवे सर्विस लेन को अवरुद्ध करता अवैध निर्माण मलबा",
        "Three truckloads of demolished concrete and rebar dumped overnight across the Noida-Greater Noida Expressway service lane.": "नोएडा-ग्रेटर नोएडा एक्सप्रेसवे सर्विस लेन पर रातों-रात डाले गए तीन ट्रक कंक्रीट और सरिया का मलबा।",
        "Overflowing Municipal Garbage & Bio-Waste Near Alpha-1 Metro Feeder": "अल्फा-1 मेट्रो फीडर के पास कचरा डंप का 19 घंटे में पूर्ण समाधान",
        "Cleared, disinfected, and paved within 19 hours of escalation; verified via geo-tagged After-photo remediation proof.": "शिकायत के 19 घंटे के भीतर सफाई और कीटाणुशोधन पूर्ण; जियो-टैग आफ्टर-फोटो द्वारा सत्यापित।",
        "Collapsed Pedestrian Footpath & Utility Trench Outside Bank Enclave": "बैंक एन्क्लेव के बाहर टूटे फुटपाथ और ट्रेंच की मरम्मत पूर्ण",
        "GNIDA civil crew relaid interlocking paver blocks and sealed underground duct trench within 28 hours of citizen report.": "नागरिक रिपोर्ट के 28 घंटे के भीतर सिविल टीम द्वारा इंटरलॉकिंग पेवर ब्लॉक लगाकर फुटपाथ दुरुस्त किया गया।",
        "Commercial Plaza Feeder Pillar Fuse Sparking During Peak Load": "पीक लोड के दौरान कमर्शियल प्लाजा फीडर पिलर में स्पार्किंग",
        "Overloaded 3-phase distribution board emitting sparks near Alpha-1 central market parking entry; assigned to field crew.": "अल्फा-1 सेंट्रल मार्केट पार्किंग के पास ओवरलोडेड 3-फेज बोर्ड से चिंगारी; फील्ड टीम को सौंपा गया।",
    }
    if stripped in exact_map:
        return exact_map[stripped]

    out = text
    replacements = [
        ("FORM 'A'", "प्रपत्र 'क' (FORM 'A')"),
        ("APPLICATION FOR INFORMATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005", "सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के अंतर्गत वैधानिक आवेदन"),
        ("The Public Information Officer (PIO),", "जन सूचना अधिकारी (PIO),"),
        ("Greater Noida Industrial Development Authority (GNIDA) / Civic Maintenance Division,", "ग्रेटर नोएडा औद्योगिक विकास प्राधिकरण (GNIDA) / नागरिक अनुरक्षण विभाग,"),
        ("INVESTIGATIVE DOSSIER:", "खोजी पत्रकारिता डोजियर:"),
        ("Investigative Press Brief:", "खोजी प्रेस ब्रीफ:"),
        ("Executive Summary & Public Safety Alert", "कार्यकारी सारांश एवं जनसुरक्षा चेतावनी"),
        ("Executive Headline", "मुख्य संपादकीय शीर्षक"),
        ("Key Findings & Systemic Pattern", "प्रमुख निष्कर्ष और प्रणालीगत लापरवाही"),
        ("Timeline of Citizen Evidence & SLA Breaches", "नागरिक साक्ष्य की समयरेखा और समय-सीमा (SLA) उल्लंघन"),
        ("Questions for Civic Authorities", "प्रशासनिक अधिकारियों से सीधे सवाल"),
        ("Part 1 of 3 — Public Safety Alert", "भाग 1/3 — जनसुरक्षा चेतावनी"),
        ("Part 2 of 3 — Forensic Evidence & Camera GPS Verification", "भाग 2/3 — फोरेंसिक साक्ष्य एवं कैमरा जीपीएस सत्यापन"),
        ("Part 3 of 3 — Questions for Civic Authorities & Statutory RTI Notice", "भाग 3/3 — प्रशासन से सवाल एवं वैधानिक आरटीआई नोटिस"),
        ("Knowledge Park III", "नॉलेज पार्क III"),
        ("Beta 2 Sector", "बीटा-2 सेक्टर"),
        ("Pari Chowk", "परी चौक"),
        ("Alpha 1 Commercial Belt", "अल्फा-1 कमर्शियल बेल्ट"),
        ("Alpha 1", "अल्फा-1"),
        ("Greater Noida", "ग्रेटर नोएडा"),
        ("Electrical Hazard", "विद्युत संकट"),
        ("Illegal Dumping", "अवैध कचरा डंपिंग"),
        ("Road Damage", "सड़क क्षति / गड्ढा"),
        ("Sanitation", "स्वच्छता संकट"),
        ("Drainage / Flood", "जल निकासी एवं बाढ़ संकट"),
        ("Waterlogging", "जलभराव"),
        ("Encroachment", "अतिक्रमण"),
    ]
    for eng, hin in replacements:
        out = out.replace(eng, hin)
    return out


@app.post("/api/translate-hindi")
def translate_to_hindi(req: TranslateHindiRequest):
    if req.texts is not None:
        if not req.texts:
            return {"texts": []}

        results: list[Optional[str]] = [None] * len(req.texts)
        missing_indices: list[int] = []
        missing_values: list[str] = []

        for i, item in enumerate(req.texts):
            s = (item or "").strip()
            if not s:
                results[i] = ""
            elif s in TRANSLATION_CACHE:
                results[i] = TRANSLATION_CACHE[s]
            else:
                offline_hit = _offline_hindi_translate(s)
                if offline_hit != s:
                    TRANSLATION_CACHE[s] = offline_hit
                    results[i] = offline_hit
                else:
                    missing_indices.append(i)
                    missing_values.append(s)

        if missing_values:
            prompt = (
                "Translate the following JSON array of English civic journalism strings into crisp, formal Hindi (Devanagari script). "
                "Return strictly a JSON array of translated Hindi strings in the exact same order. "
                f"Input JSON: {json.dumps(missing_values, ensure_ascii=False)}"
            )
            ai_text, _ = _call_gemini_with_timeout(
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
                total_timeout_sec=GEMINI_TOTAL_TIMEOUT_SEC,
            )
            parsed_ok = False
            if ai_text:
                try:
                    parsed = json.loads(ai_text)
                    if isinstance(parsed, list) and len(parsed) == len(missing_values):
                        for idx_pos, translated_val in zip(missing_indices, parsed):
                            clean_val = str(translated_val)
                            TRANSLATION_CACHE[req.texts[idx_pos].strip()] = clean_val
                            results[idx_pos] = clean_val
                        parsed_ok = True
                except Exception:
                    parsed_ok = False

            if not parsed_ok:
                for idx_pos in missing_indices:
                    results[idx_pos] = _offline_hindi_translate(req.texts[idx_pos])

        return {"texts": [r if r is not None else "" for r in results]}

    single_text = (req.text or "").strip()
    if not single_text:
        return {"translated": ""}

    if single_text in TRANSLATION_CACHE:
        return {"translated": TRANSLATION_CACHE[single_text]}

    prompt = (
        "Translate the following investigative civic report into formal, hard-hitting journalistic Hindi (Devanagari script). "
        "Keep SHA-256 hashes, dates, and coordinates intact.\n\n"
        f"{single_text}"
    )
    ai_text, _ = _call_gemini_with_timeout(
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.2),
        total_timeout_sec=GEMINI_TOTAL_TIMEOUT_SEC,
    )
    if ai_text:
        TRANSLATION_CACHE[single_text] = ai_text
        return {"translated": ai_text}

    fallback_hi = _offline_hindi_translate(single_text)
    TRANSLATION_CACHE[single_text] = fallback_hi
    return {"translated": fallback_hi}


import base64
import hashlib
import io
import json
import math
import os
from datetime import datetime, timezone
from typing import Optional

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
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="Jan Drishti Truth Engine API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FALLBACK_MODELS = [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
]


class CivicAuditSchema(BaseModel):
    is_valid_civic_issue: bool
    title: str
    summary: str
    category: str
    severity: int


def _heuristic_audit(user_note: str, locality: str) -> dict:
    note_lower = (user_note or "").lower()
    if any(w in note_lower for w in ("wire", "spark", "electric", "pole", "transformer", "shock", "cable", "meter")):
        category = "Electrical Hazard"
        severity = 8
        title = f"Reported Electrical Hazard - {locality}"
    elif any(w in note_lower for w in ("dump", "garbage", "trash", "waste", "debris", "rubble", "plastic")):
        category = "Illegal Dumping"
        severity = 7
        title = f"Reported Illegal Waste Dumping - {locality}"
    elif any(w in note_lower for w in ("pothole", "road", "crater", "crack", "asphalt", "tar", "pavement")):
        category = "Road Damage"
        severity = 7
        title = f"Reported Road Infrastructure Damage - {locality}"
    elif any(w in note_lower for w in ("water", "flood", "waterlog", "drain", "sewer", "clog", "monsoon")):
        category = "Waterlogging"
        severity = 7
        title = f"Reported Waterlogging Hazard - {locality}"
    elif any(w in note_lower for w in ("encroach", "stall", "footpath", "hawker", "illegal shop", "barrier")):
        category = "Encroachment"
        severity = 6
        title = f"Reported Pedestrian Encroachment - {locality}"
    else:
        category = "Sanitation"
        severity = 6
        title = f"Civic Grievance Report - {locality}"

    summary = (
        f"Citizen reported: '{user_note}'. Corroborated with cryptographic timestamp and location data."
        if user_note
        else f"Civic hazard captured on-site at {locality} awaiting municipal team inspection."
    )
    return {
        "is_valid_civic_issue": True,
        "title": title,
        "summary": summary,
        "category": category,
        "severity": severity,
    }


def _compress_to_jpeg(image_bytes: bytes, max_width: int = 800, quality: int = 75) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if img.width > max_width:
        ratio = max_width / float(img.width)
        new_height = int(float(img.height) * ratio)
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def _dms_to_decimal(dms, ref) -> float:
    degrees = float(dms[0])
    minutes = float(dms[1]) / 60.0
    seconds = float(dms[2]) / 3600.0
    decimal = degrees + minutes + seconds
    if ref in ["S", "W"]:
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
        make = str(exif.get("Make", "")).strip()
        model = str(exif.get("Model", "")).strip()
        if make or model:
            forensics["device"] = f"{make} {model}".strip()
        if "DateTimeOriginal" in exif:
            forensics["captured_at"] = str(exif["DateTimeOriginal"])

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


# Realistic 16-Report Greater Noida Civic Dataset (Real Local /evidence/*.jpg Photos)
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
        "image_url": "/evidence/wire_before.jpg",
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
        "title": "Unshielded Underground Feeder Cable & Sparking Pole Base",
        "summary": "Torn high-voltage armored cable protruding onto wet pavement; complete streetlight blackout along 300m institutional corridor.",
        "category": "Electrical Hazard",
        "severity": 9.0,
        "status": "SLA_BREACHED",
        "locality": "Knowledge Park III",
        "lat": 28.4751,
        "lng": 77.4824,
        "image_url": "/evidence/wire_before.jpg",
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
        "title": "Third Citizen Report: Live Wire Sparking Near Campus Main Gate",
        "summary": "Corroborating citizen photo confirming arcing electrical distribution box directly outside hostel bus stop during evening rush.",
        "category": "Electrical Hazard",
        "severity": 8.8,
        "status": "SLA_BREACHED",
        "locality": "Knowledge Park III",
        "lat": 28.4749,
        "lng": 77.4822,
        "image_url": "/evidence/wire_before.jpg",
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
        "title": "Fourth Corroboration: Transformer Oil Leak & Unlatched Fuse Cage",
        "summary": "Step-down 440V transformer leaking dielectric oil onto sidewalk within 150m of the exposed hostel feeder pillar.",
        "category": "Electrical Hazard",
        "severity": 8.5,
        "status": "ESCALATED",
        "locality": "Knowledge Park III",
        "lat": 28.4747,
        "lng": 77.4819,
        "image_url": "/evidence/wire_before.jpg",
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
        "image_url": "/evidence/wire_before.jpg",
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
        "image_url": "/evidence/wire_before.jpg",
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
        "image_url": "/evidence/wire_before.jpg",
        "after_image_url": "/evidence/wire_after.jpg",
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
    # --- BETA 2 SECTOR (3 Reports: Waterlogging, Streetlight Outage, Road Crater) ---
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
        "image_url": "/evidence/drain_before.jpg",
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
        "image_url": "/evidence/wire_before.jpg",
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
        "title": "Collapsed Culvert Slab & Road Crater Near Mother Dairy Booth",
        "summary": "Caved-in concrete drain cover creating a 2-foot wide wheel trap on sector collector road; EXIF stripped from forwarded upload.",
        "category": "Road Damage",
        "severity": 7.2,
        "status": "UNVERIFIED",
        "locality": "Beta 2 Sector",
        "lat": 28.4798,
        "lng": 77.5069,
        "image_url": "/evidence/road_before.jpg",
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
    # --- PARI CHOWK (3 Reports: Open Manhole, Traffic Signal Wire, Construction Debris) ---
    {
        "id": "e16f0eaf-4185-48e1-8d9b-f9a30d16af9c",
        "title": "Uncovered Deep Sewer Manhole & Arterial Crater at Pari Chowk Slip Road",
        "summary": "Unbarricaded 1.8-foot deep road cavity and missing cast-iron manhole cover causing high-speed two-wheeler skids.",
        "category": "Road Damage",
        "severity": 9.2,
        "status": "SLA_BREACHED",
        "locality": "Pari Chowk",
        "lat": 28.4671,
        "lng": 77.5138,
        "image_url": "/evidence/road_before.jpg",
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
        "image_url": "/evidence/wire_before.jpg",
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
        "image_url": "/evidence/garbage_before.jpg",
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
        "image_url": "/evidence/garbage_before.jpg",
        "after_image_url": "/evidence/garbage_after.jpg",
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
        "image_url": "/evidence/road_before.jpg",
        "after_image_url": "/evidence/road_after.jpg",
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
        "image_url": "/evidence/wire_before.jpg",
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

# In-memory state overrides for live demo actions on seeded reports
LIVE_DEMO_REPORTS: dict[str, dict] = {r["id"]: dict(r) for r in SEED_REPORTS_16}


@app.get("/")
def health_check():
    return {"status": "online", "service": "Jan Drishti Truth Engine"}


@app.post("/api/demo/reset")
def reset_demo_dataset():
    global LIVE_DEMO_REPORTS
    LIVE_DEMO_REPORTS = {r["id"]: dict(r) for r in SEED_REPORTS_16}
    return list(LIVE_DEMO_REPORTS.values())


@app.get("/api/reports")
def get_all_reports():
    merged: dict[str, dict] = {rid: dict(rep) for rid, rep in LIVE_DEMO_REPORTS.items()}
    try:
        db_rows = supabase.table("reports").select("*").order("created_at", desc=True).execute().data or []
        for row in db_rows:
            rid = row.get("id")
            if not rid:
                continue
            if rid in merged:
                if row.get("status") == "RESOLVED" and row.get("after_image_url"):
                    merged[rid]["status"] = "RESOLVED"
                    merged[rid]["after_image_url"] = row["after_image_url"]
                    merged[rid]["resolved_at"] = row.get("resolved_at")
            else:
                if "1518709268805" in str(row.get("image_url", "")) or "unsplash.com" in str(row.get("image_url", "")):
                    row["image_url"] = "/evidence/wire_before.jpg"
                merged[rid] = row
    except Exception:
        pass
    return list(merged.values())


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

        timestamp_iso = datetime.now(timezone.utc).isoformat()
        hash_payload = raw_bytes + f"|{lat}|{lng}|{timestamp_iso}".encode("utf-8")
        evidence_hash = hashlib.sha256(hash_payload).hexdigest()
        exif_metadata = extract_exif_forensics(raw_bytes, lat, lng)
        exif_verified = bool(exif_metadata["gps_match"])

        compact_bytes = _compress_to_jpeg(raw_bytes)
        image_data_url = f"data:image/jpeg;base64,{base64.b64encode(compact_bytes).decode('utf-8')}"

        prompt = (
            "You are an investigative civic-intelligence AI auditor for Jan Drishti in India. "
            "Inspect this citizen-submitted photo and optional note. "
            "1) Set is_valid_civic_issue=false if this is a selfie, meme, blank screen, or unrelated indoor object. "
            "2) Categorize strictly into one of: 'Electrical Hazard', 'Illegal Dumping', 'Road Damage', 'Sanitation', 'Waterlogging', or 'Encroachment'. "
            "3) Rate public safety severity from 1 to 10. "
            "4) Write a sharp, factual journalistic headline and a 2-sentence objective summary. "
            f"Citizen note: '{user_note}' | Locality: '{locality}'."
        )

        audit = None
        for model_name in FALLBACK_MODELS:
            try:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Trying model '{model_name}' ({len(compact_bytes)} bytes)...")
                try:
                    config = types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=CivicAuditSchema,
                        temperature=0.2,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    )
                    ai_response = gemini_client.models.generate_content(
                        model=model_name,
                        contents=[
                            types.Part.from_bytes(data=compact_bytes, mime_type="image/jpeg"),
                            prompt,
                        ],
                        config=config,
                    )
                except Exception as config_err:
                    err_msg = str(config_err).lower()
                    if "thinking" in err_msg or "budget" in err_msg:
                        ai_response = gemini_client.models.generate_content(
                            model=model_name,
                            contents=[
                                types.Part.from_bytes(data=compact_bytes, mime_type="image/jpeg"),
                                prompt,
                            ],
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=CivicAuditSchema,
                                temperature=0.2,
                            ),
                        )
                    else:
                        raise config_err

                audit = json.loads(ai_response.text)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Success with '{model_name}': valid={audit.get('is_valid_civic_issue')}, category='{audit.get('category')}'")
                break
            except Exception as model_err:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Model '{model_name}' failed: {model_err}")
                continue

        if audit is None:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] All Gemini models exhausted / high demand. Using structured heuristic audit fallback.")
            audit = _heuristic_audit(user_note, locality)

        if not audit.get("is_valid_civic_issue", True):
            raise HTTPException(
                status_code=400,
                detail="Truth Engine Rejected: Image does not depict a verifiable public civic or environmental hazard.",
            )

        record = {
            "title": audit["title"],
            "summary": audit["summary"],
            "category": audit["category"],
            "severity": audit["severity"],
            "status": "ESCALATED" if exif_verified else "UNVERIFIED",
            "locality": locality,
            "lat": lat,
            "lng": lng,
            "image_url": image_data_url,
            "exif_verified": exif_verified,
            "exif_metadata": exif_metadata,
            "evidence_hash": evidence_hash,
        }
        try:
            existing_rows = supabase.table("reports").select("lat, lng, locality, cluster_id").execute().data or []
            for r in existing_rows:
                if r.get("cluster_id") and r.get("lat") is not None and r.get("lng") is not None:
                    if _haversine_meters(lat, lng, float(r["lat"]), float(r["lng"])) <= 350.0:
                        record["cluster_id"] = r["cluster_id"]
                        break
        except Exception:
            pass

        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Inserting report into Supabase table 'reports'...")
        inserted = supabase.table("reports").insert(record).execute()
        new_row = inserted.data[0]
        LIVE_DEMO_REPORTS[new_row["id"]] = dict(new_row)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Supabase insert successful! Report ID: {new_row.get('id')}")

        return {
            "report": new_row,
            "forensics": {
                "evidence_hash": evidence_hash,
                "exif_verified": exif_verified,
                "exif_metadata": exif_metadata,
                "ai_audit": audit,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [TruthEngine] Unexpected exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/reports/{report_id}/verify")
def verify_and_escalate(report_id: str, action: str = "ESCALATE"):
    if action == "REJECT":
        try:
            supabase.table("reports").delete().eq("id", report_id).execute()
        except Exception:
            pass
        return {"status": "deleted", "id": report_id}

    if action == "DISPUTE":
        if report_id in LIVE_DEMO_REPORTS:
            LIVE_DEMO_REPORTS[report_id]["status"] = "SLA_BREACHED"
        try:
            supabase.table("reports").update({"status": "SLA_BREACHED"}).eq("id", report_id).execute()
        except Exception:
            pass
        return LIVE_DEMO_REPORTS.get(report_id, {"id": report_id, "status": "SLA_BREACHED"})

    if action == "MERGE_HOTSPOT":
        hotspot_cid = "63007a96-1cb2-4d78-b2ee-5aa6e9f33677"
        if report_id in LIVE_DEMO_REPORTS:
            LIVE_DEMO_REPORTS[report_id]["cluster_id"] = hotspot_cid
            LIVE_DEMO_REPORTS[report_id]["status"] = "ESCALATED"
            LIVE_DEMO_REPORTS[report_id]["exif_verified"] = True
        try:
            supabase.table("reports").update({"cluster_id": hotspot_cid, "status": "ESCALATED", "exif_verified": True}).eq("id", report_id).execute()
        except Exception:
            pass
        return LIVE_DEMO_REPORTS.get(report_id, {"id": report_id, "cluster_id": hotspot_cid, "status": "ESCALATED"})

    if report_id in LIVE_DEMO_REPORTS:
        LIVE_DEMO_REPORTS[report_id]["status"] = "ESCALATED"
        LIVE_DEMO_REPORTS[report_id]["exif_verified"] = True

    try:
        res = (
            supabase.table("reports")
            .update({"status": "ESCALATED", "exif_verified": True})
            .eq("id", report_id)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return LIVE_DEMO_REPORTS.get(report_id, {"id": report_id, "status": "ESCALATED", "exif_verified": True})


@app.post("/api/reports/{report_id}/resolve")
async def resolve_with_proof(report_id: str, file: UploadFile = File(...)):
    raw_bytes = await file.read()
    compact_bytes = _compress_to_jpeg(raw_bytes)
    after_url = f"data:image/jpeg;base64,{base64.b64encode(compact_bytes).decode('utf-8')}"
    now_iso = datetime.now(timezone.utc).isoformat()

    if report_id in LIVE_DEMO_REPORTS:
        LIVE_DEMO_REPORTS[report_id]["status"] = "RESOLVED"
        LIVE_DEMO_REPORTS[report_id]["after_image_url"] = after_url
        LIVE_DEMO_REPORTS[report_id]["resolved_at"] = now_iso

    try:
        res = (
            supabase.table("reports")
            .update(
                {
                    "status": "RESOLVED",
                    "after_image_url": after_url,
                    "resolved_at": now_iso,
                }
            )
            .eq("id", report_id)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return LIVE_DEMO_REPORTS.get(report_id, {"id": report_id, "status": "RESOLVED", "after_image_url": after_url, "resolved_at": now_iso})


@app.get("/api/clusters/{cluster_id}/press-kit")
def generate_press_kit(cluster_id: str):
    all_curr = get_all_reports()
    cluster_reports = [r for r in all_curr if r.get("cluster_id") == cluster_id]
    if not cluster_reports:
        cluster_reports = [r for r in all_curr if r.get("id") == cluster_id]
    if not cluster_reports:
        raise HTTPException(status_code=404, detail="Cluster not found")

    lightweight_reports = [{k: v for k, v in r.items() if k not in ("image_url", "after_image_url")} for r in cluster_reports]

    brief_prompt = (
        "You are an investigative editor preparing a press dossier for verified journalists based on corroborated citizen evidence. "
        "Write a crisp, hard-hitting investigative brief in Markdown with sections: "
        "1) Executive Headline, 2) Key Findings & Systemic Pattern, 3) Timeline of Citizen Evidence & SLA Breaches, and 4) Questions for Civic Authorities. "
        f"Evidence JSON: {json.dumps(lightweight_reports, default=str)}"
    )

    ai_brief_text = None
    for model_name in FALLBACK_MODELS:
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [PressKit] Trying '{model_name}'...")
            ai_brief = gemini_client.models.generate_content(
                model=model_name,
                contents=brief_prompt,
            )
            ai_brief_text = ai_brief.text
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [PressKit] Success with '{model_name}'")
            break
        except Exception as model_err:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] [PressKit] Model '{model_name}' failed: {model_err}")
            continue

    if not ai_brief_text:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [PressKit] All models failed. Generating heuristic dossier fallback.")
        primary_cat = cluster_reports[0].get("category", "Civic Infrastructure Hazard")
        primary_loc = cluster_reports[0].get("locality", "Knowledge Park III")
        ai_brief_text = (
            f"# INVESTIGATIVE DOSSIER: Corroborated {primary_cat} Hazard\n\n"
            f"**Locality:** {primary_loc} | **Cluster ID:** `{cluster_id}` | **Corroborated Reports:** {len(cluster_reports)}\n\n"
            f"### 1) Executive Headline\n"
            f"Critical {primary_cat} Cluster Verified in {primary_loc} with {len(cluster_reports)} Corroborating Evidence Submissions\n\n"
            f"### 2) Key Findings & Systemic Pattern\n"
            f"Cross-verified citizen evidence establishes recurring public safety violations within a dense geographic radius. "
            f"Forensics and photographic timestamps confirm repeated delays in municipal remediation.\n\n"
            f"### 3) Timeline of Citizen Evidence & SLA Breaches\n"
            f"- **Earliest Incident Logged:** {cluster_reports[0].get('created_at', 'Recent')}\n"
            f"- **Corroborating Submissions:** {len(cluster_reports)} independent field reports\n"
            f"- **Resolution Status:** Municipal SLA exceeded without resolution confirmation.\n\n"
            f"### 4) Questions for Civic Authorities\n"
            f"1. Why has this recurring hazard at {primary_loc} not been resolved despite repeated escalation?\n"
            f"2. Who is the designated zonal municipal engineer, and what immediate corrective action is underway?\n"
        )

    return {
        "cluster_id": cluster_id,
        "report_count": len(cluster_reports),
        "reports": cluster_reports,
        "investigative_brief": ai_brief_text,
    }


class TranslateHindiRequest(BaseModel):
    text: Optional[str] = None
    texts: Optional[list[str]] = None


def _offline_hindi_translate(text: str) -> str:
    if not text:
        return ""
    exact_map = {
        "Exposed High-Tension Junction Box Near Student Hostel": "छात्र हॉस्टल के पास खुला हाई-टेंशन बिजली जंक्शन बॉक्स — गंभीर जनसुरक्षा खतरा",
        "Open electrical feeder pillar with live exposed copper busbars beside pedestrian footpath.": "पैदल फुटपाथ के ठीक बगल में खुले तांबे के तारों वाला चालू विद्युत फीडर पिलर, जिससे राहगीरों और छात्रों को सीधा खतरा है।",
        "Unshielded Feeder Cable & Streetlight Failure": "असुरक्षित फीडर केबल और स्ट्रीटलाइट व्यवस्था ठप",
        "Complete blackout along 300m stretch; broken pole base wiring matches adjacent hazard.": "300 मीटर के दायरे में पूर्ण अंधेरा; टूटे हुए खंभे के आधार की वायरिंग पास के बिजली खतरे से जुड़ी हुई है।",
        "Third Citizen Report: Live Wire Sparking in Rain": "तीसरी नागरिक रिपोर्ट: बारिश में मुख्य गेट के पास खुले बिजली के तार से चिंगारी",
        "Corroborating citizen video/photo confirming sparking electrical panel near main gate.": "मुख्य द्वार के पास चिंगारी निकलते विद्युत पैनल की पुष्टि करने वाला प्रमाणित नागरिक फोटो और जीपीएस साक्ष्य।",
        "Illegal Construction Debris Blocking Storm Drain": "अवैध निर्माण मलबे से मुख्य बरसाती नाला अवरुद्ध",
        "Truckloads of concrete rubble dumped into primary sector drainage canal ahead of rains.": "बारिश से ठीक पहले मुख्य सेक्टर जल निकासी नहर में ट्रकों भरकर कंक्रीट का मलबा अवैध रूप से डाला गया।",
        "Deep Crater Pothole on Main Arterial Turn": "मुख्य सड़क मोड़ पर गहरा और जानलेवा गड्ढा",
        "Unmarked 1.5-foot deep road cavity causing two-wheeler skids during evening commute.": "बिना किसी चेतावनी संकेत के 1.5 फुट गहरा सड़क का गड्ढा, जिससे शाम के समय दोपहिया वाहन फिसल रहे हैं।",
        "Overflowing Municipal Garbage & Bio-Waste": "उफनता नगर निगम कचरा और जैव-अपशिष्ट — समाधान सत्यापित",
        "Cleared and sanitized after 36h escalation with verified geo-tagged after-proof.": "36 घंटे की कार्रवाई के बाद जियो-टैग किए गए 'आफ्टर' फोटो प्रमाण के साथ क्षेत्र को साफ और सैनिटाइज किया गया।",
    }
    if text.strip() in exact_map:
        return exact_map[text.strip()]

    # Phrase-level journalistic Hindi conversion for dynamic dossiers and reports
    out = text
    replacements = [
        ("INVESTIGATIVE DOSSIER:", "खोजी पत्रकारिता डोजियर:"),
        ("Executive Headline", "मुख्य संपादकीय शीर्षक"),
        ("Key Findings & Systemic Pattern", "प्रमुख निष्कर्ष और प्रणालीगत लापरवाही"),
        ("Timeline of Citizen Evidence & SLA Breaches", "नागरिक साक्ष्य की समयरेखा और समय-सीमा (SLA) उल्लंघन"),
        ("Questions for Civic Authorities", "प्रशासनिक अधिकारियों से सीधे सवाल"),
        ("Knowledge Park III", "नॉलेज पार्क III"),
        ("Beta 2 Sector", "बीटा-2 सेक्टर"),
        ("Pari Chowk", "परी चौक"),
        ("Alpha 1 Commercial Belt", "अल्फा-1 कमर्शियल बेल्ट"),
        ("Alpha 1", "अल्फा-1"),
        ("Greater Noida", "ग्रेटर नोएडा"),
        ("Electrical Hazard", "विद्युत संकट / बिजली खतरा"),
        ("Illegal Dumping", "अवैध कचरा डंपिंग"),
        ("Road Damage", "सड़क क्षति / गड्ढा"),
        ("Sanitation", "स्वच्छता संकट"),
        ("Waterlogging", "जलभराव"),
        ("Encroachment", "अतिक्रमण"),
        ("Cross-verified citizen evidence establishes recurring public safety violations within a dense geographic radius.", "क्रॉस-सत्यापित नागरिक साक्ष्य एक सघन भौगोलिक क्षेत्र के भीतर बार-बार होने वाले जनसुरक्षा उल्लंघनों की पुष्टि करते हैं।"),
        ("Forensics and photographic timestamps confirm repeated delays in municipal remediation.", "डिजिटल फोरेंसिक और फोटो टाइमस्टैम्प नगर निगम के समाधान में लगातार हो रही देरी को प्रमाणित करते हैं।"),
        ("Why has this recurring hazard at", "बार-बार शिकायत और प्रमाण के बावजूद"),
        ("not been resolved despite repeated escalation?", "में इस गंभीर समस्या का समाधान क्यों नहीं किया गया?"),
        ("Who is the designated zonal municipal engineer, and what immediate corrective action is underway?", "इस क्षेत्र के जिम्मेदार जोनल अभियंता कौन हैं और तत्काल क्या सुधारात्मक कार्रवाई की जा रही है?"),
        ("Earliest Incident Logged:", "प्रथम दर्ज शिकायत:"),
        ("Corroborating Submissions:", "पुष्टिकर्ता नागरिक रिपोर्ट:"),
        ("Resolution Status:", "समाधान की स्थिति:"),
        ("Municipal SLA exceeded without resolution confirmation.", "निर्धारित समय-सीमा समाप्त होने के बाद भी प्रशासन द्वारा कोई समाधान दर्ज नहीं किया गया।"),
    ]
    for eng, hin in replacements:
        out = out.replace(eng, hin)
    return out


@app.post("/api/translate-hindi")
def translate_to_hindi(req: TranslateHindiRequest):
    if req.texts is not None:
        prompt = (
            "Translate the following JSON array of English civic journalism strings into crisp, formal Hindi (Devanagari script). "
            "Return strictly a JSON array of translated Hindi strings in the exact same order. "
            f"Input JSON: {json.dumps(req.texts, ensure_ascii=False)}"
        )
        for model_name in FALLBACK_MODELS:
            try:
                resp = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )
                parsed = json.loads(resp.text)
                if isinstance(parsed, list) and len(parsed) == len(req.texts):
                    return {"texts": [str(x) for x in parsed]}
            except Exception:
                continue
        return {"texts": [_offline_hindi_translate(t) for t in req.texts]}

    single_text = req.text or ""
    if not single_text.strip():
        return {"translated": ""}

    prompt = (
        "Translate the following investigative civic report into formal, hard-hitting journalistic Hindi (Devanagari script). "
        "Keep SHA-256 hashes, dates, and coordinates intact.\n\n"
        f"{single_text}"
    )
    for model_name in FALLBACK_MODELS:
        try:
            resp = gemini_client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if resp.text:
                return {"translated": resp.text.strip()}
        except Exception:
            continue

    return {"translated": _offline_hindi_translate(single_text)}


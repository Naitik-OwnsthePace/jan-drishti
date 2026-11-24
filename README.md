# Jan Drishti

Investigative civic-intelligence platform for reporting, auditing, and tracking local infrastructure and environmental hazards.

## Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS, Vite, Leaflet (CartoDB)
- **Backend:** Python FastAPI, Pillow (EXIF extraction), SHA-256 evidence hashing, Gemini API hazard auditing
- **Database:** Supabase with PostGIS (200m spatial clustering)

## Setup
1. Copy `backend/.env.example` to `backend/.env` and add your API keys.
2. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
3. Frontend: `cd frontend && npm install && npm run dev`

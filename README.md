# Rwanda Opportunity Intelligence

Rwanda Opportunity Intelligence (ROI) is a bilingual-ready web platform for exploring opportunities, comparing a user profile with catalogue requirements, visualizing skill gaps, viewing Rwanda labour-market evidence, building a CV, and tracking practical next steps.

The application is implemented with React/Vite on the frontend and Express/TypeScript on the backend.

## Demo

**Live demo:** <!-- Add the deployed frontend/demo URL here -->

## Current features

### Opportunity exploration

- Browse the opportunity catalogue with pagination and filters for:
  - Opportunity type
  - Status
  - Deadline status
  - Province
  - District
  - Category
- View opportunity details, requirements, location, source, verification, cost, benefits, and application information.
- Find opportunities near the user through browser geolocation and the catalogue's district reference coordinates.
- Distance results are approximate and are not an exact indication of workplace location.

### Profile guidance and matching

- Create a profile covering:
  - Age
  - Location preferences
  - Qualifications and field of study
  - Skills
  - Work experience
  - Projects
  - Interests
  - Career goals
  - Preferred opportunity types
- Match the profile against catalogue opportunities.
- View suitability scores with evidence explanations.
- Add recommended opportunities to a local action plan.

### Eligibility assessment

- Check a profile against an individual opportunity from its detail page.
- The API returns one of two eligibility outcomes:
  - `eligible`
  - `ineligible`
- Eligible results appear green and ineligible results appear red.
- Requirement details are separated into satisfied, unmet, unresolved, and preferred groups.
- Known mandatory skill gaps show the current proficiency, required proficiency, and proficiency difference.
- Unresolved information remains visible as unresolved requirements; it does not become an additional eligibility outcome.
- Eligibility assessments are explanatory guidance, not a promise of selection, admission, hiring, or funding.

### Learning suggestions

- Generate related learning opportunities for identified skill gaps.
- Suggestions include the matched skill, evidence, training type, status, source, and source link.

### Career pathways and NISR evidence

- View labour-market overview, occupation, sector, education, TVET, establishment, and census-derived evidence.
- Explore career directions against opportunity matches and published NISR-based analytics.
- Survey patterns describe populations and do not predict an individual's outcome.

### CV builder

- Build and update a CV through a guided multi-step interface.
- Save CV progress in browser local storage.
- Improve CV text through the backend when AI configuration is available.
- Download a generated Word document.

### Interface

- Light and dark themes.
- Theme preference is stored in browser local storage.
- English, Kinyarwanda, and French interface translations.
- Responsive desktop and mobile layouts.
- Swagger UI/API documentation at `/api-docs`.

## Dataset and demo-data notice

The current opportunity catalogue is temporary demo data:

- `Rwanda Opportunity Intelligence`
- Dataset version `4.0.0`
- Catalogue fixture: `bigdata-hackathon/backend/data/fixtures/rwanda-opportunity-demo-v3.json`
- The current fixture contains 48 opportunity records.

Some fictional opportunity and training records are marked with `DEMO ONLY`. Their criteria, descriptions, organizations, application links, verification state, and learning suggestions must not be interpreted as real job vacancies, official eligibility rules, or confirmed training providers.

The temporary data is used now for frontend, matching, eligibility, chart, suggestion, and near-me testing. We will later collaborate with official opportunity and labour-market sources, including MIFOTRA, KORA, public recruitment portals, universities, TVET providers, and other verified sources.

Future integration should use their official APIs or formally authorized data feeds, source timestamps, verification rules, and update schedules where available. This will replace or supplement temporary fixtures with reliable live information.

## Implemented API routes

### Opportunities

```text
GET  /api/v1/opportunities
GET  /api/v1/opportunities/sources
GET  /api/v1/opportunities/:id
POST /api/v1/opportunities/match
POST /api/v1/opportunities/eligibility
```

Example eligibility body:

```json
{
  "opportunityId": "roi-rwanda-public-service-data-officer-demo",
  "profile": {
    "age": 25,
    "skillDisclosure": "complete",
    "skills": [
      {
        "name": "Spreadsheet analysis",
        "proficiency": "expert"
      },
      {
        "name": "Report writing",
        "proficiency": "advanced"
      }
    ],
    "qualificationDisclosure": "complete",
    "qualifications": [
      {
        "name": "Bachelor of Science in Data Science",
        "level": "Bachelor",
        "fieldOfStudy": "Data Science"
      }
    ]
  }
}
```

### NISR analytics

```text
GET /api/v1/analytics/nisr
GET /api/v1/analytics/nisr/labour-market
GET /api/v1/analytics/nisr/education
GET /api/v1/analytics/nisr/establishments
```

### CV

```text
POST /api/v1/cv/improve
POST /api/v1/cv/docx
```

API documentation is available through Swagger UI at `/api-docs`.

## Current architecture

```text
frontend/
  React + TypeScript
  Vite
  React Router
  TanStack React Query
  Browser geolocation
  Browser local storage

backend/
  Express + TypeScript
  Opportunity fixture repository
  Deterministic eligibility engine
  Profile matching and ranking
  NISR derived analytics
  CV text improvement
  DOCX generation
  Swagger/OpenAPI documentation
```

The opportunity API does not accept an opportunity object supplied by the caller. It loads and validates a record from the configured canonical catalogue, preventing request-side substitution of eligibility criteria.

## Setup

Requirements:

- Node.js
- npm
- Python 3 for analytics tools

### Backend

```bash
cd bigdata-hackathon/backend
npm install
npm run dev
```

The backend normally listens on port `5000`.

### Frontend

```bash
cd bigdata-hackathon/frontend
npm install
cp .env.example .env
npm run dev
```

Configure `.env` with the backend URL:

```text
VITE_API_BASE_URL=http://localhost:5000
```

The frontend production environment can instead point to the deployed backend URL.

## Validation

Run the backend build and targeted opportunity suites:

```bash
cd bigdata-hackathon/backend
npm run build
npx tsx --test src/opportunities/matching.test.ts src/opportunities/opportunityRoutes.test.ts
```

Run the frontend build:

```bash
cd bigdata-hackathon/frontend
npm run build
```

## Roadmap

- Collaborate with MIFOTRA, KORA, and verified opportunity providers.
- Integrate officially approved job, internship, scholarship, training, and TVET APIs.
- Add source freshness, verification status, update timestamps, and automated availability checks.
- Expand district and workplace coordinates using source-confirmed information.
- Improve matching evidence and skill equivalence.
- Add stronger accessibility and localization coverage.
- Add persistent user accounts and saved profiles if explicitly requested and secured.
- Continue separating catalogue data, eligibility results, suitability scores, and real-world outcomes.

# Rwanda Opportunity Intelligence

Rwanda Opportunity Intelligence (ROI) is a decision-support platform that helps Rwandan youth, graduates, and job seekers discover and assess opportunities across jobs, internships, apprenticeships, scholarships, training, entrepreneurship, business support, certifications, education, industrial placements, livelihoods, study loans, and TVET. It compares profiles against published requirements, identifies specific skill gaps, and supports practical next-step planning.

## Problem

Many qualified or potentially qualified people miss opportunities not because they have no relevant skills, but because eligibility criteria are fragmented across portals and difficult to interpret consistently. Qualification levels, proficiencies, work experience, location, and opportunity-specific requirements are often assessed manually and may not be connected to practical next steps or labour-market evidence.

## Solution

ROI turns a user's profile into structured guidance. It:

- compares profile information with individual opportunity requirements;
- distinguishes satisfied, unmet, unresolved, and preferred requirements;
- reports known skill gaps and their required proficiency levels;
- links unmet skills to relevant learning suggestions;
- ranks catalogue opportunities by profile suitability and evidence;
- places opportunities near the user using approximate district-level geolocation;
- connects career exploration with published Rwanda labour-market and establishment data;
- helps users prepare and improve a CV and track an action plan.

The platform does not replace official application procedures, eligibility decisions, or employer verification. Every assessment is clearly identified as guidance, with outcome, source, evidence, and uncertainty represented where available.

ROI is implemented with React and Vite on the frontend, Express and TypeScript on the backend, and Python data tools for processing and deriving NISR analytics.

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

## Data sources and datasets

### Opportunity catalogue

The application uses the temporary `Rwanda Opportunity Intelligence` opportunity catalogue:

- Dataset name: `Rwanda Opportunity Intelligence`
- Dataset version: `4.0.0`
- Catalogue file: `bigdata-hackathon/backend/data/fixtures/rwanda-opportunity-demo-v3.json`
- Coverage: 48 opportunity records
- Recorded source domains include MIFOTRA recruitment, KORA, Rwanda National Internship Programme, KURA, Higher Education Council, HECMIS, and Rwanda Polytechnic.

The fixture contains both source-linked records and explicitly marked synthetic records used for interface and integration testing. Records marked `DEMO ONLY` must not be interpreted as real vacancies, official eligibility rules, confirmed providers, or actionable application guarantees.

The opportunity catalogue is temporary. Future releases will prioritize formally authorized APIs and data feeds from MIFOTRA, KORA, public recruitment portals, universities, TVET providers, and other verified institutions. Each integration should preserve source URLs, update timestamps, verification status, record freshness, and documented eligibility criteria.

### Rwanda labour-market and establishment data

The backend serves derived analytics from two NISR datasets:

| Dataset | Coverage | Local source |
| --- | --- | --- |
| Rwanda Labour Force Survey 2025 | Labour-force status, employment, unemployment, participation, education, occupation, and youth indicators | `bigdata-hackathon/backend/data/nisr/labour_force_survey_2025/RW_LFS2025.dta` |
| Rwanda Establishment Census 2023 | Establishment workforce, district, sector, ownership, and economic activity measures | `bigdata-hackathon/backend/data/nisr/establishment_census_2023/data-rwa-nisr-ec-2023v2.dta` |

The Excel variable codebook at `bigdata-hackathon/backend/data/nisr/labour_force_survey_2025/Var_descr_RW_LFS2025.xlsx` is used to interpret Labour Force Survey variables. Source metadata, file hashes, methodology, weighted estimates, and derived outputs are retained in:

- `bigdata-hackathon/backend/data/derived/nisr-analytics.json`
- `bigdata-hackathon/backend/tools/build_nisr_analytics.py`

The Python tooling uses Pandas and Pyreadstat to read Stata `.dta` data, read the Excel codebook, calculate weighted labour-market indicators, aggregate establishment workforce measures, and produce the JSON consumed by the API. Labour Force Survey estimates use the `weight2` annual weight; establishment census workforce measures are sums of the supplied census fields.

The derived analytics describe populations and published aggregate patterns. They do not predict an individual's employment outcome, suitability, or likelihood of being selected for an opportunity.

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

data tooling/
  Python 3
  Pandas
  Pyreadstat
  OpenPyXL
  Stata .dta and Excel codebook processing
  Weighted NISR analytics generation
```

The opportunity API does not accept an opportunity object supplied by the caller. It loads and validates a record from the configured canonical catalogue, preventing request-side substitution of eligibility criteria.

## Setup

Run the following commands from the repository root.

Requirements:

- Node.js
- npm
- Python 3 with Pandas, Pyreadstat, and OpenPyXL for NISR analytics generation

Install the Python analytics dependencies:

```bash
cd bigdata-hackathon/backend
python -m pip install -r requirements-analytics.txt
python tools/build_nisr_analytics.py
```

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

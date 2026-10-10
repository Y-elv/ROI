# 🇷🇼 Rwanda Opportunity Intelligence

### Data-driven Labour Market Intelligence, Skills-Gap Analysis & Opportunity Pathways

> **An open, data-driven platform that connects labour-market supply, skills, education, experience, businesses and opportunities using Rwanda's official statistical and public data ecosystem.**

---

## 📌 Overview

**Rwanda Opportunity Intelligence** is a web-based labour-market intelligence platform designed to transform fragmented labour-market information into actionable insights for:

- Students
- Graduates
- Job seekers
- Career guidance providers
- Universities and training institutions
- Employers
- Policymakers and development organisations

The platform combines statistical information from **NISR** with publicly available and, where formally authorized, interoperable information from Rwanda's labour-market ecosystem, including **MIFOTRA/LMIS**, Kora, graduate-tracer information and professional internship programmes.

Rather than functioning as another conventional job board, the platform focuses on the relationship between:

```text
Education
    ↓
Skills
    ↓
Experience
    ↓
Occupation
    ↓
Industry
    ↓
Geography
    ↓
Labour-market demand
    ↓
Opportunities
```

The objective is to help users understand **where they fit in the labour market, what gaps exist, and which pathways can help them move toward relevant opportunities**.

---

# 🎯 Problem

Labour-market information is distributed across multiple statistical and institutional sources.

NISR provides extensive information about Rwanda's:

- population
- labour force
- employment
- unemployment
- education
- fields of study
- work experience
- occupations
- industries
- earnings
- geographic distribution
- establishments

MIFOTRA and the Rwanda Labour Market Information System provide complementary information around:

- labour-market demand
- occupations
- skills
- vacancies
- employment programmes
- career guidance
- internships
- graduate outcomes

The existence of these separate information sources creates an opportunity for an intelligence layer that can connect the signals without replacing the institutions that produce them.

### Core challenge

> **How can available labour-market data be transformed into understandable, explainable and actionable information about skills, opportunities and career pathways?**

---

# 💡 Solution

Rwanda Opportunity Intelligence provides three major experiences.

## 1. Career Navigator

For students, graduates and job seekers.

Users can provide:

- education level
- field of study
- skills
- experience
- location
- target occupation
- career interests

The system then analyses their profile against available labour-market information.

Example:

```text
Your Profile

Education:
Bachelor's — Computer Science

Experience:
0 years

Skills:
Python
SQL
JavaScript

Target:
Software Developer
```

The system can produce:

```text
Education alignment       ██████████  100%
Skill alignment           ███████░░░   70%
Experience alignment      ███░░░░░░░   30%
Occupation alignment      ██████████  100%
```

The platform then explains the result rather than simply producing an unexplained score.

---

# 2. Skills & Opportunity Intelligence

The platform analyses labour-market signals to identify:

- frequently requested skills
- occupations
- sectors
- geographic opportunity
- experience requirements
- education requirements
- potential skills gaps
- emerging opportunities

Example:

```text
Occupation: Software Development

Frequently observed skills:

Python       █████████████
SQL          ███████████
Git          █████████
Cloud        ███████
Docker       █████
```

A user can compare these signals with their own profile.

---

# 3. Rwanda Labour-Market Intelligence Dashboard

A second interface is designed for institutions.

Users can explore:

```text
District
   ↓
Industry
   ↓
Occupation
   ↓
Skills
   ↓
Employment
   ↓
Opportunities
```

The dashboard can visualize:

- labour supply
- labour demand
- employment
- establishments
- workers
- occupations
- skills
- vacancies
- geographic concentration
- education/occupation relationships

This enables users to investigate questions such as:

> Where is a particular economic activity concentrated?

> Which occupations are associated with a particular sector?

> What skills are commonly requested?

> How does labour supply compare with observed demand?

---

# 🧠 Data & Methodology

The platform follows a **data-first architecture**.

We do not allow an AI model to invent labour-market statistics.

The numerical results are generated from structured data and deterministic analytical methods.

AI is used only where it adds value, such as:

- extracting skills from unstructured job descriptions
- classifying job descriptions
- semantic similarity
- explaining analytical results
- natural-language interaction with the platform

---

# 📊 Primary Data Sources

## NISR

The project uses publicly available NISR statistical products and public-use datasets where licensing/access conditions permit.

Potential sources include:

### Labour Force Survey

Used for information related to:

- employment
- unemployment
- education
- experience
- occupation
- industry
- labour-force status
- geography
- earnings
- job characteristics

Official source:

https://statistics.gov.rw/data-sources/surveys/Labour-Force-Survey

### Establishment Census 2023

Used for:

- establishments
- economic activities
- establishment size
- workers
- geography
- formal/informal status

Official source:

https://microdatabk.statistics.gov.rw/catalog/112

---

# 🇷🇼 MIFOTRA / Labour-Market Sources

The platform may integrate publicly available information from Rwanda's labour-market ecosystem.

Potential sources include:

### Rwanda Labour Market Information System

LMIS provides labour-market analytical information around:

- employment
- occupations
- skills
- vacancies
- labour-market trends
- career information
- employment programmes

Official platform:

https://www.lmis.rw/

### Kora Job Portal

Kora is a MIFOTRA employment platform connecting job seekers and employers.

Official platform:

https://jobportal.kora.rw/

### Graduate Tracer Information

Graduate tracer information can provide evidence concerning:

- graduate employment
- career outcomes
- further education
- employment challenges
- education/employment relationships

Only publicly released or formally authorized data should be used.

### Professional Internship Programme

The Professional Internship Portal provides information related to graduate internship pathways.

Official platform:

https://www.internship.rw/

---

# ⚠️ Data Access & Privacy

The project distinguishes between three categories of information.

## 🟢 Public Data

Examples:

- published statistics
- public-use datasets
- public reports
- public dashboards
- publicly displayed opportunities

These may be used subject to the relevant source's terms and attribution requirements.

## 🟡 Authorized Institutional Data

Examples:

- authenticated APIs
- private Kora datasets
- individual graduate records
- individual internship records
- restricted LMIS datasets

These are used **only if official authorization is obtained**.

## 🔴 Private Data

The project does not attempt to:

- bypass authentication
- access restricted databases
- collect private personal information without authorization
- circumvent API controls
- expose personally identifiable information

The prototype should operate using public/authorized data only.

---

# 🏗️ Architecture

The repository is organized as a monorepo.

```text
rwanda-opportunity-intelligence/
│
├── apps/
│   │
│   ├── frontend/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   ├── public/
│   │   ├── styles/
│   │   └── ...
│   │
│   └── backend/
│       ├── src/
│       │   ├── api/
│       │   ├── services/
│       │   ├── analytics/
│       │   ├── matching/
│       │   ├── ingestion/
│       │   ├── models/
│       │   └── utils/
│       └── ...
│
├── data/
│   ├── raw/
│   ├── processed/
│   ├── geography/
│   └── schemas/
│
├── notebooks/
│   ├── exploration/
│   ├── cleaning/
│   ├── analysis/
│   └── validation/
│
├── docs/
│   ├── methodology/
│   ├── data-sources/
│   ├── architecture/
│   └── decisions/
│
├── scripts/
│   ├── ingestion/
│   ├── processing/
│   └── build/
│
├── package.json
├── README.md
└── LICENSE
```

---

# 🎨 Frontend

## Technology

The frontend is designed as a responsive web application.

Primary technologies:

- Next.js
- React
- TypeScript
- Tailwind CSS
- MapLibre GL JS
- Recharts or Apache ECharts

### Frontend responsibilities

The frontend handles:

- user interaction
- profile creation
- dashboards
- charts
- maps
- opportunity exploration
- skills-gap visualization
- career-pathway presentation
- API communication
- responsive mobile interface

---

# 🖥️ Frontend Pages

Potential application routes:

```text
/
├── /dashboard
├── /career
├── /career/profile
├── /career/matches
├── /skills
├── /opportunities
├── /map
├── /insights
├── /occupation/[id]
├── /industry/[id]
└── /about
```

---

# 🗺️ Mapping

The application uses **MapLibre GL JS** for interactive mapping.

MapLibre:

https://maplibre.org/

Geographic boundaries can be stored as GeoJSON.

Example:

```text
data/geography/rwanda-districts.geojson
```

The map can visualize:

- employment
- establishments
- workers
- opportunities
- skill gaps
- industry concentration
- district-level indicators

No proprietary Google Maps dependency is required.

---

# 📈 Visualization

The dashboard can contain:

### Labour Supply

```text
Employment
Unemployment
Experience
Education
Occupation
```

### Labour Demand

```text
Vacancies
Skills
Occupations
Experience requirements
```

### Business Structure

```text
Establishments
Workers
Industry
Size
District
```

### Opportunity

```text
Jobs
Internships
Training
Career pathways
```

---

# ⚙️ Backend

The backend provides:

- data processing
- analytical calculations
- matching
- filtering
- aggregation
- API endpoints
- data validation
- optional AI/NLP services

The backend should be designed to work independently of the frontend.

---

# 🔌 API Design

Example endpoints:

```text
GET /api/health

GET /api/districts

GET /api/occupations

GET /api/industries

GET /api/skills

GET /api/opportunities

GET /api/labour-market

GET /api/skills/demand

GET /api/skills/gaps

POST /api/match

POST /api/profile/analyze

GET /api/insights
```

---

# 🧮 Matching Engine

The initial matching system is deterministic.

A conceptual score may use:

```text
Match Score =
    Education Alignment
  + Skill Alignment
  + Occupation Alignment
  + Experience Alignment
  + Location Alignment
```

Example:

```text
Education       25%
Skills          30%
Occupation      20%
Experience      15%
Location        10%
```

The exact weights must be validated experimentally rather than presented as scientifically established before testing.

---

# 🧠 Skill Matching

Skill matching can use several levels.

## Level 1 — Exact matching

```text
Python == Python
```

## Level 2 — Normalized matching

```text
python
Python
PYTHON
```

are normalized to the same representation.

## Level 3 — Synonym/ontology matching

```text
Machine Learning
ML
Machine-learning
```

may be mapped to a common concept.

## Level 4 — Semantic matching

Embeddings can be used to compare related descriptions.

Example:

```text
"develop web applications"

≈

"web application development"
```

---

# 🤖 AI/NLP Layer

AI is optional and modular.

Possible capabilities:

### Job description extraction

```text
Input:
Job advertisement

        ↓

NLP

        ↓

Occupation
Skills
Education
Experience
Industry
```

### Natural-language explanation

The analytical engine produces:

```text
Skill alignment = 68%
Experience alignment = 40%
```

The language model may explain:

> Your education is aligned with the selected occupation, while the largest difference is in the experience requirements and several technical skills.

The model does **not** generate the underlying statistics.

---

# 🧪 Data Pipeline

The data pipeline follows:

```text
SOURCE
  ↓
INGESTION
  ↓
RAW DATA
  ↓
VALIDATION
  ↓
CLEANING
  ↓
NORMALIZATION
  ↓
HARMONIZATION
  ↓
AGGREGATION
  ↓
ANALYTICS
  ↓
OPTIMIZED DATA
  ↓
FRONTEND/API
```

---

# 🔄 Data Harmonization

Different datasets use different structures.

The project therefore creates common dimensions.

Example:

```text
Education
Occupation
Industry
District
Province
Experience
Skill
```

These dimensions allow analytical comparisons where statistically appropriate.

### Important methodological rule

NISR Labour Force Survey records and Establishment Census records represent different statistical units.

They must **not** be treated as if they describe the same individual.

Instead, they can be connected through compatible aggregate dimensions such as:

```text
District
Industry
Occupation
Education
```

where the source definitions support the comparison.

---

# 📐 Gap Analysis

The system can calculate indicators such as:

## Skill Demand

```text
Demand(skill) =
vacancies requiring skill
/
total analysed vacancies
```

## Skill Supply

```text
Supply(skill) =
relevant observed workforce with skill
/
relevant workforce
```

## Relative Gap

```text
Gap =
Demand - Supply
```

These are analytical indicators, not direct measurements of causality.

---

# 📍 Geographic Opportunity

The system can calculate geographic indicators using:

```text
District
+
Industry
+
Workers
+
Establishments
+
Opportunities
```

This enables questions such as:

> Where are particular economic activities concentrated?

> Where are relevant establishments located?

> Where are observed opportunities concentrated?

---

# 📊 Data Quality

Every dataset should have a metadata record describing:

```text
Source
Dataset
Year
Population
Unit of analysis
Variables
Missing values
Weighting
Known limitations
License/access conditions
Processing steps
```

Example:

```json
{
  "source": "NISR",
  "dataset": "Labour Force Survey 2025",
  "year": 2025,
  "unit": "person",
  "public_use": true
}
```

---

# ⚖️ Statistical Integrity

The platform follows several rules:

1. Do not treat sample distributions as national estimates without appropriate weighting.
2. Do not combine datasets with incompatible units of analysis.
3. Do not infer causation from correlations.
4. Distinguish published estimates from calculations performed by the project.
5. Preserve source definitions.
6. Display relevant limitations.
7. Do not generalize programme-specific statistics to the entire population.
8. Record the date/version of external data.
9. Never invent unavailable variables.
10. Preserve reproducibility of calculations.

---

# 🔐 Security

The application should:

- validate all API inputs
- sanitize user-provided text
- rate-limit public endpoints where appropriate
- keep secrets in environment variables
- never expose API credentials to the frontend
- avoid storing unnecessary personal information
- avoid storing sensitive candidate information
- use HTTPS in production

---

# 🌍 Responsive Design

The application is designed mobile-first.

Supported layouts:

```text
Mobile
  ↓
Tablet
  ↓
Desktop
  ↓
Large dashboard
```

Important dashboards should remain usable on small screens.

---

# 💰 Cost Strategy

The project is designed for a **free-first deployment strategy**.

## Target infrastructure

### Frontend

Vercel free tier.

### Backend

Where possible:

- serverless/API routes
- static computation
- precomputed datasets

### Mapping

MapLibre + open geographic data.

### Analytics

Python during data preparation and TypeScript/JavaScript for lightweight production calculations.

### AI

AI should remain optional.

The platform must not depend on a paid AI API for its fundamental functionality.

---

# 🚀 Local Development

## Requirements

Recommended:

```text
Node.js 20+
npm
Python 3.11+
Git
```

---

# 📥 Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/rwanda-opportunity-intelligence.git

cd rwanda-opportunity-intelligence
```

Install dependencies:

```bash
npm install
```

Install Python dependencies:

```bash
python -m pip install -r requirements.txt
```

---

# 🔑 Environment Variables

Create:

```text
.env.local
```

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Optional AI provider
AI_API_KEY=

# Optional authorized external integrations
MIFOTRA_API_URL=
MIFOTRA_CLIENT_ID=
MIFOTRA_CLIENT_SECRET=
```

Never commit:

```text
.env
.env.local
*.key
*.secret
```

to GitHub.

---

# ▶️ Run Development

Start the application:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 🧪 Testing

Run frontend/backend tests:

```bash
npm test
```

Run linting:

```bash
npm run lint
```

Run type checking:

```bash
npm run typecheck
```

Run Python data tests:

```bash
pytest
```

---

# 🏭 Production Build

Build:

```bash
npm run build
```

Run:

```bash
npm start
```

---

# ☁️ Deployment

The intended deployment target is Vercel.

Typical process:

```text
GitHub
   ↓
Vercel
   ↓
Build
   ↓
Deploy
   ↓
Public HTTPS URL
```

The application should be configured so that no development-only credentials or local filesystem dependencies are required in production.

---

# 🗂️ Recommended Repository Structure

```text
rwanda-opportunity-intelligence/
│
├── apps/
│   ├── frontend/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── career/
│   │   │   ├── opportunities/
│   │   │   ├── skills/
│   │   │   ├── labour-market/
│   │   │   └── map/
│   │   ├── lib/
│   │   └── public/
│   │
│   └── backend/
│       ├── src/
│       │   ├── api/
│       │   ├── analytics/
│       │   ├── matching/
│       │   ├── services/
│       │   ├── ingestion/
│       │   ├── validation/
│       │   └── models/
│       └── tests/
│
├── data/
│   ├── raw/
│   ├── processed/
│   ├── geography/
│   └── schemas/
│
├── notebooks/
│   ├── exploration/
│   ├── analysis/
│   └── validation/
│
├── scripts/
│   ├── download/
│   ├── clean/
│   ├── transform/
│   └── build/
│
├── docs/
│   ├── architecture/
│   ├── methodology/
│   ├── data/
│   └── decisions/
│
├── requirements.txt
├── package.json
├── README.md
└── LICENSE
```

---

# 🔬 Reproducibility

Every analytical dataset should be generated through reproducible scripts.

Example:

```bash
python scripts/clean/lfs_2025.py

python scripts/clean/establishment_2023.py

python scripts/transform/harmonize.py

python scripts/build/create_analytics.py
```

The resulting processed data should contain metadata identifying:

- source
- source year
- processing version
- transformation date
- methodology

---

# 🧩 Example End-to-End Flow

```text
                 USER
                   │
                   ▼
          Create Career Profile
                   │
                   ▼
        ┌──────────────────────┐
        │ Education            │
        │ Skills               │
        │ Experience           │
        │ Location             │
        │ Target Occupation    │
        └──────────┬───────────┘
                   │
                   ▼
            MATCHING ENGINE
                   │
        ┌──────────┼───────────┐
        ▼          ▼           ▼
      NISR        LMIS       Opportunities
        │          │           │
        └──────────┼───────────┘
                   ▼
            GAP ANALYSIS
                   │
                   ▼
          PATHWAY GENERATOR
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     Skills     Internship   Jobs
     Training   Experience   Opportunities
```

---

# 🧭 Future Extensions

Potential future capabilities include:

- institution dashboards
- employer dashboards
- advanced occupation taxonomy
- skill ontology
- semantic job matching
- internship recommendation
- training recommendation
- regional opportunity forecasting
- employer demand analytics
- graduate outcome analytics
- multilingual support
- Kinyarwanda natural-language interface
- authorized MIFOTRA API integration
- authorized Kora integration
- authorized graduate/internship data integration

These features should only be implemented where data availability, authorization and methodology support them.

---

# 🏆 Hackathon Relevance

The platform is designed around the published NISR Big Data Hackathon evaluation dimensions.

## Problem Understanding & Relevance

The project addresses a measurable labour-market information and skills/opportunity alignment challenge using Rwanda-specific evidence.

## Data Use & Methodology

The system combines and harmonizes relevant official statistical and public information while preserving dataset definitions and limitations.

## Technical Innovation

The project combines:

- data engineering
- statistical analysis
- explainable matching
- geospatial visualization
- NLP
- optional AI
- recommendation logic

## Usability & Design

A responsive web interface provides separate experiences for individuals and institutional users.

## Tangible Impact

The system aims to transform statistical information into practical:

- career guidance
- opportunity discovery
- skills-gap information
- labour-market intelligence

---

# ⚠️ Current Project Status

This repository is under active development.

The final problem statement, datasets and analytical indicators will be finalized only after data validation.

At this stage:

```text
✓ NISR data sources identified
✓ NISR Labour Force data investigated
✓ NISR Establishment Census investigated
✓ MIFOTRA ecosystem investigated
✓ LMIS identified
✓ Kora identified
✓ Graduate Tracer information identified
✓ Professional Internship ecosystem identified
✓ Technical architecture defined

→ Data validation
→ Problem selection
→ Prototype implementation
→ Evaluation
```

The project does **not** claim privileged access to MIFOTRA, Kora, LMIS, GTS or internship databases unless such access is officially granted.

---

# 🤝 Responsible Use

This platform is intended to support informed decisions, not make decisions on behalf of users.

A recommendation or match score should be treated as an analytical aid rather than a guarantee of employment.

Labour-market statistics describe observed patterns and should not be interpreted as deterministic predictions about an individual.

---

# 📚 Official References

### National Institute of Statistics of Rwanda

https://statistics.gov.rw/

### NISR Data Portals

https://statistics.gov.rw/data-portals-e-gddssdds

### NISR Microdata Catalog

https://microdatabk.statistics.gov.rw/home

### NISR Labour Force Survey

https://statistics.gov.rw/data-sources/surveys/Labour-Force-Survey

### NISR Establishment Census 2023

https://microdatabk.statistics.gov.rw/catalog/112

### Rwanda Labour Market Information System

https://www.lmis.rw/

### MIFOTRA

https://www.mifotra.gov.rw/

### Kora Job Portal

https://jobportal.kora.rw/

### Professional Internship Portal

https://www.internship.rw/

### MapLibre

https://maplibre.org/

---

# 👥 Team

**Project:** Rwanda Opportunity Intelligence

**Team:** [Team Name]

**Members:**

- [Member 1]
- [Member 2]

**Competition:** NISR Big Data Hackathon 2026

---

# 📄 License

This repository is developed for the NISR Big Data Hackathon.

The project's source code, datasets and derived analytical outputs are subject to the licenses, terms of use and intellectual-property requirements applicable to each component and source.

Where the hackathon's terms require transfer or assignment of intellectual-property rights to NISR, the team will comply with those requirements.

---

# ⭐ Vision

> **Turn Rwanda's labour-market data into understandable pathways from skills to opportunity.**

The long-term vision is a data-driven ecosystem where statistical information does not remain inside reports and dashboards, but becomes actionable intelligence for people, institutions and decision-makers.

---

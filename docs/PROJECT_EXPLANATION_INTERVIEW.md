# Savan Payrise — Project Explanation (Interview-Ready)

This document is **based on the current codebase** in this repo (MERN: React + Express + MongoDB).

## 1) Problem Statement

### Short (2–3 lines)
Savan Payrise automates annual employee increment calculation from sales KPIs. HR uploads KPI Excel sheets, the backend computes increments and salary impact, and the UI shows a per-employee breakdown to reduce disputes and manual errors.

### Detailed (5–6 lines)
In the existing company process, KPI data lives in spreadsheets and is hard to merge consistently across seasons and employees. Savan Payrise centralizes the flow: HR uploads performance sheets, the backend parses Excel, maps KPI performance into normalized increment contributions, and calculates the final increment percent and salary numbers. The system stores both the uploaded file metadata and computed outputs (season-wise, yearly, and final), so results are traceable and explainable. Employees can log in to view their own results, reducing back-and-forth with HR.

### Keywords
Increment automation, auditability, Excel ingestion, role-based access, dispute reduction

## 2) Project Architecture

### Short (2–3 lines)
The React (Vite) frontend calls Express APIs via Axios using cookie-based JWT auth. Express validates + parses Excel uploads, stores data in MongoDB via Mongoose, and returns computed results to the UI.

### Detailed (5–6 lines)
Frontend is React (Vite) with an Axios client configured with `withCredentials` so the auth cookie is included. Backend is Express with middleware like Helmet, Morgan, and a CORS allowlist. Authentication uses a JWT stored in an httpOnly cookie; routes enforce role checks (HR vs employee). MongoDB persists employees, yearly increment records, and uploaded file metadata; Mongoose schemas enforce unique constraints (e.g., one record per employee per year).

### Keywords
React/Vite, Axios, Express, JWT cookie, Mongoose, CORS allowlist

## 3) Complete Data Flow (System Flow)

### Step-by-step
1. HR logs in → backend sets JWT cookie (role = `hr`).
2. HR selects year + season + metric on dashboard.
3. Frontend uploads Excel to template validation endpoint (structure validation).
4. If valid, frontend uploads Excel to metric upload endpoint.
5. Backend parses Excel, finds/creates Employee and ensures EmployeeUser exists.
6. Backend upserts IncrementRecord for (year, employee).
7. Backend recomputes season increment, yearly metric increments, activity, final increment %, and salary values.
8. Backend stores UploadedFile metadata (audit + downloads).
9. Frontend reloads season/yearly endpoints and renders updated tables/cards.
10. Employee login shows the same computed results but filtered to their own record.

### Keywords
parse → compute → persist, template validation, upsert, recompute, refresh UI

## 4) Backend Design

### Short (2–3 lines)
Express routers implement API handlers directly, validated using Zod. File uploads use Multer disk storage; Excel parsing converts sheets into per-employee KPIs, then the backend computes and persists increment results.

### Core API groups
- Auth: login/me/logout
- Employees (HR-only): list/create employees
- Increments: upload KPI sheets, read season/month/year summaries, set base salaries, apply behaviour bonus
- Templates (HR-only): upload/validate/download Excel templates

### Keywords
Express Router, Zod validation, Multer upload, Excel parsing, role authorization

## 5) MongoDB Schema (High-Level)

### Collections
- Employees
- EmployeeUsers (employee login)
- HrUsers (HR login)
- IncrementRecords (computed performance + salary for year)
- UploadedFiles (audit for uploaded Excel)
- Years (manual year list)

### Relationships
- EmployeeUsers → Employee (ref)
- IncrementRecords → Employee (ref)
- UploadedFiles is keyed by (year, season, metric)

### Keywords
unique indexes, embedded metric objects, year+employee key

## 6) Salary / Increment Calculation Logic (Exact Behavior)

The system maps KPI performance into increment contributions and then averages them.

### Metric-to-increment mapping
- Sales Return (reverse rule):
  - If return% > 10 → increment contribution = 0
  - If return% = 0 → increment contribution = 18
  - Else linear reverse in [0..10]
- Sales Growth: linear up to 36 based on percent (clamped 0..200)
- NRV: linear up to 18 based on percent (clamped 0..100)
- Payment Collection: linear up to 18 based on percent (clamped 0..100)
- Activity: computed from monthly data (missing months treated as 0) and mapped linearly up to 18

### Aggregations
- Season increment:
  - SeasonInc = (SalesReturnInc + SalesGrowthInc + NrvInc + PaymentCollectionInc) / 4
  - Missing season metrics are treated as 0.
- Yearly per-metric increment:
  - YearMetricInc = (Shiyadu + Unadu + Chomasu) / 3
  - Missing seasons are treated as 0.
- Final increment percent:
  - FinalIncrement% = (YearSalesReturnInc + YearSalesGrowthInc + YearNrvInc + YearPaymentCollectionInc + ActivityInc) / 5
  - Behaviour bonus can add +1% (HR one-time apply).

### Salary numbers
- IncrementAmount = BaseSalary × (FinalIncrement% / 100)
- TotalSalary = BaseSalary + IncrementAmount
- BaseSalary source:
  - If previous year TotalSalary exists → BaseSalary is taken from that and is considered locked.
  - Else BaseSalary is taken from manual entry.

### Simple example
If FinalIncrement% = 15.40 and BaseSalary = 300000:
- IncrementAmount = 300000 × 15.40 / 100 = 46200
- TotalSalary = 346200

### Keywords
zero-fill, clamping, season average, year average, final average /5, continuity via previous-year total

## 7) Frontend Interaction

### Short (2–3 lines)
React calls backend APIs using Axios (`withCredentials`) and renders season/month/year summary tables. HR can upload Excel, download templates/files, export results, and manage base salary/behaviour bonus; employees can view their own results.

### Keywords
Axios withCredentials, HR dashboard, employee self-view, exports

## 8) Data Accuracy & Consistency

- Template upload validates Excel structure before ingesting data.
- Year mismatch detection blocks storing data into the wrong year (frontend can auto-switch).
- Unique indexes prevent duplicate IncrementRecords per (year, employee).
- Derived values are recomputed from stored metrics, preventing partial manual edits from breaking consistency.

### Keywords
validation, uniqueness, recompute, mismatch detection

## 9) Error Handling & Edge Cases

- Auth: invalid or missing token → 401; role mismatch → 403.
- Upload: missing file / invalid year/season/metric → 400.
- Missing data: season/year/monthly gaps are treated as 0 (partial scores still computable).
- Upload failure attempts to delete uploaded files to prevent storage buildup.

### Keywords
401/403, 400 validation, partial compute, cleanup

## 10) Performance Considerations

- Heavy path: Excel parsing + per-employee DB upserts during uploads.
- Read path: indexed queries on year/employee and lean reads for tables.
- Future optimization: prefetch employees, reduce round-trips, use bulkWrite for upserts.

### Keywords
upload hotspot, batching, bulkWrite, indexing

## 11) Scalability

- Move upload/compute to background jobs (queue + worker) for large datasets.
- Add server-side pagination and aggregated summary endpoints.
- Extend schemas with organization structures (region/branch/team) if needed.

### Keywords
async processing, pagination, aggregation, multi-tenant ready

## 12) Security

- JWT stored in httpOnly cookie.
- Passwords stored as bcrypt hashes.
- Helmet enabled; CORS allowlist configured; role-based protection on HR routes.

### Keywords
httpOnly cookie, bcrypt, helmet, CORS allowlist, RBAC

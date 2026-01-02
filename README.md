# Agri Employee Increment System (MERN)

HR-only dashboard to compute yearly salary increment for agriculture sales employees.

## Increment Rules (as per client)

### 6 dependencies (0–18%)
- Sales Return % (reverse + threshold)
- Sales Growth %
- NRV %
- Payment Collection %
- Activity %
- Behaviour %

### Mapping
- For Sales Growth / NRV / Payment Collection / Activity / Behaviour:
  - 0% → 0% increment
  - 100% → 18% increment
  - Linear in-between
- For Sales Return:
  - If employee avg Sales Return % > 10% → 0% increment
  - If 0% → 18% increment
  - Between 0%..10% → linear reverse (0→18, 10→0)

### Season + Year calculations
- Seasons: Shiyadu / Unadu / Chomasu (you label them manually)
- Season increment:
  - (SalesReturnInc + SalesGrowthInc + NRVInc + PaymentCollectionInc) / 4
- Yearly per-metric increment:
  - average of 3 seasons
- Final increment (Option B):
  - (YearSalesReturnInc + YearSalesGrowthInc + YearNRVInc + YearPaymentCollectionInc + ActivityInc + BehaviourInc) / 6

### Salary
- Increment ₹ = BaseSalary * (FinalIncrement% / 100)
- Total Salary = BaseSalary + Increment ₹
- Base salary rule:
  - First year: HR enters base salary manually
  - Next year: base salary auto = previous year total salary
  - New employee next year: base salary = 0

## Folder Structure

- backend/
  - src/
    - app.js (Express app)
    - server.js (boot + DB connect)
    - config/ (env + db)
    - middleware/ (auth)
    - models/ (Mongo schemas)
    - routes/ (API routes)
    - services/ (calculation logic)
    - utils/ (excel parsing helpers)
    - scripts/ (seed scripts)
- frontend/
  - src/
    - pages/
      - LoginPage.jsx
      - DashboardPage.jsx
    - lib/api.js (axios client)

## Setup (local)

### 1) Backend
1. Copy backend env example:
   - Create `backend/.env` based on `backend/.env.example`
2. Install + seed HR user:
   - `cd backend`
   - `npm install`
   - `npm run seed:hr`
3. Run backend:
   - `npm run dev`

Backend runs on `http://localhost:4000`.

### 2) Frontend
1. Copy frontend env example:
   - Create `frontend/.env` based on `frontend/.env.example`
2. Run frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

Frontend runs on `http://localhost:5173`.

### Run backend + frontend
Use two terminals:
- Terminal 1: `cd backend` then `npm run dev`
- Terminal 2: `cd frontend` then `npm run dev`

## Excel input format
- Upload `.xlsx`
- First sheet only
- First row treated as headers
- Backend tries to auto-detect columns:
  - Employee name: header contains `employee` or `name`
  - Percentage: header contains `%`, `percent`, or `percentage`
- If headers are unknown, backend falls back to:
  - Column 1 = Employee Name
  - Column 2 = Percentage

Employee matching uses **Employee Name** (case-insensitive, trimmed).

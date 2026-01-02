# Copilot Instructions: Agriculture Employee Increment System

## Project Architecture

This is a **MERN stack** application (separate backend + frontend, no monorepo) for computing yearly salary increments for agriculture sales employees based on 6 performance dependencies.

### Key Components
- **Backend**: Node/Express ESM with MongoDB Atlas, JWT cookie auth (HR-only)
- **Frontend**: React + Vite (JavaScript), React Router v7, Axios with credentials
- **Data Flow**: Excel uploads → parsing → Mongoose persistence → computed increments → salary calculations

## Critical Business Logic


### Increment Calculation (in `backend/src/services/incrementMath.js`)
1. **4 Sales Metrics** (per season): Sales Return, Sales Growth, NRV, Payment Collection
   - `percentToIncrement18()`: 0%→0%, 100%→18% (linear)
   - **Sales Return is reverse**: >10%→0%, 0%→18% using `salesReturnPercentToIncrement18()`
2. **Season Increment**: For each season (Shiyadu/Unadu/Chomasu), average the 4 metric increments. If a metric is missing, treat as 0.  
   `seasonInc = (SR_inc + SG_inc + NRV_inc + PC_inc) / 4`
3. **Yearly per-metric**: For each metric, average the increment across 3 seasons. If a season is missing, treat as 0.  
   `yearMetricInc = (Shiyadu_inc + Unadu_inc + Chomasu_inc) / 3`
4. **Final Increment**: Average of 6 dependencies (4 yearly metrics + Activity + Behaviour), missing values treated as 0.  
   `finalInc = (yearSR + yearSG + yearNRV + yearPC + activity + behaviour) / 6`
5. **Salary**: `incrementAmount = baseSalary * (finalIncrement% / 100)`, `totalSalary = baseSalary + incrementAmount`

**Zero-fill logic:** All missing values are treated as 0 in all calculations. This ensures partial uploads still show partial results, and no metric is blocked by missing data.

### Base Salary Logic (`backend/src/routes/increments.js`)
- **First year**: HR sets `baseSalaryManual` manually (editable)
- **Next year**: Auto-set `baseSalary = previousYear.totalSalary` (read-only)
- New employees next year start at base 0


**Note:** The project previously used `avgStrict()` to block calculations if any value was missing. Now, all calculations use zero-fill and fixed divisors (by 3, 4, or 6) for averages, so partial data always yields a result.

## Excel Upload Pattern

### File Processing (`backend/src/utils/excel.js`)
- Auto-detects columns: `employee|name` for employee, `%|percent|percentage` for value
- Fallback: column 1=name, column 2=percentage
- Aggregates rows by employee name (case-insensitive, trimmed) using `Map`
- Returns `{ employeeName: avgPercent }` pairs

### Employee Name Matching
- **Critical**: Always use `new RegExp(\`^${escapeRegExp(name)}$\`, 'i')` for case-insensitive exact match
- Function `getOrCreateEmployeeByName()` handles upserts safely
- Never use plain string equality—case-insensitive + trimmed is the source of truth

## Development Workflow

### Running the App (NO root npm scripts)
```bash
# Terminal 1: Backend
cd backend
npm install
npm run seed:hr    # One-time: seeds HR user from .env
npm run dev        # nodemon on port 4000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev        # Vite on port 5173 (or 5174 if 5173 busy)
```

### Environment Setup
1. Copy `backend/.env.example` → `backend/.env` (set MONGO_URI, JWT_SECRET, HR credentials)
2. Copy `frontend/.env.example` → `frontend/.env` (set VITE_API_BASE_URL)
3. Run `npm run seed:hr` in backend to create HR user

### Database Schema (`backend/src/models/IncrementRecord.js`)
- Unique index: `{ year, employee }` (one record per employee per year)
- Nested structure: `seasons.{shiyadu|unadu|chomasu}.{salesReturn|salesGrowth|nrv|paymentCollection}.{pct, inc}`
- Computed fields: `yearMetrics.*Inc`, `finalIncrementPercent`, `incrementAmount`, `totalSalary` (all nullable)

## Frontend Patterns

### Styling (`frontend/src/index.css`)
- CSS variables: `--primary`, `--success`, `--danger`, `--bg`, `--surface`, `--border`
- BEM-like classes: `.btn`, `.btn-primary`, `.btn-tab`, `.card`, `.alert-success`, `.upload-card`
- Use `className="btn btn-primary"` for buttons, not inline styles

### API Client (`frontend/src/lib/api.js`)
- Axios instance with `withCredentials: true` (sends JWT cookie)
- Base URL from `import.meta.env.VITE_API_BASE_URL`

### Dashboard State Management (`frontend/src/pages/DashboardPage.jsx`)
- Tabs: `shiyadu`, `unadu`, `chomasu`, `yearly`
- `seasonRows` vs `yearlyRows` data structures differ (season has 4 metrics, yearly has 6 deps + salary)
- `baseSalaryEdits` tracks local changes before save (only editable if `baseSalarySource === 'manual'`)

## Authentication Flow

1. Login POSTs to `/api/auth/login` → sets httpOnly JWT cookie
2. Frontend calls `/api/auth/me` on mount → sets `authed` state
3. Protected routes: `requireAuth` + `requireHr` middleware on all `/api/increments` and `/api/employees`
4. Logout POSTs to `/api/auth/logout` → clears cookie → navigate to `/login`

## Common Pitfalls

- **Don't batch-update computed fields**: Always call `recomputeYearAndSalary()` after season/activity/behaviour changes
- **Null safety**: Most computed values can be `null`. Use `v == null ? '—' : format(v)` in frontend
- **Season names are hardcoded**: `shiyadu`, `unadu`, `chomasu` (no date mapping—HR labels them manually)
- **Currency formatting**: Use `fmtCurrency()` for Indian Rupee: `₹XX,XXX.XX`
- **No root `package.json`**: Backend and frontend have separate `node_modules`. Run in two terminals.


## When Modifying Calculations

1. Update logic in `backend/src/services/incrementMath.js` (all increment calculations use zero-fill and fixed divisors)
2. Update `recomputeYearAndSalary()` in `backend/src/routes/increments.js` to match business rules
3. Test with partial data uploads (should show partial results, not null)


## Debugging Tips

- Backend logs Morgan HTTP logs: `GET /api/increments/2026/yearly 200 39ms`
- 401s on `/api/auth/me` are expected before login
- Check browser Network tab → Cookies for JWT presence
- MongoDB queries: check unique index violations (duplicate year+employee)

## Quick Reference: Key Files & Patterns

- **Calculation logic:** `backend/src/services/incrementMath.js` (all increment math, zero-fill logic)
- **Salary computation:** `backend/src/routes/increments.js` (`recomputeYearAndSalary`)
- **Excel parsing:** `backend/src/utils/excel.js` (auto-detects columns, case-insensitive employee matching)
- **Frontend dashboard:** `frontend/src/pages/DashboardPage.jsx` (table headers, export logic, state management)
- **API client:** `frontend/src/lib/api.js` (Axios instance, credentials)
- **Styling:** `frontend/src/index.css` (BEM-like classes, CSS variables)

## Example Calculation

Suppose for Sales Growth Inc:
- Shiyadu: 12%
- Unadu: (missing)
- Chomasu: 6%

Yearly Sales Growth Inc = (12 + 0 + 6) / 3 = 6%

If all are missing: (0 + 0 + 0) / 3 = 0%

If only one is present: (value + 0 + 0) / 3

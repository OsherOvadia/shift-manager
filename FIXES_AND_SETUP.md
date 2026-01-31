# Fixes Applied & Setup Instructions

## Issues Fixed

### 1. ✅ Dashboard Showing Fake Data
**Problem:** Dashboard was displaying hardcoded "0" values for all statistics.

**Solution:** Updated dashboard to fetch real data from the API:
- My shifts count for current week
- Availability status (Approved/Pending/Not Submitted)
- Active employees count (for managers)
- Pending availability submissions (for managers)

### 2. ✅ Reports Page Not Loading
**Problem:** Reports/statistics page wasn't showing data.

**Solution:** 
- Added authentication token to API calls
- Added error handling to show specific error messages
- Fixed API connection issues

---

## Important: Database Setup Required

⚠️ **The application won't work fully until you complete these steps:**

### Current Situation
Your project is configured for **SQLite** (local development), but the new features require **PostgreSQL** features:
- Enums (Role, ShiftType, etc.)
- Array fields (weekendDays)
- Date types

### Option 1: Use PostgreSQL Locally (Recommended)

1. **Install PostgreSQL** (if not installed):
   - Download from: https://www.postgresql.org/download/windows/
   - Or use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres`

2. **Update `.env` file** in `apps/api/`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/shiftmanager"
DIRECT_URL="postgresql://postgres:password@localhost:5432/shiftmanager"
```

3. **Run migration**:
```bash
cd apps/api
npx prisma migrate dev --name initial_setup
```

### Option 2: Use Neon PostgreSQL (Cloud - Free Tier)

1. **Create free account**: https://neon.tech
2. **Create a new project** and copy the connection string
3. **Update `.env` file**:
```env
DATABASE_URL="your-neon-connection-string"
DIRECT_URL="your-neon-direct-connection-string"
```
4. **Run migration**:
```bash
cd apps/api
npx prisma migrate deploy
```

---

## After Database Setup

### 1. Generate Prisma Client
```bash
cd apps/api
npx prisma generate
```

### 2. Restart Backend Server
```bash
cd apps/api
npm run dev
```

### 3. Restart Frontend Server
```bash
cd apps/web
npm run dev
```

---

## Testing the Fixes

### Dashboard (should now show real data):
1. Navigate to `/dashboard`
2. You should see:
   - Your shifts count (if you have any scheduled)
   - Availability status
   - For managers: Active employees count and pending availability

### Reports Page (statistics):
1. Navigate to `/dashboard/reports`
2. If you see an error message, check:
   - Backend server is running
   - Database is connected
   - You have completed the database setup above

3. To add data:
   - **Add daily revenue**: Click the edit icon on any day in the daily breakdown
   - **Add tips**: Click the coins icon next to tip-based employees
   - **View statistics**: Revenue vs salary percentages, profit margins, etc.

---

## New Features Available

### 1. Daily Revenue Tracking
- Admins/Managers can enter daily revenue
- Statistics show revenue vs salary costs
- Profit margin calculations
- Salary percentage of revenue

### 2. Tip-Based Salary (for Waiters)
- Mark employees as "tip-based" in employee management
- Set base hourly wage (e.g., 40 NIS/hour)
- Enter tips per shift
- System automatically calculates:
  - If tips cover base salary → Manager pays 0
  - If tips < base salary → Manager pays difference

### Example:
- Base wage: 40 NIS/hour
- Tips earned: 25 NIS/hour
- Hours worked: 8 hours
- **Manager pays: 15 NIS/hour × 8 hours = 120 NIS**

---

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running
- Check DATABASE_URL is correct
- Verify database exists

### "Module not found: @prisma/client"
```bash
cd apps/api
npm install @prisma/client
npx prisma generate
```

### Reports page shows "No data"
- This is normal if you haven't:
  - Created any schedules
  - Assigned shifts to employees
  - Entered daily revenue

### Still seeing errors?
1. Check browser console (F12) for detailed errors
2. Check backend terminal for API errors
3. Verify you're logged in as ADMIN or MANAGER role

---

## Quick Start Checklist

- [ ] Install/Setup PostgreSQL
- [ ] Update .env with database connection
- [ ] Run `npx prisma migrate dev`
- [ ] Run `npx prisma generate`
- [ ] Restart backend server
- [ ] Restart frontend server
- [ ] Create some schedules and assign shifts
- [ ] Test dashboard - should show real numbers
- [ ] Test reports page - should load without errors
- [ ] Add daily revenue to see statistics
- [ ] Mark an employee as tip-based and add tips

---

Need help? Check the console logs in both frontend (F12 in browser) and backend terminal for detailed error messages.

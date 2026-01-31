# Vercel Deployment Guide

## ✅ All Code Changes Are Complete

The database schema and migration files have been created. You just need to deploy!

---

## 🚀 Deploy to Vercel

### Step 1: Set Environment Variables in Vercel

Go to your Vercel project settings and add these environment variables for **BOTH** API and Web apps:

#### For API Project (apps/api):
```
DATABASE_URL=your-neon-postgresql-connection-string
DIRECT_URL=your-neon-direct-connection-string
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key
FRONTEND_URL=https://your-frontend-url.vercel.app
NODE_ENV=production
```

#### For Web Project (apps/web):
```
NEXT_PUBLIC_API_URL=https://your-api-url.vercel.app/api
```

### Step 2: Get Your Neon PostgreSQL Connection Strings

If you don't have Neon PostgreSQL set up yet:

1. Go to https://neon.tech (free tier available)
2. Create a new project
3. Copy the connection strings:
   - **Connection string** → Use for `DATABASE_URL`
   - **Direct connection** → Use for `DIRECT_URL`

Example:
```
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

### Step 3: Deploy (Git Push or Vercel CLI)

#### Option A: Git Push (Recommended)
```bash
git add .
git commit -m "Add daily revenue and tips features"
git push origin main
```

Vercel will automatically:
1. Copy production schema
2. Run migrations (`prisma migrate deploy`)
3. Generate Prisma Client
4. Build the app
5. Deploy

#### Option B: Vercel CLI
```bash
# Deploy API
cd apps/api
vercel --prod

# Deploy Web
cd ../web
vercel --prod
```

---

## 🔍 Verify Deployment

### 1. Check API is Running
Visit: `https://your-api-url.vercel.app/api`

You should see a response (even if it's an error page, it means the API is running).

### 2. Check Database Migration
In your Vercel API deployment logs, look for:
```
✓ Prisma Migrate applied successfully
```

### 3. Test the App
1. Go to your frontend URL
2. Login with your admin account
3. Check Dashboard → Should show real data
4. Go to Reports page → Should load without errors

---

## 📋 What the Build Does

When you deploy to Vercel, this happens automatically:

```bash
# 1. Copy production schema (already in vercel.json)
cp prisma/schema.production.prisma prisma/schema.prisma

# 2. Run database migrations (added to vercel.json)
npx prisma migrate deploy

# 3. Generate Prisma Client (in package.json build script)
npx prisma generate

# 4. Build the NestJS app
nest build
```

---

## 🐛 Troubleshooting

### "Migration failed" Error
- **Cause**: Database connection issue or environment variables not set
- **Fix**: 
  1. Check `DATABASE_URL` and `DIRECT_URL` are correct in Vercel settings
  2. Ensure your Neon database is active
  3. Re-deploy

### "Prisma Client not found"
- **Cause**: Build failed before generating client
- **Fix**: Check build logs in Vercel dashboard for the actual error

### API returns 500 errors
- **Cause**: Database schema doesn't match
- **Fix**: 
  1. Go to Vercel Functions logs
  2. Check the actual error message
  3. You may need to manually run migrations in Neon console

### Frontend can't connect to API
- **Cause**: `NEXT_PUBLIC_API_URL` environment variable not set correctly
- **Fix**: 
  1. Go to Vercel Web project settings
  2. Add `NEXT_PUBLIC_API_URL=https://your-api-url.vercel.app/api`
  3. Redeploy frontend

---

## 📝 Manual Migration (If Needed)

If automatic migration fails, you can run it manually:

1. **Get your database connection string from Neon**

2. **Run migration locally** (one-time):
```bash
cd apps/api
# Set environment variable temporarily
$env:DATABASE_URL="your-neon-connection-string"
npx prisma migrate deploy
```

This will apply the migration directly to your Neon database.

3. **Re-deploy on Vercel** (skip migration this time):
   - Temporarily change `vercel.json` buildCommand to:
   ```json
   "buildCommand": "cp prisma/schema.production.prisma prisma/schema.prisma && npm run build"
   ```
   - Push and deploy
   - Then change it back to include migrations for future deployments

---

## ✨ New Features After Deployment

### 1. Daily Revenue Tracking
- Go to Reports page
- Click edit icon on any day
- Enter daily revenue
- View revenue vs salary statistics

### 2. Tip-Based Salaries
- Go to Employees page
- Edit a waiter/server employee
- Set `isTipBased = true` and `baseHourlyWage = 40`
- Go to Reports page
- Click coins icon next to tip-based employees
- Enter tips per shift
- View automatic salary calculations

---

## 🎯 Quick Checklist

- [ ] Set all environment variables in Vercel (API + Web)
- [ ] Have Neon PostgreSQL connection strings ready
- [ ] Push code to Git or use Vercel CLI
- [ ] Watch deployment logs for successful migration
- [ ] Test dashboard - should show real data
- [ ] Test reports page - should load
- [ ] Create test schedules and shifts
- [ ] Add daily revenue and tips

---

## 📞 Need Help?

Check Vercel deployment logs:
1. Go to Vercel Dashboard
2. Click on your deployment
3. View "Function Logs" for API errors
4. View "Build Logs" for build errors

The migration SQL is in: `apps/api/prisma/migrations/20260131_add_daily_revenue_and_tips/migration.sql`

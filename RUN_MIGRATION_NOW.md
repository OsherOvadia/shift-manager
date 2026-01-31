# 🚨 Quick Fix: Run Migration Manually

The 500 error on login means the database columns still don't exist. Let's fix it NOW.

---

## ⚡ Quick Fix (2 minutes)

### Option 1: Using Render Shell (Easiest)

1. **Go to Render Dashboard:**
   - https://dashboard.render.com
   - Click on your `shift-manager-api` service

2. **Open Shell:**
   - Click the "Shell" tab at the top
   - Wait for shell to connect

3. **Run Migration:**
   ```bash
   cd /opt/render/project/src/apps/api
   npx prisma migrate deploy
   ```

4. **Restart Service:**
   - Go back to "Settings" tab
   - Click "Manual Deploy" → "Clear build cache & deploy"
   - OR just wait ~30 seconds for auto-restart

5. **Test Login:**
   - Try logging in again
   - Should work now! ✅

---

### Option 2: Using Your Local Machine + Database URL

1. **Get Database URL from Render:**
   - Render Dashboard → Your Service
   - Click "Environment" tab
   - Copy the `DATABASE_URL` value

2. **Run Migration Locally:**
   ```bash
   cd apps/api
   
   # Set DATABASE_URL (PowerShell):
   $env:DATABASE_URL="your-render-postgres-url-here"
   
   # Run migration:
   npx prisma migrate deploy
   ```

3. **Done!** The migration is applied to your Render database

---

## 🔍 Check If Migration Ran

In Render Shell, run:
```bash
cd /opt/render/project/src/apps/api
npx prisma migrate status
```

Should show:
```
✓ All migrations have been applied
```

---

## 🐛 Why This Happened

The build command in `render.yaml` runs the migration, BUT:
- If the build was cached, it might have skipped the migration
- If there was a database connection issue during build, migration failed silently

Running it manually ensures it happens.

---

## ✅ After Running Migration

Your app should work:
- ✅ Login works (no more 500 error)
- ✅ Dashboard shows real data
- ✅ Reports page loads

---

## 📋 The Migration SQL (FYI)

This is what gets run:

```sql
-- Add tip-based columns to users
ALTER TABLE "users" ADD COLUMN "base_hourly_wage" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "is_tip_based" BOOLEAN NOT NULL DEFAULT false;

-- Add tips to shift assignments
ALTER TABLE "shift_assignments" ADD COLUMN "tips_earned" DOUBLE PRECISION DEFAULT 0;

-- Create daily revenues table
CREATE TABLE "daily_revenues" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_revenue" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_revenues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_revenues_organization_id_date_key" 
ON "daily_revenues"("organization_id", "date");
```

---

## 🎯 Quick Steps Summary

1. Render Dashboard → Your Service → Shell tab
2. Run: `cd /opt/render/project/src/apps/api && npx prisma migrate deploy`
3. Wait 30 seconds for auto-restart
4. Try login again
5. ✅ Done!

---

**Note:** The browser error "A listener indicated an asynchronous response..." is just a browser extension issue and can be ignored. The real problem is the 500 error, which this migration will fix.

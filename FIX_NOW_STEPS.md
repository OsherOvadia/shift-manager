# 🔧 Fix the 500 Error RIGHT NOW

## The Problem
Your Render deployment is live, but the database migration didn't run. The columns are missing.

---

## 🎯 Solution: Run Migration Manually (Choose ONE option)

### **Option A: Render Shell** (Recommended - 1 minute)

1. **Open Render Dashboard:**
   - Go to: https://dashboard.render.com/
   - Find and click: `shift-manager-api`

2. **Click "Shell" tab** (top menu bar)

3. **Wait for shell to connect** (shows `bash-5.1$` prompt)

4. **Copy and paste this command:**
   ```bash
   cd /opt/render/project/src/apps/api && npx prisma migrate deploy
   ```

5. **Press Enter** - Should show:
   ```
   ✓ Applied migration 20260131_add_daily_revenue_and_tips
   ```

6. **Wait 30 seconds** for service to restart automatically

7. **Try login again** - Should work! ✅

---

### **Option B: From Your Computer** (If Shell doesn't work)

1. **Get your Database URL from Render:**
   - Render Dashboard → `shift-manager-api`
   - Click "Environment" tab (left sidebar)
   - Find `DATABASE_URL`
   - Click "Copy" button

2. **Open PowerShell on your computer:**
   ```powershell
   cd C:\Users\oser1\OneDrive\Desktop\shiftManager\apps\api
   
   # Paste your DATABASE_URL (replace the part after =):
   $env:DATABASE_URL="postgresql://your-url-here"
   
   # Run migration:
   npx prisma migrate deploy
   ```

3. **Should see:**
   ```
   ✓ Applying migration `20260131_add_daily_revenue_and_tips`
   All migrations have been applied
   ```

4. **Done!** Try login again.

---

### **Option C: Render Dashboard** (If both above fail)

1. **Force a fresh deployment:**
   - Render Dashboard → Your Service
   - Click "Manual Deploy" (top right)
   - Select "Clear build cache & deploy"
   - Wait 3-4 minutes
   - Migration should run this time

---

## ✅ How to Verify It Worked

After running migration, check Render logs:
- Should see: `[Nest] ... Application is running`
- Should NOT see: `column does not exist` errors
- Login should work

---

## 🚨 If You're Stuck

**Screenshot what you see and share:**
1. The Shell tab output (if using Option A)
2. Or the error message (if using Option B)
3. Or the deployment logs (if using Option C)

---

## 📊 What This Does

The migration adds these columns to your database:
- `users.base_hourly_wage` (for tip-based employees)
- `users.is_tip_based` (boolean flag)
- `shift_assignments.tips_earned` (tips per shift)
- Creates new `daily_revenues` table

Without these columns, the app crashes on login because the Prisma schema expects them to exist.

---

## ⏱️ Expected Time

- **Option A (Shell):** 1 minute
- **Option B (Local):** 2 minutes
- **Option C (Redeploy):** 4 minutes

---

**Start with Option A (Render Shell) - it's the fastest!** 🚀

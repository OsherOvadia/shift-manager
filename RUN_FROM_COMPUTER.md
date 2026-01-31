# 🖥️ Run Migration From Your Computer (FREE)

Since Render Shell costs money, we'll run the migration from your computer. Takes 2 minutes!

---

## 📋 Step-by-Step Instructions

### **Step 1: Get Your Database URL from Render**

1. Go to: https://dashboard.render.com
2. Click on your `shift-manager-api` service
3. Click **"Environment"** in the left sidebar
4. Find `DATABASE_URL` 
5. Click the **👁️ eye icon** to reveal it
6. Click **Copy** button (or manually select and copy)

The URL looks like:
```
postgresql://username:password@dpg-xxxxx.oregon-postgres.render.com/database_xxxxx
```

---

### **Step 2: Open PowerShell**

Press `Win + X` → Select "Windows PowerShell" or "Terminal"

---

### **Step 3: Navigate to Your Project**

```powershell
cd C:\Users\oser1\OneDrive\Desktop\shiftManager\apps\api
```

---

### **Step 4: Set the Database URL**

Paste this command, but **replace the URL** with your actual DATABASE_URL from Step 1:

```powershell
$env:DATABASE_URL="postgresql://your-actual-url-from-render"
```

**Example:**
```powershell
$env:DATABASE_URL="postgresql://shiftmanager_user:abc123xyz@dpg-xxxxx.oregon-postgres.render.com/shiftmanager_db"
```

Press Enter.

---

### **Step 5: Run the Migration**

```powershell
npx prisma migrate deploy
```

---

### **Step 6: Watch for Success**

You should see:
```
✔ Generated Prisma Client
Applying migration `20260131_add_daily_revenue_and_tips`

The following migration(s) have been applied:

migrations/
  └─ 20260131_add_daily_revenue_and_tips/
    └─ migration.sql

✔ All migrations have been successfully applied.
```

---

### **Step 7: Test Your App**

1. Go to your app: https://your-frontend.vercel.app
2. Try to **login**
3. ✅ Should work now!

---

## 🎯 Complete Command Sequence (Copy-Paste)

```powershell
# Navigate to project
cd C:\Users\oser1\OneDrive\Desktop\shiftManager\apps\api

# Set DATABASE_URL (replace with your actual URL)
$env:DATABASE_URL="YOUR_RENDER_DATABASE_URL_HERE"

# Run migration
npx prisma migrate deploy
```

---

## ✅ What This Does

Connects to your Render PostgreSQL database and runs the migration that adds:
- `users.base_hourly_wage` column
- `users.is_tip_based` column  
- `shift_assignments.tips_earned` column
- `daily_revenues` table

---

## 🐛 Troubleshooting

### "Cannot connect to database"
- Make sure you copied the **entire** DATABASE_URL (it's very long)
- Check for typos
- Make sure there are no extra spaces

### "prisma command not found"
```powershell
npm install
```
Then try again.

### "Migration already applied"
✅ This is GOOD! It means the migration ran successfully before. Just restart your Render service:
- Render Dashboard → Manual Deploy → "Clear build cache & deploy"

---

## 📸 What to Share If You're Stuck

Take a screenshot of:
1. The PowerShell window showing the error
2. Or the success message

---

**Ready? Start with Step 1 - get your DATABASE_URL from Render!** 🚀

# 🔄 How to Reset Your Production Database

## Step 1: Set Environment Variable in Render

1. Go to https://dashboard.render.com
2. Click on your **shift-manager-api** service
3. Click **Environment** in the left sidebar
4. Click **Add Environment Variable**
5. Add:
   - **Key**: `DB_RESET_SECRET`
   - **Value**: `MySecretReset2026!` (or choose your own secure password)
6. Click **Save Changes**
7. Wait for the service to redeploy (about 2-3 minutes)

---

## Step 2: Call the Reset Endpoint

Once the redeploy is complete, open your browser and visit this URL:

```
https://shift-manager-api-ngpl.onrender.com/api/database-reset?secret=MySecretReset2026!
```

**⚠️ Replace `MySecretReset2026!` with whatever secret you set in Step 1**

You should see a response like:
```json
{
  "success": true,
  "message": "Database reset successfully! All tables dropped.",
  "instructions": [...]
}
```

---

## Step 3: Redeploy to Recreate Tables

1. Go back to Render dashboard
2. Your **shift-manager-api** service
3. Click **Manual Deploy**
4. Select **Clear build cache & deploy**
5. Wait for deployment to complete

Prisma will automatically recreate all tables with the new schema (including the unique organization name constraint).

---

## Step 4: Remove the Reset Secret (IMPORTANT!)

**For security, remove the reset endpoint after use:**

1. Go back to **Environment** in your Render service
2. Find `DB_RESET_SECRET`
3. Click the **🗑️ trash icon** to delete it
4. Click **Save Changes**
5. Service will redeploy, and the reset endpoint will no longer work

---

## Step 5: Register Your Organization

1. Visit your app: https://shift-manager-lfvu.vercel.app
2. Click **"הרשם כעסק חדש"** (Register as new business)
3. Create your organization with a unique name
4. Start fresh!

---

## If Something Goes Wrong

If the reset endpoint doesn't work, you can always:
1. Delete the database in Render dashboard
2. Create a new PostgreSQL database
3. Update environment variables with new database URLs
4. Redeploy

---

## Summary

```
1. Add DB_RESET_SECRET env var → Wait for redeploy
2. Visit: https://shift-manager-api-ngpl.onrender.com/api/database-reset?secret=YOUR_SECRET
3. Manual Deploy → Clear cache & deploy
4. Remove DB_RESET_SECRET env var
5. Register new organization
```

**Total time: ~10 minutes**

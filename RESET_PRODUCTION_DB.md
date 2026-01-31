# Reset Production Database on Render

This guide explains how to completely reset your production database on Render.

## Method 1: Using Render Shell (Recommended)

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on your **shift-manager-api** service
3. Click on the **Shell** tab in the left sidebar
4. Run the following commands one by one:

```bash
# Navigate to the app directory
cd /app

# Force reset the database (THIS WILL DELETE ALL DATA)
npx prisma db push --force-reset --accept-data-loss

# Generate Prisma Client
npx prisma generate

# Apply any pending migrations
npx prisma migrate deploy
```

5. Restart your service after the reset completes

## Method 2: Using Environment Variable + Redeploy

1. Go to your Render dashboard
2. Click on your **shift-manager-api** service
3. Go to **Environment** tab
4. Add a temporary environment variable:
   - Key: `RESET_DB`
   - Value: `true`
5. Click **Manual Deploy** → **Clear build cache & deploy**
6. After deployment completes, **remove** the `RESET_DB` variable
7. Redeploy again to ensure clean state

## Method 3: Drop and Recreate Database (Nuclear Option)

If the above methods don't work:

1. In Render dashboard, go to your **Database** (not the API service)
2. Click **Settings**
3. Scroll down to **Danger Zone**
4. Click **Delete Database** (⚠️ THIS IS PERMANENT)
5. Create a new PostgreSQL database
6. Update the `DATABASE_URL` and `DIRECT_URL` in your API service environment variables
7. Redeploy your API service

## After Reset

After successfully resetting the database:

1. Visit your deployed app: https://shift-manager-lfvu.vercel.app
2. Click **"הרשם כעסק חדש"** (Register as new business)
3. Create your organization and admin account fresh

## Notes

- All data will be permanently deleted
- You'll need to re-register your organization
- All users, shifts, and assignments will be lost
- The new schema includes a unique constraint on organization names

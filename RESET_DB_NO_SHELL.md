# Reset Production Database WITHOUT Shell Access

Since Render Shell requires a paid plan, here are free alternatives:

## Method 1: Use Render's PostgreSQL Dashboard (Recommended)

1. Go to https://dashboard.render.com
2. Find and click on your **PostgreSQL database** (not the API service)
3. Click **Connect** → **External Connection**
4. Copy the connection command or get the connection details
5. Use a PostgreSQL client:

### Option A: Using pgAdmin (GUI)
1. Download pgAdmin: https://www.pgadmin.org/download/
2. Create new server with your Neon/Render database details
3. Right-click on your database → **Query Tool**
4. Run this SQL to reset everything:

```sql
-- Drop all tables (cascades to delete all data)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

5. Then run from your local machine:
```bash
cd apps/api
npx prisma db push --accept-data-loss
npx prisma generate
```

### Option B: Using psql Command Line
1. Install PostgreSQL tools: https://www.postgresql.org/download/
2. Connect using the connection string from Render:
```bash
psql "your-connection-string-here"
```
3. Run:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

---

## Method 2: Create Temporary Reset Endpoint (Quick & Easy)

I can create a special API endpoint that you can call once to reset the database:

1. I'll add a `/reset-database` endpoint with a secret key
2. You call it once via browser or Postman
3. Database gets reset
4. Remove the endpoint after use

**Want me to create this endpoint for you?** (It's the easiest option)

---

## Method 3: Delete & Recreate Database in Render

1. Go to https://dashboard.render.com
2. Click on your **PostgreSQL** database
3. Go to **Settings** tab
4. Scroll to **Danger Zone**
5. Click **Delete Database** (⚠️ This is permanent!)
6. Create a new PostgreSQL database:
   - Click **New +** → **PostgreSQL**
   - Choose free plan
   - Name it (e.g., "shift-manager-db")
7. Copy the **Internal Database URL** and **External Database URL**
8. Go to your **shift-manager-api** service
9. Update environment variables:
   - `DATABASE_URL` = Internal Database URL
   - `DIRECT_URL` = External Database URL
10. Click **Manual Deploy** → **Clear build cache & deploy**

This creates a completely fresh database and Prisma will set it up automatically on deploy.

---

## Method 4: Local Reset (If you have the connection string)

If you have the production `DATABASE_URL`:

1. Add it to your local `apps/api/.env` temporarily:
```env
DATABASE_URL="your-production-url-here"
DIRECT_URL="your-production-url-here"
```

2. Run:
```bash
cd apps/api
npx prisma db push --force-reset --accept-data-loss
npx prisma generate
npx prisma migrate deploy
```

3. Remove the production URL from your local .env after

---

## Which method do you prefer?

**Easiest**: Method 2 (I create a temporary reset endpoint)
**Cleanest**: Method 3 (Delete & recreate database in Render)
**Most control**: Method 1 (Use pgAdmin or psql)

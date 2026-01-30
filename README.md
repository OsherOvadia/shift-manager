# מנהל משמרות - Shift Manager

מערכת ניהול משמרות מבוססת ענן לעסקים כמו מסעדות, בתי קפה ושירותי קייטרינג.

## 🔑 משתמשי ברירת מחדל

לאחר הפעלת `npx prisma db seed`:

| תפקיד | אימייל | סיסמה |
|-------|--------|-------|
| **מנהל (Admin)** | admin@demo.com | admin123 |
| **עובד (Worker)** | worker@demo.com | worker123 |

## סביבות פיתוח ופרודקשן

- **פיתוח מקומי**: SQLite (ללא התקנה נדרשת)
- **פרודקשן**: Neon PostgreSQL + Vercel

## תכונות עיקריות

- **ניהול משתמשים**: הרשמה, התחברות וניהול הרשאות (מנהל מערכת, מנהל, עובד)
- **הגשת זמינות**: עובדים מגישים את הזמינות שלהם לשבוע הקרוב
- **חוקי עבודה**: אימות אוטומטי של דרישות מינימום משמרות ומשמרות סוף שבוע
- **ניהול לוח משמרות**: ממשק גרירה ושחרור לשיבוץ עובדים
- **התראות**: התראות על פרסום לוח, אישור/דחיית זמינות ושינויים
- **הגדרות גמישות**: הגדרת ימי סוף שבוע ומועדי הגשה
- **קטגוריות תפקידים**: מלצר, טבח, סושימן, ברמן ועוד (ניתן להתאמה)
- **שכר לשעה**: ניהול שכר עובדים ודוחות עלויות
- **אישור הרשמות**: עובדים חדשים צריכים אישור מנהל
- **מצב כהה/בהיר**: תמיכה במצב כהה עם החלפה קלה
- **תצוגה רספונסיבית**: מותאם למובייל

## מבנה הפרויקט

```
shiftManager/
├── apps/
│   ├── web/          # Next.js Frontend (Hebrew RTL)
│   └── api/          # NestJS Backend
├── packages/
│   └── shared/       # Shared types and constants
├── package.json      # Monorepo configuration
└── turbo.json        # Turborepo configuration
```

## טכנולוגיות

### Frontend
- Next.js 14 with React 18
- TypeScript
- Tailwind CSS
- shadcn/ui Components
- React Query
- Zustand

### Backend
- NestJS
- Prisma ORM
- PostgreSQL
- JWT Authentication
- class-validator

## התקנה

### דרישות מקדימות
- Node.js 18+
- npm או yarn

### שלבי התקנה

1. **Clone the repository**
```bash
git clone <repository-url>
cd shiftManager
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Copy the example environment files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

הגדרות ברירת המחדל מוכנות לפיתוח מקומי עם SQLite.

4. **Setup database and seed admin user**
```bash
cd apps/api
npx prisma generate
npx prisma db push
npx prisma db seed
```

5. **Run development servers**
```bash
# From root directory
npm run dev
```

The frontend will be available at `http://localhost:3000`
The API will be available at `http://localhost:3001`

## התחברות ראשונה

1. פתח http://localhost:3000
2. התחבר עם:
   - אימייל: admin@demo.com
   - סיסמה: admin123
3. או צור ארגון חדש דרך "צור ארגון חדש"

## הרשמת עובדים

עובדים יכולים להירשם דרך דף ההרשמה:
1. לחץ על "הרשם כאן" בדף ההתחברות
2. בחר את הארגון המתאים
3. מלא את הפרטים ושלח
4. המתן לאישור מנהל

## חוקי עבודה

### עובד במשרה מלאה
- מינימום 5 משמרות בשבוע
- לפחות 2 משמרות סוף שבוע

### עובד במשרה חלקית
- מינימום 3 משמרות בשבוע
- לפחות משמרת סוף שבוע אחת

## API Endpoints

### Authentication
- `POST /api/auth/login` - התחברות
- `POST /api/auth/register` - רישום משתמש (מנהל בלבד)
- `POST /api/auth/refresh` - רענון טוקן
- `GET /api/auth/me` - פרטי משתמש נוכחי

### Users
- `GET /api/users` - רשימת משתמשים
- `PATCH /api/users/:id` - עדכון משתמש
- `DELETE /api/users/:id` - השבתת משתמש

### Availability
- `GET /api/availability/week/:date` - זמינות לשבוע
- `POST /api/availability` - הגשת זמינות
- `GET /api/availability/submissions` - כל ההגשות (מנהל)

### Schedules
- `GET /api/schedules` - רשימת לוחות
- `POST /api/schedules` - יצירת לוח
- `POST /api/schedules/:id/publish` - פרסום לוח

### Assignments
- `POST /api/assignments` - יצירת שיבוץ
- `DELETE /api/assignments/:id` - מחיקת שיבוץ

## 🚀 Deployment (Vercel + Neon)

### Prerequisites

- [Vercel account](https://vercel.com/signup)
- [Neon account](https://neon.tech/signup)
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`

---

### Step 1: Create Neon Database

1. Go to [Neon Console](https://console.neon.tech)
2. Click **"New Project"**
3. Choose a name (e.g., `shift-manager`)
4. Select region closest to your users
5. Click **"Create Project"**
6. Copy the connection string - it looks like:
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

---

### Step 2: Deploy API to Vercel

```bash
cd apps/api
vercel
```

Follow the prompts:
- Link to existing project or create new
- Set root directory to `apps/api`
- Framework: **Other**

**Set Environment Variables** in [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx...` | Your Neon connection string |
| `DIRECT_URL` | Same as DATABASE_URL | Required for Prisma |
| `JWT_SECRET` | `your-super-secret-key-here` | Generate: `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | `another-secret-key-here` | Generate: `openssl rand -base64 32` |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Your frontend URL (add after Step 3) |

**Deploy again** after setting env vars:
```bash
vercel --prod
```

---

### Step 3: Deploy Frontend to Vercel

```bash
cd apps/web
vercel
```

Follow the prompts:
- Framework: **Next.js**
- Root directory: `apps/web`

**Set Environment Variables:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.vercel.app/api` |

**Deploy:**
```bash
vercel --prod
```

---

### Step 4: Initialize Production Database

After both are deployed:

1. Set the production DATABASE_URL locally (temporarily):
   ```bash
   # Windows PowerShell
   $env:DATABASE_URL="postgresql://user:pass@ep-xxx..."
   
   # Linux/Mac
   export DATABASE_URL="postgresql://user:pass@ep-xxx..."
   ```

2. Push schema to Neon:
   ```bash
   cd apps/api
   npx prisma db push
   ```

3. Seed initial data (optional):
   ```bash
   npx ts-node prisma/seed.ts
   ```

---

### Step 5: Update CORS (Important!)

Go back to Vercel Dashboard → API Project → Settings → Environment Variables:
- Update `FRONTEND_URL` to your actual frontend URL

Redeploy the API:
```bash
cd apps/api
vercel --prod
```

---

### ✅ You're Done!

Your app should now be live at:
- **Frontend**: `https://your-app.vercel.app`
- **API**: `https://your-api.vercel.app`

**Test credentials** (if you ran seed):
- Admin: `admin@demo.com` / `admin123`
- Worker: `worker@demo.com` / `worker123`

## רישיון

MIT License

## תמיכה

לשאלות ותמיכה, פתח Issue ב-GitHub.

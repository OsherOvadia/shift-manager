# Database Migration Guide - Super Admin & Feature Toggles

## Overview
This migration adds:
1. **SUPER_ADMIN role** - Platform-level administration
2. **Organization approval workflow** - PENDING/APPROVED/SUSPENDED/REJECTED statuses
3. **Complete feature configurability** - Toggle any feature on/off per organization

## Database Migration Steps

### Step 1: Run the Migration SQL
Execute the migration file located at:
```
apps/api/prisma/migrations/add_super_admin_and_feature_toggles.sql
```

**For Production (Neon):**
```bash
# Connect to your Neon database and run:
psql "your-neon-connection-string" -f apps/api/prisma/migrations/add_super_admin_and_feature_toggles.sql
```

**Important Notes:**
- The migration will add `SUPER_ADMIN` to the `Role` enum
- Creates new `OrganizationStatus` enum
- Makes `organizationId` nullable for SUPER_ADMIN users
- Adds 18 new feature toggle columns to `business_settings`
- **Existing organizations will automatically be set to APPROVED status**

### Step 2: Create Super Admin User
The migration includes a template to create the super admin user. You need to:

1. Generate a hashed password:
```typescript
// In Node.js or a script:
const bcrypt = require('bcrypt');
const password = 'YourSecurePassword123';
const hash = await bcrypt.hash(password, 10);
console.log(hash);
```

2. Update the migration SQL with the actual hashed password
3. Or manually create the user after running the migration:
```sql
INSERT INTO "users" (id, email, password_hash, first_name, last_name, role, organization_id, is_active, is_approved, created_at)
VALUES (
  gen_random_uuid(),
  'oser130309@gmail.com',
  '$2b$10$YOUR_HASHED_PASSWORD_HERE',
  'Super',
  'Admin',
  'SUPER_ADMIN',
  NULL,
  true,
  true,
  CURRENT_TIMESTAMP
);
```

### Step 3: Deploy Backend
```bash
cd apps/api
npm run build
# Deploy to Render or your hosting platform
```

### Step 4: Deploy Frontend
```bash
cd apps/web
npm run build
# Deploy to Vercel or your hosting platform
```

## New Features

### 1. Super Admin Dashboard
**Access:** Login with super admin credentials → Navigate to `/super-admin`

**Features:**
- View all organizations and their stats
- Approve/reject new organization registrations
- Suspend/reactivate organizations
- Monitor platform-wide statistics
- View organization details

### 2. Organization Approval Workflow
- New organizations start with `PENDING` status
- Only SUPER_ADMIN can approve organizations
- Users cannot login to suspended organizations
- Approved organizations show up in signup form

### 3. Feature Toggles (Settings Page)
All features are now configurable per organization:

**Availability & Scheduling:**
- Availability submission
- Shift approval requirement
- Automatic scheduling (coming soon)
- Shift swapping (coming soon)

**Tips & Revenue:**
- Tip tracking
- Cash tip tracking
- Revenue breakdown (sitting/takeaway/delivery)
- Daily revenue reporting

**Reports & Analytics:**
- Financial reports
- Monthly overview
- Cook payroll
- Monthly expenses
- Overtime tracking (coming soon)

**Import & Categories:**
- Excel import
- Job categories
- Kitchen staff separation

**Notifications:**
- In-app notifications
- Email notifications (coming soon)

### 4. Organization Isolation
- All database queries filter by `organizationId`
- SUPER_ADMIN can access all organizations
- Regular users limited to their organization data
- Cascade delete preserves data integrity

## Testing

### Test Super Admin Access
1. Login as super admin
2. Navigate to `/super-admin`
3. Verify platform statistics display
4. Test organization approval/rejection

### Test Organization Isolation
1. Create two test organizations
2. Create users in each organization
3. Verify users can only see their organization's data

### Test Feature Toggles
1. Login as ADMIN
2. Go to Settings page
3. Toggle various features
4. Verify UI changes reflect feature status

## Rollback Plan
If issues occur:

1. **Revert code changes** (git revert)
2. **Database rollback:**
```sql
-- Remove new columns from business_settings
ALTER TABLE "business_settings" 
DROP COLUMN IF EXISTS "enable_availability_submission",
DROP COLUMN IF EXISTS "require_shift_approval",
-- ... (drop all 18 new columns)

-- Revert organization changes
ALTER TABLE "organizations"
DROP COLUMN IF EXISTS "status",
DROP COLUMN IF EXISTS "contact_email",
DROP COLUMN IF EXISTS "contact_phone",
DROP COLUMN IF EXISTS "approved_at",
DROP COLUMN IF EXISTS "approved_by",
DROP COLUMN IF EXISTS "updated_at";

-- Remove SUPER_ADMIN users
DELETE FROM "users" WHERE role = 'SUPER_ADMIN';

-- Make organizationId NOT NULL again
ALTER TABLE "users" 
ALTER COLUMN "organization_id" SET NOT NULL;

-- Drop enums (careful - will fail if still referenced)
DROP TYPE IF EXISTS "OrganizationStatus";
-- Note: Cannot remove value from existing enum in PostgreSQL
```

## Support
For issues or questions, contact: oser130309@gmail.com

## Security Notes
- Change super admin password immediately after first login
- Use strong passwords for super admin accounts
- Super admin access is unrestricted - use carefully
- Organization suspension is immediate and affects all users

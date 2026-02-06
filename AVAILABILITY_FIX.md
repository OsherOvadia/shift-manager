# Fix: Availability Status Not Updating After Submission

## Problem
After a waiter submitted their availability/shifts for the week, the dashboard continued to show "יש להגיש זמינות לשבוע הבא" (Need to submit availability for next week) instead of updating to show "ממתין לאישור" (Waiting for approval).

## Root Cause
The issue was with React Query cache invalidation. When the availability was submitted, the mutation was only invalidating queries with the key `['availability']`, but the dashboard was using a different query key `['my-availability', weekDate]`. This mismatch meant the dashboard wasn't refreshing to show the updated status.

## Solution
Updated the availability submission mutation to:
1. Invalidate all related query keys:
   - `['availability']` - for the availability page
   - `['my-availability']` - for the employee dashboard
   - `['all-availability']` - for the manager view
2. Force an immediate refetch of the current availability query
3. Made the onSuccess handler async to properly await the invalidations

## Files Changed
- `apps/web/src/app/(dashboard)/dashboard/availability/page.tsx`

## Code Changes

### Before:
```typescript
onSuccess: () => {
  toast({
    title: 'הזמינות נשמרה בהצלחה',
    description: 'הזמינות שלך הוגשה לאישור המנהל',
  })
  queryClient.invalidateQueries({ queryKey: ['availability'] })
},
```

### After:
```typescript
onSuccess: async () => {
  toast({
    title: 'הזמינות נשמרה בהצלחה',
    description: 'הזמינות שלך הוגשה לאישור המנהל',
  })
  // Invalidate and refetch all availability-related queries
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['availability'] }),
    queryClient.invalidateQueries({ queryKey: ['my-availability'] }),
    queryClient.invalidateQueries({ queryKey: ['all-availability'] }),
  ])
  // Force immediate refetch of current query
  queryClient.refetchQueries({ queryKey: ['availability', targetWeekStart.toISOString()] })
},
```

## Testing Instructions

1. Log in as a waiter/employee
2. Go to the Dashboard and note the availability status shows "טרם הוגש" (Not submitted)
3. Navigate to Availability page
4. Select shifts for next week
5. Click "Submit Availability"
6. Return to Dashboard
7. **Expected Result**: The availability status card should now show "ממתין לאישור" (Waiting for approval) with a blue badge
8. The message should say "הזמינות שלך ממתינה לאישור" (Your availability is waiting for approval)

## Status Display Logic

The dashboard shows different statuses based on the availability submission:

- **אושר (APPROVED)** - Green badge - "הזמינות לשבוע הבא אושרה" (Availability approved for next week)
- **ממתין לאישור (PENDING)** - Blue badge - "הזמינות שלך ממתינה לאישור" (Your availability is waiting for approval)
- **נדחה (REJECTED)** - Red badge - "יש לעדכן את הזמינות" (Need to update availability)
- **טרם הוגש (NOT_SUBMITTED)** - Amber badge - "יש להגיש זמינות לשבוע הבא" (Need to submit availability for next week)

## Additional Notes

- The fix ensures that all availability-related queries across the application are synchronized
- The dashboard checks availability for "next week" (relative to current week)
- The availability page defaults to showing "next week" for submission
- Both pages are now properly synchronized through the cache invalidation

---

**Fix Date**: February 6, 2026
**Status**: ✅ Complete - Ready for Testing

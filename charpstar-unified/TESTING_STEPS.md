# Testing Retroactive Bonus Feature - Step by Step

## 🎯 Goal

Test the scenario where an allocation list created in August is completed in September, triggering retroactive bonuses.

## 📋 Steps

### Step 1: Get Your User IDs

Run this in Supabase SQL Editor:

```sql
SELECT id, name, email, role FROM profiles WHERE role IN ('modeler', 'admin') LIMIT 5;
```

**Copy the modeler ID and admin ID for later use.**

### Step 2: Get Available Assets

```sql
SELECT id, product_name, article_id, client, status FROM onboarding_assets LIMIT 10;
```

**Copy 6 asset IDs for testing.**

### Step 3: Create the Test Allocation List

Replace `YOUR_MODELER_ID` and `YOUR_ADMIN_ID` with actual IDs:

```sql
INSERT INTO allocation_lists (
  id,
  name,
  user_id,
  role,
  assigned_by,
  deadline,
  bonus,
  status,
  approved_at,
  created_at
) VALUES (
  gen_random_uuid(),
  'Test Retroactive Bonus Demo',
  'YOUR_MODELER_ID',  -- Replace this
  'modeler',
  'YOUR_ADMIN_ID',    -- Replace this
  '2024-09-15 23:59:59',
  15.0,
  'approved',
  '2024-09-11 14:30:00',  -- Completed Sep 11
  '2024-08-15 09:00:00'   -- Created Aug 15
);
```

### Step 4: Create Asset Assignments

Replace `YOUR_MODELER_ID`, `YOUR_ADMIN_ID`, and the 6 asset IDs:

```sql
INSERT INTO asset_assignments (
  asset_id,
  user_id,
  role,
  allocation_list_id,
  status,
  price,
  assigned_by,
  start_time
) VALUES
-- Asset 1
('ASSET_ID_1', 'YOUR_MODELER_ID', 'modeler',
 (SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus Demo'),
 'accepted', 50.00, 'YOUR_ADMIN_ID', '2024-08-15 09:00:00'),
-- Asset 2
('ASSET_ID_2', 'YOUR_MODELER_ID', 'modeler',
 (SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus Demo'),
 'accepted', 50.00, 'YOUR_ADMIN_ID', '2024-08-15 09:00:00'),
-- Asset 3
('ASSET_ID_3', 'YOUR_MODELER_ID', 'modeler',
 (SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus Demo'),
 'accepted', 50.00, 'YOUR_ADMIN_ID', '2024-08-15 09:00:00'),
-- Asset 4
('ASSET_ID_4', 'YOUR_MODELER_ID', 'modeler',
 (SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus Demo'),
 'accepted', 50.00, 'YOUR_ADMIN_ID', '2024-08-15 09:00:00'),
-- Asset 5
('ASSET_ID_5', 'YOUR_MODELER_ID', 'modeler',
 (SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus Demo'),
 'accepted', 50.00, 'YOUR_ADMIN_ID', '2024-08-15 09:00:00'),
-- Asset 6
('ASSET_ID_6', 'YOUR_MODELER_ID', 'modeler',
 (SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus Demo'),
 'accepted', 50.00, 'YOUR_ADMIN_ID', '2024-08-15 09:00:00');
```

### Step 5: Approve the Assets

Replace with your 6 asset IDs:

```sql
UPDATE onboarding_assets
SET status = 'approved'
WHERE id IN ('ASSET_ID_1', 'ASSET_ID_2', 'ASSET_ID_3', 'ASSET_ID_4', 'ASSET_ID_5', 'ASSET_ID_6');
```

### Step 6: Verify Test Data

```sql
-- Check allocation list
SELECT name, created_at, approved_at, deadline, bonus, status
FROM allocation_lists
WHERE name = 'Test Retroactive Bonus Demo';

-- Check assignments
SELECT aa.price, oa.product_name, oa.status, al.created_at, al.approved_at
FROM asset_assignments aa
JOIN onboarding_assets oa ON aa.asset_id = oa.id
JOIN allocation_lists al ON aa.allocation_list_id = al.id
WHERE al.name = 'Test Retroactive Bonus Demo';
```

## 🧪 Testing the UI

1. **Login as the modeler** you used in the SQL
2. **Navigate to** `/invoicing`
3. **Select "September 2024"** from the dropdown
4. **Look for the retroactive bonus section** - you should see:

```
🟨 Retroactive Bonuses Applied This Month

   Allocation List #xxxxxxxx
   6 assets • 15% bonus rate
   Created: 8/15/2024 • Completed: 9/11/2024
   +€45.00 retroactive bonus

   Total Retroactive Bonuses: +€45.00
```

5. **Check August 2024** - should NOT show this as retroactive

## 📊 Expected Results

- **September 2024 view**: Shows retroactive bonus section
- **August 2024 view**: No retroactive bonus section
- **Total bonus**: €45.00 (€300 base × 15%)
- **UI correctly identifies**: List created in Aug, completed in Sep

## 🧹 Cleanup (when done testing)

```sql
DELETE FROM asset_assignments
WHERE allocation_list_id IN (
  SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus Demo'
);

DELETE FROM allocation_lists
WHERE name = 'Test Retroactive Bonus Demo';
```

-- SQL Script to Test Retroactive Bonus Feature
-- This simulates the scenario: List allocated Aug 15, deadline Sep 15, completed Sep 11

-- Step 1: First, let's check what user IDs we have available
-- Run this first to get actual user IDs from your system
SELECT id, name, email, role FROM profiles WHERE role IN ('modeler', 'admin') LIMIT 5;

-- Step 2: Check existing assets that we can use for testing
-- Run this to see available assets
SELECT id, product_name, article_id, client, status FROM onboarding_assets LIMIT 10;

-- Step 3: Create test allocation list
-- Replace the user IDs with actual IDs from Step 1
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
  'Test Retroactive Bonus - Aug to Sep',
  'YOUR_MODELER_ID_HERE',  -- Replace with actual modeler ID from Step 1
  'modeler',
  'YOUR_ADMIN_ID_HERE',    -- Replace with actual admin ID from Step 1
  '2024-09-15 23:59:59',   -- Deadline: September 15
  15.0,                    -- 15% bonus
  'approved',              -- Completed status
  '2024-09-11 14:30:00',   -- Completed: September 11 (before deadline)
  '2024-08-15 09:00:00'    -- Created: August 15
);

-- Step 4: Create asset assignments for this allocation list
-- Replace asset IDs with actual IDs from Step 2
-- These represent the 6 assets in your scenario (3 from Aug, 3 from Sep)
INSERT INTO asset_assignments (
  asset_id,
  user_id,
  role,
  allocation_list_id,
  status,
  price,
  assigned_by,
  start_time
) 
SELECT 
  asset_id,
  'YOUR_MODELER_ID_HERE',  -- Same modeler ID as above
  'modeler',
  (SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus - Aug to Sep'),
  'accepted',
  50.00,  -- €50 per asset
  'YOUR_ADMIN_ID_HERE',    -- Same admin ID as above
  '2024-08-15 09:00:00'
FROM (
  VALUES 
    ('ASSET_ID_1'),  -- Replace with actual asset IDs
    ('ASSET_ID_2'),  
    ('ASSET_ID_3'),
    ('ASSET_ID_4'),
    ('ASSET_ID_5'),
    ('ASSET_ID_6')
) AS assets(asset_id);

-- Step 5: Update the assets to approved status
-- Replace with actual asset IDs
UPDATE onboarding_assets 
SET status = 'approved' 
WHERE id IN ('ASSET_ID_1', 'ASSET_ID_2', 'ASSET_ID_3', 'ASSET_ID_4', 'ASSET_ID_5', 'ASSET_ID_6');

-- Step 6: Verify the test data
-- Check the allocation list was created
SELECT 
  id,
  name,
  created_at,
  approved_at,
  deadline,
  bonus,
  status
FROM allocation_lists 
WHERE name = 'Test Retroactive Bonus - Aug to Sep';

-- Check the asset assignments
SELECT 
  aa.asset_id,
  aa.price,
  oa.product_name,
  oa.status,
  al.name as allocation_list_name,
  al.created_at as list_created,
  al.approved_at as list_approved
FROM asset_assignments aa
JOIN onboarding_assets oa ON aa.asset_id = oa.id
JOIN allocation_lists al ON aa.allocation_list_id = al.id
WHERE al.name = 'Test Retroactive Bonus - Aug to Sep';

-- Expected Results when you view September 2024 in the invoicing page:
-- ✅ Base Earnings: €300 (6 assets × €50)
-- ✅ Bonus Earnings: €45 (€300 × 15%)
-- ✅ Retroactive Bonus Section appears showing:
--     - Allocation List created: 8/15/2024
--     - Allocation List completed: 9/11/2024  
--     - 6 assets • 15% bonus rate
--     - +€45.00 retroactive bonus

-- Clean up script (run this to remove test data when done)
/*
DELETE FROM asset_assignments 
WHERE allocation_list_id IN (
  SELECT id FROM allocation_lists WHERE name = 'Test Retroactive Bonus - Aug to Sep'
);

DELETE FROM allocation_lists 
WHERE name = 'Test Retroactive Bonus - Aug to Sep';

-- Reset asset status if needed
UPDATE onboarding_assets 
SET status = 'pending'  -- or whatever the original status was
WHERE id IN ('ASSET_ID_1', 'ASSET_ID_2', 'ASSET_ID_3', 'ASSET_ID_4', 'ASSET_ID_5', 'ASSET_ID_6');
*/

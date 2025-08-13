-- Retroactive Bonus Test with Real Asset IDs
-- This will create a test scenario using your actual assets

-- Step 1: First get your user IDs (run this first)
SELECT id, email, role FROM profiles WHERE role IN ('modeler', 'admin') ORDER BY role;

-- Step 2: Create test allocation list 
-- Replace YOUR_MODELER_ID and YOUR_ADMIN_ID with actual IDs from Step 1
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
  'Retroactive Bonus Test - Real Assets',
  'YOUR_MODELER_ID_HERE',  -- Replace with actual modeler ID
  'modeler',
  'YOUR_ADMIN_ID_HERE',    -- Replace with actual admin ID
  '2024-09-15 23:59:59',   -- Deadline: September 15
  15.0,                    -- 15% bonus
  'approved',              -- Completed status
  '2024-09-11 14:30:00',   -- Completed: September 11 (before deadline)
  '2024-08-15 09:00:00'    -- Created: August 15
);

-- Step 3: Create asset assignments using your real asset IDs
-- Replace YOUR_MODELER_ID and YOUR_ADMIN_ID with the same IDs as above
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
-- Cargobike Delivery
('5b55ce93-6590-4781-8df4-21b771eea429', 'YOUR_MODELER_ID_HERE', 'modeler', 
 (SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Real Assets'), 
 'accepted', 50.00, 'YOUR_ADMIN_ID_HERE', '2024-08-15 09:00:00'),
-- Another Product
('9ebe7bce-63b5-4702-b108-e94877ee1f55', 'YOUR_MODELER_ID_HERE', 'modeler', 
 (SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Real Assets'), 
 'accepted', 50.00, 'YOUR_ADMIN_ID_HERE', '2024-08-15 09:00:00'),
-- Cargobike DeLight Box
('443d072e-1500-4863-b8c2-027698631148', 'YOUR_MODELER_ID_HERE', 'modeler', 
 (SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Real Assets'), 
 'accepted', 50.00, 'YOUR_ADMIN_ID_HERE', '2024-08-15 09:00:00'),
-- Phoenix King Ottoman Bed
('bebe94b9-e642-49a8-a7d4-3af9835bd971', 'YOUR_MODELER_ID_HERE', 'modeler', 
 (SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Real Assets'), 
 'accepted', 50.00, 'YOUR_ADMIN_ID_HERE', '2024-08-15 09:00:00'),
-- Cargobike Kindergarden
('a732cb9a-85b9-4dc8-b7ac-c68f74238037', 'YOUR_MODELER_ID_HERE', 'modeler', 
 (SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Real Assets'), 
 'accepted', 50.00, 'YOUR_ADMIN_ID_HERE', '2024-08-15 09:00:00'),
-- Cargobike Classic
('2c462fd9-4d67-4f25-a31d-a163e47f6c63', 'YOUR_MODELER_ID_HERE', 'modeler', 
 (SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Real Assets'), 
 'accepted', 50.00, 'YOUR_ADMIN_ID_HERE', '2024-08-15 09:00:00');

-- Step 4: Update the assets to approved status
UPDATE onboarding_assets 
SET status = 'approved' 
WHERE id IN (
  '5b55ce93-6590-4781-8df4-21b771eea429',  -- Cargobike Delivery
  '9ebe7bce-63b5-4702-b108-e94877ee1f55',  -- Another Product
  '443d072e-1500-4863-b8c2-027698631148',  -- Cargobike DeLight Box
  'bebe94b9-e642-49a8-a7d4-3af9835bd971',  -- Phoenix King Ottoman Bed
  'a732cb9a-85b9-4dc8-b7ac-c68f74238037',  -- Cargobike Kindergarden
  '2c462fd9-4d67-4f25-a31d-a163e47f6c63'   -- Cargobike Classic
);

-- Step 5: Verify the test data
SELECT 
  al.name,
  al.created_at,
  al.approved_at,
  al.deadline,
  al.bonus,
  al.status,
  COUNT(aa.asset_id) as asset_count,
  SUM(aa.price) as total_base_price,
  SUM(aa.price * al.bonus / 100) as total_bonus
FROM allocation_lists al
LEFT JOIN asset_assignments aa ON al.id = aa.allocation_list_id
WHERE al.name = 'Retroactive Bonus Test - Real Assets'
GROUP BY al.id, al.name, al.created_at, al.approved_at, al.deadline, al.bonus, al.status;

-- Step 6: Check individual assets
SELECT 
  oa.product_name,
  oa.client,
  oa.status,
  aa.price,
  al.bonus,
  (aa.price * al.bonus / 100) as bonus_amount
FROM asset_assignments aa
JOIN onboarding_assets oa ON aa.asset_id = oa.id
JOIN allocation_lists al ON aa.allocation_list_id = al.id
WHERE al.name = 'Retroactive Bonus Test - Real Assets'
ORDER BY oa.product_name;

-- Expected Results:
-- Total Base: €300 (6 assets × €50)
-- Total Bonus: €45 (€300 × 15%)
-- List created: Aug 15, 2024
-- List completed: Sep 11, 2024

-- CLEANUP SCRIPT (run this when done testing)
/*
DELETE FROM asset_assignments 
WHERE allocation_list_id IN (
  SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Real Assets'
);

DELETE FROM allocation_lists 
WHERE name = 'Retroactive Bonus Test - Real Assets';

-- Optional: Reset asset status to original state
UPDATE onboarding_assets 
SET status = 'pending'  -- or whatever the original status was
WHERE id IN (
  '5b55ce93-6590-4781-8df4-21b771eea429',
  '9ebe7bce-63b5-4702-b108-e94877ee1f55',
  '443d072e-1500-4863-b8c2-027698631148',
  'bebe94b9-e642-49a8-a7d4-3af9835bd971',
  'a732cb9a-85b9-4dc8-b7ac-c68f74238037',
  '2c462fd9-4d67-4f25-a31d-a163e47f6c63'
);
*/

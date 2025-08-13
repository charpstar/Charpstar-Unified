-- FINAL TEST SCRIPT - Retroactive Bonus Feature
-- Ready to run with your actual user IDs and asset IDs

-- Admin ID: 7dcf03be-d650-4b64-b06a-946bb121e784
-- Modeler ID: 2b8c87fb-55ba-4bea-b65c-cabfbc77bf39

-- Step 1: First clean up any existing test data
DELETE FROM asset_assignments 
WHERE allocation_list_id IN (
  SELECT id FROM allocation_lists WHERE name LIKE 'Retroactive Bonus Test%'
);

DELETE FROM allocation_lists 
WHERE name LIKE 'Retroactive Bonus Test%';

-- Step 2: Create allocation list (Aug 15 → Sep 11) with unique ID
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
  '12345678-1234-5678-9012-123456789abc',  -- Fixed UUID for easy reference
  'Retroactive Bonus Test - Final 2025',
  '2b8c87fb-55ba-4bea-b65c-cabfbc77bf39',  -- Modeler ID
  'modeler',
  '7dcf03be-d650-4b64-b06a-946bb121e784',  -- Admin ID
  '2025-09-15 23:59:59',   -- Deadline: September 15, 2025
  15.0,                    -- 15% bonus
  'approved',              -- Completed status
  '2025-09-11 14:30:00',   -- Completed: September 11, 2025 (before deadline)
  '2025-08-15 09:00:00'    -- Created: August 15, 2025
);

-- Step 3: Create asset assignments with your real assets
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
('5b55ce93-6590-4781-8df4-21b771eea429', '2b8c87fb-55ba-4bea-b65c-cabfbc77bf39', 'modeler', 
 '12345678-1234-5678-9012-123456789abc', 
 'accepted', 50.00, '7dcf03be-d650-4b64-b06a-946bb121e784', '2025-08-15 09:00:00'),
-- Another Product
('9ebe7bce-63b5-4702-b108-e94877ee1f55', '2b8c87fb-55ba-4bea-b65c-cabfbc77bf39', 'modeler', 
 '12345678-1234-5678-9012-123456789abc', 
 'accepted', 50.00, '7dcf03be-d650-4b64-b06a-946bb121e784', '2025-08-15 09:00:00'),
-- Cargobike DeLight Box
('443d072e-1500-4863-b8c2-027698631148', '2b8c87fb-55ba-4bea-b65c-cabfbc77bf39', 'modeler', 
 '12345678-1234-5678-9012-123456789abc', 
 'accepted', 50.00, '7dcf03be-d650-4b64-b06a-946bb121e784', '2025-08-15 09:00:00'),
-- Phoenix King Ottoman Bed
('bebe94b9-e642-49a8-a7d4-3af9835bd971', '2b8c87fb-55ba-4bea-b65c-cabfbc77bf39', 'modeler', 
 '12345678-1234-5678-9012-123456789abc', 
 'accepted', 50.00, '7dcf03be-d650-4b64-b06a-946bb121e784', '2025-08-15 09:00:00'),
-- Cargobike Kindergarden
('a732cb9a-85b9-4dc8-b7ac-c68f74238037', '2b8c87fb-55ba-4bea-b65c-cabfbc77bf39', 'modeler', 
 '12345678-1234-5678-9012-123456789abc', 
 'accepted', 50.00, '7dcf03be-d650-4b64-b06a-946bb121e784', '2025-08-15 09:00:00'),
-- Cargobike Classic
('2c462fd9-4d67-4f25-a31d-a163e47f6c63', '2b8c87fb-55ba-4bea-b65c-cabfbc77bf39', 'modeler', 
 '12345678-1234-5678-9012-123456789abc', 
 'accepted', 50.00, '7dcf03be-d650-4b64-b06a-946bb121e784', '2025-08-15 09:00:00');

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

-- Step 5: Verify the test data was created correctly
SELECT 
  al.name AS "Allocation List",
  al.created_at AS "Created Date",
  al.approved_at AS "Completed Date", 
  al.deadline AS "Deadline",
  al.bonus || '%' AS "Bonus Rate",
  al.status AS "Status",
  COUNT(aa.asset_id) AS "Asset Count",
  '€' || SUM(aa.price) AS "Total Base",
  '€' || ROUND(SUM(aa.price * al.bonus / 100), 2) AS "Total Bonus",
  '€' || ROUND(SUM(aa.price * (1 + al.bonus / 100)), 2) AS "Grand Total"
FROM allocation_lists al
LEFT JOIN asset_assignments aa ON al.id = aa.allocation_list_id
WHERE al.name = 'Retroactive Bonus Test - Final 2025'
GROUP BY al.id, al.name, al.created_at, al.approved_at, al.deadline, al.bonus, al.status;

-- Step 6: Check individual assets
SELECT 
  oa.product_name AS "Product",
  oa.client AS "Client",
  oa.status AS "Asset Status",
  '€' || aa.price AS "Price",
  al.bonus || '%' AS "Bonus Rate",
  '€' || ROUND(aa.price * al.bonus / 100, 2) AS "Bonus Amount"
FROM asset_assignments aa
JOIN onboarding_assets oa ON aa.asset_id = oa.id
JOIN allocation_lists al ON aa.allocation_list_id = al.id
WHERE al.name = 'Retroactive Bonus Test - Final 2025'
ORDER BY oa.product_name;

-- EXPECTED RESULTS:
-- 📊 Summary:
--   - Asset Count: 6
--   - Total Base: €300.00
--   - Total Bonus: €45.00 (15% of €300)
--   - Grand Total: €345.00
--   - Created: Aug 15, 2025
--   - Completed: Sep 11, 2025 (before Sep 15 deadline)

-- 🧪 UI Testing Instructions:
-- 1. Login as modeler: 2b8c87fb-55ba-4bea-b65c-cabfbc77bf39
-- 2. Navigate to: /invoicing
-- 3. Select: "September 2025"
-- 4. Look for: "Retroactive Bonuses Applied This Month" section
-- 5. Verify: Should show +€45.00 retroactive bonus
-- 6. Test: August 2025 should NOT show retroactive bonus

-- 🧹 CLEANUP SCRIPT (run this when done testing)
/*
DELETE FROM asset_assignments 
WHERE allocation_list_id IN (
  SELECT id FROM allocation_lists WHERE name = 'Retroactive Bonus Test - Final'
);

DELETE FROM allocation_lists 
WHERE name = 'Retroactive Bonus Test - Final';

-- Optional: Reset asset status if needed
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

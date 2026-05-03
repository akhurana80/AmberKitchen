insert into restaurants (id, owner_id, name, address, contact_name, contact_phone, cuisine_type, onboarding_status, approval_status, lat, lng)
values (
  '00000000-0000-0000-0000-000000000001',
  null,
  'AmberKitchen Demo Restaurant',
  'Connaught Place, New Delhi',
  'Demo Owner',
  '+919999999999',
  'North Indian',
  'approved',
  'approved',
  28.6315,
  77.2167
)
on conflict (id) do nothing;

insert into zones (id, name, city, center_lat, center_lng, radius_km, sla_minutes, surge_multiplier)
values (
  '11111111-1111-4fff-8fff-111111111111',
  'Ghaziabad Central',
  'Ghaziabad',
  28.6692,
  77.4538,
  6,
  25,
  1.05
)
on conflict (id) do nothing;

insert into zones (id, name, city, center_lat, center_lng, radius_km, sla_minutes, surge_multiplier)
values (
  '22222222-2222-4fff-8fff-222222222222',
  'Raj Nagar Extension',
  'Ghaziabad',
  28.6603,
  77.3939,
  4.5,
  25,
  1.05
)
on conflict (id) do nothing;

insert into restaurants (id, owner_id, name, address, contact_name, contact_phone, cuisine_type, onboarding_status, approval_status, lat, lng)
values (
  '00000000-0000-0000-0000-000000000002',
  null,
  'AmberKitchen Ghaziabad Restaurant',
  'Kaushambi, Ghaziabad',
  'Demo Owner',
  '+919999999998',
  'North Indian',
  'approved',
  'approved',
  28.6459,
  77.3308
),
(
  '00000000-0000-0000-0000-000000000003',
  null,
  'AmberKitchen Raj Nagar Kitchen',
  'Raj Nagar Extension, Ghaziabad',
  'Demo Owner',
  '+919999999997',
  'Street Food',
  'approved',
  'approved',
  28.6603,
  77.3939
),
(
  '00000000-0000-0000-0000-000000000004',
  null,
  'Dilshad Garden Tandoor Point',
  'Dilshad Garden, Delhi',
  'Demo Owner',
  '+919999999996',
  'North Indian',
  'approved',
  'approved',
  28.6758,
  77.3211
)
on conflict (id) do nothing;

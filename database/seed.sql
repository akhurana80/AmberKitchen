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

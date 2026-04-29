insert into restaurants (id, owner_id, name, address, lat, lng)
values (
  '00000000-0000-0000-0000-000000000001',
  null,
  'AmberKitchen Demo Restaurant',
  'Connaught Place, New Delhi',
  28.6315,
  77.2167
)
on conflict (id) do nothing;

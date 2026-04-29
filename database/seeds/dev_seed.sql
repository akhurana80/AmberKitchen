insert into users (id, name, email, phone, role, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Demo Customer', 'customer@amberkitchen.local', '+919999000001', 'customer', now()),
  ('22222222-2222-4222-8222-222222222222', 'Demo Restaurant Admin', 'restaurant@amberkitchen.local', '+919999000002', 'restaurant_admin', now()),
  ('33333333-3333-4333-8333-333333333333', 'Demo Driver', 'driver@amberkitchen.local', '+919999000003', 'driver', now()),
  ('44444444-4444-4444-8444-444444444444', 'Demo Super Admin', 'admin@amberkitchen.local', '+919999000004', 'super_admin', now())
on conflict (id) do nothing;

insert into restaurants (id, owner_id, name, cuisine_type, address, lat, lng, approval_status, onboarding_status, created_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'Amber Delhi Kitchen', 'North Indian', 'Connaught Place, New Delhi', 28.6315, 77.2167, 'approved', 'approved', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Amber Gurgaon Bowls', 'Healthy Bowls', 'Cyber City, Gurugram', 28.4949, 77.0880, 'approved', 'approved', now())
on conflict (id) do nothing;

insert into menu_items (restaurant_id, name, description, price_paise, is_veg, cuisine_type, rating, photo_url, is_available)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paneer Tikka Bowl', 'Paneer tikka, rice, salad, and mint chutney', 24900, true, 'North Indian', 4.3, 'https://placehold.co/640x480?text=Paneer+Tikka+Bowl', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Butter Chicken Meal', 'Classic butter chicken with rice and naan', 34900, false, 'North Indian', 4.4, 'https://placehold.co/640x480?text=Butter+Chicken+Meal', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Quinoa Power Bowl', 'Quinoa, chickpeas, vegetables, and house dressing', 29900, true, 'Healthy Bowls', 4.1, 'https://placehold.co/640x480?text=Quinoa+Power+Bowl', true)
on conflict do nothing;

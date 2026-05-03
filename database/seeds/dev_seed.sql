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
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Amber Gurgaon Bowls', 'Healthy Bowls', 'Cyber City, Gurugram', 28.4949, 77.0880, 'approved', 'approved', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '22222222-2222-4222-8222-222222222222', 'Amber Ghaziabad Kitchen', 'Mughlai', 'Kaushambi, Ghaziabad', 28.6459, 77.3308, 'approved', 'approved', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '22222222-2222-4222-8222-222222222222', 'Amber Vaishali Kitchen', 'North Indian', 'Vaishali, Ghaziabad', 28.6506, 77.3851, 'approved', 'approved', now()),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '22222222-2222-4222-8222-222222222222', 'Amber Indirapuram Kitchen', 'South Indian', 'Indirapuram, Ghaziabad', 28.6204, 77.3999, 'approved', 'approved', now()),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', '22222222-2222-4222-8222-222222222222', 'Amber Raj Nagar Kitchen', 'Street Food', 'Raj Nagar Extension, Ghaziabad', 28.6603, 77.3939, 'approved', 'approved', now()),
  ('gggggggg-gggg-4ggg-8ggg-gggggggggggg', '22222222-2222-4222-8222-222222222222', 'Dilshad Garden Tandoor Point', 'North Indian', 'Dilshad Garden, Delhi', 28.6758, 77.3211, 'approved', 'approved', now())
on conflict (id) do nothing;

insert into zones (id, name, city, center_lat, center_lng, radius_km, sla_minutes, surge_multiplier, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Ghaziabad Central', 'Ghaziabad', 28.6692, 77.4538, 6, 25, 1.1, now()),
  ('22222222-2222-4222-8222-222222222222', 'Vaishali / Indirapuram', 'Ghaziabad', 28.6164, 77.3662, 5, 25, 1.05, now()),
  ('33333333-3333-4333-8333-333333333333', 'Raj Nagar Extension', 'Ghaziabad', 28.6603, 77.3939, 4.5, 25, 1.05, now())
on conflict (id) do nothing;

insert into offers (code, title, description, discount_type, discount_value, min_order_paise, starts_at, ends_at, is_active)
values
  ('GHAZ10', 'Ghaziabad launch offer', '10% off first Ghaziabad order', 'percent', 10, 15000, now(), now() + interval '30 days', true)
on conflict (code) do nothing;

insert into menu_items (restaurant_id, name, description, price_paise, is_veg, cuisine_type, rating, photo_url, is_available)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paneer Tikka Bowl', 'Paneer tikka, rice, salad, and mint chutney', 24900, true, 'North Indian', 4.3, 'https://placehold.co/640x480?text=Paneer+Tikka+Bowl', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Butter Chicken Meal', 'Classic butter chicken with rice and naan', 34900, false, 'North Indian', 4.4, 'https://placehold.co/640x480?text=Butter+Chicken+Meal', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Quinoa Power Bowl', 'Quinoa, chickpeas, vegetables, and house dressing', 29900, true, 'Healthy Bowls', 4.1, 'https://placehold.co/640x480?text=Quinoa+Power+Bowl', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Paneer Lababdar Thali', 'Rich paneer lababdar with rice and naan', 27900, true, 'Mughlai', 4.2, 'https://placehold.co/640x480?text=Paneer+Lababdar+Thali', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Mutton Rogan Josh', 'Slow-cooked mutton in a spiced gravy', 34900, false, 'Mughlai', 4.5, 'https://placehold.co/640x480?text=Mutton+Rogan+Josh', true),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Mixed Kebab Platter', 'Chicken and paneer kebabs with chutney', 32900, false, 'North Indian', 4.4, 'https://placehold.co/640x480?text=Mixed+Kebab+Platter', true),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Veg Thali Deluxe', 'Seasonal vegetables, dal, roti, rice and chutneys', 24900, true, 'North Indian', 4.0, 'https://placehold.co/640x480?text=Veg+Thali+Deluxe', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Masala Dosa Plate', 'Crispy dosa with sambar and chutneys', 22900, true, 'South Indian', 4.2, 'https://placehold.co/640x480?text=Masala+Dosa+Plate', true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Raj Nagar Chaat Platter', 'Mixed chaat, gol gappe and dahi puri', 19900, true, 'Street Food', 4.0, 'https://placehold.co/640x480?text=Raj+Nagar+Chaat+Platter', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Idli Sambar Combo', 'Steamed idli with hot sambar and coconut chutney', 18900, true, 'South Indian', 4.1, 'https://placehold.co/640x480?text=Idli+Sambar+Combo', true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Paneer Tikka Masala', 'Creamy paneer with tomato gravy and rice', 27900, true, 'North Indian', 4.3, 'https://placehold.co/640x480?text=Paneer+Tikka+Masala', true),
  ('gggggggg-gggg-4ggg-8ggg-gggggggggggg', 'Tandoori Chicken', 'Spicy marinated chicken cooked in tandoor', 34900, false, 'North Indian', 4.5, 'https://placehold.co/640x480?text=Tandoori+Chicken', true)
on conflict do nothing;

insert into users (id, name, email, phone, role, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Demo Customer', 'customer@amberkitchen.local', '+919999000001', 'customer', now()),
  ('22222222-2222-4222-8222-222222222222', 'Demo Restaurant Admin', 'restaurant@amberkitchen.local', '+919999000002', 'restaurant', now()),
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
  ('a1b2c3d4-e5f6-4a1b-8a1b-a1b2c3d4e5f6', '22222222-2222-4222-8222-222222222222', 'Dilshad Garden Tandoor Point', 'North Indian', 'Dilshad Garden, Delhi', 28.6758, 77.3211, 'approved', 'approved', now())
on conflict (id) do nothing;

insert into zones (id, name, city, center_lat, center_lng, radius_km, sla_minutes, surge_multiplier, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Ghaziabad Central', 'Ghaziabad', 28.6692, 77.4538, 6, 25, 1.1, now()),
  ('22222222-2222-4222-8222-222222222222', 'Vaishali / Indirapuram', 'Ghaziabad', 28.6164, 77.3662, 5, 25, 1.05, now()),
  ('33333333-3333-4333-8333-333333333333', 'Raj Nagar Extension', 'Ghaziabad', 28.6603, 77.3939, 4.5, 25, 1.05, now())
on conflict (id) do nothing;

insert into offers (code, title, description, discount_type, discount_value, min_order_paise, starts_at, ends_at, is_active)
values
  ('GHAZ10', 'Ghaziabad Launch Offer', '10% off your first Ghaziabad order', 'percent', 10, 15000, now(), now() + interval '30 days', true),
  ('AMBER50', 'Flat ₹50 Off', 'Get ₹50 off on orders above ₹299', 'flat', 5000, 29900, now(), now() + interval '60 days', true),
  ('WELCOME20', 'Welcome 20% Off', '20% off on your first order — new customers only', 'percent', 20, 20000, now(), now() + interval '90 days', true),
  ('HEALTHY100', 'Healthy Bowl Offer', 'Flat ₹100 off on all Healthy Bowl orders', 'flat', 10000, 49900, now(), now() + interval '45 days', true)
on conflict (code) do nothing;

insert into menu_items (restaurant_id, name, description, price_paise, is_veg, cuisine_type, rating, photo_url, is_available)
values
  -- Amber Delhi Kitchen
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paneer Tikka Bowl', 'Paneer tikka, rice, salad, and mint chutney', 24900, true, 'North Indian', 4.3, 'https://placehold.co/640x480?text=Paneer+Tikka+Bowl', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Butter Chicken Meal', 'Classic butter chicken with rice and naan', 34900, false, 'North Indian', 4.4, 'https://placehold.co/640x480?text=Butter+Chicken+Meal', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Dal Makhani Thali', 'Slow-cooked dal makhani with roti and rice', 22900, true, 'North Indian', 4.2, 'https://placehold.co/640x480?text=Dal+Makhani+Thali', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Chicken Biryani', 'Fragrant basmati rice with tender chicken pieces', 32900, false, 'North Indian', 4.6, 'https://placehold.co/640x480?text=Chicken+Biryani', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Palak Paneer Meal', 'Creamy spinach with paneer, served with naan', 26900, true, 'North Indian', 4.1, 'https://placehold.co/640x480?text=Palak+Paneer+Meal', true),
  -- Amber Gurgaon Bowls
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Quinoa Power Bowl', 'Quinoa, chickpeas, vegetables, and house dressing', 29900, true, 'Healthy Bowls', 4.1, 'https://placehold.co/640x480?text=Quinoa+Power+Bowl', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Grilled Chicken Bowl', 'Grilled chicken, brown rice, and garden vegetables', 32900, false, 'Healthy Bowls', 4.3, 'https://placehold.co/640x480?text=Grilled+Chicken+Bowl', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Avocado Veggie Bowl', 'Avocado, corn, cherry tomatoes and lemon dressing', 27900, true, 'Healthy Bowls', 4.0, 'https://placehold.co/640x480?text=Avocado+Veggie+Bowl', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Protein Egg Bowl', 'Boiled eggs, spinach, quinoa, and tahini', 24900, true, 'Healthy Bowls', 4.2, 'https://placehold.co/640x480?text=Protein+Egg+Bowl', true),
  -- Amber Ghaziabad Kitchen
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Paneer Lababdar Thali', 'Rich paneer lababdar with rice and naan', 27900, true, 'Mughlai', 4.2, 'https://placehold.co/640x480?text=Paneer+Lababdar+Thali', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Mutton Rogan Josh', 'Slow-cooked mutton in a spiced gravy', 34900, false, 'Mughlai', 4.5, 'https://placehold.co/640x480?text=Mutton+Rogan+Josh', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Chicken Korma', 'Tender chicken in a rich cashew and cream gravy', 31900, false, 'Mughlai', 4.3, 'https://placehold.co/640x480?text=Chicken+Korma', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Mughlai Paratha', 'Flaky paratha stuffed with minced meat and egg', 19900, false, 'Mughlai', 4.1, 'https://placehold.co/640x480?text=Mughlai+Paratha', true),
  -- Amber Vaishali Kitchen
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Mixed Kebab Platter', 'Chicken and paneer kebabs with chutney', 32900, false, 'North Indian', 4.4, 'https://placehold.co/640x480?text=Mixed+Kebab+Platter', true),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Veg Thali Deluxe', 'Seasonal vegetables, dal, roti, rice and chutneys', 24900, true, 'North Indian', 4.0, 'https://placehold.co/640x480?text=Veg+Thali+Deluxe', true),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Shahi Paneer Meal', 'Paneer in a royal tomato cream sauce with naan', 28900, true, 'North Indian', 4.3, 'https://placehold.co/640x480?text=Shahi+Paneer+Meal', true),
  -- Amber Indirapuram Kitchen
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Masala Dosa Plate', 'Crispy dosa with sambar and chutneys', 22900, true, 'South Indian', 4.2, 'https://placehold.co/640x480?text=Masala+Dosa+Plate', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Idli Sambar Combo', 'Steamed idli with hot sambar and coconut chutney', 18900, true, 'South Indian', 4.1, 'https://placehold.co/640x480?text=Idli+Sambar+Combo', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Rava Uttapam', 'Thick semolina pancake with tomato and onion topping', 20900, true, 'South Indian', 4.0, 'https://placehold.co/640x480?text=Rava+Uttapam', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Chettinad Chicken Curry', 'Spicy South Indian chicken curry with steamed rice', 29900, false, 'South Indian', 4.4, 'https://placehold.co/640x480?text=Chettinad+Chicken+Curry', true),
  -- Amber Raj Nagar Kitchen
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Raj Nagar Chaat Platter', 'Mixed chaat, gol gappe and dahi puri', 19900, true, 'Street Food', 4.0, 'https://placehold.co/640x480?text=Raj+Nagar+Chaat+Platter', true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Paneer Tikka Masala', 'Creamy paneer with tomato gravy and rice', 27900, true, 'North Indian', 4.3, 'https://placehold.co/640x480?text=Paneer+Tikka+Masala', true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Pav Bhaji', 'Spiced mashed vegetables served with buttered pav', 17900, true, 'Street Food', 4.2, 'https://placehold.co/640x480?text=Pav+Bhaji', true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Chole Bhature', 'Fluffy bhature with spicy chickpea curry', 18900, true, 'Street Food', 4.1, 'https://placehold.co/640x480?text=Chole+Bhature', true),
  -- Dilshad Garden Tandoor Point
  ('a1b2c3d4-e5f6-4a1b-8a1b-a1b2c3d4e5f6', 'Tandoori Chicken', 'Spicy marinated chicken cooked in tandoor', 34900, false, 'North Indian', 4.5, 'https://placehold.co/640x480?text=Tandoori+Chicken', true),
  ('a1b2c3d4-e5f6-4a1b-8a1b-a1b2c3d4e5f6', 'Seekh Kebab Plate', 'Minced lamb kebabs with onion rings and chutney', 31900, false, 'North Indian', 4.4, 'https://placehold.co/640x480?text=Seekh+Kebab+Plate', true),
  ('a1b2c3d4-e5f6-4a1b-8a1b-a1b2c3d4e5f6', 'Tandoori Roti Basket', 'Assorted tandoori breads with dal and pickle', 14900, true, 'North Indian', 4.0, 'https://placehold.co/640x480?text=Tandoori+Roti+Basket', true),
  ('a1b2c3d4-e5f6-4a1b-8a1b-a1b2c3d4e5f6', 'Murgh Malai Tikka', 'Creamy marinated chicken tikka from the tandoor', 32900, false, 'North Indian', 4.3, 'https://placehold.co/640x480?text=Murgh+Malai+Tikka', true)
on conflict do nothing;

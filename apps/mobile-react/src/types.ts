export type Role = "customer" | "driver" | "restaurant" | "admin" | "super_admin" | "delivery_admin";
export type PaymentProvider = "paytm" | "phonepe" | "razorpay";

export type AuthSession = {
  token: string;
  refreshToken?: string;
  user: unknown;
};

export type RestaurantSearchResult = {
  menu_item_id: string;
  menu_item_name: string;
  description: string | null;
  price_paise: number;
  photo_url: string | null;
  is_veg: boolean | null;
  cuisine_type: string | null;
  rating: string | null;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string;
  distance_km: string | null;
};

export type TrendingRestaurant = {
  id: string;
  name: string;
  address: string;
  cuisine_type: string | null;
  lat: string | null;
  lng: string | null;
  recent_orders: number;
  rating: string | null;
  starting_price_paise: number | null;
  photo_url: string | null;
  distance_km: string | null;
  trending_score: string;
  predicted_eta_minutes: number;
};

export type OrderSummary = {
  id: string;
  status: string;
  total_paise: number;
  delivery_address: string;
  delivery_lat: string;
  delivery_lng: string;
  estimated_delivery_at: string | null;
  driver_phone: string | null;
  driver_name: string | null;
  history: Array<{ status: string; note: string | null; created_at: string }>;
};

export type DriverOrder = {
  id: string;
  status: string;
  total_paise: number;
  delivery_address: string;
  delivery_lat: string;
  delivery_lng: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_lat: string | null;
  restaurant_lng: string | null;
};

export type DriverOnboardingApplication = {
  id: string;
  full_name: string;
  phone: string | null;
  aadhaar_last4: string | null;
  ocr_status: string;
  selfie_status: string;
  background_check_status: string;
  bank_account_last4: string | null;
  upi_id: string | null;
  referral_code: string | null;
  approval_status: string;
  admin_note: string | null;
};

export type AdminDashboard = {
  users: number;
  ordersByStatus: Array<{ status: string; count: number }>;
  revenuePaise: number;
  payments: Array<{ provider: string; status: string; count: number }>;
  recentOrders: Array<{ id: string; status: string; total_paise: number; restaurant_name: string; created_at: string }>;
};

export type WalletSummary = {
  wallet: { balance_paise: number; total_earnings_paise: number; total_payouts_paise: number };
  earnings: { earned_paise: string; deliveries: string };
  pendingPayouts: { requested_paise: string; requests: string };
};

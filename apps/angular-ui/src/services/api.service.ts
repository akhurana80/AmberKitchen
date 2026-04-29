import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../environments/environment";

@Injectable({ providedIn: "root" })
export class ApiService {
  baseUrl = environment.apiBaseUrl;
  token = "";

  constructor(private http: HttpClient) {}

  requestOtp(phone: string) {
    return this.http.post<{ sent: boolean; devCode?: string }>(`${this.baseUrl}/api/auth/otp/request`, { phone });
  }

  verifyOtp(phone: string, code: string, role: string) {
    return this.http.post<{ token: string; user: unknown }>(`${this.baseUrl}/api/auth/otp/verify`, {
      phone,
      code,
      role
    });
  }

  googleLogin(idToken: string, role: string) {
    return this.http.post<{ token: string; user: unknown }>(`${this.baseUrl}/api/auth/google`, {
      idToken,
      role
    });
  }

  createOrder() {
    return this.http.post<{ id: string; totalPaise: number; status: string; estimatedDeliveryAt: string }>(
      `${this.baseUrl}/api/orders`,
      {
        restaurantId: "00000000-0000-0000-0000-000000000001",
        deliveryAddress: "Demo delivery address",
        deliveryLat: 28.6139,
        deliveryLng: 77.209,
        items: [{ name: "Demo Thali", quantity: 1, pricePaise: 24900 }]
      },
      { headers: this.authHeaders() }
    );
  }

  getOrder(orderId: string) {
    return this.http.get<{
      id: string;
      status: string;
      total_paise: number;
      delivery_address: string;
      delivery_lat: string;
      delivery_lng: string;
      estimated_delivery_at: string | null;
      driver_phone: string | null;
      driver_name: string | null;
      history: Array<{ status: string; note: string; created_at: string }>;
    }>(`${this.baseUrl}/api/orders/${orderId}`, { headers: this.authHeaders() });
  }

  editOrderBeforeConfirmation(orderId: string, deliveryAddress: string) {
    return this.http.patch(
      `${this.baseUrl}/api/orders/${orderId}`,
      {
        deliveryAddress,
        deliveryLat: 28.6139,
        deliveryLng: 77.209
      },
      { headers: this.authHeaders() }
    );
  }

  cancelOrder(orderId: string, reason: string) {
    return this.http.post(`${this.baseUrl}/api/orders/${orderId}/cancel`, { reason }, { headers: this.authHeaders() });
  }

  reorder(orderId: string) {
    return this.http.post<{ id: string; totalPaise: number; status: string; estimatedDeliveryAt: string }>(
      `${this.baseUrl}/api/orders/${orderId}/reorder`,
      {},
      { headers: this.authHeaders() }
    );
  }

  createPayment(provider: "paytm" | "phonepe", orderId: string) {
    return this.http.post(
      `${this.baseUrl}/api/payments/create`,
      { provider, orderId, amountPaise: 24900 },
      { headers: this.authHeaders() }
    );
  }

  requestRefund(orderId: string, reason: string, amountPaise?: number) {
    return this.http.post(`${this.baseUrl}/api/payments/refunds`, { orderId, reason, amountPaise }, { headers: this.authHeaders() });
  }

  registerDeviceToken(token: string) {
    return this.http.post(`${this.baseUrl}/api/notifications/device-token`, { token, platform: "web" }, { headers: this.authHeaders() });
  }

  sendTestNotification() {
    return this.http.post(`${this.baseUrl}/api/notifications/test`, {}, { headers: this.authHeaders() });
  }

  availableDeliveryOrders() {
    return this.http.get<Array<{
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
    }>>(`${this.baseUrl}/api/orders/available`, { headers: this.authHeaders() });
  }

  acceptDeliveryOrder(orderId: string) {
    return this.http.patch(`${this.baseUrl}/api/orders/${orderId}/assign`, {}, { headers: this.authHeaders() });
  }

  updateOrderStatus(orderId: string, status: string) {
    return this.http.patch(`${this.baseUrl}/api/orders/${orderId}/status`, { status }, { headers: this.authHeaders() });
  }

  sendDriverLocation(orderId: string, lat: number, lng: number) {
    return this.http.post(
      `${this.baseUrl}/api/tracking/orders/${orderId}/location`,
      { lat, lng },
      { headers: this.authHeaders() }
    );
  }

  submitDriverOnboarding(input: {
    fullName: string;
    phone?: string;
    aadhaarLast4: string;
    aadhaarFrontUrl?: string;
    aadhaarBackUrl?: string;
    selfieUrl?: string;
    bankAccountLast4?: string;
    upiId?: string;
    referredByCode?: string;
  }) {
    return this.http.post<DriverOnboardingApplication>(
      `${this.baseUrl}/api/driver-onboarding/signup`,
      input,
      { headers: this.authHeaders() }
    );
  }

  myDriverOnboarding() {
    return this.http.get<DriverOnboardingApplication | null>(
      `${this.baseUrl}/api/driver-onboarding/mine`,
      { headers: this.authHeaders() }
    );
  }

  runDriverBackgroundCheck() {
    return this.http.post<DriverOnboardingApplication>(
      `${this.baseUrl}/api/driver-onboarding/background-check`,
      { consent: true },
      { headers: this.authHeaders() }
    );
  }

  driverOnboardingApplications() {
    return this.http.get<DriverOnboardingApplication[]>(
      `${this.baseUrl}/api/driver-onboarding/admin/applications`,
      { headers: this.authHeaders() }
    );
  }

  updateDriverApplicationApproval(id: string, status: "approved" | "rejected" | "pending", note?: string) {
    return this.http.patch<DriverOnboardingApplication>(
      `${this.baseUrl}/api/driver-onboarding/admin/applications/${id}/approval`,
      { status, note },
      { headers: this.authHeaders() }
    );
  }

  driverReferrals() {
    return this.http.get<Array<{
      id: string;
      referral_code: string;
      status: string;
      reward_paise: number;
      referrer_phone: string | null;
      referred_phone: string | null;
      created_at: string;
    }>>(`${this.baseUrl}/api/driver-onboarding/admin/referrals`, { headers: this.authHeaders() });
  }

  orderEta(orderId: string) {
    return this.http.get<{
      orderId: string;
      status: string;
      predictedEtaMinutes: number;
      predictedDeliveryAt: string;
      currentEstimatedDeliveryAt: string | null;
      route: {
        origin: { lat: number; lng: number };
        pickup: { lat: number; lng: number };
        dropoff: { lat: number; lng: number };
        distanceToPickupKm: number;
        distanceToDropoffKm: number;
      };
      driverLocationAt: string | null;
    }>(`${this.baseUrl}/api/tracking/orders/${orderId}/eta`, { headers: this.authHeaders() });
  }

  adminDashboard() {
    return this.http.get<{
      users: number;
      ordersByStatus: Array<{ status: string; count: number }>;
      revenuePaise: number;
      payments: Array<{ provider: string; status: string; count: number }>;
      recentOrders: Array<{ id: string; status: string; total_paise: number; restaurant_name: string; created_at: string }>;
    }>(`${this.baseUrl}/api/admin/dashboard`, { headers: this.authHeaders() });
  }

  adminRestaurants() {
    return this.http.get<Array<{ id: string; name: string; address: string; approval_status: string }>>(
      `${this.baseUrl}/api/admin/restaurants`,
      { headers: this.authHeaders() }
    );
  }

  updateRestaurantApproval(id: string, status: "approved" | "rejected" | "pending") {
    return this.http.patch(`${this.baseUrl}/api/admin/restaurants/${id}/approval`, { status }, { headers: this.authHeaders() });
  }

  adminUsers() {
    return this.http.get<Array<{ id: string; phone: string; email: string; name: string; role: string }>>(
      `${this.baseUrl}/api/admin/users`,
      { headers: this.authHeaders() }
    );
  }

  adminAllOrders() {
    return this.http.get<Array<{ id: string; status: string; total_paise: number; restaurant_name: string; customer_phone: string; driver_phone: string }>>(
      `${this.baseUrl}/api/admin/orders`,
      { headers: this.authHeaders() }
    );
  }

  paymentReports() {
    return this.http.get<Array<{ provider: string; status: string; transactions: number; amount_paise: number }>>(
      `${this.baseUrl}/api/admin/payment-reports`,
      { headers: this.authHeaders() }
    );
  }

  platformAnalytics() {
    return this.http.get<{ dailyOrders: unknown[]; topRestaurants: unknown[]; driverStats: unknown[] }>(
      `${this.baseUrl}/api/admin/analytics`,
      { headers: this.authHeaders() }
    );
  }

  onboardRestaurant(input: {
    name: string;
    address: string;
    contactName: string;
    contactPhone: string;
    cuisineType: string;
    fssaiLicense?: string;
    gstNumber?: string;
    bankAccountLast4?: string;
  }) {
    return this.http.post<{ id: string; name: string; address: string; approval_status: string; onboarding_status: string }>(
      `${this.baseUrl}/api/restaurants/onboarding`,
      input,
      { headers: this.authHeaders() }
    );
  }

  myRestaurants() {
    return this.http.get<Array<{ id: string; name: string; address: string; approval_status: string; onboarding_status: string }>>(
      `${this.baseUrl}/api/restaurants/mine`,
      { headers: this.authHeaders() }
    );
  }

  googlePlacesDelhiNcrRestaurants(minRating = 3) {
    return this.http.get<{
      source: string;
      region: string;
      minRating: number;
      restaurants: Array<{
        googlePlaceId: string;
        name: string;
        address: string;
        rating: number;
        photoUrl: string | null;
        lat: number;
        lng: number;
      }>;
    }>(`${this.baseUrl}/api/restaurants/google-places/delhi-ncr?minRating=${minRating}`, { headers: this.authHeaders() });
  }

  trendingRestaurants(lat = 28.6139, lng = 77.209) {
    return this.http.get<Array<{
      id: string;
      name: string;
      address: string;
      cuisine_type: string | null;
      lat: string | null;
      lng: string | null;
      recent_orders: number;
      delivered_orders: number;
      active_orders: number;
      rating: string | null;
      starting_price_paise: number | null;
      photo_url: string | null;
      distance_km: string | null;
      trending_score: string;
      historical_eta_minutes: number;
      predicted_eta_minutes: number;
    }>>(`${this.baseUrl}/api/restaurants/trending?lat=${lat}&lng=${lng}`, { headers: this.authHeaders() });
  }

  searchRestaurants(filters: {
    q?: string;
    cuisine?: string;
    diet?: "all" | "veg" | "non_veg";
    minRating?: number;
    maxPricePaise?: number;
    sort?: "rating_desc" | "distance" | "price_asc" | "price_desc";
    lat?: number;
    lng?: number;
  }) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    return this.http.get<Array<{
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
    }>>(`${this.baseUrl}/api/restaurants/search?${params.toString()}`, { headers: this.authHeaders() });
  }

  createMenuItem(restaurantId: string, item: {
    name: string;
    pricePaise: number;
    description?: string;
    photoUrl?: string;
    isVeg?: boolean;
    cuisineType?: string;
    rating?: number;
  }) {
    return this.http.post(
      `${this.baseUrl}/api/restaurants/${restaurantId}/menu`,
      { ...item, isAvailable: true },
      { headers: this.authHeaders() }
    );
  }

  importMenuItems(restaurantId: string, items: Array<{
    name: string;
    pricePaise: number;
    description?: string;
    photoUrl?: string;
    isVeg?: boolean;
    cuisineType?: string;
    rating?: number;
    googlePlaceId?: string;
  }>) {
    return this.http.post(
      `${this.baseUrl}/api/restaurants/${restaurantId}/menu/import`,
      { items },
      { headers: this.authHeaders() }
    );
  }

  restaurantOrders(restaurantId: string) {
    return this.http.get<Array<{ id: string; status: string; total_paise: number }>>(
      `${this.baseUrl}/api/restaurants/${restaurantId}/orders`,
      { headers: this.authHeaders() }
    );
  }

  decideRestaurantOrder(orderId: string, decision: "accepted" | "cancelled") {
    return this.http.patch(`${this.baseUrl}/api/restaurants/orders/${orderId}/decision`, { decision }, { headers: this.authHeaders() });
  }

  restaurantEarnings(restaurantId: string) {
    return this.http.get<{ orders: string; gross_paise: string; estimated_payout_paise: string }>(
      `${this.baseUrl}/api/restaurants/${restaurantId}/earnings`,
      { headers: this.authHeaders() }
    );
  }

  deliveryAdminOrders() {
    return this.http.get<Array<{
      id: string;
      status: string;
      restaurant_name: string;
      driver_phone: string;
      last_driver_lat: string | null;
      last_driver_lng: string | null;
      last_location_at: string | null;
    }>>(
      `${this.baseUrl}/api/delivery-admin/orders`,
      { headers: this.authHeaders() }
    );
  }

  deliveryDrivers() {
    return this.http.get<Array<{ id: string; phone: string; name: string }>>(`${this.baseUrl}/api/delivery-admin/drivers`, {
      headers: this.authHeaders()
    });
  }

  assignDriver(orderId: string, driverId: string) {
    return this.http.patch(`${this.baseUrl}/api/delivery-admin/orders/${orderId}/assign-driver`, { driverId }, { headers: this.authHeaders() });
  }

  private authHeaders() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }
}

export type DriverOnboardingApplication = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  user_phone?: string | null;
  aadhaar_last4: string | null;
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  selfie_url: string | null;
  ocr_status: string;
  ocr_confidence: string | null;
  selfie_status: string;
  selfie_match_score: string | null;
  background_check_status: string;
  bank_account_last4: string | null;
  upi_id: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  approval_status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

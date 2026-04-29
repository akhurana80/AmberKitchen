import { Platform } from "react-native";
import { config } from "./config";
import {
  AdminDashboard,
  AuthSession,
  DriverOnboardingApplication,
  DriverOrder,
  OrderSummary,
  PaymentProvider,
  RestaurantSearchResult,
  Role,
  TrendingRestaurant,
  WalletSummary
} from "./types";

type RequestOptions = {
  token?: string;
  idempotencyKey?: string;
};

export class ApiClient {
  constructor(private readonly baseUrl = config.apiBaseUrl) {}

  async requestOtp(phone: string) {
    return this.post<{ sent: boolean; devCode?: string }>("/api/v1/auth/otp/request", { phone });
  }

  async verifyOtp(phone: string, code: string, role: Role) {
    return this.post<AuthSession>("/api/v1/auth/otp/verify", { phone, code, role });
  }

  async googleLogin(idToken: string, role: Role) {
    return this.post<AuthSession>("/api/v1/auth/google", { idToken, role });
  }

  async registerDeviceToken(token: string, pushToken: string) {
    return this.post("/api/v1/notifications/device-token", { token: pushToken, platform: Platform.OS }, { token });
  }

  async sendTestNotification(token: string) {
    return this.post("/api/v1/notifications/test", {}, { token });
  }

  async trendingRestaurants(token: string, lat: number, lng: number) {
    return this.get<TrendingRestaurant[]>(`/api/v1/restaurants/trending?lat=${lat}&lng=${lng}`, { token });
  }

  async searchRestaurants(token: string, filters: {
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
    return this.get<RestaurantSearchResult[]>(`/api/v1/restaurants/search?${params.toString()}`, { token });
  }

  async googlePlacesDelhiNcr(token: string, minRating = 3) {
    return this.get<{ restaurants: Array<{ name: string; address: string; rating: number; lat: number; lng: number; photoUrl: string | null }> }>(
      `/api/v1/restaurants/google-places/delhi-ncr?minRating=${minRating}`,
      { token }
    );
  }

  async createOrder(token: string, restaurantId: string, lat: number, lng: number) {
    return this.post<{ id: string; totalPaise: number; status: string; estimatedDeliveryAt: string }>(
      "/api/v1/orders",
      {
        restaurantId,
        deliveryAddress: "Mobile delivery address",
        deliveryLat: lat,
        deliveryLng: lng,
        items: [{ name: "Mobile Demo Thali", quantity: 1, pricePaise: 24900 }]
      },
      { token, idempotencyKey: `mobile-${Date.now()}` }
    );
  }

  async getOrder(token: string, orderId: string) {
    return this.get<OrderSummary>(`/api/v1/orders/${orderId}`, { token });
  }

  async editOrder(token: string, orderId: string, deliveryAddress: string, lat: number, lng: number) {
    return this.patch(`/api/v1/orders/${orderId}`, { deliveryAddress, deliveryLat: lat, deliveryLng: lng }, { token });
  }

  async cancelOrder(token: string, orderId: string, reason: string) {
    return this.post(`/api/v1/orders/${orderId}/cancel`, { reason }, { token });
  }

  async reorder(token: string, orderId: string) {
    return this.post<{ id: string; totalPaise: number; status: string; estimatedDeliveryAt: string }>(`/api/v1/orders/${orderId}/reorder`, {}, { token });
  }

  async createPayment(token: string, provider: PaymentProvider, orderId: string, amountPaise = 24900) {
    return this.post<{ redirectUrl?: string; paymentUrl?: string; provider: PaymentProvider }>(
      "/api/v1/payments/create",
      { provider, orderId, amountPaise },
      { token }
    );
  }

  async requestRefund(token: string, orderId: string, reason: string, amountPaise?: number) {
    return this.post("/api/v1/payments/refunds", { orderId, reason, amountPaise }, { token });
  }

  async orderEta(token: string, orderId: string) {
    return this.get<{
      predictedEtaMinutes: number;
      predictedDeliveryAt: string;
      route: {
        origin: { lat: number; lng: number };
        pickup: { lat: number; lng: number };
        dropoff: { lat: number; lng: number };
        distanceToPickupKm: number;
        distanceToDropoffKm: number;
      };
    }>(`/api/v1/tracking/orders/${orderId}/eta`, { token });
  }

  async sendDriverLocation(token: string, orderId: string, lat: number, lng: number) {
    return this.post(`/api/v1/tracking/orders/${orderId}/location`, { lat, lng }, { token });
  }

  async availableDeliveryOrders(token: string) {
    return this.get<DriverOrder[]>("/api/v1/orders/available", { token });
  }

  async acceptDeliveryOrder(token: string, orderId: string) {
    return this.patch(`/api/v1/orders/${orderId}/assign`, {}, { token });
  }

  async updateOrderStatus(token: string, orderId: string, status: string) {
    return this.patch(`/api/v1/orders/${orderId}/status`, { status }, { token });
  }

  async submitDriverOnboarding(token: string, input: {
    fullName: string;
    aadhaarLast4: string;
    aadhaarFrontUrl?: string;
    aadhaarBackUrl?: string;
    selfieUrl?: string;
    bankAccountLast4?: string;
    upiId?: string;
    referredByCode?: string;
  }) {
    return this.post<DriverOnboardingApplication>("/api/v1/driver-onboarding/signup", input, { token });
  }

  async myDriverOnboarding(token: string) {
    return this.get<DriverOnboardingApplication | null>("/api/v1/driver-onboarding/mine", { token });
  }

  async runDriverBackgroundCheck(token: string) {
    return this.post<DriverOnboardingApplication>("/api/v1/driver-onboarding/background-check", { consent: true }, { token });
  }

  async onboardRestaurant(token: string, input: {
    name: string;
    address: string;
    contactName: string;
    contactPhone: string;
    cuisineType: string;
    fssaiLicense?: string;
    gstNumber?: string;
    bankAccountLast4?: string;
  }) {
    return this.post("/api/v1/restaurants/onboarding", input, { token });
  }

  async myRestaurants(token: string) {
    return this.get<Array<{ id: string; name: string; approval_status: string; onboarding_status: string }>>("/api/v1/restaurants/mine", { token });
  }

  async createMenuItem(token: string, restaurantId: string, item: {
    name: string;
    pricePaise: number;
    description?: string;
    photoUrl?: string;
    isVeg?: boolean;
    cuisineType?: string;
    rating?: number;
  }) {
    return this.post(`/api/v1/restaurants/${restaurantId}/menu`, { ...item, isAvailable: true }, { token });
  }

  async restaurantOrders(token: string, restaurantId: string) {
    return this.get<Array<{ id: string; status: string; total_paise: number }>>(`/api/v1/restaurants/${restaurantId}/orders`, { token });
  }

  async decideRestaurantOrder(token: string, orderId: string, decision: "accepted" | "cancelled") {
    return this.patch(`/api/v1/restaurants/orders/${orderId}/decision`, { decision }, { token });
  }

  async restaurantEarnings(token: string, restaurantId: string) {
    return this.get<{ orders: string; gross_paise: string; estimated_payout_paise: string }>(`/api/v1/restaurants/${restaurantId}/earnings`, { token });
  }

  async adminDashboard(token: string) {
    return this.get<AdminDashboard>("/api/v1/admin/dashboard", { token });
  }

  async adminRestaurants(token: string) {
    return this.get<Array<{ id: string; name: string; address: string; approval_status: string }>>("/api/v1/admin/restaurants", { token });
  }

  async updateRestaurantApproval(token: string, id: string, status: "approved" | "rejected" | "pending") {
    return this.patch(`/api/v1/admin/restaurants/${id}/approval`, { status }, { token });
  }

  async adminAllOrders(token: string) {
    return this.get<Array<{ id: string; status: string; total_paise: number; restaurant_name: string }>>("/api/v1/admin/orders", { token });
  }

  async adminUsers(token: string) {
    return this.get<Array<{ id: string; phone: string | null; email: string | null; name: string | null; role: string }>>("/api/v1/admin/users", { token });
  }

  async paymentReports(token: string) {
    return this.get<Array<{ provider: string; status: string; transactions: number; amount_paise: number }>>("/api/v1/admin/payment-reports", { token });
  }

  async platformAnalytics(token: string) {
    return this.get<{ dailyOrders: unknown[]; topRestaurants: unknown[]; driverStats: unknown[] }>("/api/v1/admin/analytics", { token });
  }

  async deliveryAdminOrders(token: string) {
    return this.get<Array<{ id: string; status: string; restaurant_name: string; last_driver_lat: string | null; last_driver_lng: string | null }>>(
      "/api/v1/delivery-admin/orders",
      { token }
    );
  }

  async deliveryDrivers(token: string) {
    return this.get<Array<{ id: string; phone: string | null; name: string | null }>>("/api/v1/delivery-admin/drivers", { token });
  }

  async assignDriver(token: string, orderId: string, driverId: string) {
    return this.patch(`/api/v1/delivery-admin/orders/${orderId}/assign-driver`, { driverId }, { token });
  }

  async driverLoadBalancing(token: string) {
    return this.get<Array<{ id: string; phone: string | null; active_orders: number; capacity_score: number }>>("/api/v1/operations/driver-load", { token });
  }

  async assignBestDriver(token: string, orderId: string) {
    return this.post(`/api/v1/operations/orders/${orderId}/assign-best-driver`, {}, { token });
  }

  async runDemandPredictionJob(token: string) {
    return this.post<{ predictions: unknown[] }>("/api/v1/operations/analytics/jobs/demand-prediction", {}, { token });
  }

  async walletSummary(token: string) {
    return this.get<WalletSummary>("/api/v1/wallet/summary", { token });
  }

  async walletTransactions(token: string) {
    return this.get<Array<{ id: string; type: string; amount_paise: number; status: string; created_at: string }>>("/api/v1/wallet/transactions", { token });
  }

  async driverEarnings(token: string) {
    return this.get<Array<{ id: string; order_id: string; amount_paise: number; status: string; created_at: string }>>("/api/v1/wallet/earnings", { token });
  }

  async requestPayout(token: string, amountPaise: number, method: "upi" | "bank", upiId?: string, bankAccountLast4?: string) {
    return this.post("/api/v1/wallet/payouts/request", { amountPaise, method, upiId, bankAccountLast4 }, { token });
  }

  private async get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { method: "GET" }, options);
  }

  private async post<T>(path: string, body: unknown, options?: RequestOptions) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) }, options);
  }

  private async patch<T>(path: string, body: unknown, options?: RequestOptions) {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, options);
  }

  private async request<T>(path: string, init: RequestInit, options?: RequestOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(options?.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options?.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {})
      }
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(body?.error ?? `Request failed: ${response.status}`);
    }
    return body as T;
  }
}

export const api = new ApiClient();

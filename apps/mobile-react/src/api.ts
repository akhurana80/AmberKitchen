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

  async googlePlacesRegion(token: string, minRating = 3) {
    return this.get<{ restaurants: Array<{ name: string; address: string; rating: number; lat: number; lng: number; photoUrl: string | null }> }>(
      `/api/v1/restaurants/google-places/region?minRating=${minRating}`,
      { token }
    );
  }

  async createRestaurantReview(token: string, restaurantId: string, rating: number, comment?: string, orderId?: string) {
    return this.post(`/api/v1/marketplace/restaurants/${restaurantId}/reviews`, { rating, comment, orderId }, { token });
  }

  async createSupportTicket(token: string, category: string, subject: string, message: string, orderId?: string) {
    return this.post("/api/v1/marketplace/support/tickets", { category, subject, message, orderId }, { token });
  }

  async createOrder(token: string, restaurantId: string, lat: number, lng: number, items?: Array<{ name: string; quantity: number; pricePaise: number }>) {
    return this.post<{ id: string; totalPaise: number; status: string; estimatedDeliveryAt: string }>(
      "/api/v1/orders",
      {
        restaurantId,
        deliveryAddress: "Mobile app delivery address",
        deliveryLat: lat,
        deliveryLng: lng,
        items: items && items.length > 0 ? items : (__DEV__ ? [{ name: "Sample Item", quantity: 1, pricePaise: 24900 }] : [])
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

  async orderEtaLoop(token: string, orderId: string) {
    return this.get<Array<{
      id: string;
      predicted_eta_minutes: number;
      distance_to_pickup_km: string | null;
      distance_to_dropoff_km: string | null;
      source: string;
      created_at: string;
    }>>(`/api/v1/tracking/orders/${orderId}/eta-loop`, { token });
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

  async driverOnboardingApplications(token: string) {
    return this.get<DriverOnboardingApplication[]>("/api/v1/driver-onboarding/admin/applications", { token });
  }

  async updateDriverApplicationApproval(token: string, id: string, status: "approved" | "rejected" | "pending", note?: string) {
    return this.patch<DriverOnboardingApplication>(`/api/v1/driver-onboarding/admin/applications/${id}/approval`, { status, note }, { token });
  }

  async driverReferrals(token: string) {
    return this.get<Array<{
      id: string;
      referral_code: string;
      status: string;
      reward_paise: number;
      referrer_phone: string | null;
      referred_phone: string | null;
      created_at: string;
    }>>("/api/v1/driver-onboarding/admin/referrals", { token });
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

  async importMenuItems(token: string, restaurantId: string, items: Array<{
    name: string;
    pricePaise: number;
    description?: string;
    photoUrl?: string;
    isVeg?: boolean;
    cuisineType?: string;
    rating?: number;
    googlePlaceId?: string;
  }>) {
    return this.post(`/api/v1/restaurants/${restaurantId}/menu/import`, { items }, { token });
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

  async supportTickets(token: string) {
    return this.get<Array<{ id: string; category: string; subject: string; status: string; created_at: string }>>("/api/v1/marketplace/support/tickets", { token });
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

  async analyticsJobs(token: string) {
    return this.get<Array<{ id: string; job_type: string; status: string; summary: unknown; created_at: string }>>(
      "/api/v1/operations/analytics/jobs",
      { token }
    );
  }

  async demandPredictions(token: string) {
    return this.get<Array<{
      id: string;
      zone_key: string;
      cuisine_type: string | null;
      hour_start: string;
      predicted_orders: number;
      confidence: string;
    }>>("/api/v1/operations/demand-predictions", { token });
  }

  async marketplaceZones(token: string) {
    return this.get<Array<{ id: string; name: string; city: string; sla_minutes: number; surge_multiplier: string }>>("/api/v1/marketplace/zones", { token });
  }

  async createZone(token: string, name: string, city: string, centerLat: number, centerLng: number, radiusKm: number, slaMinutes: number) {
    return this.post("/api/v1/marketplace/zones", { name, city, centerLat, centerLng, radiusKm, slaMinutes }, { token });
  }

  async marketplaceOffers(token: string) {
    return this.get<Array<{ id: string; code: string; title: string; discount_type: string; discount_value: number }>>("/api/v1/marketplace/offers", { token });
  }

  async createOffer(token: string, code: string, title: string, discountType: "flat" | "percent", discountValue: number, minOrderPaise: number) {
    return this.post("/api/v1/marketplace/offers", { code, title, discountType, discountValue, minOrderPaise }, { token });
  }

  async campaigns(token: string) {
    return this.get<Array<{ id: string; name: string; channel: string; budget_paise: number; status: string; ai_creative: string | null }>>(
      "/api/v1/marketplace/campaigns",
      { token }
    );
  }

  async createCampaign(token: string, name: string, channel: "push" | "email" | "whatsapp" | "ads", budgetPaise: number, aiCreative?: string) {
    return this.post("/api/v1/marketplace/campaigns", { name, channel, budgetPaise, aiCreative }, { token });
  }

  async driverIncentives(token: string) {
    return this.get<Array<{ id: string; title: string; target_deliveries: number; reward_paise: number; status: string }>>(
      "/api/v1/marketplace/driver-incentives",
      { token }
    );
  }

  async createDriverIncentive(token: string, title: string, targetDeliveries: number, rewardPaise: number, driverId?: string) {
    return this.post("/api/v1/marketplace/driver-incentives", { title, targetDeliveries, rewardPaise, driverId }, { token });
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

  async adminPayouts(token: string) {
    return this.get<Array<{ id: string; amount_paise: number; method: string; status: string; phone: string | null; role: string; created_at: string }>>(
      "/api/v1/wallet/payouts",
      { token }
    );
  }

  async updatePayoutApproval(token: string, id: string, status: "approved" | "paid" | "rejected", note?: string) {
    return this.patch(`/api/v1/wallet/payouts/${id}/approval`, { status, note }, { token });
  }

  async createAzureBlobAsset(token: string, fileName: string, contentType: string, sizeBytes: number, data?: string) {
    return this.post("/api/v1/integrations/azure/blob/assets", { fileName, contentType, sizeBytes, data }, { token });
  }

  async verifyAzureOcr(token: string, imageUrl: string) {
    return this.post("/api/v1/integrations/azure/ocr/verify", { imageUrl }, { token });
  }

  async verifyAzureFace(token: string, selfieUrl: string, documentUrl: string) {
    return this.post("/api/v1/integrations/azure/face/verify", { selfieUrl, documentUrl }, { token });
  }

  async auditLogs(token: string) {
    return this.get<Array<{ id: string; method: string; path: string; status_code: number; created_at: string }>>("/api/v1/integrations/audit-logs", { token });
  }

  async verificationChecks(token: string) {
    return this.get<Array<{ id: string; provider: string; check_type: string; status: string; created_at: string }>>("/api/v1/integrations/verification-checks", { token });
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

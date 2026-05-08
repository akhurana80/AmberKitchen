import { config } from './config';

class ApiClient {
  private token = '';

  setToken(t: string) { this.token = t; }
  clearToken() { this.token = ''; }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'content-type': 'application/json',
      ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: this.headers(init.headers as Record<string, string>),
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
    return body as T;
  }

  private get<T>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  }
  private post<T>(path: string, body: unknown, extra?: Record<string, string>) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body), headers: extra });
  }
  private patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  // Auth
  requestOtp(phone: string) {
    return this.post<{ sent: boolean; devCode?: string }>('/api/v1/auth/otp/request', { phone });
  }
  verifyOtp(phone: string, code: string) {
    return this.post<{ token: string; user: { id: string; role: string } }>(
      '/api/v1/auth/otp/verify', { phone, code, role: 'customer' }
    );
  }

  // Restaurants & menu
  searchRestaurants(params: {
    q?: string; cuisine?: string; diet?: string;
    minRating?: number; sort?: string; lat?: number; lng?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.cuisine) qs.set('cuisine', params.cuisine);
    if (params.diet) qs.set('diet', params.diet);
    if (params.minRating != null) qs.set('minRating', String(params.minRating));
    if (params.sort) qs.set('sort', params.sort);
    if (params.lat != null) qs.set('lat', String(params.lat));
    if (params.lng != null) qs.set('lng', String(params.lng));
    return this.get<MenuItem[]>(`/api/v1/restaurants/search?${qs}`);
  }
  trendingRestaurants(lat?: number, lng?: number) {
    const qs = new URLSearchParams();
    if (lat != null) qs.set('lat', String(lat));
    if (lng != null) qs.set('lng', String(lng));
    return this.get<TrendingRestaurant[]>(`/api/v1/restaurants/trending?${qs}`);
  }
  marketplaceOffers() {
    return this.get<Offer[]>('/api/v1/marketplace/offers');
  }

  // Orders
  createOrder(body: {
    restaurantId: string; deliveryAddress: string;
    deliveryLat: number; deliveryLng: number;
    items: Array<{ name: string; quantity: number; pricePaise: number }>;
    couponCode?: string; idempotencyKey: string;
  }) {
    return this.post<OrderCreated>('/api/v1/orders', body, { 'idempotency-key': body.idempotencyKey });
  }
  getOrders() {
    return this.get<OrderSummary[]>('/api/v1/orders');
  }
  getOrder(id: string) {
    return this.get<OrderDetail>(`/api/v1/orders/${id}`);
  }
  cancelOrder(id: string, reason: string) {
    return this.post<void>(`/api/v1/orders/${id}/cancel`, { reason });
  }
  reorder(id: string) {
    return this.post<OrderCreated>(`/api/v1/orders/${id}/reorder`, {});
  }

  // Payments
  createPayment(provider: string, orderId: string, amountPaise: number) {
    return this.post<PaymentStart>('/api/v1/payments/create', { provider, orderId, amountPaise });
  }
  paymentStatus(orderId: string) {
    return this.get<PaymentStatus>(`/api/v1/payments/orders/${orderId}/status`);
  }
  requestRefund(orderId: string, reason: string) {
    return this.post<{ id: string }>('/api/v1/payments/refunds', { orderId, reason });
  }

  // Tracking & ETA
  orderEta(orderId: string) {
    return this.get<EtaResult>(`/api/v1/tracking/orders/${orderId}/eta`);
  }

  // Reviews & support
  createReview(restaurantId: string, rating: number, comment: string, orderId?: string) {
    return this.post<void>(`/api/v1/marketplace/restaurants/${restaurantId}/reviews`, {
      rating, comment, ...(orderId ? { orderId } : {})
    });
  }
  createSupportTicket(category: string, subject: string, message: string, orderId?: string) {
    return this.post<void>('/api/v1/marketplace/support/tickets', {
      category, subject, message, ...(orderId ? { orderId } : {})
    });
  }

  // Push notifications
  registerPushToken(pushToken: string) {
    return this.post<void>('/api/v1/notifications/device-token', { token: pushToken, platform: 'ios' });
  }
}

export const api = new ApiClient();

// ── Types ──────────────────────────────────────────────────────────────────

export type MenuItem = {
  menu_item_id: string;
  menu_item_name: string;
  description?: string;
  price_paise: number;
  photo_url?: string;
  is_veg?: boolean;
  cuisine_type?: string;
  rating?: number;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string;
  distance_km?: number;
};

export type TrendingRestaurant = {
  id: string;
  name: string;
  address: string;
  cuisine_type?: string;
  rating?: number;
  starting_price_paise?: number;
  photo_url?: string;
  distance_km?: number;
  predicted_eta_minutes: number;
};

export type Offer = {
  id: string;
  code: string;
  title: string;
  discount_type: string;
  discount_value: number;
  min_order_paise: number;
};

export type OrderCreated = {
  id: string;
  status: string;
  total_paise: number;
  subtotal_paise?: number;
  tax_paise?: number;
  delivery_fee_paise?: number;
  discount_paise?: number;
  estimated_delivery_at?: string;
};

export type OrderSummary = {
  id: string;
  status: string;
  total_paise: number;
  estimated_delivery_at?: string;
  created_at?: string;
};

export type OrderDetail = OrderSummary & {
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  driver_phone?: string;
  driver_name?: string;
  subtotal_paise?: number;
  tax_paise?: number;
  delivery_fee_paise?: number;
  discount_paise?: number;
  coupon_code?: string;
  items: Array<{ name: string; quantity: number; price_paise: number }>;
  history: Array<{ status: string; note: string; created_at: string }>;
};

export type PaymentStart = {
  provider: string;
  status?: string;
  redirectUrl?: string;
  paymentUrl?: string;
  deepLinkUrl?: string;
  intentUrl?: string;
  transactionId?: string;
  note?: string;
};

export type PaymentStatus = {
  orderId: string;
  state: string;
  payment?: { id: string; provider: string; amount_paise: number; status: string };
  refunds?: Array<{ id: string; amount_paise: number; status: string }>;
};

export type EtaResult = {
  predictedEtaMinutes: number;
  predictedDeliveryAt: string;
  currentEstimatedDeliveryAt?: string;
  status?: string;
  route: {
    origin: { lat: number; lng: number };
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
    distanceToPickupKm: number;
    distanceToDropoffKm: number;
  };
};

export type CartLine = {
  menuItemId: string;
  name: string;
  pricePaise: number;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
};

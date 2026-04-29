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

  createOrder() {
    return this.http.post<{ id: string; totalPaise: number; status: string }>(
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

  createPayment(provider: "paytm" | "phonepe", orderId: string) {
    return this.http.post(
      `${this.baseUrl}/api/payments/create`,
      { provider, orderId, amountPaise: 24900 },
      { headers: this.authHeaders() }
    );
  }

  requestRefund(orderId: string, reason: string) {
    return this.http.post(`${this.baseUrl}/api/payments/refunds`, { orderId, reason }, { headers: this.authHeaders() });
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

  createMenuItem(restaurantId: string, name: string, pricePaise: number) {
    return this.http.post(
      `${this.baseUrl}/api/restaurants/${restaurantId}/menu`,
      { name, pricePaise, isAvailable: true },
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

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

  createPayment(provider: "paytm" | "phonepe", orderId: string) {
    return this.http.post(
      `${this.baseUrl}/api/payments/create`,
      { provider, orderId, amountPaise: 24900 },
      { headers: this.authHeaders() }
    );
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

  private authHeaders() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }
}

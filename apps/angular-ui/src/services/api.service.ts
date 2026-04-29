import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ApiService {
  baseUrl = "http://localhost:8080";
  token = "";

  constructor(private http: HttpClient) {}

  requestOtp(phone: string) {
    return this.http.post<{ sent: boolean; devCode?: string }>(`${this.baseUrl}/api/auth/otp/request`, { phone });
  }

  verifyOtp(phone: string, code: string) {
    return this.http.post<{ token: string; user: unknown }>(`${this.baseUrl}/api/auth/otp/verify`, {
      phone,
      code,
      role: "customer"
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

  private authHeaders() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }
}

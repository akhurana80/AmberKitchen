import { Component, inject, signal, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-orders",
  standalone: true,
  template: `
    <div class="page">
      <div class="container" style="padding-top:24px;max-width:700px">
        <div class="page-header">
          <div class="page-title">My Orders</div>
          <div class="page-subtitle">Your order history and active deliveries</div>
        </div>

        @if (loading()) {
          <div class="loading-box"><div class="spinner"></div><span>Loading orders…</span></div>
        } @else if (orders().length === 0) {
          <div class="empty-state">
            <div class="empty-emoji">📋</div>
            <div class="empty-title">No orders yet</div>
            <div class="empty-desc">Place your first order to see it here</div>
            <button class="btn btn-primary mt-16" (click)="router.navigate(['/customer/home'])">Order Now</button>
          </div>
        } @else {
          @for (order of orders(); track order.id) {
            <div class="order-card" (click)="view(order.id)" style="cursor:pointer">
              <div class="order-card-head">
                <div>
                  <div class="order-id">{{ order.id }}</div>
                  <div class="font-bold mt-4" style="font-size:15px">{{ order.restaurant_name || 'Restaurant Order' }}</div>
                </div>
                <span class="badge {{ statusBadge(order.status) }}">{{ fmtStatus(order.status) }}</span>
              </div>
              <div class="flex items-center justify-between text-sm text-muted">
                <span>{{ fmtCurrency(order.total_paise) }}</span>
                <span>{{ fmtDate(order.created_at) }}</span>
                <span class="btn btn-sm btn-outline" (click)="view(order.id); $event.stopPropagation()">Track →</span>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `
})
export class OrdersPage implements OnInit {
  router = inject(Router);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  orders = signal<Array<{
    id: string;
    status: string;
    total_paise: number;
    restaurant_name: string;
    created_at: string;
  }>>([]);

  ngOnInit() { this.loadOrders(); }

  loadOrders() {
    this.api.myOrders().subscribe({
      next: orders => { this.loading.set(false); this.orders.set(orders); },
      error: () => { this.loading.set(false); this.toast.error("Failed to load orders."); }
    });
  }

  view(id: string) { this.router.navigate(["/customer/orders", id]); }

  statusBadge(s: string) {
    const m: Record<string, string> = { pending: "badge-warning", confirmed: "badge-info", preparing: "badge-amber", picked_up: "badge-purple", out_for_delivery: "badge-purple", delivered: "badge-success", cancelled: "badge-error" };
    return m[s] ?? "badge-default";
  }

  fmtStatus(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
  fmtCurrency(p: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100); }
  fmtDate(t: string) { return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
}

import { Component, inject, signal, OnInit, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";
import { environment } from "../../environments/environment";
import { Loader } from "@googlemaps/js-api-loader";
import { io } from "socket.io-client";

@Component({
  selector: "app-delivery-admin",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-nav-section">Navigation</div>
        <a class="admin-nav-btn" routerLink="/admin">← Admin Dashboard</a>
        <div class="admin-nav-section">Delivery</div>
        <button class="admin-nav-btn active">📍 Live Orders</button>
        <a class="admin-nav-btn" routerLink="/admin/operations">🤖 Operations AI</a>
      </aside>

      <main class="admin-content">
        <div class="section-header">
          <div><div class="section-title">Delivery Admin</div><div class="section-subtitle">Live order tracking & driver assignment</div></div>
          <button class="btn btn-secondary btn-sm" (click)="load()">🔄 Refresh</button>
        </div>

        <div class="tabs">
          <button class="tab" [class.active]="tab() === 'orders'" (click)="tab.set('orders')">📦 Live Orders</button>
          <button class="tab" [class.active]="tab() === 'load'" (click)="tab.set('load'); loadDriverLoad()">⚡ Driver Load</button>
          <button class="tab" [class.active]="tab() === 'payouts'" (click)="tab.set('payouts'); loadPayouts()">💸 Payouts</button>
        </div>

        <!-- LIVE ORDERS -->
        @if (tab() === 'orders') {
          <!-- Driver selector -->
          <div class="card mb-16">
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Assign Driver</label>
                  <select class="form-select" [(ngModel)]="selectedDriverId">
                    <option value="">Select driver…</option>
                    @for (d of drivers(); track d.id) {
                      <option [value]="d.id">{{ d.name || d.phone || d.id }}</option>
                    }
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Map -->
          <div class="map-wrap mb-16">
            <div #map style="width:100%;height:100%"></div>
            @if (!hasMap) {
              <div class="map-placeholder"><span style="font-size:32px">🗺️</span><span>{{ mapMsg }}</span></div>
            }
          </div>

          @if (orders().length === 0) {
            <div class="empty-state"><div class="empty-emoji">📦</div><div class="empty-title">No active orders</div></div>
          } @else {
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>Order ID</th><th>Restaurant</th><th>Driver</th><th>Status</th><th>Location</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  @for (order of orders(); track order.id) {
                    <tr>
                      <td><span class="order-id">{{ order.id.slice(0,8) }}…</span></td>
                      <td>{{ order.restaurant_name || '—' }}</td>
                      <td>{{ order.driver_phone || 'Unassigned' }}</td>
                      <td><span class="badge {{ statusBadge(order.status) }}">{{ fmtStatus(order.status) }}</span></td>
                      <td class="text-sm text-muted">
                        @if (order.last_driver_lat && order.last_driver_lng) {
                          {{ (+order.last_driver_lat).toFixed(4) }}, {{ (+order.last_driver_lng).toFixed(4) }}
                        } @else { — }
                      </td>
                      <td>
                        <div class="td-actions">
                          <button class="btn btn-secondary btn-sm" [disabled]="!selectedDriverId" (click)="assignDriver(order.id)">Assign</button>
                          <button class="btn btn-primary btn-sm" (click)="assignBest(order.id)">Best Driver</button>
                          <button class="btn btn-outline btn-sm" (click)="trackOrder(order)">Track</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        <!-- DRIVER LOAD -->
        @if (tab() === 'load') {
          <div class="metrics-grid">
            @if (driverLoad().length > 0) {
              <div class="metric-card">
                <div class="metric-label">Active Drivers</div>
                <div class="metric-value">{{ driverLoad().length }}</div>
              </div>
              <div class="metric-card amber">
                <div class="metric-label">Total Active Deliveries</div>
                <div class="metric-value">{{ totalActiveDeliveries() }}</div>
              </div>
            }
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Driver</th><th>Active Orders</th><th>Delivered Today</th><th>Capacity Score</th><th>Location</th></tr></thead>
              <tbody>
                @for (d of driverLoad(); track d.id) {
                  <tr>
                    <td class="font-bold">{{ d.name || d.phone || d.id }}</td>
                    <td>{{ d.active_orders }}</td>
                    <td class="text-muted">{{ d.delivered_today }}</td>
                    <td><span class="badge {{ d.capacity_score > 0.5 ? 'badge-success' : 'badge-warning' }}">{{ (d.capacity_score * 100).toFixed(0) }}%</span></td>
                    <td class="text-sm text-muted">
                      @if (d.last_lat && d.last_lng) { {{ (+d.last_lat).toFixed(3) }}, {{ (+d.last_lng).toFixed(3) }} } @else { — }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- PAYOUTS -->
        @if (tab() === 'payouts') {
          <div class="form-group mb-16" style="max-width:360px">
            <label class="form-label">Approval Note</label>
            <input class="form-input" [(ngModel)]="payoutNote" placeholder="Optional note">
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>User</th><th>Role</th><th>Amount</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                @for (p of payouts(); track p.id) {
                  <tr>
                    <td>{{ p.phone || p.id }}</td>
                    <td><span class="badge badge-default">{{ p.role }}</span></td>
                    <td class="font-bold">{{ fmt(p.amount_paise) }}</td>
                    <td>{{ p.method }}</td>
                    <td><span class="badge {{ p.status === 'paid' ? 'badge-success' : p.status === 'approved' ? 'badge-info' : p.status === 'rejected' ? 'badge-error' : 'badge-warning' }}">{{ p.status }}</span></td>
                    <td>
                      <div class="td-actions">
                        <button class="btn btn-success btn-sm" (click)="updatePayout(p.id, 'approved')">Approve</button>
                        <button class="btn btn-secondary btn-sm" (click)="updatePayout(p.id, 'paid')">Mark Paid</button>
                        <button class="btn btn-danger btn-sm" (click)="updatePayout(p.id, 'rejected')">Reject</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </main>
    </div>
  `
})
export class DeliveryAdminPage implements OnInit, AfterViewInit {
  @ViewChild("map") mapRef!: ElementRef<HTMLDivElement>;

  private api = inject(ApiService);
  private toast = inject(ToastService);

  tab = signal<"orders" | "load" | "payouts">("orders");
  hasMap = false;
  mapMsg = "Add Google Maps API key";

  orders = signal<Array<{ id: string; status: string; restaurant_name: string; driver_phone: string; last_driver_lat: string | null; last_driver_lng: string | null; last_location_at: string | null }>>([]);
  drivers = signal<Array<{ id: string; phone: string; name: string }>>([]);
  selectedDriverId = "";
  driverLoad = signal<Array<{ id: string; phone: string | null; name: string | null; active_orders: number; delivered_today: number; last_lat: string | null; last_lng: string | null; last_location_at: string | null; capacity_score: number }>>([]);
  payouts = signal<Array<{ id: string; amount_paise: number; method: string; status: string; phone: string | null; role: string; created_at: string }>>([]);
  payoutNote = "";

  totalActiveDeliveries() {
    return this.driverLoad().reduce((s, d) => s + d.active_orders, 0);
  }

  private map?: google.maps.Map;
  private marker?: google.maps.Marker;

  ngOnInit() { this.load(); }

  ngAfterViewInit() {
    if (environment.googleMapsApiKey) {
      new Loader({ apiKey: environment.googleMapsApiKey, version: "weekly" }).load().then(() => {
        this.map = new google.maps.Map(this.mapRef.nativeElement, { center: { lat: 28.6139, lng: 77.209 }, zoom: 12, disableDefaultUI: true });
        this.marker = new google.maps.Marker({ map: this.map, position: { lat: 28.6139, lng: 77.209 } });
        this.hasMap = true;
      });
    } else {
      this.mapMsg = "Add Google Maps API key in environment.ts";
    }
  }

  load() {
    this.api.deliveryAdminOrders().subscribe({ next: o => this.orders.set(o), error: () => {} });
    this.api.deliveryDrivers().subscribe({ next: d => this.drivers.set(d), error: () => {} });
  }

  loadDriverLoad() {
    this.api.driverLoadBalancing().subscribe({ next: d => this.driverLoad.set(d), error: () => {} });
  }

  loadPayouts() {
    this.api.adminPayouts().subscribe({ next: p => this.payouts.set(p), error: () => {} });
  }

  assignDriver(orderId: string) {
    if (!this.selectedDriverId) return;
    this.api.assignDriver(orderId, this.selectedDriverId).subscribe({
      next: () => { this.toast.success("Driver assigned!"); this.load(); },
      error: () => this.toast.error("Assignment failed")
    });
  }

  assignBest(orderId: string) {
    this.api.assignBestDriver(orderId).subscribe({
      next: () => { this.toast.success("Best driver assigned!"); this.load(); this.loadDriverLoad(); },
      error: () => this.toast.error("Auto-assignment failed")
    });
  }

  trackOrder(order: { id: string; last_driver_lat: string | null; last_driver_lng: string | null }) {
    if (order.last_driver_lat && order.last_driver_lng) {
      const lat = +order.last_driver_lat; const lng = +order.last_driver_lng;
      if (this.map && this.marker) { this.marker.setPosition({ lat, lng }); this.map.panTo({ lat, lng }); }
      try {
        const socket = io(this.api.baseUrl, { transports: ["websocket"] });
        socket.emit("order:join", order.id);
        socket.on("driver:location", (loc: { lat: string; lng: string }) => {
          if (this.map && this.marker) { const p = { lat: +loc.lat, lng: +loc.lng }; this.marker!.setPosition(p); this.map.panTo(p); }
        });
      } catch {}
    }
    this.toast.info("Tracking order " + order.id.slice(0, 8) + "…");
  }

  updatePayout(id: string, status: "approved" | "paid" | "rejected") {
    this.api.updatePayoutApproval(id, status, this.payoutNote || undefined).subscribe({
      next: () => { this.toast.success("Payout updated"); this.loadPayouts(); },
      error: () => this.toast.error("Update failed")
    });
  }

  statusBadge(s: string) {
    const m: Record<string, string> = { pending: "badge-warning", confirmed: "badge-info", out_for_delivery: "badge-purple", delivered: "badge-success", cancelled: "badge-error" };
    return m[s] ?? "badge-default";
  }

  fmtStatus(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
  fmt(p: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100); }
}

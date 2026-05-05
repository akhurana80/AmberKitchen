import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-admin-page",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="admin-layout">
      <!-- Sidebar -->
      <aside class="admin-sidebar">
        <div class="admin-nav-section">Platform</div>
        <button class="admin-nav-btn" [class.active]="tab() === 'dashboard'" (click)="tab.set('dashboard')">📊 Dashboard</button>
        @if (auth.isSuperAdmin()) {
          <button class="admin-nav-btn" [class.active]="tab() === 'restaurants'" (click)="tab.set('restaurants')">🍽️ Restaurants</button>
          <button class="admin-nav-btn" [class.active]="tab() === 'users'" (click)="tab.set('users')">👥 Users</button>
        }
        <button class="admin-nav-btn" [class.active]="tab() === 'orders'" (click)="tab.set('orders')">📦 All Orders</button>
        @if (auth.isSuperAdmin()) {
          <button class="admin-nav-btn" [class.active]="tab() === 'payments'" (click)="tab.set('payments')">💳 Payments</button>
        }
        <div class="admin-nav-section">Management</div>
        <button class="admin-nav-btn" [class.active]="tab() === 'drivers'" (click)="tab.set('drivers'); loadDrivers()">🚴 Driver Approvals</button>
        <a class="admin-nav-btn" routerLink="/admin/delivery">📍 Delivery Admin</a>
        <a class="admin-nav-btn" routerLink="/admin/operations">🤖 Operations AI</a>
      </aside>

      <main class="admin-content">
        <!-- DASHBOARD -->
        @if (tab() === 'dashboard') {
          <div class="section-header">
            <div><div class="section-title">Dashboard</div><div class="section-subtitle">Platform-wide metrics</div></div>
            <button class="btn btn-secondary btn-sm" (click)="loadDashboard()">🔄 Refresh</button>
          </div>

          @if (loading()) {
            <div class="loading-box"><div class="spinner"></div></div>
          } @else if (dashboard()) {
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Total Users</div>
                <div class="metric-value">{{ dashboard()!.users }}</div>
              </div>
              <div class="metric-card amber">
                <div class="metric-label">Total Revenue</div>
                <div class="metric-value" style="font-size:20px">{{ fmt(dashboard()!.revenuePaise) }}</div>
              </div>
              @for (stat of dashboard()!.ordersByStatus; track stat.status) {
                <div class="metric-card">
                  <div class="metric-label">{{ fmtStatus(stat.status) }}</div>
                  <div class="metric-value">{{ stat.count }}</div>
                </div>
              }
            </div>

            <div class="table-wrap">
              <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-weight:700">Recent Orders</div>
              <table class="data-table">
                <thead><tr><th>Order ID</th><th>Restaurant</th><th>Status</th><th>Total</th><th>Time</th></tr></thead>
                <tbody>
                  @for (order of dashboard()!.recentOrders; track order.id) {
                    <tr>
                      <td><span class="order-id">{{ order.id.slice(0,8) }}…</span></td>
                      <td>{{ order.restaurant_name || '—' }}</td>
                      <td><span class="badge {{ statusBadge(order.status) }}">{{ fmtStatus(order.status) }}</span></td>
                      <td class="font-bold">{{ fmt(order.total_paise) }}</td>
                      <td class="text-muted">{{ fmtDate(order.created_at) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        <!-- RESTAURANTS -->
        @if (tab() === 'restaurants') {
          <div class="section-header">
            <div><div class="section-title">Restaurant Approvals</div></div>
            <button class="btn btn-secondary btn-sm" (click)="loadSuperAdmin()">🔄 Refresh</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Restaurant</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                @for (r of restaurants(); track r.id) {
                  <tr>
                    <td class="font-bold">{{ r.name }}</td>
                    <td class="text-muted">{{ r.address }}</td>
                    <td><span class="badge {{ r.approval_status === 'approved' ? 'badge-success' : r.approval_status === 'rejected' ? 'badge-error' : 'badge-warning' }}">{{ r.approval_status }}</span></td>
                    <td>
                      <div class="td-actions">
                        <button class="btn btn-success btn-sm" (click)="approveRestaurant(r.id, 'approved')">Approve</button>
                        <button class="btn btn-danger btn-sm" (click)="approveRestaurant(r.id, 'rejected')">Reject</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- USERS -->
        @if (tab() === 'users') {
          <div class="section-header">
            <div><div class="section-title">User Management</div></div>
            <button class="btn btn-secondary btn-sm" (click)="loadSuperAdmin()">🔄 Refresh</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Role</th></tr></thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr>
                    <td class="font-bold">{{ u.name || '—' }}</td>
                    <td>{{ u.phone || '—' }}</td>
                    <td>{{ u.email || '—' }}</td>
                    <td><span class="badge badge-default">{{ u.role }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- ORDERS -->
        @if (tab() === 'orders') {
          <div class="section-header">
            <div><div class="section-title">All Orders</div></div>
            <button class="btn btn-secondary btn-sm" (click)="loadAllOrders()">🔄 Refresh</button>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Order ID</th><th>Restaurant</th><th>Customer</th><th>Driver</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                @for (o of allOrders(); track o.id) {
                  <tr>
                    <td><span class="order-id">{{ o.id.slice(0,8) }}…</span></td>
                    <td>{{ o.restaurant_name || '—' }}</td>
                    <td>{{ o.customer_phone || '—' }}</td>
                    <td>{{ o.driver_phone || '—' }}</td>
                    <td><span class="badge {{ statusBadge(o.status) }}">{{ fmtStatus(o.status) }}</span></td>
                    <td class="font-bold">{{ fmt(o.total_paise) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- PAYMENTS -->
        @if (tab() === 'payments') {
          <div class="section-header">
            <div><div class="section-title">Payment Reports</div></div>
          </div>
          <div class="metrics-grid">
            @for (r of paymentReports(); track r.provider + r.status) {
              <div class="metric-card">
                <div class="metric-label">{{ r.provider }} — {{ r.status }}</div>
                <div class="metric-value">{{ r.transactions }}</div>
                <div class="metric-sub">{{ fmt(r.amount_paise) }}</div>
              </div>
            }
          </div>
        }

        <!-- DRIVERS -->
        @if (tab() === 'drivers') {
          <div class="section-header">
            <div><div class="section-title">Driver Approvals</div></div>
            <button class="btn btn-secondary btn-sm" (click)="loadDrivers()">🔄 Refresh</button>
          </div>

          <div class="form-group mb-16" style="max-width:360px">
            <label class="form-label">Admin Note</label>
            <input class="form-input" [(ngModel)]="driverNote" placeholder="Approval note…">
          </div>

          <div class="table-wrap mb-24">
            <table class="data-table">
              <thead><tr><th>Driver</th><th>Verification</th><th>Bank/UPI</th><th>Referral</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                @for (a of driverApplications(); track a.id) {
                  <tr>
                    <td>
                      <div class="font-bold">{{ a.full_name }}</div>
                      <div class="text-xs text-muted">{{ a.phone || a.user_phone || a.user_id }}</div>
                    </td>
                    <td>
                      <div class="text-sm">OCR: <span class="badge {{ a.ocr_status === 'verified' ? 'badge-success' : 'badge-warning' }}">{{ a.ocr_status }}</span></div>
                      <div class="text-sm mt-4">Selfie: <span class="badge {{ a.selfie_status === 'verified' ? 'badge-success' : 'badge-warning' }}">{{ a.selfie_status }}</span></div>
                    </td>
                    <td>
                      <div class="text-sm">{{ a.upi_id || '—' }}</div>
                      <div class="text-xs text-muted">{{ a.bank_account_last4 ? 'xx' + a.bank_account_last4 : '—' }}</div>
                    </td>
                    <td class="text-sm">{{ a.referral_code || '—' }}</td>
                    <td><span class="badge {{ a.approval_status === 'approved' ? 'badge-success' : a.approval_status === 'rejected' ? 'badge-error' : 'badge-warning' }}">{{ a.approval_status }}</span></td>
                    <td>
                      <div class="td-actions">
                        <button class="btn btn-success btn-sm" (click)="approveDriver(a.id, 'approved')">Approve</button>
                        <button class="btn btn-danger btn-sm" (click)="approveDriver(a.id, 'rejected')">Reject</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Referrals -->
          <div class="section-title mb-16" style="font-size:18px">Referral Tracking</div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Code</th><th>Referrer</th><th>Referred</th><th>Status</th><th>Reward</th></tr></thead>
              <tbody>
                @for (r of referrals(); track r.id) {
                  <tr>
                    <td class="font-bold">{{ r.referral_code }}</td>
                    <td>{{ r.referrer_phone || '—' }}</td>
                    <td>{{ r.referred_phone || '—' }}</td>
                    <td><span class="badge {{ r.status === 'paid' ? 'badge-success' : 'badge-warning' }}">{{ r.status }}</span></td>
                    <td>{{ fmt(r.reward_paise) }}</td>
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
export class AdminPage implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tab = signal<"dashboard" | "restaurants" | "users" | "orders" | "payments" | "drivers">("dashboard");
  loading = signal(false);

  dashboard = signal<{ users: number; ordersByStatus: Array<{ status: string; count: number }>; revenuePaise: number; payments: Array<{ provider: string; status: string; count: number }>; recentOrders: Array<{ id: string; status: string; total_paise: number; restaurant_name: string; created_at: string }> } | null>(null);
  restaurants = signal<Array<{ id: string; name: string; address: string; approval_status: string }>>([]);
  users = signal<Array<{ id: string; phone: string; email: string; name: string; role: string }>>([]);
  allOrders = signal<Array<{ id: string; status: string; total_paise: number; restaurant_name: string; customer_phone: string; driver_phone: string }>>([]);
  paymentReports = signal<Array<{ provider: string; status: string; transactions: number; amount_paise: number }>>([]);
  driverApplications = signal<Array<{
    id: string; user_id: string; full_name: string; phone: string | null; user_phone?: string | null;
    aadhaar_last4: string | null; ocr_status: string; selfie_status: string; background_check_status: string;
    bank_account_last4: string | null; upi_id: string | null; referral_code: string | null;
    referred_by_code: string | null; approval_status: string; admin_note: string | null; created_at: string; updated_at: string;
  }>>([]);
  referrals = signal<Array<{ id: string; referral_code: string; status: string; reward_paise: number; referrer_phone: string | null; referred_phone: string | null; created_at: string }>>([]);

  driverNote = "";

  ngOnInit() {
    this.loadDashboard();
    if (this.auth.isSuperAdmin()) this.loadSuperAdmin();
  }

  loadDashboard() {
    this.loading.set(true);
    this.api.adminDashboard().subscribe({
      next: d => { this.loading.set(false); this.dashboard.set(d); },
      error: () => { this.loading.set(false); this.toast.error("Failed to load dashboard."); }
    });
  }

  loadSuperAdmin() {
    this.api.adminRestaurants().subscribe({ next: r => this.restaurants.set(r), error: () => {} });
    this.api.adminUsers().subscribe({ next: u => this.users.set(u), error: () => {} });
    this.api.paymentReports().subscribe({ next: p => this.paymentReports.set(p), error: () => {} });
    this.loadAllOrders();
  }

  loadAllOrders() {
    this.api.adminAllOrders().subscribe({ next: o => this.allOrders.set(o), error: () => {} });
  }

  loadDrivers() {
    this.api.driverOnboardingApplications().subscribe({ next: a => this.driverApplications.set(a), error: () => {} });
    this.api.driverReferrals().subscribe({ next: r => this.referrals.set(r), error: () => {} });
  }

  approveRestaurant(id: string, status: "approved" | "rejected" | "pending") {
    this.api.updateRestaurantApproval(id, status).subscribe({
      next: () => { this.toast.success(`Restaurant ${status}`); this.loadSuperAdmin(); },
      error: () => this.toast.error("Failed")
    });
  }

  approveDriver(id: string, status: "approved" | "rejected" | "pending") {
    this.api.updateDriverApplicationApproval(id, status, this.driverNote || undefined).subscribe({
      next: () => { this.toast.success(`Driver ${status}`); this.loadDrivers(); },
      error: () => this.toast.error("Failed")
    });
  }

  statusBadge(s: string) {
    const m: Record<string, string> = { pending: "badge-warning", confirmed: "badge-info", delivered: "badge-success", cancelled: "badge-error", preparing: "badge-amber", out_for_delivery: "badge-purple" };
    return m[s] ?? "badge-default";
  }

  fmtStatus(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
  fmt(p: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100); }
  fmtDate(t: string) { return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
}

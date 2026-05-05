import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-restaurant-page",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container" style="padding-top:24px">
        <div class="page-header">
          <div class="page-title">Restaurant Dashboard</div>
          <div class="page-subtitle">Manage your restaurant, menu, and orders</div>
        </div>

        <div class="tabs">
          <button class="tab" [class.active]="tab() === 'overview'" (click)="tab.set('overview')">📊 Overview</button>
          <button class="tab" [class.active]="tab() === 'menu'" (click)="tab.set('menu')">🍽️ Menu</button>
          <button class="tab" [class.active]="tab() === 'orders'" (click)="tab.set('orders')">📦 Orders</button>
          <button class="tab" [class.active]="tab() === 'onboard'" (click)="tab.set('onboard')">⚙️ Settings</button>
        </div>

        <!-- ===== OVERVIEW ===== -->
        @if (tab() === 'overview') {
          @if (restaurants().length === 0) {
            <div class="empty-state">
              <div class="empty-emoji">🍽️</div>
              <div class="empty-title">No restaurant yet</div>
              <div class="empty-desc">Set up your restaurant to start receiving orders</div>
              <button class="btn btn-primary mt-16" (click)="tab.set('onboard')">Get Started →</button>
            </div>
          } @else {
            <!-- Restaurant selector -->
            <div class="card mb-24">
              <div class="card-body">
                <div class="form-group">
                  <label class="form-label">Active Restaurant</label>
                  <select class="form-select" [(ngModel)]="selectedRestaurantId" (change)="loadOps()">
                    @for (r of restaurants(); track r.id) {
                      <option [value]="r.id">{{ r.name }} — {{ r.approval_status }}</option>
                    }
                  </select>
                </div>
              </div>
            </div>

            @if (earnings()) {
              <div class="metrics-grid">
                <div class="metric-card green">
                  <div class="metric-label">Total Orders</div>
                  <div class="metric-value">{{ earnings()!.orders }}</div>
                </div>
                <div class="metric-card amber">
                  <div class="metric-label">Gross Revenue</div>
                  <div class="metric-value">{{ fmt(+earnings()!.gross_paise) }}</div>
                </div>
                <div class="metric-card blue">
                  <div class="metric-label">Est. Payout</div>
                  <div class="metric-value">{{ fmt(+earnings()!.estimated_payout_paise) }}</div>
                </div>
              </div>
            }

            <!-- Delhi NCR Places -->
            <div class="card mb-24">
              <div class="card-body">
                <div class="section-header mb-12">
                  <div>
                    <div class="font-bold" style="font-size:15px">🗺️ Google Places — Import Real Data</div>
                    <div class="text-sm text-muted">Import real restaurant photos and data from Google Maps</div>
                  </div>
                  <div class="flex gap-8">
                    <button class="btn btn-secondary btn-sm" (click)="loadPlaces()">Load Delhi NCR Places</button>
                    <button class="btn btn-outline btn-sm" [disabled]="places().length === 0" (click)="importPlaces()">Import to Menu</button>
                  </div>
                </div>
                @if (places().length > 0) {
                  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;max-height:200px;overflow-y:auto">
                    @for (p of places(); track p.googlePlaceId) {
                      <div style="text-align:center;font-size:12px">
                        @if (p.photoUrl) { <img [src]="p.photoUrl" [alt]="p.name" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:4px"> }
                        <div class="truncate">{{ p.name }}</div>
                        <div class="text-muted">⭐ {{ p.rating }}</div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }

        <!-- ===== MENU ===== -->
        @if (tab() === 'menu') {
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">➕ Add Menu Item</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Item Name *</label>
                  <input class="form-input" [(ngModel)]="menuItem.name" placeholder="Butter Chicken">
                </div>
                <div class="form-group">
                  <label class="form-label">Price (₹) *</label>
                  <input class="form-input" type="number" [(ngModel)]="menuItemRupees" placeholder="249">
                </div>
                <div class="form-group">
                  <label class="form-label">Cuisine</label>
                  <input class="form-input" [(ngModel)]="menuItem.cuisineType" placeholder="North Indian">
                </div>
                <div class="form-group">
                  <label class="form-label">Rating</label>
                  <input class="form-input" type="number" min="0" max="5" step="0.1" [(ngModel)]="menuItem.rating">
                </div>
                <div class="form-group">
                  <label class="form-label">Photo URL</label>
                  <input class="form-input" [(ngModel)]="menuItem.photoUrl" placeholder="https://…">
                </div>
                <div class="form-group">
                  <label class="form-label">Description</label>
                  <input class="form-input" [(ngModel)]="menuItem.description" placeholder="Fresh, aromatic…">
                </div>
              </div>
              <div class="flex gap-12 mt-16 items-center flex-wrap">
                <div class="checkbox-group">
                  <input type="checkbox" [(ngModel)]="menuItem.isVeg">
                  <span>Veg Item</span>
                </div>
                <button class="btn btn-primary" (click)="addMenuItem()" [disabled]="submitting() || !menuItem.name || menuItemRupees <= 0 || !selectedRestaurantId">
                  @if (submitting()) { <span class="spinner spinner-sm"></span> }
                  Add Item
                </button>
              </div>
            </div>
          </div>

          <div class="alert alert-info">
            Menu items are shown to customers when browsing your restaurant. Add photos for better visibility.
          </div>
        }

        <!-- ===== ORDERS ===== -->
        @if (tab() === 'orders') {
          <div class="flex gap-8 mb-16">
            <button class="btn btn-secondary btn-sm" (click)="loadOps()">🔄 Refresh</button>
          </div>

          @if (restaurantOrders().length === 0) {
            <div class="empty-state">
              <div class="empty-emoji">📦</div>
              <div class="empty-title">No orders yet</div>
              <div class="empty-desc">New orders will appear here</div>
            </div>
          } @else {
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (order of restaurantOrders(); track order.id) {
                    <tr>
                      <td><span class="order-id">{{ order.id }}</span></td>
                      <td class="font-bold">{{ fmt(order.total_paise) }}</td>
                      <td><span class="badge {{ statusBadge(order.status) }}">{{ fmtStatus(order.status) }}</span></td>
                      <td>
                        <div class="td-actions">
                          @if (order.status === 'pending' || order.status === 'confirmed') {
                            <button class="btn btn-success btn-sm" (click)="decideOrder(order.id, 'accepted')">Accept</button>
                            <button class="btn btn-danger btn-sm" (click)="decideOrder(order.id, 'cancelled')">Reject</button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        <!-- ===== SETTINGS / ONBOARD ===== -->
        @if (tab() === 'onboard') {
          <div class="card">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">{{ restaurants().length > 0 ? 'Add Another Restaurant' : 'Register Your Restaurant' }}</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Restaurant Name *</label>
                  <input class="form-input" [(ngModel)]="restForm.name" placeholder="Spice Garden">
                </div>
                <div class="form-group">
                  <label class="form-label">Address *</label>
                  <input class="form-input" [(ngModel)]="restForm.address" placeholder="123 Main St, Delhi">
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Name *</label>
                  <input class="form-input" [(ngModel)]="restForm.contactName" placeholder="Arjun Sharma">
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Phone *</label>
                  <input class="form-input" [(ngModel)]="restForm.contactPhone" placeholder="+919999999999">
                </div>
                <div class="form-group">
                  <label class="form-label">Cuisine Type *</label>
                  <input class="form-input" [(ngModel)]="restForm.cuisineType" placeholder="North Indian, Chinese…">
                </div>
                <div class="form-group">
                  <label class="form-label">FSSAI License</label>
                  <input class="form-input" [(ngModel)]="restForm.fssaiLicense" placeholder="12345678901234">
                </div>
                <div class="form-group">
                  <label class="form-label">GST Number</label>
                  <input class="form-input" [(ngModel)]="restForm.gstNumber" placeholder="29ABCDE1234F1Z5">
                </div>
                <div class="form-group">
                  <label class="form-label">Bank Account Last 4</label>
                  <input class="form-input" [(ngModel)]="restForm.bankAccountLast4" maxlength="4" placeholder="XXXX">
                </div>
              </div>
              <button class="btn btn-primary mt-24" (click)="createRestaurant()" [disabled]="submitting() || !restForm.name || !restForm.address || !restForm.cuisineType">
                @if (submitting()) { <span class="spinner spinner-sm"></span> }
                Submit for Approval
              </button>
              <div class="alert alert-info mt-16">Restaurants are reviewed and approved by our team within 24 hours.</div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class RestaurantPage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tab = signal<"overview" | "menu" | "orders" | "onboard">("overview");
  submitting = signal(false);

  restaurants = signal<Array<{ id: string; name: string; address: string; approval_status: string; onboarding_status: string }>>([]);
  selectedRestaurantId = "";
  earnings = signal<{ orders: string; gross_paise: string; estimated_payout_paise: string } | null>(null);
  restaurantOrders = signal<Array<{ id: string; status: string; total_paise: number }>>([]);
  places = signal<Array<{ googlePlaceId: string; name: string; address: string; rating: number; photoUrl: string | null; lat: number; lng: number }>>([]);

  menuItem = { name: "", description: "", cuisineType: "", photoUrl: "", isVeg: true, rating: 0 };
  menuItemRupees = 0;

  restForm = { name: "", address: "", contactName: "", contactPhone: "", cuisineType: "", fssaiLicense: "", gstNumber: "", bankAccountLast4: "" };

  ngOnInit() { this.loadRestaurants(); }

  loadRestaurants() {
    this.api.myRestaurants().subscribe({
      next: r => {
        this.restaurants.set(r);
        this.selectedRestaurantId = r[0]?.id ?? "";
        if (this.selectedRestaurantId) this.loadOps();
      },
      error: () => {}
    });
  }

  loadOps() {
    if (!this.selectedRestaurantId) return;
    this.api.restaurantOrders(this.selectedRestaurantId).subscribe({ next: o => this.restaurantOrders.set(o), error: () => {} });
    this.api.restaurantEarnings(this.selectedRestaurantId).subscribe({ next: e => this.earnings.set(e), error: () => {} });
  }

  loadPlaces() {
    this.api.googlePlacesDelhiNcrRestaurants(3).subscribe({
      next: r => { this.places.set(r.restaurants); this.toast.success(`Loaded ${r.restaurants.length} places from Google`); },
      error: () => this.toast.error("Failed to load Google Places")
    });
  }

  importPlaces() {
    if (!this.selectedRestaurantId || this.places().length === 0) return;
    const items = this.places().map(p => ({
      name: p.name, description: p.address, pricePaise: 19900,
      photoUrl: p.photoUrl ?? undefined, isVeg: true, cuisineType: "Delhi NCR", rating: p.rating
    }));
    this.api.importMenuItems(this.selectedRestaurantId, items).subscribe({
      next: () => this.toast.success("Places imported as menu items!"),
      error: () => this.toast.error("Import failed")
    });
  }

  addMenuItem() {
    if (!this.selectedRestaurantId || !this.menuItem.name || this.menuItemRupees <= 0) return;
    this.submitting.set(true);
    this.api.createMenuItem(this.selectedRestaurantId, {
      name: this.menuItem.name,
      pricePaise: this.menuItemRupees * 100,
      description: this.menuItem.description || undefined,
      photoUrl: this.menuItem.photoUrl || undefined,
      isVeg: this.menuItem.isVeg,
      cuisineType: this.menuItem.cuisineType || undefined,
      rating: this.menuItem.rating > 0 ? this.menuItem.rating : undefined
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.menuItem = { name: "", description: "", cuisineType: "", photoUrl: "", isVeg: true, rating: 0 };
        this.menuItemRupees = 0;
        this.toast.success("Menu item added!");
      },
      error: () => { this.submitting.set(false); this.toast.error("Failed to add menu item."); }
    });
  }

  decideOrder(orderId: string, decision: "accepted" | "cancelled") {
    this.api.decideRestaurantOrder(orderId, decision).subscribe({
      next: () => { this.loadOps(); this.toast.success(`Order ${decision}`); },
      error: () => this.toast.error("Failed to update order")
    });
  }

  createRestaurant() {
    if (!this.restForm.name || !this.restForm.address || !this.restForm.cuisineType) return;
    this.submitting.set(true);
    this.api.onboardRestaurant({
      name: this.restForm.name, address: this.restForm.address,
      contactName: this.restForm.contactName, contactPhone: this.restForm.contactPhone,
      cuisineType: this.restForm.cuisineType, fssaiLicense: this.restForm.fssaiLicense || undefined,
      gstNumber: this.restForm.gstNumber || undefined, bankAccountLast4: this.restForm.bankAccountLast4 || undefined
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.restForm = { name: "", address: "", contactName: "", contactPhone: "", cuisineType: "", fssaiLicense: "", gstNumber: "", bankAccountLast4: "" };
        this.loadRestaurants();
        this.tab.set("overview");
        this.toast.success("Restaurant submitted for review!");
      },
      error: () => { this.submitting.set(false); this.toast.error("Submission failed."); }
    });
  }

  statusBadge(s: string) {
    const m: Record<string, string> = { pending: "badge-warning", confirmed: "badge-info", accepted: "badge-success", preparing: "badge-amber", delivered: "badge-success", cancelled: "badge-error" };
    return m[s] ?? "badge-default";
  }

  fmtStatus(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
  fmt(p: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100); }
}

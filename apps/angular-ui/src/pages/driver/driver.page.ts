import { Component, inject, signal, OnInit, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService, DriverOnboardingApplication } from "../../services/api.service";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";
import { environment } from "../../environments/environment";
import { Loader } from "@googlemaps/js-api-loader";
import { io } from "socket.io-client";

@Component({
  selector: "app-driver-page",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container" style="padding-top:24px">
        <div class="page-header">
          <div class="page-title">Driver Dashboard</div>
          <div class="page-subtitle">Manage deliveries, track earnings, and update your status</div>
        </div>

        <div class="tabs">
          <button class="tab" [class.active]="tab() === 'deliveries'" (click)="tab.set('deliveries')">🚴 Deliveries</button>
          <button class="tab" [class.active]="tab() === 'onboarding'" (click)="tab.set('onboarding')">📋 Onboarding</button>
          <button class="tab" [class.active]="tab() === 'wallet'" (click)="tab.set('wallet')">💰 Wallet</button>
        </div>

        <!-- ===== DELIVERIES TAB ===== -->
        @if (tab() === 'deliveries') {
          <div class="flex gap-12 mb-16 flex-wrap">
            <button class="btn btn-primary" (click)="loadOrders()">🔄 Refresh Orders</button>
            @if (activeOrder()) {
              <button class="btn btn-success" (click)="updateStatus('picked_up')">✓ Mark Picked Up</button>
              <button class="btn btn-primary" (click)="updateStatus('delivered')">🎉 Mark Delivered</button>
            }
          </div>

          @if (activeOrder()) {
            <div class="alert alert-warning mb-16">
              🚴 Active delivery: <strong>{{ activeOrder() }}</strong>
              <button class="btn btn-sm btn-secondary" style="margin-left:8px" (click)="shareLocation()">Share Location</button>
            </div>

            <!-- Location input -->
            <div class="card mb-16">
              <div class="card-body">
                <div class="font-bold mb-12">📍 Update Location</div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Latitude</label>
                    <input class="form-input" type="number" [(ngModel)]="driverLat">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Longitude</label>
                    <input class="form-input" type="number" [(ngModel)]="driverLng">
                  </div>
                  <div style="padding-top:22px">
                    <button class="btn btn-outline" (click)="shareLocation()">Share</button>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Map -->
          <div class="map-wrap mb-16">
            <div #map style="width:100%;height:100%"></div>
            @if (!hasMap) {
              <div class="map-placeholder">
                <span style="font-size:32px">🗺️</span>
                <span>{{ mapMsg }}</span>
              </div>
            }
          </div>

          @if (orders().length === 0) {
            <div class="empty-state">
              <div class="empty-emoji">📦</div>
              <div class="empty-title">No available orders</div>
              <div class="empty-desc">New orders will appear here when available</div>
            </div>
          } @else {
            @for (order of orders(); track order.id) {
              <div class="order-card">
                <div class="order-card-head">
                  <div>
                    <div class="order-id">{{ order.id }}</div>
                    <div class="font-bold mt-4">{{ order.restaurant_name || 'Restaurant' }}</div>
                  </div>
                  <span class="font-bold" style="color:var(--amber)">{{ fmt(order.total_paise) }}</span>
                </div>
                <div class="order-info-row"><span>📍</span><span>{{ order.delivery_address }}</span></div>
                @if (order.restaurant_address) {
                  <div class="order-info-row"><span>🍽️</span><span>{{ order.restaurant_address }}</span></div>
                }
                <div class="mt-8">
                  <button class="btn btn-primary btn-sm" [disabled]="!!activeOrder()" (click)="acceptOrder(order.id)">
                    Accept Delivery
                  </button>
                </div>
              </div>
            }
          }
        }

        <!-- ===== ONBOARDING TAB ===== -->
        @if (tab() === 'onboarding') {
          @if (onboarding()) {
            <div class="card mb-16" [class.alert-success]="onboarding()!.approval_status === 'approved'">
              <div class="card-body">
                <div class="font-bold mb-12" style="font-size:15px">Application Status</div>
                <div class="metrics-grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
                  <div class="metric-card">
                    <div class="metric-label">Approval</div>
                    <span class="badge {{ onboarding()!.approval_status === 'approved' ? 'badge-success' : 'badge-warning' }}">{{ onboarding()!.approval_status }}</span>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">Aadhaar OCR</div>
                    <span class="badge {{ onboarding()!.ocr_status === 'verified' ? 'badge-success' : 'badge-warning' }}">{{ onboarding()!.ocr_status }}</span>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">Selfie Match</div>
                    <span class="badge {{ onboarding()!.selfie_status === 'verified' ? 'badge-success' : 'badge-warning' }}">{{ onboarding()!.selfie_status }}</span>
                  </div>
                  <div class="metric-card">
                    <div class="metric-label">Background</div>
                    <span class="badge {{ onboarding()!.background_check_status === 'cleared' ? 'badge-success' : 'badge-default' }}">{{ onboarding()!.background_check_status }}</span>
                  </div>
                </div>
                @if (onboarding()!.referral_code) {
                  <div class="alert alert-info mt-16">
                    Your referral code: <strong>{{ onboarding()!.referral_code }}</strong>
                  </div>
                }
                <div class="flex gap-8 mt-16">
                  <button class="btn btn-secondary btn-sm" (click)="loadOnboarding()">Refresh</button>
                  <button class="btn btn-outline btn-sm" (click)="runBgCheck()" [disabled]="onboarding()!.background_check_status !== 'pending'">
                    Run Background Check
                  </button>
                </div>
              </div>
            </div>
          }

          <div class="card">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">{{ onboarding() ? 'Update Application' : 'Driver Signup' }}</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Full Name *</label>
                  <input class="form-input" [(ngModel)]="form.fullName" placeholder="Rahul Kumar">
                </div>
                <div class="form-group">
                  <label class="form-label">Aadhaar Last 4 *</label>
                  <input class="form-input" [(ngModel)]="form.aadhaarLast4" maxlength="4" placeholder="XXXX">
                </div>
                <div class="form-group">
                  <label class="form-label">Bank Account Last 4</label>
                  <input class="form-input" [(ngModel)]="form.bankAccountLast4" maxlength="4" placeholder="XXXX">
                </div>
                <div class="form-group">
                  <label class="form-label">UPI ID</label>
                  <input class="form-input" [(ngModel)]="form.upiId" placeholder="rahul@upi">
                </div>
                <div class="form-group">
                  <label class="form-label">Referral Code</label>
                  <input class="form-input" [(ngModel)]="form.referredByCode" placeholder="AMBER123">
                </div>
              </div>

              <div class="form-grid mt-16">
                <div class="form-group">
                  <label class="form-label">Aadhaar Front</label>
                  <div class="file-drop" (click)="fileInput1.click()">
                    <div class="file-drop-icon">📄</div>
                    <div class="file-drop-text">{{ form.aadhaarFrontUrl ? '✓ File selected' : 'Upload Aadhaar Front' }}</div>
                    <input #fileInput1 type="file" accept="image/*,.pdf" style="display:none" (change)="uploadFile($event, 'aadhaarFront')">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Aadhaar Back</label>
                  <div class="file-drop" (click)="fileInput2.click()">
                    <div class="file-drop-icon">📄</div>
                    <div class="file-drop-text">{{ form.aadhaarBackUrl ? '✓ File selected' : 'Upload Aadhaar Back' }}</div>
                    <input #fileInput2 type="file" accept="image/*,.pdf" style="display:none" (change)="uploadFile($event, 'aadhaarBack')">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Selfie</label>
                  <div class="file-drop" (click)="fileInput3.click()">
                    <div class="file-drop-icon">🤳</div>
                    <div class="file-drop-text">{{ form.selfieUrl ? '✓ Photo selected' : 'Upload Selfie' }}</div>
                    <input #fileInput3 type="file" accept="image/*" style="display:none" (change)="uploadFile($event, 'selfie')">
                  </div>
                </div>
              </div>

              <button class="btn btn-primary mt-24" (click)="submitOnboarding()" [disabled]="submitting() || !form.fullName || !form.aadhaarLast4">
                @if (submitting()) { <span class="spinner spinner-sm"></span> }
                {{ onboarding() ? 'Update Application' : 'Submit Driver Signup' }}
              </button>
            </div>
          </div>
        }

        <!-- ===== WALLET TAB ===== -->
        @if (tab() === 'wallet') {
          @if (wallet()) {
            <div class="wallet-card">
              <div class="wallet-balance-label">Available Balance</div>
              <div class="wallet-balance-value">{{ fmt(wallet()!.wallet.balance_paise) }}</div>
              <div class="wallet-stats" style="position:relative">
                <div class="wallet-stat">
                  <div class="wallet-stat-label">Total Earnings</div>
                  <div class="wallet-stat-value">{{ fmt(wallet()!.wallet.total_earnings_paise) }}</div>
                </div>
                <div class="wallet-stat">
                  <div class="wallet-stat-label">Deliveries</div>
                  <div class="wallet-stat-value">{{ wallet()!.earnings.deliveries }}</div>
                </div>
                <div class="wallet-stat">
                  <div class="wallet-stat-label">Paid Out</div>
                  <div class="wallet-stat-value">{{ fmt(wallet()!.wallet.total_payouts_paise) }}</div>
                </div>
              </div>
            </div>
          } @else {
            <div class="loading-box"><div class="spinner"></div></div>
          }

          <!-- Request Payout -->
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">💸 Request Payout</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Amount (₹)</label>
                  <input class="form-input" type="number" [(ngModel)]="payoutAmount" placeholder="500">
                </div>
                <div class="form-group">
                  <label class="form-label">Method</label>
                  <select class="form-select" [(ngModel)]="payoutMethod">
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
                @if (payoutMethod === 'upi') {
                  <div class="form-group">
                    <label class="form-label">UPI ID</label>
                    <input class="form-input" [(ngModel)]="payoutUpi" placeholder="yourname@upi">
                  </div>
                } @else {
                  <div class="form-group">
                    <label class="form-label">Account Last 4</label>
                    <input class="form-input" [(ngModel)]="payoutBank" maxlength="4" placeholder="XXXX">
                  </div>
                }
              </div>
              <button class="btn btn-primary mt-16" (click)="requestPayout()" [disabled]="submitting() || payoutAmount <= 0">
                @if (submitting()) { <span class="spinner spinner-sm"></span> }
                Request Payout
              </button>
            </div>
          </div>

          <!-- Transaction History -->
          <div class="table-wrap">
            <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-weight:700">Transaction History</div>
            @if (transactions().length === 0) {
              <div class="empty-state" style="padding:32px"><div class="empty-emoji" style="font-size:32px">💳</div><div class="empty-desc">No transactions yet</div></div>
            } @else {
              <table class="data-table">
                <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  @for (tx of transactions(); track tx.id) {
                    <tr>
                      <td>{{ tx.type }}</td>
                      <td class="font-bold">{{ fmt(tx.amount_paise) }}</td>
                      <td><span class="badge {{ tx.status === 'completed' ? 'badge-success' : 'badge-warning' }}">{{ tx.status }}</span></td>
                      <td class="text-muted">{{ fmtDate(tx.created_at) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class DriverPage implements OnInit, AfterViewInit {
  @ViewChild("map") mapRef!: ElementRef<HTMLDivElement>;

  private api = inject(ApiService);
  auth = inject(AuthService);
  private toast = inject(ToastService);

  tab = signal<"deliveries" | "onboarding" | "wallet">("deliveries");
  loading = signal(false);
  submitting = signal(false);
  hasMap = false;
  mapMsg = "Map unavailable";

  orders = signal<Array<{
    id: string; status: string; total_paise: number;
    delivery_address: string; delivery_lat: string; delivery_lng: string;
    restaurant_name: string; restaurant_address: string;
    restaurant_lat: string | null; restaurant_lng: string | null;
  }>>([]);

  activeOrder = signal<string>("");
  driverLat = 28.6139;
  driverLng = 77.209;

  onboarding = signal<DriverOnboardingApplication | null>(null);
  form = { fullName: "", aadhaarLast4: "", aadhaarFrontUrl: "", aadhaarBackUrl: "", selfieUrl: "", bankAccountLast4: "", upiId: "", referredByCode: "" };

  wallet = signal<{ wallet: { balance_paise: number; total_earnings_paise: number; total_payouts_paise: number }; earnings: { earned_paise: string; deliveries: string }; pendingPayouts: { requested_paise: string; requests: string } } | null>(null);
  transactions = signal<Array<{ id: string; type: string; amount_paise: number; status: string; created_at: string }>>([]);

  payoutAmount = 0;
  payoutMethod: "upi" | "bank" = "upi";
  payoutUpi = "";
  payoutBank = "";

  private map?: google.maps.Map;
  private marker?: google.maps.Marker;

  ngOnInit() {
    this.loadOrders();
    this.loadOnboarding();
    this.loadWallet();
  }

  ngAfterViewInit() {
    if (environment.googleMapsApiKey) {
      new Loader({ apiKey: environment.googleMapsApiKey, version: "weekly" }).load().then(() => {
        this.map = new google.maps.Map(this.mapRef.nativeElement, { center: { lat: this.driverLat, lng: this.driverLng }, zoom: 13, disableDefaultUI: true });
        this.marker = new google.maps.Marker({ map: this.map, position: { lat: this.driverLat, lng: this.driverLng } });
        this.hasMap = true;
      });
    } else {
      this.mapMsg = "Add a Google Maps API key in environment.ts to enable the map";
    }
  }

  loadOrders() {
    this.api.availableDeliveryOrders().subscribe({
      next: o => this.orders.set(o),
      error: () => this.toast.error("Failed to load orders")
    });
  }

  acceptOrder(id: string) {
    this.api.acceptDeliveryOrder(id).subscribe({
      next: () => { this.activeOrder.set(id); this.toast.success("Order accepted!"); this.loadOrders(); },
      error: () => this.toast.error("Failed to accept order")
    });
  }

  updateStatus(status: "picked_up" | "delivered") {
    const id = this.activeOrder();
    if (!id) return;
    this.api.updateOrderStatus(id, status).subscribe({
      next: () => {
        this.toast.success(`Order ${status === "delivered" ? "delivered" : "picked up"}!`);
        if (status === "delivered") { this.activeOrder.set(""); this.loadWallet(); }
      },
      error: () => this.toast.error("Failed to update status")
    });
  }

  shareLocation() {
    const id = this.activeOrder();
    if (!id) { this.toast.warning("No active delivery"); return; }
    navigator.geolocation?.getCurrentPosition(
      pos => { this.driverLat = pos.coords.latitude; this.driverLng = pos.coords.longitude; this.sendLocation(id); },
      () => this.sendLocation(id)
    );
  }

  private sendLocation(id: string) {
    this.api.sendDriverLocation(id, this.driverLat, this.driverLng).subscribe({
      next: () => {
        if (this.map && this.marker) {
          const pos = { lat: this.driverLat, lng: this.driverLng };
          this.marker.setPosition(pos);
          this.map.panTo(pos);
        }
        this.toast.success("Location shared");
      },
      error: () => this.toast.error("Failed to share location")
    });
  }

  loadOnboarding() {
    this.api.myDriverOnboarding().subscribe({
      next: a => this.onboarding.set(a),
      error: () => {}
    });
  }

  uploadFile(event: Event, field: "aadhaarFront" | "aadhaarBack" | "selfie") {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const val = String(reader.result ?? "");
      if (field === "aadhaarFront") this.form.aadhaarFrontUrl = val;
      else if (field === "aadhaarBack") this.form.aadhaarBackUrl = val;
      else this.form.selfieUrl = val;
    };
    reader.readAsDataURL(file);
  }

  submitOnboarding() {
    if (!this.form.fullName || !this.form.aadhaarLast4) return;
    this.submitting.set(true);
    this.api.submitDriverOnboarding({
      fullName: this.form.fullName,
      aadhaarLast4: this.form.aadhaarLast4,
      aadhaarFrontUrl: this.form.aadhaarFrontUrl || undefined,
      aadhaarBackUrl: this.form.aadhaarBackUrl || undefined,
      selfieUrl: this.form.selfieUrl || undefined,
      bankAccountLast4: this.form.bankAccountLast4 || undefined,
      upiId: this.form.upiId || undefined,
      referredByCode: this.form.referredByCode || undefined
    }).subscribe({
      next: app => {
        this.submitting.set(false);
        this.onboarding.set(app);
        this.toast.success("Onboarding submitted!");
      },
      error: () => { this.submitting.set(false); this.toast.error("Submission failed."); }
    });
  }

  runBgCheck() {
    this.api.runDriverBackgroundCheck().subscribe({
      next: app => { this.onboarding.set(app); this.toast.success("Background check initiated."); },
      error: () => this.toast.error("Background check failed.")
    });
  }

  loadWallet() {
    this.api.walletSummary().subscribe({ next: w => this.wallet.set(w), error: () => {} });
    this.api.walletTransactions().subscribe({ next: t => this.transactions.set(t), error: () => {} });
  }

  requestPayout() {
    if (this.payoutAmount <= 0) return;
    this.submitting.set(true);
    this.api.requestPayout(this.payoutAmount * 100, this.payoutMethod, this.payoutUpi || undefined, this.payoutBank || undefined)
      .subscribe({
        next: () => { this.submitting.set(false); this.payoutAmount = 0; this.loadWallet(); this.toast.success("Payout requested!"); },
        error: () => { this.submitting.set(false); this.toast.error("Payout request failed."); }
      });
  }

  fmt(p: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100); }
  fmtDate(t: string) { return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
}

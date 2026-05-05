import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../services/toast.service";
import { environment } from "../../environments/environment";
import { Loader } from "@googlemaps/js-api-loader";
import { io, Socket } from "socket.io-client";

interface OrderDetail {
  id: string;
  status: string;
  total_paise: number;
  delivery_address: string;
  delivery_lat: string;
  delivery_lng: string;
  estimated_delivery_at: string | null;
  driver_phone: string | null;
  driver_name: string | null;
  history: Array<{ status: string; note: string; created_at: string }>;
}

const STATUS_ORDER = ["pending", "confirmed", "preparing", "picked_up", "out_for_delivery", "delivered"];

@Component({
  selector: "app-order-tracking",
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="container" style="padding-top:24px;max-width:700px">
        <div class="flex items-center gap-12 mb-24">
          <a class="btn btn-ghost btn-sm" routerLink="/customer/orders">← My Orders</a>
          <div style="flex:1">
            <div class="page-title">Live Tracking</div>
          </div>
        </div>

        @if (loading()) {
          <div class="loading-box"><div class="spinner"></div><span>Loading order…</span></div>
        } @else if (order()) {
          <!-- Status Badge -->
          <div class="card mb-16">
            <div class="card-body">
              <div class="flex items-center justify-between mb-12">
                <div>
                  <div class="text-xs text-muted mb-2">Order ID</div>
                  <div class="order-id">{{ order()!.id }}</div>
                </div>
                <span class="badge {{ statusBadge(order()!.status) }}">{{ fmt_status(order()!.status) }}</span>
              </div>

              <!-- Progress Bar -->
              <div class="flex gap-4 mb-16" style="height:4px;border-radius:2px;overflow:hidden;background:var(--border)">
                <div [style.width.%]="statusPct(order()!.status)" style="background:var(--amber);border-radius:2px;transition:width 0.5s ease"></div>
              </div>

              <div class="flex items-center gap-16 text-sm text-muted">
                @if (order()!.driver_name) {
                  <span>🚴 {{ order()!.driver_name }}</span>
                }
                @if (order()!.driver_phone) {
                  <a [href]="'tel:' + order()!.driver_phone" class="btn btn-sm btn-secondary">📞 Call Driver</a>
                }
                @if (order()!.estimated_delivery_at) {
                  <span>⏱ ETA: {{ fmtTime(order()!.estimated_delivery_at!) }}</span>
                }
              </div>
            </div>
          </div>

          <!-- Map -->
          <div class="map-wrap mb-16">
            <div #map style="width:100%;height:100%"></div>
            @if (!hasMap) {
              <div class="map-placeholder">
                <span style="font-size:32px">🗺️</span>
                <span>{{ mapStatus() }}</span>
              </div>
            }
          </div>

          @if (eta()) {
            <div class="card mb-16" style="background:var(--amber-bg);border-color:var(--amber-light)">
              <div class="card-body">
                <div class="flex items-center gap-12">
                  <span style="font-size:24px">⏱️</span>
                  <div>
                    <div class="font-bold">Predicted delivery in {{ eta()!.predictedEtaMinutes }} minutes</div>
                    <div class="text-sm text-muted">
                      {{ eta()!.route.distanceToPickupKm.toFixed(1) }} km to restaurant ·
                      {{ eta()!.route.distanceToDropoffKm.toFixed(1) }} km to you
                    </div>
                  </div>
                  <button class="btn btn-sm btn-outline" (click)="openMapsNavigation()" style="margin-left:auto">Directions</button>
                </div>
              </div>
            </div>
          }

          <!-- Order Timeline -->
          <div class="card mb-16">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">Order Timeline</div>
              <div class="order-timeline">
                @for (event of order()!.history; track event.created_at + event.status; let i = $index) {
                  <div class="timeline-item">
                    @if (i < order()!.history.length - 1) {
                      <div class="timeline-line"></div>
                    }
                    <div class="timeline-dot" [class.done]="i < order()!.history.length - 1" [class.active]="i === order()!.history.length - 1"></div>
                    <div class="timeline-content">
                      <div class="timeline-status">{{ fmt_status(event.status) }}</div>
                      @if (event.note) { <div class="timeline-note">{{ event.note }}</div> }
                      <div class="timeline-time">{{ fmtTime(event.created_at) }}</div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Order Info -->
          <div class="card mb-16">
            <div class="card-body">
              <div class="font-bold mb-12" style="font-size:15px">Order Details</div>
              <div class="order-info-row">
                <span class="order-info-icon">📍</span>
                <span>{{ order()!.delivery_address }}</span>
              </div>
              <div class="order-info-row">
                <span class="order-info-icon">💰</span>
                <span class="font-bold">{{ fmt_currency(order()!.total_paise) }}</span>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class OrderTrackingPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("map") mapRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  orderId = "";
  loading = signal(true);
  order = signal<OrderDetail | null>(null);
  mapStatus = signal("Add Google Maps API key to see live tracking");
  eta = signal<{
    predictedEtaMinutes: number;
    predictedDeliveryAt: string;
    route: { origin: { lat: number; lng: number }; pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number }; distanceToPickupKm: number; distanceToDropoffKm: number };
  } | null>(null);

  hasMap = false;
  private map?: google.maps.Map;
  private marker?: google.maps.Marker;
  private socket?: Socket;

  ngOnInit() {
    this.orderId = this.route.snapshot.paramMap.get("id") ?? "";
    this.loadOrder();
    this.watchSocket();
  }

  ngAfterViewInit() {
    if (environment.googleMapsApiKey) {
      new Loader({ apiKey: environment.googleMapsApiKey, version: "weekly" }).load().then(() => {
        const center = { lat: 28.6139, lng: 77.209 };
        this.map = new google.maps.Map(this.mapRef.nativeElement, { center, zoom: 14, disableDefaultUI: true });
        this.marker = new google.maps.Marker({ map: this.map, position: center });
        this.hasMap = true;
        this.mapStatus.set("Live tracking active");
      });
    }
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }

  loadOrder() {
    if (!this.orderId) return;
    this.api.getOrder(this.orderId).subscribe({
      next: order => {
        this.loading.set(false);
        this.order.set(order);
        this.loadEta();
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Could not load order details.");
      }
    });
  }

  loadEta() {
    if (!this.orderId) return;
    this.api.orderEta(this.orderId).subscribe({
      next: eta => this.eta.set(eta),
      error: () => {}
    });
  }

  watchSocket() {
    if (!this.orderId) return;
    try {
      this.socket = io(this.api.baseUrl, { transports: ["websocket"] });
      this.socket.emit("order:join", this.orderId);
      this.socket.on("driver:location", (loc: { lat: string; lng: string }) => {
        const lat = Number(loc.lat); const lng = Number(loc.lng);
        if (this.map && this.marker) {
          this.marker.setPosition({ lat, lng });
          this.map.panTo({ lat, lng });
        }
        this.mapStatus.set(`Driver at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      });
      this.socket.on("order:update", () => this.loadOrder());
    } catch {}
  }

  openMapsNavigation() {
    const e = this.eta();
    if (!e) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${e.route.origin.lat},${e.route.origin.lng}&destination=${e.route.dropoff.lat},${e.route.dropoff.lng}&waypoints=${e.route.pickup.lat},${e.route.pickup.lng}&travelmode=driving`;
    window.open(url, "_blank");
  }

  statusBadge(s: string) {
    const m: Record<string, string> = { pending: "badge-warning", confirmed: "badge-info", preparing: "badge-amber", picked_up: "badge-purple", out_for_delivery: "badge-purple", delivered: "badge-success", cancelled: "badge-error" };
    return m[s] ?? "badge-default";
  }

  statusPct(s: string) {
    const i = STATUS_ORDER.indexOf(s);
    if (i < 0) return 5;
    return Math.round(((i + 1) / STATUS_ORDER.length) * 100);
  }

  fmt_status(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
  fmt_currency(p: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100); }
  fmtTime(t: string) { return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
}

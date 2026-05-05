import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-operations",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-nav-section">Navigation</div>
        <a class="admin-nav-btn" routerLink="/admin">← Admin Dashboard</a>
        <a class="admin-nav-btn" routerLink="/admin/delivery">📍 Delivery Admin</a>
        <div class="admin-nav-section">Operations</div>
        <button class="admin-nav-btn active">🤖 AI Intelligence</button>
      </aside>

      <main class="admin-content">
        <div class="section-header">
          <div><div class="section-title">Operations Intelligence</div><div class="section-subtitle">AI demand predictions, zones, campaigns & incentives</div></div>
          <div class="flex gap-8">
            <button class="btn btn-primary btn-sm" (click)="runDemandJob()">🤖 Run AI Demand Job</button>
            <button class="btn btn-secondary btn-sm" (click)="loadAll()">🔄 Refresh</button>
          </div>
        </div>

        <div class="tabs">
          <button class="tab" [class.active]="tab() === 'demand'" (click)="tab.set('demand')">🤖 AI Demand</button>
          <button class="tab" [class.active]="tab() === 'zones'" (click)="tab.set('zones')">🗺️ Zones</button>
          <button class="tab" [class.active]="tab() === 'offers'" (click)="tab.set('offers')">🎁 Offers</button>
          <button class="tab" [class.active]="tab() === 'campaigns'" (click)="tab.set('campaigns')">📢 Campaigns</button>
          <button class="tab" [class.active]="tab() === 'incentives'" (click)="tab.set('incentives')">⚡ Incentives</button>
        </div>

        <!-- AI DEMAND -->
        @if (tab() === 'demand') {
          @if (predictions().length === 0) {
            <div class="empty-state">
              <div class="empty-emoji">🤖</div>
              <div class="empty-title">No predictions yet</div>
              <div class="empty-desc">Run the AI demand job to generate predictions</div>
              <button class="btn btn-primary mt-16" (click)="runDemandJob()">Run AI Demand Job</button>
            </div>
          } @else {
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-bottom:24px">
              @for (p of predictions(); track p.id) {
                <div class="predict-card">
                  <div class="predict-zone">{{ p.zone_key }}</div>
                  <div class="predict-detail">
                    {{ p.cuisine_type || 'Mixed' }} · {{ p.predicted_orders }} orders predicted
                    · {{ p.confidence }}% confidence
                  </div>
                  <div class="predict-detail" style="opacity:0.6;font-size:12px;margin-top:4px">{{ fmtTime(p.hour_start) }}</div>
                </div>
              }
            </div>
          }

          <!-- Analytics Jobs -->
          @if (jobs().length > 0) {
            <div class="section-title mb-16" style="font-size:16px">Recent Analytics Jobs</div>
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Type</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  @for (j of jobs(); track j.id) {
                    <tr>
                      <td>{{ j.job_type }}</td>
                      <td><span class="badge {{ j.status === 'completed' ? 'badge-success' : 'badge-warning' }}">{{ j.status }}</span></td>
                      <td class="text-muted">{{ fmtDate(j.created_at) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        <!-- ZONES -->
        @if (tab() === 'zones') {
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">Create Delivery Zone</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Zone Name *</label><input class="form-input" [(ngModel)]="zone.name" placeholder="Delhi Zone 1"></div>
                <div class="form-group"><label class="form-label">City *</label><input class="form-input" [(ngModel)]="zone.city" placeholder="Delhi NCR"></div>
                <div class="form-group"><label class="form-label">Latitude</label><input class="form-input" type="number" [(ngModel)]="zone.lat"></div>
                <div class="form-group"><label class="form-label">Longitude</label><input class="form-input" type="number" [(ngModel)]="zone.lng"></div>
                <div class="form-group"><label class="form-label">Radius (km)</label><input class="form-input" type="number" [(ngModel)]="zone.radiusKm"></div>
                <div class="form-group"><label class="form-label">SLA (minutes)</label><input class="form-input" type="number" [(ngModel)]="zone.slaMinutes"></div>
              </div>
              <button class="btn btn-primary mt-16" (click)="createZone()" [disabled]="submitting() || !zone.name || !zone.city">
                @if (submitting()) { <span class="spinner spinner-sm"></span> } Create Zone
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>City</th><th>SLA</th><th>Surge</th></tr></thead>
              <tbody>
                @for (z of zones(); track z.id) {
                  <tr>
                    <td class="font-bold">{{ z.name }}</td>
                    <td>{{ z.city }}</td>
                    <td>{{ z.sla_minutes }} min</td>
                    <td>{{ z.surge_multiplier }}×</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- OFFERS -->
        @if (tab() === 'offers') {
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">Create Offer / Coupon</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Offer Code *</label><input class="form-input" [(ngModel)]="offer.code" placeholder="AMBER50"></div>
                <div class="form-group"><label class="form-label">Title *</label><input class="form-input" [(ngModel)]="offer.title" placeholder="Welcome Offer"></div>
                <div class="form-group"><label class="form-label">Discount (₹)</label><input class="form-input" type="number" [(ngModel)]="offerRupees" placeholder="50"></div>
              </div>
              <button class="btn btn-primary mt-16" (click)="createOffer()" [disabled]="submitting() || !offer.code || !offer.title">
                @if (submitting()) { <span class="spinner spinner-sm"></span> } Create Offer
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Code</th><th>Title</th><th>Discount</th><th>Type</th></tr></thead>
              <tbody>
                @for (o of offers(); track o.id) {
                  <tr>
                    <td class="font-bold" style="font-family:var(--mono)">{{ o.code }}</td>
                    <td>{{ o.title }}</td>
                    <td>{{ fmt(o.discount_value) }}</td>
                    <td><span class="badge badge-amber">{{ o.discount_type }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- CAMPAIGNS -->
        @if (tab() === 'campaigns') {
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">Launch Campaign</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Campaign Name *</label><input class="form-input" [(ngModel)]="campaign.name" placeholder="Peak Hour Push"></div>
                <div class="form-group">
                  <label class="form-label">Channel</label>
                  <select class="form-select" [(ngModel)]="campaign.channel">
                    <option value="push">Push Notification</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="ads">Ads</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Budget (₹)</label><input class="form-input" type="number" [(ngModel)]="campaignBudgetRupees" placeholder="1000"></div>
                <div class="form-group"><label class="form-label">AI Creative Prompt</label><input class="form-input" [(ngModel)]="campaign.aiCreative" placeholder="Promote lunch deals near Connaught Place"></div>
              </div>
              <button class="btn btn-primary mt-16" (click)="createCampaign()" [disabled]="submitting() || !campaign.name">
                @if (submitting()) { <span class="spinner spinner-sm"></span> } Launch Campaign
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Channel</th><th>Budget</th><th>Status</th></tr></thead>
              <tbody>
                @for (c of campaigns(); track c.id) {
                  <tr>
                    <td class="font-bold">{{ c.name }}</td>
                    <td><span class="badge badge-info">{{ c.channel }}</span></td>
                    <td>{{ fmt(c.budget_paise) }}</td>
                    <td><span class="badge {{ c.status === 'active' ? 'badge-success' : 'badge-default' }}">{{ c.status }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- INCENTIVES -->
        @if (tab() === 'incentives') {
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">Create Driver Incentive</div>
              <div class="form-grid">
                <div class="form-group"><label class="form-label">Title *</label><input class="form-input" [(ngModel)]="incentive.title" placeholder="Peak Hour Bonus"></div>
                <div class="form-group"><label class="form-label">Target Deliveries</label><input class="form-input" type="number" [(ngModel)]="incentive.targetDeliveries" placeholder="5"></div>
                <div class="form-group"><label class="form-label">Reward (₹)</label><input class="form-input" type="number" [(ngModel)]="incentiveRewardRupees" placeholder="75"></div>
              </div>
              <button class="btn btn-primary mt-16" (click)="createIncentive()" [disabled]="submitting() || !incentive.title">
                @if (submitting()) { <span class="spinner spinner-sm"></span> } Create Incentive
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Title</th><th>Target</th><th>Reward</th><th>Status</th></tr></thead>
              <tbody>
                @for (i of incentives(); track i.id) {
                  <tr>
                    <td class="font-bold">{{ i.title }}</td>
                    <td>{{ i.target_deliveries }} deliveries</td>
                    <td>{{ fmt(i.reward_paise) }}</td>
                    <td><span class="badge {{ i.status === 'active' ? 'badge-success' : 'badge-default' }}">{{ i.status }}</span></td>
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
export class OperationsPage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tab = signal<"demand" | "zones" | "offers" | "campaigns" | "incentives">("demand");
  submitting = signal(false);

  predictions = signal<Array<{ id: string; zone_key: string; cuisine_type: string | null; hour_start: string; predicted_orders: number; confidence: string }>>([]);
  jobs = signal<Array<{ id: string; job_type: string; status: string; summary: unknown; created_at: string }>>([]);
  zones = signal<Array<{ id: string; name: string; city: string; sla_minutes: number; surge_multiplier: string }>>([]);
  offers = signal<Array<{ id: string; code: string; title: string; discount_type: string; discount_value: number }>>([]);
  campaigns = signal<Array<{ id: string; name: string; channel: string; budget_paise: number; status: string; ai_creative: string | null }>>([]);
  incentives = signal<Array<{ id: string; title: string; target_deliveries: number; reward_paise: number; status: string }>>([]);

  zone = { name: "Delhi Zone 1", city: "Delhi NCR", lat: 28.6139, lng: 77.209, radiusKm: 3, slaMinutes: 15 };
  offer = { code: "AMBER50", title: "Welcome Offer" };
  offerRupees = 50;
  campaign = { name: "", channel: "push" as const, aiCreative: "" };
  campaignBudgetRupees = 1000;
  incentive = { title: "", targetDeliveries: 5 };
  incentiveRewardRupees = 75;

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.api.demandPredictions().subscribe({ next: p => this.predictions.set(p), error: () => {} });
    this.api.analyticsJobs().subscribe({ next: j => this.jobs.set(j), error: () => {} });
    this.api.marketplaceZones().subscribe({ next: z => this.zones.set(z), error: () => {} });
    this.api.marketplaceOffers().subscribe({ next: o => this.offers.set(o), error: () => {} });
    this.api.campaigns().subscribe({ next: c => this.campaigns.set(c), error: () => {} });
    this.api.driverIncentives().subscribe({ next: i => this.incentives.set(i), error: () => {} });
  }

  runDemandJob() {
    this.api.runDemandPredictionJob().subscribe({
      next: () => { this.toast.success("AI demand job running…"); this.loadAll(); },
      error: () => this.toast.error("Job failed to start")
    });
  }

  createZone() {
    this.submitting.set(true);
    this.api.createZone(this.zone.name, this.zone.city, this.zone.lat, this.zone.lng, this.zone.radiusKm, this.zone.slaMinutes)
      .subscribe({
        next: () => { this.submitting.set(false); this.loadAll(); this.toast.success("Zone created!"); },
        error: () => { this.submitting.set(false); this.toast.error("Failed"); }
      });
  }

  createOffer() {
    this.submitting.set(true);
    this.api.createOffer(this.offer.code, this.offer.title, "flat", this.offerRupees * 100, 0)
      .subscribe({
        next: () => { this.submitting.set(false); this.loadAll(); this.toast.success("Offer created!"); },
        error: () => { this.submitting.set(false); this.toast.error("Failed"); }
      });
  }

  createCampaign() {
    this.submitting.set(true);
    this.api.createCampaign(this.campaign.name, this.campaign.channel, this.campaignBudgetRupees * 100, this.campaign.aiCreative || undefined)
      .subscribe({
        next: () => { this.submitting.set(false); this.loadAll(); this.toast.success("Campaign launched!"); this.campaign.name = ""; },
        error: () => { this.submitting.set(false); this.toast.error("Failed"); }
      });
  }

  createIncentive() {
    this.submitting.set(true);
    this.api.createDriverIncentive(this.incentive.title, this.incentive.targetDeliveries, this.incentiveRewardRupees * 100)
      .subscribe({
        next: () => { this.submitting.set(false); this.loadAll(); this.toast.success("Incentive created!"); this.incentive.title = ""; },
        error: () => { this.submitting.set(false); this.toast.error("Failed"); }
      });
  }

  fmt(p: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(p / 100); }
  fmtDate(t: string) { return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  fmtTime(t: string) { try { return new Date(t).toLocaleString("en-IN"); } catch { return t; } }
}

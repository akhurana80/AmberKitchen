import { Component, inject, signal, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../services/toast.service";

type SortOrder = "rating_desc" | "distance" | "price_asc" | "price_desc";
type Diet = "all" | "veg" | "non_veg";

interface MenuItem {
  menu_item_id: string;
  menu_item_name: string;
  description: string | null;
  price_paise: number;
  photo_url: string | null;
  is_veg: boolean | null;
  cuisine_type: string | null;
  rating: string | null;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string;
  distance_km: string | null;
}

interface TrendingRestaurant {
  id: string;
  name: string;
  address: string;
  cuisine_type: string | null;
  recent_orders: number;
  rating: string | null;
  starting_price_paise: number | null;
  photo_url: string | null;
  distance_km: string | null;
  trending_score: string;
  historical_eta_minutes: number;
  predicted_eta_minutes: number;
}

@Component({
  selector: "app-customer-home",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <!-- Hero -->
      <div class="hero">
        <div class="hero-inner">
          <span class="hero-badge">🌟 Delhi NCR's #1 Cloud Kitchen</span>
          <h1 class="hero-title">Delicious food,<br>delivered fast 🚀</h1>
          <p class="hero-subtitle">Order from 500+ restaurants. 30 min delivery guaranteed.</p>
          <div class="hero-search">
            <input class="hero-search-input" [(ngModel)]="searchText"
              placeholder="Search for food, restaurants…" (keyup.enter)="doSearch()">
            <button class="hero-search-btn" (click)="doSearch()">Search</button>
          </div>
        </div>
      </div>

      <div class="container" style="padding-top:24px">

        <!-- Filter bar -->
        <div class="filter-bar">
          <button class="filter-chip" [class.active]="diet === 'all'" (click)="diet='all'; doSearch()">All</button>
          <button class="filter-chip" [class.active]="diet === 'veg'" (click)="diet='veg'; doSearch()">
            <span class="veg-dot"></span> Veg
          </button>
          <button class="filter-chip" [class.active]="diet === 'non_veg'" (click)="diet='non_veg'; doSearch()">
            <span class="nonveg-dot"></span> Non-Veg
          </button>
          <button class="filter-chip" [class.active]="sort === 'rating_desc'" (click)="sort='rating_desc'; doSearch()">⭐ Top Rated</button>
          <button class="filter-chip" [class.active]="sort === 'price_asc'" (click)="sort='price_asc'; doSearch()">💰 Low Price</button>
          <button class="filter-chip" [class.active]="sort === 'distance'" (click)="sort='distance'; doSearch()">📍 Nearest</button>
        </div>

        <!-- Trending Restaurants -->
        @if (trending().length > 0) {
          <div class="section-header">
            <div>
              <div class="section-title">🔥 Trending Now</div>
              <div class="section-subtitle">Popular restaurants in your area</div>
            </div>
            <button class="btn btn-ghost btn-sm" (click)="loadTrending()">Refresh</button>
          </div>
          <div class="restaurant-grid mb-24">
            @for (r of trending(); track r.id) {
              <div class="restaurant-card" (click)="openRestaurant(r.id, r.name)">
                @if (r.photo_url) {
                  <img class="restaurant-img" [src]="r.photo_url" [alt]="r.name" loading="lazy">
                } @else {
                  <div class="restaurant-img-placeholder">🍽️</div>
                }
                <div class="restaurant-body">
                  <div class="restaurant-name">{{ r.name }}</div>
                  <div class="restaurant-meta">
                    @if (r.rating) {
                      <span class="rating">⭐ {{ (+r.rating).toFixed(1) }}</span>
                    }
                    @if (r.cuisine_type) {
                      <span class="dot">·</span>
                      <span>{{ r.cuisine_type }}</span>
                    }
                    @if (r.recent_orders > 0) {
                      <span class="dot">·</span>
                      <span class="trend-badge">🔥 {{ r.recent_orders }} orders</span>
                    }
                  </div>
                </div>
                <div class="restaurant-footer">
                  <span>{{ r.predicted_eta_minutes > 0 ? r.predicted_eta_minutes + ' min' : '—' }}</span>
                  @if (r.starting_price_paise) {
                    <span>From {{ fmt(r.starting_price_paise) }}</span>
                  }
                  @if (r.distance_km) {
                    <span>{{ (+r.distance_km).toFixed(1) }} km</span>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- Search Results -->
        @if (loading()) {
          <div class="loading-box">
            <div class="spinner"></div>
            <span>Finding the best food near you…</span>
          </div>
        } @else if (results().length > 0) {
          <div class="section-header">
            <div>
              <div class="section-title">Search Results</div>
              <div class="section-subtitle">{{ results().length }} items found</div>
            </div>
          </div>

          <!-- Group by restaurant -->
          @for (group of groupedResults(); track group.restaurantId) {
            <div class="card mb-24">
              <div class="card-body" style="border-bottom:1px solid var(--border); cursor:pointer"
                (click)="openRestaurant(group.restaurantId, group.restaurantName)">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-bold" style="font-size:16px">{{ group.restaurantName }}</div>
                    <div class="text-sm text-muted">{{ group.address }}</div>
                  </div>
                  <span class="btn btn-sm btn-outline">View Menu →</span>
                </div>
              </div>
              @for (item of group.items; track item.menu_item_id) {
                <div class="menu-item" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--bg-2)">
                  <div class="menu-item-info">
                    <div class="flex items-center gap-8 mb-4">
                      @if (item.is_veg === true) { <span class="veg-dot"></span> }
                      @else if (item.is_veg === false) { <span class="nonveg-dot"></span> }
                    </div>
                    <div class="menu-item-name">{{ item.menu_item_name }}</div>
                    @if (item.description) {
                      <div class="menu-item-desc">{{ item.description }}</div>
                    }
                    <div class="menu-item-price">{{ fmt(item.price_paise) }}</div>
                  </div>
                  @if (item.photo_url) {
                    <img class="menu-item-img" [src]="item.photo_url" [alt]="item.menu_item_name" loading="lazy">
                  } @else {
                    <div class="menu-item-img-ph">🍱</div>
                  }
                </div>
              }
            </div>
          }
        } @else if (searchText || diet !== 'all') {
          <div class="empty-state">
            <div class="empty-emoji">🔍</div>
            <div class="empty-title">No results found</div>
            <div class="empty-desc">Try different keywords or remove filters</div>
            <button class="btn btn-outline mt-16" (click)="clearSearch()">Clear Filters</button>
          </div>
        }

      </div>
    </div>
  `
})
export class CustomerHomePage implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  searchText = "";
  cuisine = "";
  diet: Diet = "all";
  sort: SortOrder = "rating_desc";
  lat = 28.6139;
  lng = 77.209;

  loading = signal(false);
  results = signal<MenuItem[]>([]);
  trending = signal<TrendingRestaurant[]>([]);

  groupedResults = () => {
    const map = new Map<string, { restaurantId: string; restaurantName: string; address: string; items: MenuItem[] }>();
    for (const item of this.results()) {
      if (!map.has(item.restaurant_id)) {
        map.set(item.restaurant_id, {
          restaurantId: item.restaurant_id,
          restaurantName: item.restaurant_name,
          address: item.restaurant_address,
          items: []
        });
      }
      map.get(item.restaurant_id)!.items.push(item);
    }
    return Array.from(map.values());
  };

  ngOnInit() {
    this.loadTrending();
    this.doSearch();
  }

  loadTrending() {
    this.api.trendingRestaurants(this.lat, this.lng).subscribe({
      next: restaurants => this.trending.set(restaurants),
      error: () => {}
    });
  }

  doSearch() {
    this.loading.set(true);
    this.api.searchRestaurants({
      q: this.searchText || undefined,
      cuisine: this.cuisine || undefined,
      diet: this.diet,
      sort: this.sort,
      lat: this.sort === "distance" ? this.lat : undefined,
      lng: this.sort === "distance" ? this.lng : undefined
    }).subscribe({
      next: items => {
        this.loading.set(false);
        this.results.set(items);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Failed to load restaurants. Is the backend running?");
      }
    });
  }

  clearSearch() {
    this.searchText = "";
    this.diet = "all";
    this.sort = "rating_desc";
    this.doSearch();
  }

  openRestaurant(id: string, name: string) {
    this.router.navigate(["/customer/restaurant", id], { state: { name } });
  }

  fmt(paise: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
  }
}

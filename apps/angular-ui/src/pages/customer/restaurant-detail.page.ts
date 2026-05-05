import { Component, inject, signal, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { CartService } from "../../services/cart.service";
import { ToastService } from "../../services/toast.service";

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

@Component({
  selector: "app-restaurant-detail",
  standalone: true,
  template: `
    <div class="page">
      <!-- Back + Restaurant Header -->
      <div style="background:var(--white);border-bottom:1px solid var(--border);padding:16px 0;margin-bottom:0">
        <div class="container">
          <button class="btn btn-ghost btn-sm mb-16" (click)="goBack()">← Back</button>
          <div class="flex items-center gap-16">
            <div style="font-size:48px;background:var(--amber-bg);width:72px;height:72px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;flex-shrink:0">🍽️</div>
            <div class="min-w-0">
              <h1 style="font-size:22px;font-weight:800;color:var(--dark);letter-spacing:-0.3px">{{ restaurantName() }}</h1>
              <div class="flex items-center gap-8 mt-4 flex-wrap">
                @if (cuisine()) { <span class="badge badge-default">{{ cuisine() }}</span> }
                <span class="badge badge-success">✓ Open</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="container" style="padding-top:24px">
        @if (loading()) {
          <div class="loading-box">
            <div class="spinner"></div>
            <span>Loading menu…</span>
          </div>
        } @else if (items().length === 0) {
          <div class="empty-state">
            <div class="empty-emoji">🍽️</div>
            <div class="empty-title">Menu not available</div>
            <div class="empty-desc">This restaurant hasn't added menu items yet</div>
          </div>
        } @else {
          <div class="flex gap-24">
            <!-- Menu -->
            <div style="flex:1;min-width:0">
              @for (group of groupedItems(); track group.cuisine) {
                <div class="menu-section">
                  <div class="menu-section-title">{{ group.cuisine || 'Menu' }}</div>
                  @for (item of group.items; track item.menu_item_id) {
                    <div class="menu-item">
                      <div class="menu-item-info">
                        <div class="flex items-center gap-8 mb-4">
                          @if (item.is_veg === true) { <span class="veg-dot"></span> }
                          @else if (item.is_veg === false) { <span class="nonveg-dot"></span> }
                          @if (item.rating) {
                            <span class="rating" style="font-size:11px">⭐ {{ item.rating }}</span>
                          }
                        </div>
                        <div class="menu-item-name">{{ item.menu_item_name }}</div>
                        @if (item.description) {
                          <div class="menu-item-desc">{{ item.description }}</div>
                        }
                        <div class="flex items-center gap-12 mt-8">
                          <div class="menu-item-price">{{ fmt(item.price_paise) }}</div>
                          @if (cart.getQty(item.menu_item_id) > 0) {
                            <div class="qty-control">
                              <button class="qty-btn" (click)="remove(item)">−</button>
                              <span class="qty-value">{{ cart.getQty(item.menu_item_id) }}</span>
                              <button class="qty-btn" (click)="add(item)">+</button>
                            </div>
                          } @else {
                            <button class="add-btn" (click)="add(item)">ADD</button>
                          }
                        </div>
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
            </div>
          </div>
        }
      </div>

      <!-- Sticky Cart Bar -->
      @if (!cart.isEmpty()) {
        <div class="sticky-cart" (click)="goToCheckout()">
          <div class="sticky-cart-info">
            <div class="sticky-cart-count">{{ cart.totalItems() }} item{{ cart.totalItems() > 1 ? 's' : '' }}</div>
            <div class="sticky-cart-name">{{ cart.restaurantName() }}</div>
          </div>
          <div class="sticky-cart-right">
            <div class="sticky-cart-price">{{ fmt(cart.totalPaise()) }}</div>
            <span>→ View Cart</span>
          </div>
        </div>
      }
    </div>
  `
})
export class RestaurantDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  cart = inject(CartService);
  private toast = inject(ToastService);
  private router = inject(Router);

  restaurantId = "";
  restaurantName = signal("Restaurant");
  cuisine = signal("");
  loading = signal(true);
  items = signal<MenuItem[]>([]);

  groupedItems = () => {
    const map = new Map<string, MenuItem[]>();
    for (const item of this.items()) {
      const key = item.cuisine_type ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([cuisine, items]) => ({ cuisine, items }));
  };

  ngOnInit() {
    this.restaurantId = this.route.snapshot.paramMap.get("id") ?? "";
    const state = history.state;
    if (state?.name) this.restaurantName.set(state.name);
    this.loadMenu();
  }

  loadMenu() {
    this.loading.set(true);
    this.api.searchRestaurants({ q: undefined }).subscribe({
      next: allItems => {
        const filtered = allItems.filter(i => i.restaurant_id === this.restaurantId);
        if (filtered.length > 0) {
          this.restaurantName.set(filtered[0].restaurant_name);
          this.cuisine.set(filtered[0].cuisine_type ?? "");
        }
        this.items.set(filtered);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Failed to load menu.");
      }
    });
  }

  add(item: MenuItem) {
    this.cart.addItem({
      menuItemId: item.menu_item_id,
      name: item.menu_item_name,
      pricePaise: item.price_paise,
      quantity: 1,
      photoUrl: item.photo_url,
      restaurantId: item.restaurant_id,
      restaurantName: item.restaurant_name,
      isVeg: item.is_veg
    });
  }

  remove(item: MenuItem) {
    this.cart.removeItem(item.menu_item_id);
  }

  goBack() { this.router.navigate(["/customer/home"]); }
  goToCheckout() { this.router.navigate(["/customer/checkout"]); }

  fmt(paise: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
  }
}

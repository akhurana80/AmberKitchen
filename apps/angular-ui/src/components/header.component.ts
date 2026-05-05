import { Component, inject, computed } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { CartService } from "../services/cart.service";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="header-inner">
        <a class="header-logo" [routerLink]="homeLink()">
          <div class="logo-icon">🍳</div>
          <span class="logo-text">Amber<span>Kitchen</span></span>
        </a>

        @if (auth.isLoggedIn()) {
          <nav class="header-nav">
            @if (auth.isCustomer()) {
              <a class="nav-link" routerLink="/customer/home" routerLinkActive="active">Restaurants</a>
              <a class="nav-link" routerLink="/customer/orders" routerLinkActive="active">My Orders</a>
              <a class="nav-link" routerLink="/customer/profile" routerLinkActive="active">Profile</a>
            }
            @if (auth.isDriver()) {
              <a class="nav-link" routerLink="/driver" routerLinkActive="active">Dashboard</a>
            }
            @if (auth.isRestaurant()) {
              <a class="nav-link" routerLink="/restaurant" routerLinkActive="active">My Restaurant</a>
            }
            @if (auth.isAdmin()) {
              <a class="nav-link" routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Dashboard</a>
              @if (auth.isSuperAdmin() || auth.isAdmin()) {
                <a class="nav-link" routerLink="/admin/operations" routerLinkActive="active">Operations</a>
              }
              <a class="nav-link" routerLink="/admin/delivery" routerLinkActive="active">Delivery</a>
            }
          </nav>
        }

        <div class="header-spacer"></div>

        <div class="header-actions">
          @if (auth.isCustomer() && auth.isLoggedIn()) {
            <a class="cart-btn" routerLink="/customer/checkout">
              🛒 Cart
              @if (cart.totalItems() > 0) {
                <span class="cart-badge">{{ cart.totalItems() }}</span>
              }
            </a>
          }

          @if (auth.isLoggedIn()) {
            <button class="user-menu" (click)="auth.logout()">
              <div class="user-avatar">{{ initials() }}</div>
              <span class="user-role">{{ roleLabel() }}</span>
              <span style="color:var(--muted);font-size:12px">✕</span>
            </button>
          } @else {
            <a class="btn btn-primary btn-sm" routerLink="/auth">Sign In</a>
          }
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  auth = inject(AuthService);
  cart = inject(CartService);

  homeLink = computed(() => {
    if (!this.auth.isLoggedIn()) return "/auth";
    if (this.auth.isCustomer()) return "/customer/home";
    if (this.auth.isDriver()) return "/driver";
    if (this.auth.isRestaurant()) return "/restaurant";
    return "/admin";
  });

  initials = computed(() => {
    const name = this.auth.userName();
    if (!name) return this.auth.role().charAt(0).toUpperCase();
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  });

  roleLabel = computed(() => {
    const map: Record<string, string> = {
      customer: "Customer", driver: "Driver", restaurant: "Restaurant",
      admin: "Admin", super_admin: "Super Admin", delivery_admin: "Delivery Admin"
    };
    return map[this.auth.role()] ?? "Logout";
  });
}

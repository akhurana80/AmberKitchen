import { Routes } from "@angular/router";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "./services/auth.service";

function authGuard() {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(["/auth"]);
}

function roleGuard(...roles: string[]) {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) return router.createUrlTree(["/auth"]);
    if (!roles.includes(auth.role())) return router.createUrlTree(["/auth"]);
    return true;
  };
}

export const routes: Routes = [
  { path: "", redirectTo: "auth", pathMatch: "full" },
  {
    path: "auth",
    loadComponent: () => import("./pages/auth/auth.page").then(m => m.AuthPage)
  },
  {
    path: "customer",
    canActivate: [roleGuard("customer")],
    children: [
      { path: "", redirectTo: "home", pathMatch: "full" },
      { path: "home", loadComponent: () => import("./pages/customer/home.page").then(m => m.CustomerHomePage) },
      { path: "restaurant/:id", loadComponent: () => import("./pages/customer/restaurant-detail.page").then(m => m.RestaurantDetailPage) },
      { path: "checkout", loadComponent: () => import("./pages/customer/checkout.page").then(m => m.CheckoutPage) },
      { path: "orders", loadComponent: () => import("./pages/customer/orders.page").then(m => m.OrdersPage) },
      { path: "orders/:id", loadComponent: () => import("./pages/customer/order-tracking.page").then(m => m.OrderTrackingPage) },
      { path: "profile", loadComponent: () => import("./pages/customer/profile.page").then(m => m.ProfilePage) }
    ]
  },
  {
    path: "driver",
    canActivate: [roleGuard("driver")],
    loadComponent: () => import("./pages/driver/driver.page").then(m => m.DriverPage)
  },
  {
    path: "restaurant",
    canActivate: [roleGuard("restaurant")],
    loadComponent: () => import("./pages/restaurant/restaurant.page").then(m => m.RestaurantPage)
  },
  {
    path: "admin",
    canActivate: [roleGuard("admin", "super_admin", "delivery_admin")],
    children: [
      { path: "", loadComponent: () => import("./pages/admin/admin.page").then(m => m.AdminPage) },
      { path: "delivery", loadComponent: () => import("./pages/admin/delivery.page").then(m => m.DeliveryAdminPage) },
      { path: "operations", loadComponent: () => import("./pages/admin/operations.page").then(m => m.OperationsPage) }
    ]
  },
  { path: "**", redirectTo: "auth" }
];

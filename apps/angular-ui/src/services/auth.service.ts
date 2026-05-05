import { Injectable, signal, computed } from "@angular/core";
import { Router } from "@angular/router";

@Injectable({ providedIn: "root" })
export class AuthService {
  readonly token = signal<string>(localStorage.getItem("ak_token") ?? "");
  readonly role = signal<string>(localStorage.getItem("ak_role") ?? "");
  readonly userName = signal<string>(localStorage.getItem("ak_name") ?? "");
  readonly userId = signal<string>(localStorage.getItem("ak_uid") ?? "");

  readonly isLoggedIn = computed(() => !!this.token());
  readonly isCustomer = computed(() => this.role() === "customer");
  readonly isDriver = computed(() => this.role() === "driver");
  readonly isRestaurant = computed(() => this.role() === "restaurant");
  readonly isAdmin = computed(() => ["admin", "super_admin", "delivery_admin"].includes(this.role()));
  readonly isSuperAdmin = computed(() => this.role() === "super_admin");
  readonly isDeliveryAdmin = computed(() => this.role() === "delivery_admin");

  constructor(private router: Router) {}

  setSession(token: string, role: string, name?: string, uid?: string) {
    this.token.set(token);
    this.role.set(role);
    if (name) this.userName.set(name);
    if (uid) this.userId.set(uid);
    localStorage.setItem("ak_token", token);
    localStorage.setItem("ak_role", role);
    if (name) localStorage.setItem("ak_name", name);
    if (uid) localStorage.setItem("ak_uid", uid);
  }

  logout() {
    this.token.set("");
    this.role.set("");
    this.userName.set("");
    this.userId.set("");
    localStorage.removeItem("ak_token");
    localStorage.removeItem("ak_role");
    localStorage.removeItem("ak_name");
    localStorage.removeItem("ak_uid");
    this.router.navigate(["/auth"]);
  }

  navigateAfterLogin(): void {
    const role = this.role();
    if (role === "customer") this.router.navigate(["/customer/home"]);
    else if (role === "driver") this.router.navigate(["/driver"]);
    else if (role === "restaurant") this.router.navigate(["/restaurant"]);
    else if (role === "delivery_admin") this.router.navigate(["/admin/delivery"]);
    else this.router.navigate(["/admin"]);
  }
}

import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Loader } from "@googlemaps/js-api-loader";
import { io } from "socket.io-client";
import { ApiService } from "./services/api.service";
import { environment } from "./environments/environment";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./app.html",
  styleUrl: "./styles.css"
})
class AppComponent implements AfterViewInit {
  private api = inject(ApiService);
  @ViewChild("map", { static: true }) mapElement!: ElementRef<HTMLDivElement>;
  phone = "";
  otp = "";
  role = "customer";
  restaurantName = "";
  restaurantAddress = "";
  restaurantContactName = "";
  restaurantContactPhone = "";
  restaurantCuisineType = "";
  restaurantFssaiLicense = "";
  restaurantGstNumber = "";
  restaurantBankAccountLast4 = "";
  menuItemName = "";
  menuItemPricePaise = 0;
  selectedRestaurantId = "";
  selectedDriverId = "";
  token = signal("");
  orderId = signal("");
  editDeliveryAddress = "Updated demo delivery address";
  cancelReason = "Customer requested cancellation";
  refundReason = "Order cancelled by customer";
  partialRefundAmountPaise = 0;
  orderDetails = signal<{
    id: string;
    status: string;
    total_paise: number;
    delivery_address: string;
    estimated_delivery_at: string | null;
    driver_phone: string | null;
    driver_name: string | null;
    history: Array<{ status: string; note: string; created_at: string }>;
  } | null>(null);
  latestLocation = signal("Waiting for driver location");
  driverOrders = signal<Array<{
    id: string;
    status: string;
    total_paise: number;
    delivery_address: string;
    restaurant_name: string;
    restaurant_address: string;
  }>>([]);
  activeDeliveryOrder = signal("");
  driverLat = 28.6139;
  driverLng = 77.209;
  adminDashboard = signal<{
    users: number;
    ordersByStatus: Array<{ status: string; count: number }>;
    revenuePaise: number;
    payments: Array<{ provider: string; status: string; count: number }>;
    recentOrders: Array<{ id: string; status: string; total_paise: number; restaurant_name: string; created_at: string }>;
  } | null>(null);
  adminRestaurants = signal<Array<{ id: string; name: string; address: string; approval_status: string }>>([]);
  adminUsers = signal<Array<{ id: string; phone: string; email: string; name: string; role: string }>>([]);
  paymentReports = signal<Array<{ provider: string; status: string; transactions: number; amount_paise: number }>>([]);
  adminAllOrders = signal<Array<{ id: string; status: string; total_paise: number; restaurant_name: string; customer_phone: string; driver_phone: string }>>([]);
  platformAnalytics = signal<{ dailyOrders: unknown[]; topRestaurants: unknown[]; driverStats: unknown[] } | null>(null);
  restaurantAccounts = signal<Array<{ id: string; name: string; address: string; approval_status: string; onboarding_status: string }>>([]);
  restaurantOrders = signal<Array<{ id: string; status: string; total_paise: number }>>([]);
  restaurantEarnings = signal<{ orders: string; gross_paise: string; estimated_payout_paise: string } | null>(null);
  deliveryAdminOrders = signal<Array<{
    id: string;
    status: string;
    restaurant_name: string;
    driver_phone: string;
    last_driver_lat: string | null;
    last_driver_lng: string | null;
    last_location_at: string | null;
  }>>([]);
  deliveryDrivers = signal<Array<{ id: string; phone: string; name: string }>>([]);
  private map?: google.maps.Map;
  private marker?: google.maps.Marker;

  ngAfterViewInit() {
    if (!environment.googleMapsApiKey) {
      return;
    }

    new Loader({ apiKey: environment.googleMapsApiKey, version: "weekly" }).load().then(() => {
      const center = { lat: 28.6139, lng: 77.209 };
      this.map = new google.maps.Map(this.mapElement.nativeElement, {
        center,
        zoom: 13,
        disableDefaultUI: true
      });
      this.marker = new google.maps.Marker({ map: this.map, position: center });
    });
  }

  requestOtp() {
    this.api.requestOtp(this.phone).subscribe(response => {
      alert(response.devCode ? `Dev OTP: ${response.devCode}` : "OTP sent");
    });
  }

  verifyOtp() {
    this.api.verifyOtp(this.phone, this.otp, this.role).subscribe(response => {
      this.token.set(response.token);
      this.api.token = response.token;
      if (this.role === "admin") {
        this.loadAdminDashboard();
      }
      if (this.role === "super_admin") {
        this.loadSuperAdmin();
      }
      if (this.role === "driver") {
        this.loadDeliveryOrders();
      }
      if (this.role === "restaurant") {
        this.loadRestaurantAdmin();
      }
      if (this.role === "delivery_admin") {
        this.loadDeliveryAdmin();
      }
    });
  }

  createDemoOrder() {
    this.api.createOrder().subscribe(order => {
      this.orderId.set(order.id);
      this.watchOrder(order.id);
      this.loadOrderDetails();
    });
  }

  loadOrderDetails() {
    const orderId = this.orderId();
    if (!orderId) {
      return;
    }

    this.api.getOrder(orderId).subscribe(order => {
      this.orderDetails.set(order);
    });
  }

  editActiveOrder() {
    const orderId = this.orderId();
    if (!orderId) {
      return;
    }

    this.api.editOrderBeforeConfirmation(orderId, this.editDeliveryAddress).subscribe(() => {
      this.loadOrderDetails();
    });
  }

  cancelActiveOrder() {
    const orderId = this.orderId();
    if (!orderId) {
      return;
    }

    this.api.cancelOrder(orderId, this.cancelReason).subscribe(() => {
      this.loadOrderDetails();
    });
  }

  reorderActiveOrder() {
    const orderId = this.orderId();
    if (!orderId) {
      return;
    }

    this.api.reorder(orderId).subscribe(order => {
      this.orderId.set(order.id);
      this.watchOrder(order.id);
      this.loadOrderDetails();
    });
  }

  startPayment(provider: "paytm" | "phonepe") {
    this.api.createPayment(provider, this.orderId()).subscribe(response => {
      console.log(response);
      alert(`${provider} payment initialized. Check console for gateway payload.`);
    });
  }

  requestRefund() {
    const orderId = this.orderId();
    if (!orderId) {
      return;
    }

    const amountPaise = this.partialRefundAmountPaise > 0 ? this.partialRefundAmountPaise : undefined;
    this.api.requestRefund(orderId, this.refundReason, amountPaise).subscribe(response => {
      console.log("Refund request", response);
      alert("Refund request recorded.");
    });
  }

  callDriver() {
    const phone = this.orderDetails()?.driver_phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }

  loadAdminDashboard() {
    this.api.adminDashboard().subscribe(dashboard => {
      this.adminDashboard.set(dashboard);
    });
  }

  loadSuperAdmin() {
    this.loadAdminDashboard();
    this.api.adminRestaurants().subscribe(restaurants => this.adminRestaurants.set(restaurants));
    this.api.adminUsers().subscribe(users => this.adminUsers.set(users));
    this.api.adminAllOrders().subscribe(orders => this.adminAllOrders.set(orders));
    this.api.paymentReports().subscribe(reports => this.paymentReports.set(reports));
    this.api.platformAnalytics().subscribe(analytics => this.platformAnalytics.set(analytics));
  }

  updateRestaurantApproval(id: string, status: "approved" | "rejected" | "pending") {
    this.api.updateRestaurantApproval(id, status).subscribe(() => this.loadSuperAdmin());
  }

  loadRestaurantAdmin() {
    this.api.myRestaurants().subscribe(restaurants => {
      this.restaurantAccounts.set(restaurants);
      this.selectedRestaurantId = restaurants[0]?.id ?? "";
      if (this.selectedRestaurantId) {
        this.loadRestaurantOperations();
      }
    });
  }

  createRestaurant() {
    this.api.onboardRestaurant({
      name: this.restaurantName,
      address: this.restaurantAddress,
      contactName: this.restaurantContactName,
      contactPhone: this.restaurantContactPhone,
      cuisineType: this.restaurantCuisineType,
      fssaiLicense: this.restaurantFssaiLicense || undefined,
      gstNumber: this.restaurantGstNumber || undefined,
      bankAccountLast4: this.restaurantBankAccountLast4 || undefined
    }).subscribe(() => {
      this.restaurantName = "";
      this.restaurantAddress = "";
      this.restaurantContactName = "";
      this.restaurantContactPhone = "";
      this.restaurantCuisineType = "";
      this.restaurantFssaiLicense = "";
      this.restaurantGstNumber = "";
      this.restaurantBankAccountLast4 = "";
      this.loadRestaurantAdmin();
    });
  }

  loadRestaurantOperations() {
    if (!this.selectedRestaurantId) {
      return;
    }
    this.api.restaurantOrders(this.selectedRestaurantId).subscribe(orders => this.restaurantOrders.set(orders));
    this.api.restaurantEarnings(this.selectedRestaurantId).subscribe(earnings => this.restaurantEarnings.set(earnings));
  }

  addMenuItem() {
    if (!this.selectedRestaurantId) {
      return;
    }
    this.api.createMenuItem(this.selectedRestaurantId, this.menuItemName, this.menuItemPricePaise).subscribe(() => {
      this.menuItemName = "";
      this.menuItemPricePaise = 0;
    });
  }

  decideOrder(orderId: string, decision: "accepted" | "cancelled") {
    this.api.decideRestaurantOrder(orderId, decision).subscribe(() => this.loadRestaurantOperations());
  }

  loadDeliveryAdmin() {
    this.api.deliveryAdminOrders().subscribe(orders => this.deliveryAdminOrders.set(orders));
    this.api.deliveryDrivers().subscribe(drivers => this.deliveryDrivers.set(drivers));
  }

  assignDriver(orderId: string) {
    if (!this.selectedDriverId) {
      return;
    }
    this.api.assignDriver(orderId, this.selectedDriverId).subscribe(() => this.loadDeliveryAdmin());
  }

  trackDeliveryAdminOrder(order: {
    id: string;
    last_driver_lat: string | null;
    last_driver_lng: string | null;
  }) {
    this.orderId.set(order.id);
    this.watchOrder(order.id);

    if (order.last_driver_lat && order.last_driver_lng) {
      const lat = Number(order.last_driver_lat);
      const lng = Number(order.last_driver_lng);
      this.latestLocation.set(`${lat}, ${lng}`);
      this.updateMap(lat, lng);
    }
  }

  loadDeliveryOrders() {
    this.api.availableDeliveryOrders().subscribe(orders => {
      this.driverOrders.set(orders);
    });
  }

  acceptDelivery(orderId: string) {
    this.api.acceptDeliveryOrder(orderId).subscribe(() => {
      this.activeDeliveryOrder.set(orderId);
      this.orderId.set(orderId);
      this.watchOrder(orderId);
      this.loadDeliveryOrders();
    });
  }

  updateDeliveryStatus(status: "picked_up" | "delivered") {
    const orderId = this.activeDeliveryOrder();
    if (!orderId) {
      return;
    }

    this.api.updateOrderStatus(orderId, status).subscribe(() => {
      if (status === "delivered") {
        this.activeDeliveryOrder.set("");
      }
    });
  }

  shareDriverLocation() {
    const orderId = this.activeDeliveryOrder();
    if (!orderId) {
      return;
    }

    this.api.sendDriverLocation(orderId, this.driverLat, this.driverLng).subscribe(() => {
      this.latestLocation.set(`${this.driverLat}, ${this.driverLng}`);
      this.updateMap(this.driverLat, this.driverLng);
    });
  }

  formatCurrency(paise: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR"
    }).format(paise / 100);
  }

  watchOrder(orderId: string) {
    const socket = io(this.api.baseUrl);
    socket.emit("order:join", orderId);
    socket.on("driver:location", location => {
      this.latestLocation.set(`${location.lat}, ${location.lng}`);
      this.updateMap(Number(location.lat), Number(location.lng));
    });
    socket.on("order:update", order => {
      console.log("Order update", order);
      this.loadOrderDetails();
    });
  }

  private updateMap(lat: number, lng: number) {
    if (!this.map || !this.marker) {
      return;
    }

    const position = { lat, lng };
    this.marker.setPosition(position);
    this.map.panTo(position);
  }
}

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient()]
}).catch(error => console.error(error));

import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Loader } from "@googlemaps/js-api-loader";
import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
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
  @ViewChild("googleButton", { static: true }) googleButtonElement!: ElementRef<HTMLDivElement>;
  phone = "";
  otp = "";
  role = "customer";
  authNotice = signal("Use OTP or Google Sign-In to continue.");
  mapNotice = signal("Add a Google Maps browser key to enable the live delivery map.");
  pushNotice = signal("Enable push notifications after login.");
  restaurantName = "";
  restaurantAddress = "";
  restaurantContactName = "";
  restaurantContactPhone = "";
  restaurantCuisineType = "";
  restaurantFssaiLicense = "";
  restaurantGstNumber = "";
  restaurantBankAccountLast4 = "";
  menuItemName = "";
  menuItemDescription = "";
  menuItemPricePaise = 0;
  menuItemPhotoUrl = "";
  menuItemIsVeg = true;
  menuItemCuisineType = "";
  menuItemRating = 0;
  searchText = "";
  searchCuisine = "";
  searchDiet: "all" | "veg" | "non_veg" = "all";
  searchMinRating = 3;
  searchMaxPricePaise = 0;
  searchSort: "rating_desc" | "distance" | "price_asc" | "price_desc" = "rating_desc";
  searchLat = 28.6139;
  searchLng = 77.209;
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
    delivery_lat: string;
    delivery_lng: string;
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
    delivery_lat: string;
    delivery_lng: string;
    restaurant_name: string;
    restaurant_address: string;
    restaurant_lat: string | null;
    restaurant_lng: string | null;
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
  delhiNcrPlaces = signal<Array<{
    googlePlaceId: string;
    name: string;
    address: string;
    rating: number;
    photoUrl: string | null;
    lat: number;
    lng: number;
  }>>([]);
  restaurantSearchResults = signal<Array<{
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
  }>>([]);
  trendingRestaurants = signal<Array<{
    id: string;
    name: string;
    address: string;
    cuisine_type: string | null;
    lat: string | null;
    lng: string | null;
    recent_orders: number;
    rating: string | null;
    starting_price_paise: number | null;
    photo_url: string | null;
    distance_km: string | null;
    trending_score: string;
    historical_eta_minutes: number;
    predicted_eta_minutes: number;
  }>>([]);
  routeEta = signal<{
    predictedEtaMinutes: number;
    predictedDeliveryAt: string;
    route: {
      origin: { lat: number; lng: number };
      pickup: { lat: number; lng: number };
      dropoff: { lat: number; lng: number };
      distanceToPickupKm: number;
      distanceToDropoffKm: number;
    };
  } | null>(null);
  navigationNotice = signal("Route navigation will appear after an order is active.");
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
  private directionsService?: google.maps.DirectionsService;
  private directionsRenderer?: google.maps.DirectionsRenderer;

  ngAfterViewInit() {
    this.initializeGoogleLogin();

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
      this.directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer({ map: this.map, suppressMarkers: false });
      this.mapNotice.set("Live delivery map ready. Tracking updates will pan to the driver.");
      this.navigationNotice.set("Google Maps route navigation is ready.");
    });
  }

  requestOtp() {
    this.api.requestOtp(this.phone).subscribe(response => {
      alert(response.devCode ? `Dev OTP: ${response.devCode}` : "OTP sent");
    });
  }

  verifyOtp() {
    this.api.verifyOtp(this.phone, this.otp, this.role).subscribe(response => {
      this.completeLogin(response.token, "OTP login successful.");
    });
  }

  private initializeGoogleLogin() {
    if (!environment.googleClientId) {
      this.authNotice.set("OTP is ready. Add a Google client ID to enable Google Sign-In.");
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as unknown as { google?: {
        accounts: {
          id: {
            initialize: (options: unknown) => void;
            renderButton: (element: HTMLElement, options: unknown) => void;
          };
        };
      } }).google;

      google?.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (credentialResponse: { credential: string }) => {
          this.api.googleLogin(credentialResponse.credential, this.role).subscribe(response => {
            this.completeLogin(response.token, "Google login successful.");
          });
        }
      });

      google?.accounts.id.renderButton(this.googleButtonElement.nativeElement, {
        theme: "outline",
        size: "large",
        width: 280
      });
      this.authNotice.set("OTP and Google Sign-In are ready.");
    };
    document.head.appendChild(script);
  }

  private completeLogin(token: string, notice: string) {
    this.token.set(token);
    this.api.token = token;
    this.authNotice.set(notice);
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
    if (this.role === "customer") {
      this.searchRestaurants();
      this.loadTrendingRestaurants();
    }
  }

  async enablePushNotifications() {
    if (!this.token()) {
      this.pushNotice.set("Log in before enabling push notifications.");
      return;
    }
    if (!environment.firebaseVapidKey || !environment.firebase.projectId) {
      this.pushNotice.set("Add Firebase web config and VAPID key to enable push notifications.");
      return;
    }
    if (!(await isSupported())) {
      this.pushNotice.set("This browser does not support Firebase web messaging.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      this.pushNotice.set("Push notification permission was not granted.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const app = getApps()[0] ?? initializeApp(environment.firebase);
    const messaging = getMessaging(app);
    const deviceToken = await getToken(messaging, {
      vapidKey: environment.firebaseVapidKey,
      serviceWorkerRegistration: registration
    });

    this.api.registerDeviceToken(deviceToken).subscribe(() => {
      this.pushNotice.set("Push notifications enabled for this browser.");
    });
  }

  sendTestNotification() {
    this.api.sendTestNotification().subscribe(() => {
      this.pushNotice.set("Test push notification sent.");
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
      this.loadOrderEta();
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

  loadDelhiNcrPlaces() {
    this.api.googlePlacesDelhiNcrRestaurants(3).subscribe(response => {
      this.delhiNcrPlaces.set(response.restaurants);
    });
  }

  addMenuItem() {
    if (!this.selectedRestaurantId) {
      return;
    }
    this.api.createMenuItem(this.selectedRestaurantId, {
      name: this.menuItemName,
      description: this.menuItemDescription || undefined,
      pricePaise: this.menuItemPricePaise,
      photoUrl: this.menuItemPhotoUrl || undefined,
      isVeg: this.menuItemIsVeg,
      cuisineType: this.menuItemCuisineType || undefined,
      rating: this.menuItemRating > 0 ? this.menuItemRating : undefined
    }).subscribe(() => {
      this.menuItemName = "";
      this.menuItemDescription = "";
      this.menuItemPricePaise = 0;
      this.menuItemPhotoUrl = "";
      this.menuItemRating = 0;
    });
  }

  importPlacesAsMenu() {
    if (!this.selectedRestaurantId || this.delhiNcrPlaces().length === 0) {
      return;
    }

    const cuisineType = this.menuItemCuisineType || this.restaurantCuisineType || "Delhi NCR";
    const items = this.delhiNcrPlaces().map(place => ({
      name: place.name,
      description: place.address,
      pricePaise: this.menuItemPricePaise > 0 ? this.menuItemPricePaise : 19900,
      photoUrl: place.photoUrl || undefined,
      isVeg: this.menuItemIsVeg,
      cuisineType,
      rating: place.rating,
      googlePlaceId: place.googlePlaceId
    }));

    this.api.importMenuItems(this.selectedRestaurantId, items).subscribe(() => {
      this.loadRestaurantOperations();
    });
  }

  searchRestaurants() {
    const maxPricePaise = this.searchMaxPricePaise > 0 ? this.searchMaxPricePaise : undefined;
    this.api.searchRestaurants({
      q: this.searchText || undefined,
      cuisine: this.searchCuisine || undefined,
      diet: this.searchDiet,
      minRating: this.searchMinRating > 0 ? this.searchMinRating : undefined,
      maxPricePaise,
      sort: this.searchSort,
      lat: this.searchSort === "distance" ? this.searchLat : undefined,
      lng: this.searchSort === "distance" ? this.searchLng : undefined
    }).subscribe(results => {
      this.restaurantSearchResults.set(results);
    });
  }

  loadTrendingRestaurants() {
    this.api.trendingRestaurants(this.searchLat, this.searchLng).subscribe(restaurants => {
      this.trendingRestaurants.set(restaurants);
    });
  }

  loadOrderEta() {
    const orderId = this.orderId();
    if (!orderId) {
      return;
    }

    this.api.orderEta(orderId).subscribe(eta => {
      this.routeEta.set(eta);
      this.navigationNotice.set(`Predicted delivery ETA: ${eta.predictedEtaMinutes} minutes.`);
    });
  }

  drawOrderRoute() {
    const eta = this.routeEta();
    if (!eta || !this.directionsService || !this.directionsRenderer) {
      this.navigationNotice.set("Add a Google Maps browser key and load an order before drawing the route.");
      return;
    }

    this.directionsService.route({
      origin: eta.route.origin,
      destination: eta.route.dropoff,
      waypoints: [{ location: eta.route.pickup, stopover: true }],
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        this.directionsRenderer?.setDirections(result);
        const legMinutes = result.routes[0]?.legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0) ?? 0;
        const minutes = Math.ceil(legMinutes / 60);
        this.navigationNotice.set(minutes > 0 ? `Google route drawn. Driving time: ${minutes} minutes.` : "Google route drawn.");
        return;
      }

      this.navigationNotice.set(`Google route could not be drawn: ${status}`);
    });
  }

  openGoogleNavigation() {
    const eta = this.routeEta();
    if (!eta) {
      this.navigationNotice.set("Load ETA before opening navigation.");
      return;
    }

    const origin = `${eta.route.origin.lat},${eta.route.origin.lng}`;
    const waypoint = `${eta.route.pickup.lat},${eta.route.pickup.lng}`;
    const destination = `${eta.route.dropoff.lat},${eta.route.dropoff.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoint)}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
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

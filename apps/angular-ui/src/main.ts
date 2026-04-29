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
  token = signal("");
  orderId = signal("");
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
      if (this.role === "driver") {
        this.loadDeliveryOrders();
      }
    });
  }

  createDemoOrder() {
    this.api.createOrder().subscribe(order => {
      this.orderId.set(order.id);
      this.watchOrder(order.id);
    });
  }

  startPayment(provider: "paytm" | "phonepe") {
    this.api.createPayment(provider, this.orderId()).subscribe(response => {
      console.log(response);
      alert(`${provider} payment initialized. Check console for gateway payload.`);
    });
  }

  loadAdminDashboard() {
    this.api.adminDashboard().subscribe(dashboard => {
      this.adminDashboard.set(dashboard);
    });
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

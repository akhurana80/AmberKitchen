import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { io } from "socket.io-client";
import { ApiService } from "./services/api.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./app.html",
  styleUrl: "./styles.css"
})
class AppComponent {
  private api = inject(ApiService);
  phone = "";
  otp = "";
  token = signal("");
  orderId = signal("");
  latestLocation = signal("Waiting for driver location");

  requestOtp() {
    this.api.requestOtp(this.phone).subscribe(response => {
      alert(response.devCode ? `Dev OTP: ${response.devCode}` : "OTP sent");
    });
  }

  verifyOtp() {
    this.api.verifyOtp(this.phone, this.otp).subscribe(response => {
      this.token.set(response.token);
      this.api.token = response.token;
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

  watchOrder(orderId: string) {
    const socket = io(this.api.baseUrl);
    socket.emit("order:join", orderId);
    socket.on("driver:location", location => {
      this.latestLocation.set(`${location.lat}, ${location.lng}`);
    });
    socket.on("order:update", order => {
      console.log("Order update", order);
    });
  }
}

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient()]
}).catch(error => console.error(error));

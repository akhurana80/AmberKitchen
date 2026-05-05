import { Component, inject, signal, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";
import { environment } from "../../environments/environment";

type Role = "customer" | "driver" | "restaurant" | "admin" | "super_admin" | "delivery_admin";

@Component({
  selector: "app-auth-page",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">🍳</div>
          <div class="auth-logo-title">AmberKitchen</div>
          <div class="auth-logo-sub">India's smartest cloud kitchen platform</div>
        </div>

        @if (step() === 'phone') {
          <div class="mb-16">
            <div class="form-group mb-16">
              <label class="form-label">Mobile Number</label>
              <div class="phone-field">
                <span class="phone-prefix">🇮🇳 +91</span>
                <input class="phone-input" [(ngModel)]="phone" placeholder="9999 999 999" maxlength="10" type="tel" (keyup.enter)="sendOtp()">
              </div>
            </div>

            <div class="form-group mb-16">
              <label class="form-label">Sign in as</label>
              <div class="role-grid">
                @for (r of roles; track r.value) {
                  <button class="role-chip" [class.active]="role === r.value" (click)="role = r.value">
                    <span class="role-emoji">{{ r.emoji }}</span>
                    <span>{{ r.label }}</span>
                  </button>
                }
              </div>
            </div>

            <button class="btn btn-primary btn-full btn-lg" (click)="sendOtp()" [disabled]="loading() || phone.length < 10">
              @if (loading()) { <span class="spinner spinner-sm"></span> }
              Send OTP
            </button>

            @if (environment.googleClientId) {
              <div class="divider-or mt-24 mb-16">or</div>
              <div #googleButton class="flex justify-center"></div>
            }
          </div>
        }

        @if (step() === 'otp') {
          <div>
            <div class="alert alert-info mb-16">
              OTP sent to +91 {{ phone }}
            </div>
            <div class="form-group mb-24">
              <label class="form-label">Enter 6-digit OTP</label>
              <div class="otp-row">
                <input class="otp-digit form-input" [(ngModel)]="otp" maxlength="6" placeholder="------" type="text" (keyup.enter)="verifyOtp()">
              </div>
              @if (devOtp()) {
                <span class="text-sm text-muted mt-8 flex items-center gap-4">
                  <span>Dev OTP:</span>
                  <strong>{{ devOtp() }}</strong>
                  <button class="btn btn-sm btn-secondary" (click)="otp = devOtp()">Use it</button>
                </span>
              }
            </div>
            <button class="btn btn-primary btn-full btn-lg" (click)="verifyOtp()" [disabled]="loading() || otp.length < 6">
              @if (loading()) { <span class="spinner spinner-sm"></span> }
              Verify & Continue
            </button>
            <button class="btn btn-ghost btn-full mt-8" (click)="step.set('phone')">← Back</button>
          </div>
        }
      </div>

      <p class="text-muted text-sm mt-24" style="text-align:center">
        By continuing you agree to AmberKitchen's Terms & Privacy Policy
      </p>
    </div>
  `
})
export class AuthPage implements AfterViewInit {
  @ViewChild("googleButton") googleButtonRef!: ElementRef<HTMLDivElement>;

  private api = inject(ApiService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  environment = environment;

  phone = "";
  otp = "";
  role: Role = "customer";
  step = signal<"phone" | "otp">("phone");
  loading = signal(false);
  devOtp = signal("");

  roles: Array<{ value: Role; label: string; emoji: string }> = [
    { value: "customer", label: "Customer", emoji: "🛒" },
    { value: "driver", label: "Driver", emoji: "🚴" },
    { value: "restaurant", label: "Restaurant", emoji: "🍽️" },
    { value: "admin", label: "Admin", emoji: "⚙️" },
    { value: "super_admin", label: "Super Admin", emoji: "👑" },
    { value: "delivery_admin", label: "Delivery Admin", emoji: "📦" }
  ];

  ngAfterViewInit() {
    this.initGoogleLogin();
    if (this.authService.isLoggedIn()) {
      this.authService.navigateAfterLogin();
    }
  }

  sendOtp() {
    if (this.phone.length < 10) return;
    this.loading.set(true);
    const fullPhone = "+91" + this.phone.replace(/\D/g, "");
    this.api.requestOtp(fullPhone).subscribe({
      next: res => {
        this.loading.set(false);
        this.step.set("otp");
        if (res.devCode) {
          this.devOtp.set(res.devCode);
          this.toast.info(`Dev OTP: ${res.devCode}`);
        } else {
          this.toast.success("OTP sent to your phone!");
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Failed to send OTP. Please try again.");
      }
    });
  }

  verifyOtp() {
    if (this.otp.length < 6) return;
    this.loading.set(true);
    const fullPhone = "+91" + this.phone.replace(/\D/g, "");
    this.api.verifyOtp(fullPhone, this.otp, this.role).subscribe({
      next: res => {
        this.loading.set(false);
        this.handleLogin(res.token, this.role);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Invalid OTP. Please check and try again.");
      }
    });
  }

  private handleLogin(token: string, role: string) {
    this.authService.setSession(token, role);
    this.toast.success(`Welcome! Signed in as ${role.replace("_", " ")}.`);
    this.authService.navigateAfterLogin();
  }

  private initGoogleLogin() {
    if (!environment.googleClientId || !this.googleButtonRef?.nativeElement) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const g = (window as unknown as { google?: { accounts: { id: { initialize: (o: unknown) => void; renderButton: (el: HTMLElement, o: unknown) => void } } } }).google;
      g?.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (r: { credential: string }) => {
          this.api.googleLogin(r.credential, this.role).subscribe({
            next: res => this.handleLogin(res.token, this.role),
            error: () => this.toast.error("Google sign-in failed. Try OTP instead.")
          });
        }
      });
      g?.accounts.id.renderButton(this.googleButtonRef.nativeElement, {
        theme: "outline", size: "large", width: 330
      });
    };
    document.head.appendChild(script);
  }
}

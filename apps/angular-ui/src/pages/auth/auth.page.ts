import { Component, inject, signal, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
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

        <!-- Already logged in banner -->
        @if (alreadyLoggedIn()) {
          <div class="card mb-16" style="border:2px solid var(--primary);text-align:center">
            <div class="card-body">
              <div style="font-size:32px;margin-bottom:8px">👋</div>
              <div class="font-bold mb-4">You're signed in as <span style="color:var(--primary)">{{ auth.role().replace('_', ' ') | titlecase }}</span></div>
              <div class="text-muted text-sm mb-16">{{ auth.userName() || 'Welcome back!' }}</div>
              <button class="btn btn-primary btn-full mb-8" (click)="continueSession()">Continue →</button>
              <button class="btn btn-ghost btn-full btn-sm" (click)="signOut()">Sign out & use a different account</button>
            </div>
          </div>
        }

        @if (!alreadyLoggedIn()) {
          @if (step() === 'phone') {
            <div class="mb-16">
              <div class="form-group mb-16">
                <label class="form-label">Mobile Number</label>
                <div class="phone-field">
                  <span class="phone-prefix">🇮🇳 +91</span>
                  <input #phoneInput class="phone-input" [(ngModel)]="phone" placeholder="10-digit number" maxlength="10"
                    type="tel" inputmode="numeric" pattern="[0-9]*"
                    (input)="onPhoneInput($event)"
                    (keyup.enter)="sendOtp()">
                </div>
                @if (phone.length > 0 && digits().length < 10) {
                  <div class="text-sm mt-4" style="color:var(--danger)">Enter 10 digits ({{ digits().length }}/10)</div>
                }
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

              <button class="btn btn-primary btn-full btn-lg" (click)="sendOtp()" [disabled]="loading() || digits().length < 10">
                @if (loading()) { <span class="spinner spinner-sm"></span> }
                @if (!loading()) { Send OTP }
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
                OTP sent to <strong>+91 {{ phone }}</strong>
              </div>
              <div class="form-group mb-24">
                <label class="form-label">Enter 6-digit OTP</label>
                <input class="form-input" [(ngModel)]="otp" maxlength="6" placeholder="Enter OTP"
                  type="text" inputmode="numeric" pattern="[0-9]*"
                  style="font-size:24px;letter-spacing:8px;text-align:center"
                  (keyup.enter)="verifyOtp()">
                @if (devOtp()) {
                  <div class="text-sm text-muted mt-8" style="display:flex;align-items:center;gap:8px">
                    <span>Dev OTP: <strong>{{ devOtp() }}</strong></span>
                    <button class="btn btn-sm btn-secondary" (click)="otp = devOtp()">Use it</button>
                  </div>
                }
              </div>
              <button class="btn btn-primary btn-full btn-lg" (click)="verifyOtp()" [disabled]="loading() || otp.length < 6">
                @if (loading()) { <span class="spinner spinner-sm"></span> }
                @if (!loading()) { Verify & Sign In }
              </button>
              <button class="btn btn-ghost btn-full mt-8" (click)="step.set('phone')">← Change number</button>
            </div>
          }
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
  auth = inject(AuthService);
  private toast = inject(ToastService);

  environment = environment;

  phone = "";
  otp = "";
  role: Role = "customer";
  step = signal<"phone" | "otp">("phone");
  loading = signal(false);
  devOtp = signal("");
  alreadyLoggedIn = signal(false);

  roles: Array<{ value: Role; label: string; emoji: string }> = [
    { value: "customer", label: "Customer", emoji: "🛒" },
    { value: "driver", label: "Driver", emoji: "🚴" },
    { value: "restaurant", label: "Restaurant", emoji: "🍽️" },
    { value: "admin", label: "Admin", emoji: "⚙️" },
    { value: "super_admin", label: "Super Admin", emoji: "👑" },
    { value: "delivery_admin", label: "Delivery Admin", emoji: "📦" }
  ];

  digits() {
    return this.phone.replace(/\D/g, "");
  }

  onPhoneInput(e: Event) {
    const val = (e.target as HTMLInputElement).value.replace(/\D/g, "");
    this.phone = val.slice(0, 10);
    (e.target as HTMLInputElement).value = this.phone;
  }

  ngAfterViewInit() {
    if (this.auth.isLoggedIn()) {
      this.alreadyLoggedIn.set(true);
    }
    this.initGoogleLogin();
  }

  continueSession() {
    this.auth.navigateAfterLogin();
  }

  signOut() {
    this.auth.logout();
    this.alreadyLoggedIn.set(false);
  }

  sendOtp() {
    const d = this.digits();
    if (d.length < 10) return;
    this.loading.set(true);
    const fullPhone = "+91" + d;
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
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.error?.error || "Failed to send OTP. Is the backend running?";
        this.toast.error(msg);
      }
    });
  }

  verifyOtp() {
    if (this.otp.length < 6) return;
    this.loading.set(true);
    const fullPhone = "+91" + this.digits();
    this.api.verifyOtp(fullPhone, this.otp, this.role).subscribe({
      next: res => {
        this.loading.set(false);
        this.handleLogin(res.token, this.role);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.error?.error || "Invalid OTP. Please check and try again.";
        this.toast.error(msg);
      }
    });
  }

  private handleLogin(token: string, role: string) {
    this.authService.setSession(token, role);
    this.toast.success(`Welcome! Signed in as ${role.replace(/_/g, " ")}.`);
    this.authService.navigateAfterLogin();
  }

  private get authService() { return this.auth; }

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

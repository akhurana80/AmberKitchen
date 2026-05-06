import { Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../services/api.service";
import { CartService } from "../../services/cart.service";
import { AuthService } from "../../services/auth.service";
import { ToastService } from "../../services/toast.service";

type PaymentProvider = "phonepe" | "razorpay" | "paytm";

@Component({
  selector: "app-checkout",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container" style="padding-top:24px;max-width:640px">
        <button class="btn btn-ghost btn-sm mb-16" (click)="router.navigate(['/customer/home'])">← Continue Shopping</button>

        <div class="page-header">
          <div class="page-title">Checkout</div>
          <div class="page-subtitle">Review your order and choose payment</div>
        </div>

        @if (cart.isEmpty()) {
          <div class="empty-state">
            <div class="empty-emoji">🛒</div>
            <div class="empty-title">Your cart is empty</div>
            <div class="empty-desc">Add some delicious food to get started</div>
            <button class="btn btn-primary mt-16" (click)="router.navigate(['/customer/home'])">Browse Restaurants</button>
          </div>
        } @else {
          <!-- Cart Items -->
          <div class="cart-wrap mb-24">
            <div class="cart-header">
              <div>
                <div class="font-bold">{{ cart.restaurantName() }}</div>
                <div class="text-sm text-muted">{{ cart.totalItems() }} item{{ cart.totalItems() > 1 ? 's' : '' }}</div>
              </div>
              <button class="btn btn-danger btn-sm" (click)="cart.clear()">Clear Cart</button>
            </div>

            @for (item of cart.items(); track item.menuItemId) {
              <div class="cart-item">
                <div class="flex items-center gap-8 shrink-0">
                  @if (item.isVeg === true) { <span class="veg-dot"></span> }
                  @else if (item.isVeg === false) { <span class="nonveg-dot"></span> }
                </div>
                <div class="cart-item-name flex-1">{{ item.name }}</div>
                <div class="qty-control" style="margin:0 8px">
                  <button class="qty-btn" (click)="cart.removeItem(item.menuItemId)">−</button>
                  <span class="qty-value">{{ item.quantity }}</span>
                  <button class="qty-btn" (click)="addMore(item)">+</button>
                </div>
                <div class="cart-item-price">{{ fmt(item.pricePaise * item.quantity) }}</div>
              </div>
            }

            <div class="cart-total">
              <div class="cart-total-label">Subtotal</div>
              <div class="cart-total-value">{{ fmt(cart.totalPaise()) }}</div>
            </div>
          </div>

          <!-- Delivery Address -->
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">📍 Delivery Address</div>
              <div class="form-group">
                <label class="form-label">Full Address</label>
                <textarea class="form-textarea" [value]="cart.deliveryAddress()" rows="2"
                  (input)="onAddressChange($event)" placeholder="Enter your delivery address"></textarea>
              </div>
            </div>
          </div>

          <!-- Payment Method -->
          <div class="card mb-24">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">💳 Payment Method</div>
              <div class="payment-methods">
                @for (p of paymentOptions; track p.id) {
                  <div class="payment-card" [class.selected]="selectedPayment === p.id" (click)="selectedPayment = p.id">
                    <div class="payment-icon">{{ p.icon }}</div>
                    <div class="payment-name">{{ p.name }}</div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Order Summary -->
          <div class="card mb-24">
            <div class="card-body">
              <div class="flex justify-between mb-8">
                <span class="text-muted">Subtotal</span>
                <span>{{ fmt(cart.totalPaise()) }}</span>
              </div>
              <div class="flex justify-between mb-8">
                <span class="text-muted">Delivery fee</span>
                <span class="text-sm" style="color:var(--success)">FREE</span>
              </div>
              <div class="divider"></div>
              <div class="flex justify-between">
                <span class="font-bold">Total</span>
                <span class="font-bold" style="font-size:18px">{{ fmt(cart.totalPaise()) }}</span>
              </div>
            </div>
          </div>

          <!-- Place Order -->
          <button class="btn btn-primary btn-full btn-lg" (click)="placeOrder()" [disabled]="loading() || !selectedPayment">
            @if (loading()) { <span class="spinner spinner-sm"></span> }
            Place Order — {{ fmt(cart.totalPaise()) }}
          </button>
        }
      </div>
    </div>
  `
})
export class CheckoutPage {
  router = inject(Router);
  cart = inject(CartService);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  selectedPayment: PaymentProvider | "" = "razorpay";
  loading = signal(false);

  paymentOptions: Array<{ id: PaymentProvider; icon: string; name: string }> = [
    { id: "razorpay", icon: "💳", name: "Razorpay" },
    { id: "phonepe", icon: "📱", name: "PhonePe" },
    { id: "paytm", icon: "💰", name: "Paytm" }
  ];

  onAddressChange(e: Event) {
    this.cart.deliveryAddress.set((e.target as HTMLTextAreaElement).value);
  }

  addMore(item: { menuItemId: string; name: string; pricePaise: number; restaurantId: string; restaurantName: string; isVeg?: boolean | null; photoUrl?: string | null }) {
    this.cart.addItem({ ...item, quantity: 1 });
  }

  placeOrder() {
    if (this.cart.isEmpty() || !this.selectedPayment) return;

    if (!this.cart.deliveryAddress() || this.cart.deliveryAddress().trim().length < 5) {
      this.toast.error("Please enter a valid delivery address.");
      return;
    }

    this.loading.set(true);

    const items = this.cart.items().map(i => ({
      name: i.name,
      quantity: i.quantity,
      pricePaise: i.pricePaise
    }));

    this.api.createOrderWithItems(
      this.cart.restaurantId(),
      items,
      this.cart.deliveryAddress(),
      this.cart.deliveryLat(),
      this.cart.deliveryLng()
    ).subscribe({
      next: order => {
        // Attempt payment — if no gateway keys are configured the backend returns an error,
        // but the order is already created so we navigate to it either way.
        this.api.createPayment(this.selectedPayment as "paytm" | "phonepe" | "razorpay", order.id, order.totalPaise).subscribe({
          next: () => {
            this.cart.clear();
            this.loading.set(false);
            this.toast.success("Order placed successfully! 🎉");
            this.router.navigate(["/customer/orders", order.id]);
          },
          error: () => {
            this.cart.clear();
            this.loading.set(false);
            this.toast.success("Order placed! 🎉 Complete payment on the next screen.");
            this.router.navigate(["/customer/orders", order.id]);
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.error || err?.error?.message || "Failed to place order. Please try again.";
        this.toast.error(msg);
      }
    });
  }

  fmt(paise: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
  }
}

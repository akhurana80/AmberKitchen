import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../services/auth.service";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="container" style="padding-top:24px;max-width:640px">
        <div class="page-header">
          <div class="page-title">Profile & Support</div>
        </div>

        <div class="tabs">
          <button class="tab" [class.active]="tab() === 'profile'" (click)="tab.set('profile')">My Profile</button>
          <button class="tab" [class.active]="tab() === 'support'" (click)="tab.set('support')">Support</button>
          <button class="tab" [class.active]="tab() === 'review'" (click)="tab.set('review')">Write Review</button>
        </div>

        @if (tab() === 'profile') {
          <div class="card mb-16">
            <div class="card-body">
              <div class="flex items-center gap-16 mb-24">
                <div style="width:64px;height:64px;background:var(--amber);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:800;flex-shrink:0">
                  {{ auth.userName().charAt(0).toUpperCase() || 'U' }}
                </div>
                <div>
                  <div class="font-bold" style="font-size:18px">{{ auth.userName() || 'Customer' }}</div>
                  <div class="badge badge-success mt-4">{{ auth.role() }}</div>
                </div>
              </div>
              <button class="btn btn-danger btn-full" (click)="auth.logout()">Sign Out</button>
            </div>
          </div>
        }

        @if (tab() === 'support') {
          <div class="card">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">🎧 Contact Support</div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select class="form-select" [(ngModel)]="supportCategory">
                    <option value="order">Order Issue</option>
                    <option value="payment">Payment Issue</option>
                    <option value="delivery">Delivery Issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Order ID (optional)</label>
                  <input class="form-input" [(ngModel)]="supportOrderId" placeholder="Order ID">
                </div>
              </div>
              <div class="form-group mt-16">
                <label class="form-label">Subject</label>
                <input class="form-input" [(ngModel)]="supportSubject" placeholder="Brief summary of your issue">
              </div>
              <div class="form-group mt-16">
                <label class="form-label">Message</label>
                <textarea class="form-textarea" [(ngModel)]="supportMessage" rows="4" placeholder="Describe your issue in detail…"></textarea>
              </div>
              <button class="btn btn-primary mt-16" (click)="submitTicket()" [disabled]="submitting() || !supportSubject || !supportMessage">
                @if (submitting()) { <span class="spinner spinner-sm"></span> }
                Submit Ticket
              </button>
            </div>
          </div>
        }

        @if (tab() === 'review') {
          <div class="card">
            <div class="card-body">
              <div class="font-bold mb-16" style="font-size:15px">⭐ Leave a Review</div>
              <div class="form-group mb-16">
                <label class="form-label">Restaurant ID</label>
                <input class="form-input" [(ngModel)]="reviewRestaurantId" placeholder="Restaurant ID from your order">
              </div>
              <div class="form-group mb-16">
                <label class="form-label">Rating</label>
                <div class="flex gap-8">
                  @for (star of [1,2,3,4,5]; track star) {
                    <button style="font-size:28px;background:none;border:none;cursor:pointer;opacity:{{ star <= reviewRating ? 1 : 0.3 }}" (click)="reviewRating = star">⭐</button>
                  }
                </div>
              </div>
              <div class="form-group mb-16">
                <label class="form-label">Comment</label>
                <textarea class="form-textarea" [(ngModel)]="reviewComment" rows="3" placeholder="Share your experience…"></textarea>
              </div>
              <button class="btn btn-primary" (click)="submitReview()" [disabled]="submitting() || !reviewRestaurantId">
                @if (submitting()) { <span class="spinner spinner-sm"></span> }
                Submit Review
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class ProfilePage {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tab = signal<"profile" | "support" | "review">("profile");
  submitting = signal(false);

  supportCategory = "order";
  supportSubject = "";
  supportMessage = "";
  supportOrderId = "";

  reviewRestaurantId = "";
  reviewRating = 5;
  reviewComment = "";

  submitTicket() {
    if (!this.supportSubject || !this.supportMessage) return;
    this.submitting.set(true);
    this.api.createSupportTicket(this.supportCategory, this.supportSubject, this.supportMessage, this.supportOrderId || undefined)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.supportSubject = ""; this.supportMessage = ""; this.supportOrderId = "";
          this.toast.success("Support ticket submitted! We'll get back to you within 24 hours.");
        },
        error: () => { this.submitting.set(false); this.toast.error("Failed to submit ticket."); }
      });
  }

  submitReview() {
    if (!this.reviewRestaurantId) return;
    this.submitting.set(true);
    this.api.createRestaurantReview(this.reviewRestaurantId, this.reviewRating, this.reviewComment)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.reviewComment = "";
          this.toast.success("Review submitted! Thank you.");
        },
        error: () => { this.submitting.set(false); this.toast.error("Failed to submit review."); }
      });
  }
}

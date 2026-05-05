import { Component, inject } from "@angular/core";
import { ToastService } from "../services/toast.service";

@Component({
  selector: "app-toast",
  standalone: true,
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast {{ toast.type }}" (click)="toastService.dismiss(toast.id)">
          <span>{{ icon(toast.type) }}</span>
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `
})
export class ToastComponent {
  toastService = inject(ToastService);

  icon(type: string) {
    return { success: "✓", error: "✕", info: "ℹ", warning: "⚠" }[type] ?? "ℹ";
  }
}

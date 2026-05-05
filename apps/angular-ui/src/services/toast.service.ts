import { Injectable, signal } from "@angular/core";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: "root" })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;

  show(message: string, type: ToastType = "info", duration = 3500) {
    const id = ++this.nextId;
    this.toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(msg: string) { this.show(msg, "success"); }
  error(msg: string) { this.show(msg, "error"); }
  info(msg: string) { this.show(msg, "info"); }
  warning(msg: string) { this.show(msg, "warning"); }

  dismiss(id: number) {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}

import { Injectable, signal, computed } from "@angular/core";

export interface CartItem {
  menuItemId: string;
  name: string;
  pricePaise: number;
  quantity: number;
  photoUrl?: string | null;
  restaurantId: string;
  restaurantName: string;
  isVeg?: boolean | null;
}

@Injectable({ providedIn: "root" })
export class CartService {
  readonly items = signal<CartItem[]>([]);
  readonly restaurantId = signal<string>("");
  readonly restaurantName = signal<string>("");
  readonly deliveryAddress = signal<string>("Demo delivery address, New Delhi");
  readonly deliveryLat = signal<number>(28.6139);
  readonly deliveryLng = signal<number>(77.209);

  readonly totalItems = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );
  readonly totalPaise = computed(() =>
    this.items().reduce((sum, i) => sum + i.pricePaise * i.quantity, 0)
  );
  readonly isEmpty = computed(() => this.items().length === 0);

  addItem(item: CartItem) {
    if (this.restaurantId() && this.restaurantId() !== item.restaurantId) {
      if (!confirm(`Start a new cart from ${item.restaurantName}? Your current cart from ${this.restaurantName()} will be cleared.`)) {
        return;
      }
      this.clear();
    }
    this.restaurantId.set(item.restaurantId);
    this.restaurantName.set(item.restaurantName);
    const existing = this.items().find(i => i.menuItemId === item.menuItemId);
    if (existing) {
      this.items.update(items =>
        items.map(i => i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i)
      );
    } else {
      this.items.update(items => [...items, { ...item, quantity: 1 }]);
    }
  }

  removeItem(menuItemId: string) {
    const item = this.items().find(i => i.menuItemId === menuItemId);
    if (!item) return;
    if (item.quantity > 1) {
      this.items.update(items =>
        items.map(i => i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i)
      );
    } else {
      this.items.update(items => items.filter(i => i.menuItemId !== menuItemId));
    }
    if (this.items().length === 0) this.clear();
  }

  clear() {
    this.items.set([]);
    this.restaurantId.set("");
    this.restaurantName.set("");
  }

  getQty(menuItemId: string): number {
    return this.items().find(i => i.menuItemId === menuItemId)?.quantity ?? 0;
  }
}

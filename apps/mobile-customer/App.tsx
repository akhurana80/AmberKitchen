import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Linking, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { io, Socket } from 'socket.io-client';
import { api, CartLine, MenuItem, Offer, OrderDetail, OrderSummary, TrendingRestaurant } from './src/api';
import { config } from './src/config';

// ── Screen / tab types ─────────────────────────────────────────────────────
type Tab = 'home' | 'browse' | 'cart' | 'orders' | 'profile';
type Screen = 'auth' | 'app';

const AMBER = '#d97706';
const BG = '#fff8f0';
const CARD_BG = '#ffffff';

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<Tab>('home');

  // Cart (in-memory; cleared on logout)
  const [cart, setCart] = useState<CartLine[]>([]);

  // Track which restaurant menu is expanded in browse tab
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Tracked order for socket
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingNotice, setTrackingNotice] = useState('');
  const socketRef = useRef<Socket | null>(null);

  // Restore saved token on mount
  useEffect(() => {
    SecureStore.getItemAsync('amberkitchen.customer.token').then(saved => {
      if (saved) {
        api.setToken(saved);
        setToken(saved);
        setScreen('app');
      }
    });
  }, []);

  // Socket for tracking
  useEffect(() => {
    if (!token || !trackingOrderId) return;
    const socket = io(config.socketUrl, { auth: { token }, transports: ['websocket'] });
    socket.emit('join-order', trackingOrderId);
    socket.on('order:update', (p: { status?: string }) => {
      setTrackingNotice(`Order update: ${p?.status ?? 'updated'}`);
    });
    socketRef.current = socket;
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token, trackingOrderId]);

  function saveToken(t: string) {
    setToken(t);
    api.setToken(t);
    SecureStore.setItemAsync('amberkitchen.customer.token', t);
  }

  function logout() {
    setToken('');
    api.clearToken();
    setCart([]);
    setScreen('auth');
    setTab('home');
    setTrackingOrderId(null);
    SecureStore.deleteItemAsync('amberkitchen.customer.token');
  }

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(l => l.menuItemId === item.menu_item_id);
      if (existing) {
        return prev.map(l => l.menuItemId === item.menu_item_id
          ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, {
        menuItemId: item.menu_item_id,
        name: item.menu_item_name,
        pricePaise: item.price_paise,
        quantity: 1,
        restaurantId: item.restaurant_id,
        restaurantName: item.restaurant_name,
      }];
    });
  }

  function removeFromCart(menuItemId: string) {
    setCart(prev => {
      const line = prev.find(l => l.menuItemId === menuItemId);
      if (!line) return prev;
      if (line.quantity <= 1) return prev.filter(l => l.menuItemId !== menuItemId);
      return prev.map(l => l.menuItemId === menuItemId ? { ...l, quantity: l.quantity - 1 } : l);
    });
  }

  function clearCart() { setCart([]); }

  const cartTotal = cart.reduce((s, l) => s + l.pricePaise * l.quantity, 0);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  function openRestaurant(restaurantId: string) {
    setSelectedRestaurantId(restaurantId);
    setTab('browse');
  }

  function startTracking(orderId: string) {
    setTrackingOrderId(orderId);
    setTab('orders');
  }

  if (screen === 'auth') {
    return <AuthScreen onLogin={saveToken} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.flex}>
        {tab === 'home' && (
          <HomeScreen
            token={token}
            onOpenRestaurant={openRestaurant}
            onOpenOrders={() => setTab('orders')}
          />
        )}
        {tab === 'browse' && (
          <BrowseScreen
            token={token}
            cart={cart}
            selectedRestaurantId={selectedRestaurantId}
            onSelectRestaurant={setSelectedRestaurantId}
            onAddToCart={addToCart}
            onRemoveFromCart={removeFromCart}
            onOpenCart={() => setTab('cart')}
          />
        )}
        {tab === 'cart' && (
          <CartScreen
            token={token}
            cart={cart}
            onAddToCart={(id) => {
              const line = cart.find(l => l.menuItemId === id);
              if (line) addToCart({
                menu_item_id: line.menuItemId,
                menu_item_name: line.name,
                price_paise: line.pricePaise,
                restaurant_id: line.restaurantId,
                restaurant_name: line.restaurantName,
                restaurant_address: '',
              });
            }}
            onRemoveFromCart={removeFromCart}
            onClearCart={clearCart}
            onOrderPlaced={startTracking}
          />
        )}
        {tab === 'orders' && (
          <OrdersScreen
            token={token}
            trackingOrderId={trackingOrderId}
            trackingNotice={trackingNotice}
            onTrack={setTrackingOrderId}
          />
        )}
        {tab === 'profile' && (
          <ProfileScreen token={token} onLogout={logout} />
        )}
      </View>
      <TabBar
        tab={tab}
        cartCount={cartCount}
        onChange={setTab}
      />
    </SafeAreaView>
  );
}

// ── Auth Screen ────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendOtp() {
    if (!phone.trim()) { setError('Enter your phone number'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.requestOtp(phone.trim());
      if (__DEV__ && res.devCode) setOtp(res.devCode);
      setStep('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (!otp.trim()) { setError('Enter the OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.verifyOtp(phone.trim(), otp.trim());
      onLogin(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.authContainer}>
        <Text style={styles.brand}>AmberKitchen</Text>
        <Text style={styles.brandSub}>Food delivery, redefined.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {step === 'phone' ? 'Enter your phone' : 'Enter OTP'}
          </Text>
          {step === 'phone' ? (
            <>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                autoFocus
              />
              <Btn label={loading ? 'Sending…' : 'Send OTP'} onPress={sendOtp} disabled={loading} />
            </>
          ) : (
            <>
              <Text style={styles.otpHint}>OTP sent to {phone}</Text>
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                placeholder="6-digit OTP"
                keyboardType="number-pad"
                autoFocus
              />
              <Btn label={loading ? 'Verifying…' : 'Verify & Login'} onPress={verifyOtp} disabled={loading} />
              <Pressable onPress={() => { setStep('phone'); setOtp(''); setError(''); }}>
                <Text style={styles.link}>Change number</Text>
              </Pressable>
            </>
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Home Screen ────────────────────────────────────────────────────────────
function HomeScreen({
  token, onOpenRestaurant, onOpenOrders,
}: {
  token: string;
  onOpenRestaurant: (id: string) => void;
  onOpenOrders: () => void;
}) {
  const [trending, setTrending] = useState<TrendingRestaurant[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lat, setLat] = useState(28.6139);
  const [lng, setLng] = useState(77.209);

  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().then(p => {
      if (p.status === 'granted') {
        Location.getCurrentPositionAsync({}).then(pos => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        }).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.trendingRestaurants(lat, lng),
      api.marketplaceOffers(),
      api.getOrders(),
    ]).then(([t, o, ord]) => {
      setTrending(t);
      setOffers(o);
      setOrders(ord.slice(0, 3));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token, lat, lng]);

  const activeOrder = orders.find(o => !['delivered', 'cancelled'].includes(o.status));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screenPad}>
      <Text style={styles.screenTitle}>Good morning!</Text>
      <Text style={styles.screenSub}>What are you craving today?</Text>

      {activeOrder && (
        <Pressable style={styles.activeOrderBanner} onPress={onOpenOrders}>
          <Text style={styles.activeOrderText}>
            Active order • {titleCase(activeOrder.status)} — {formatCurrency(activeOrder.total_paise)}
          </Text>
          <Text style={styles.activeOrderCta}>Track →</Text>
        </Pressable>
      )}

      {offers.length > 0 && (
        <Section title="Today's Offers">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
            {offers.map(offer => (
              <View key={offer.id} style={styles.offerChip}>
                <Text style={styles.offerCode}>{offer.code}</Text>
                <Text style={styles.offerTitle}>{offer.title}</Text>
              </View>
            ))}
          </ScrollView>
        </Section>
      )}

      {loading ? <Loader /> : (
        <Section title="Trending Near You">
          {trending.map(r => (
            <RestaurantCard key={r.id} restaurant={r} onPress={() => onOpenRestaurant(r.id)} />
          ))}
          {trending.length === 0 && (
            <Text style={styles.emptyText}>No restaurants found nearby.</Text>
          )}
        </Section>
      )}
    </ScrollView>
  );
}

// ── Browse / Restaurant Menu Screen ───────────────────────────────────────
function BrowseScreen({
  token, cart, selectedRestaurantId, onSelectRestaurant, onAddToCart, onRemoveFromCart, onOpenCart,
}: {
  token: string;
  cart: CartLine[];
  selectedRestaurantId: string | null;
  onSelectRestaurant: (id: string | null) => void;
  onAddToCart: (item: MenuItem) => void;
  onRemoveFromCart: (id: string) => void;
  onOpenCart: () => void;
}) {
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState<'all' | 'veg' | 'non_veg'>('all');
  const [sort, setSort] = useState('distance');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lat] = useState(28.6139);
  const [lng] = useState(77.209);

  const search = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api.searchRestaurants({ q: query, diet, sort, lat, lng, minRating: 0 })
      .then(setMenuItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, query, diet, sort, lat, lng]);

  useEffect(() => { search(); }, [search]);

  // Group menu items by restaurant
  const restaurants = useMemo(() => {
    const map = new Map<string, { id: string; name: string; address: string; cuisineType?: string; rating?: number; distance?: number; items: MenuItem[] }>();
    for (const item of menuItems) {
      const existing = map.get(item.restaurant_id);
      if (!existing) {
        map.set(item.restaurant_id, {
          id: item.restaurant_id,
          name: item.restaurant_name,
          address: item.restaurant_address,
          cuisineType: item.cuisine_type,
          rating: item.rating,
          distance: item.distance_km,
          items: [item],
        });
      } else {
        existing.items.push(item);
      }
    }
    return Array.from(map.values());
  }, [menuItems]);

  const selectedRestaurant = selectedRestaurantId
    ? restaurants.find(r => r.id === selectedRestaurantId) ?? null
    : null;

  const cartTotal = cart.reduce((s, l) => s + l.pricePaise * l.quantity, 0);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  if (selectedRestaurant) {
    return (
      <View style={styles.flex}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.screenPad}>
          <Pressable onPress={() => onSelectRestaurant(null)}>
            <Text style={styles.back}>← All Restaurants</Text>
          </Pressable>
          <Text style={styles.screenTitle}>{selectedRestaurant.name}</Text>
          <Text style={styles.screenSub}>{selectedRestaurant.address}</Text>
          {selectedRestaurant.rating != null && (
            <Text style={styles.screenSub}>⭐ {selectedRestaurant.rating.toFixed(1)} • {selectedRestaurant.cuisineType ?? 'Restaurant'}</Text>
          )}
          <Section title="Menu">
            {selectedRestaurant.items.map(item => {
              const cartLine = cart.find(l => l.menuItemId === item.menu_item_id);
              return (
                <View key={item.menu_item_id} style={styles.menuItem}>
                  <View style={styles.menuItemInfo}>
                    <Text style={styles.menuItemName}>
                      {item.is_veg ? '🟢' : '🔴'} {item.menu_item_name}
                    </Text>
                    {item.description ? <Text style={styles.menuItemDesc}>{item.description}</Text> : null}
                    <Text style={styles.menuItemPrice}>{formatCurrency(item.price_paise)}</Text>
                  </View>
                  <View style={styles.qtyControl}>
                    {cartLine ? (
                      <>
                        <Pressable style={styles.qtyBtn} onPress={() => onRemoveFromCart(item.menu_item_id)}>
                          <Text style={styles.qtyBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.qtyCount}>{cartLine.quantity}</Text>
                        <Pressable style={styles.qtyBtn} onPress={() => onAddToCart(item)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable style={styles.addBtn} onPress={() => onAddToCart(item)}>
                        <Text style={styles.addBtnText}>Add</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </Section>
        </ScrollView>
        {cartCount > 0 && (
          <Pressable style={styles.cartFooter} onPress={onOpenCart}>
            <Text style={styles.cartFooterText}>{cartCount} items • {formatCurrency(cartTotal)}</Text>
            <Text style={styles.cartFooterCta}>View Cart →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screenPad}>
      <Text style={styles.screenTitle}>Restaurants</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={v => { setQuery(v); }}
        onSubmitEditing={search}
        placeholder="Search food or restaurants…"
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
        {(['all', 'veg', 'non_veg'] as const).map(d => (
          <Pressable key={d} style={[styles.filterChip, diet === d && styles.filterChipActive]} onPress={() => setDiet(d)}>
            <Text style={[styles.filterChipText, diet === d && styles.filterChipTextActive]}>{d === 'non_veg' ? 'Non-veg' : titleCase(d)}</Text>
          </Pressable>
        ))}
        {(['distance', 'rating_desc', 'price_asc'] as const).map(s => (
          <Pressable key={s} style={[styles.filterChip, sort === s && styles.filterChipActive]} onPress={() => setSort(s)}>
            <Text style={[styles.filterChipText, sort === s && styles.filterChipTextActive]}>
              {s === 'rating_desc' ? 'Top Rated' : s === 'price_asc' ? 'Price ↑' : 'Nearest'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <Loader /> : restaurants.map(r => (
        <RestaurantCard
          key={r.id}
          restaurant={{ id: r.id, name: r.name, address: r.address, cuisine_type: r.cuisineType, rating: r.rating, distance_km: r.distance, predicted_eta_minutes: 0 }}
          onPress={() => onSelectRestaurant(r.id)}
        />
      ))}
      {!loading && restaurants.length === 0 && (
        <Text style={styles.emptyText}>No restaurants found. Try a different search.</Text>
      )}
    </ScrollView>
  );
}

// ── Cart Screen ────────────────────────────────────────────────────────────
function CartScreen({
  token, cart, onAddToCart, onRemoveFromCart, onClearCart, onOrderPlaced,
}: {
  token: string;
  cart: CartLine[];
  onAddToCart: (id: string) => void;
  onRemoveFromCart: (id: string) => void;
  onClearCart: () => void;
  onOrderPlaced: (orderId: string) => void;
}) {
  const [address, setAddress] = useState('');
  const [coupon, setCoupon] = useState('');
  const [provider, setProvider] = useState<'phonepe' | 'paytm' | 'razorpay'>('phonepe');
  const [loading, setLoading] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ id: string; total: number } | null>(null);

  const subtotal = cart.reduce((s, l) => s + l.pricePaise * l.quantity, 0);
  const deliveryFee = subtotal > 0 ? 2900 : 0;
  const total = subtotal + deliveryFee;

  const restaurantId = cart[0]?.restaurantId ?? '';
  const mixedRestaurants = new Set(cart.map(l => l.restaurantId)).size > 1;

  async function placeOrder() {
    if (!address.trim()) { Alert.alert('Cart', 'Enter a delivery address'); return; }
    if (mixedRestaurants) { Alert.alert('Cart', 'You can only order from one restaurant at a time.'); return; }
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const order = await api.createOrder({
        restaurantId,
        deliveryAddress: address.trim(),
        deliveryLat: 28.6139,
        deliveryLng: 77.209,
        items: cart.map(l => ({ name: l.name, quantity: l.quantity, pricePaise: l.pricePaise })),
        couponCode: coupon.trim() || undefined,
        idempotencyKey: `${Date.now()}-${restaurantId}`,
      });
      setPlacedOrder({ id: order.id, total: order.total_paise });
      // Launch payment
      const payment = await api.createPayment(provider, order.id, order.total_paise);
      const url = payment.deepLinkUrl ?? payment.intentUrl ?? payment.redirectUrl ?? payment.paymentUrl;
      if (url) {
        await Linking.openURL(url).catch(() => {});
      } else {
        Alert.alert('Payment', payment.note ?? 'Open your payment app to complete the payment.');
      }
      onClearCart();
      onOrderPlaced(order.id);
    } catch (e) {
      Alert.alert('Order failed', e instanceof Error ? e.message : 'Could not place order');
    } finally { setLoading(false); }
  }

  if (cart.length === 0 && !placedOrder) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyText}>Browse restaurants and add items to get started.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screenPad}>
      <Text style={styles.screenTitle}>Your Cart</Text>
      {mixedRestaurants && (
        <Text style={styles.errorText}>Cart has items from multiple restaurants. Remove extras to continue.</Text>
      )}
      {cart.map(line => (
        <View key={line.menuItemId} style={styles.cartLine}>
          <View style={styles.flex}>
            <Text style={styles.cartLineName}>{line.name}</Text>
            <Text style={styles.cartLineRestaurant}>{line.restaurantName}</Text>
          </View>
          <View style={styles.qtyControl}>
            <Pressable style={styles.qtyBtn} onPress={() => onRemoveFromCart(line.menuItemId)}>
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qtyCount}>{line.quantity}</Text>
            <Pressable style={styles.qtyBtn} onPress={() => onAddToCart(line.menuItemId)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.cartLinePrice}>{formatCurrency(line.pricePaise * line.quantity)}</Text>
        </View>
      ))}

      <View style={styles.pricingBox}>
        <PricingRow label="Subtotal" value={subtotal} />
        <PricingRow label="Delivery fee" value={deliveryFee} />
        <View style={styles.divider} />
        <PricingRow label="Total" value={total} bold />
      </View>

      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Delivery address"
        multiline
      />
      <TextInput
        style={styles.input}
        value={coupon}
        onChangeText={setCoupon}
        placeholder="Coupon code (optional)"
        autoCapitalize="characters"
      />

      <Text style={styles.sectionLabel}>Payment method</Text>
      <View style={styles.rowGap}>
        {(['phonepe', 'paytm', 'razorpay'] as const).map(p => (
          <Pressable key={p} style={[styles.filterChip, provider === p && styles.filterChipActive]} onPress={() => setProvider(p)}>
            <Text style={[styles.filterChipText, provider === p && styles.filterChipTextActive]}>{titleCase(p)}</Text>
          </Pressable>
        ))}
      </View>

      <Btn label={loading ? 'Placing order…' : `Pay ${formatCurrency(total)}`} onPress={placeOrder} disabled={loading || cart.length === 0} />
    </ScrollView>
  );
}

// ── Orders Screen ──────────────────────────────────────────────────────────
function OrdersScreen({
  token, trackingOrderId, trackingNotice, onTrack,
}: {
  token: string;
  trackingOrderId: string | null;
  trackingNotice: string;
  onTrack: (id: string) => void;
}) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderDetail | null>(null);
  const [eta, setEta] = useState<{ minutes: number; deliveryAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(trackingOrderId);

  useEffect(() => { setDetailId(trackingOrderId); }, [trackingOrderId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.getOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!detailId || !token) return;
    api.getOrder(detailId).then(setActiveOrder).catch(() => {});
    api.orderEta(detailId).then(e => setEta({ minutes: e.predictedEtaMinutes, deliveryAt: e.predictedDeliveryAt })).catch(() => {});
  }, [detailId, token]);

  async function cancelOrder(id: string) {
    Alert.alert('Cancel order', 'Are you sure?', [
      { text: 'No' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelOrder(id, 'Cancelled by customer');
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
            if (detailId === id) { setDetailId(null); setActiveOrder(null); }
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not cancel');
          }
        },
      },
    ]);
  }

  async function reorder(id: string) {
    try {
      const res = await api.reorder(id);
      Alert.alert('Reordered', `New order placed: ${formatCurrency(res.total_paise)}`);
      onTrack(res.id);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not reorder');
    }
  }

  if (detailId && activeOrder) {
    const isActive = !['delivered', 'cancelled'].includes(activeOrder.status);
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.screenPad}>
        <Pressable onPress={() => { setDetailId(null); setActiveOrder(null); }}>
          <Text style={styles.back}>← All Orders</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Order Detail</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(activeOrder.status) }]}>
          <Text style={styles.statusBadgeText}>{titleCase(activeOrder.status)}</Text>
        </View>

        {trackingNotice ? <Text style={styles.notice}>{trackingNotice}</Text> : null}

        {eta && isActive && (
          <View style={styles.etaBox}>
            <Text style={styles.etaMinutes}>{eta.minutes} min</Text>
            <Text style={styles.etaSub}>Estimated delivery time</Text>
          </View>
        )}

        <Section title="Items">
          {activeOrder.items.map((item, i) => (
            <View key={i} style={styles.orderItem}>
              <Text style={styles.orderItemName}>{item.quantity}× {item.name}</Text>
              <Text style={styles.orderItemPrice}>{formatCurrency(item.price_paise * item.quantity)}</Text>
            </View>
          ))}
        </Section>

        <View style={styles.pricingBox}>
          {activeOrder.subtotal_paise != null && <PricingRow label="Subtotal" value={activeOrder.subtotal_paise} />}
          {activeOrder.delivery_fee_paise != null && <PricingRow label="Delivery fee" value={activeOrder.delivery_fee_paise} />}
          {(activeOrder.discount_paise ?? 0) > 0 && <PricingRow label="Discount" value={-(activeOrder.discount_paise ?? 0)} />}
          <View style={styles.divider} />
          <PricingRow label="Total" value={activeOrder.total_paise} bold />
        </View>

        {activeOrder.driver_name && (
          <View style={styles.driverBox}>
            <Text style={styles.driverLabel}>Your driver</Text>
            <Text style={styles.driverName}>{activeOrder.driver_name}</Text>
            {activeOrder.driver_phone && (
              <Text style={styles.driverPhone}>{activeOrder.driver_phone}</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>Delivery to</Text>
        <Text style={styles.bodyText}>{activeOrder.delivery_address}</Text>

        <Section title="Order history">
          {activeOrder.history.map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <View style={styles.historyDot} />
              <View>
                <Text style={styles.historyStatus}>{titleCase(h.status)}</Text>
                {h.note ? <Text style={styles.historySub}>{h.note}</Text> : null}
              </View>
            </View>
          ))}
        </Section>

        {isActive && (
          <Btn label="Cancel Order" onPress={() => cancelOrder(activeOrder.id)} secondary />
        )}
        {activeOrder.status === 'delivered' && (
          <Btn label="Reorder" onPress={() => reorder(activeOrder.id)} />
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screenPad}>
      <Text style={styles.screenTitle}>My Orders</Text>
      {loading ? <Loader /> : orders.length === 0 ? (
        <Text style={styles.emptyText}>You have no orders yet.</Text>
      ) : orders.map(order => (
        <Pressable key={order.id} style={styles.orderCard} onPress={() => { setDetailId(order.id); onTrack(order.id); }}>
          <View style={styles.flex}>
            <Text style={styles.orderCardId}>Order #{order.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.orderCardDate}>{formatDate(order.created_at)}</Text>
          </View>
          <View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) }]}>
              <Text style={styles.statusBadgeText}>{titleCase(order.status)}</Text>
            </View>
            <Text style={styles.orderCardTotal}>{formatCurrency(order.total_paise)}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── Profile Screen ─────────────────────────────────────────────────────────
function ProfileScreen({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submitTicket() {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Support', 'Fill in subject and message'); return;
    }
    setSending(true);
    try {
      await api.createSupportTicket(category, subject.trim(), message.trim());
      Alert.alert('Support', 'Your ticket has been submitted. We will get back to you soon.');
      setSubject(''); setMessage('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not submit ticket');
    } finally { setSending(false); }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screenPad}>
      <Text style={styles.screenTitle}>Profile</Text>

      <Section title="Account">
        <View style={styles.profileInfo}>
          <Text style={styles.profileLabel}>Logged in as customer</Text>
          <Text style={styles.profileSub}>Token active • AmberKitchen</Text>
        </View>
        <Btn label="Log Out" onPress={onLogout} secondary />
      </Section>

      <Section title="Contact Support">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
          {(['general', 'order', 'payment', 'delivery', 'other']).map(c => (
            <Pressable key={c} style={[styles.filterChip, category === c && styles.filterChipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.filterChipText, category === c && styles.filterChipTextActive]}>{titleCase(c)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject" />
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={message}
          onChangeText={setMessage}
          placeholder="Describe your issue…"
          multiline
          numberOfLines={4}
        />
        <Btn label={sending ? 'Sending…' : 'Submit Ticket'} onPress={submitTicket} disabled={sending} />
      </Section>
    </ScrollView>
  );
}

// ── Shared Components ──────────────────────────────────────────────────────

function TabBar({ tab, cartCount, onChange }: { tab: Tab; cartCount: number; onChange: (t: Tab) => void }) {
  const tabs: Array<{ key: Tab; label: string; icon: string }> = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'browse', label: 'Browse', icon: '🍽️' },
    { key: 'cart', label: 'Cart', icon: '🛒' },
    { key: 'orders', label: 'Orders', icon: '📦' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map(t => (
        <Pressable key={t.key} style={styles.tabItem} onPress={() => onChange(t.key)}>
          <View style={styles.tabIconWrap}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
            {t.key === 'cart' && cartCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View>
            )}
          </View>
          <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RestaurantCard({
  restaurant, onPress,
}: {
  restaurant: { id: string; name: string; address: string; cuisine_type?: string; rating?: number; distance_km?: number; predicted_eta_minutes: number };
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.restaurantCard} onPress={onPress}>
      <Text style={styles.restaurantName}>{restaurant.name}</Text>
      <Text style={styles.restaurantMeta}>
        {[restaurant.cuisine_type, restaurant.rating != null ? `⭐ ${Number(restaurant.rating).toFixed(1)}` : null, restaurant.distance_km != null ? `${Number(restaurant.distance_km).toFixed(1)} km` : null, Number(restaurant.predicted_eta_minutes) > 0 ? `${restaurant.predicted_eta_minutes} min` : null].filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.restaurantAddress} numberOfLines={1}>{restaurant.address}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function PricingRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.pricingRow}>
      <Text style={[styles.pricingLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.pricingValue, bold && styles.bold]}>{formatCurrency(value)}</Text>
    </View>
  );
}

function Btn({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <Pressable
      style={[styles.btn, secondary && styles.btnSecondary, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.btnText, secondary && styles.btnTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function Loader() {
  return <ActivityIndicator size="large" color={AMBER} style={{ marginVertical: 24 }} />;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(paise: number): string {
  if (paise < 0) return `-₹${(Math.abs(paise) / 100).toFixed(0)}`;
  return `₹${(paise / 100).toFixed(0)}`;
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch { return ''; }
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered': return '#dcfce7';
    case 'cancelled': return '#fee2e2';
    case 'pending': return '#fef9c3';
    case 'confirmed': case 'accepted': return '#dbeafe';
    case 'picked_up': case 'out_for_delivery': return '#e0f2fe';
    default: return '#f1f5f9';
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  screenPad: { padding: 16, paddingBottom: 24, gap: 12 },

  // Auth
  authContainer: { padding: 24, justifyContent: 'center', flexGrow: 1, gap: 20 },
  brand: { fontSize: 36, fontWeight: '900', color: AMBER, textAlign: 'center' },
  brandSub: { fontSize: 16, color: '#64748b', textAlign: 'center' },
  otpHint: { color: '#64748b', fontSize: 14, marginBottom: 4 },
  link: { color: AMBER, textAlign: 'center', marginTop: 8, fontWeight: '700' },

  // Card
  card: { backgroundColor: CARD_BG, borderRadius: 12, padding: 20, gap: 12, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },

  // Screen headings
  screenTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  screenSub: { fontSize: 14, color: '#64748b' },
  back: { color: AMBER, fontWeight: '700', fontSize: 15, marginBottom: 4 },

  // Input
  input: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 8, padding: Platform.OS === 'ios' ? 12 : 9, backgroundColor: CARD_BG, fontSize: 15 },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },

  // Button
  btn: { backgroundColor: AMBER, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: AMBER },
  btnDisabled: { backgroundColor: '#94a3b8', borderColor: '#94a3b8' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnTextSecondary: { color: AMBER },

  // Error / notice
  errorText: { color: '#b91c1c', fontSize: 13 },
  notice: { backgroundColor: '#fff7ed', padding: 10, borderRadius: 8, color: '#9a3412', fontSize: 13 },

  // Active order banner
  activeOrderBanner: { backgroundColor: AMBER, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeOrderText: { color: '#fff', fontWeight: '700', flex: 1 },
  activeOrderCta: { color: '#fff', fontWeight: '800' },

  // Offers
  offerChip: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, minWidth: 100 },
  offerCode: { fontWeight: '900', color: '#b45309', fontSize: 15 },
  offerTitle: { color: '#92400e', fontSize: 12, marginTop: 2 },

  // Restaurant card
  restaurantCard: { backgroundColor: CARD_BG, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', gap: 4 },
  restaurantName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  restaurantMeta: { fontSize: 13, color: '#64748b' },
  restaurantAddress: { fontSize: 12, color: '#94a3b8' },

  // Filters
  rowGap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: CARD_BG },
  filterChipActive: { backgroundColor: AMBER, borderColor: AMBER },
  filterChipText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  filterChipTextActive: { color: '#fff' },

  // Menu item
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', gap: 8 },
  menuItemInfo: { flex: 1, gap: 3 },
  menuItemName: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  menuItemDesc: { color: '#64748b', fontSize: 12 },
  menuItemPrice: { color: AMBER, fontWeight: '800', fontSize: 14 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { backgroundColor: AMBER, borderRadius: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  qtyCount: { minWidth: 20, textAlign: 'center', fontWeight: '800', color: '#0f172a' },
  addBtn: { backgroundColor: AMBER, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Cart footer sticky
  cartFooter: { backgroundColor: AMBER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  cartFooterText: { color: '#fff', fontWeight: '700' },
  cartFooterCta: { color: '#fff', fontWeight: '800' },

  // Cart lines
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CARD_BG, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cartLineName: { fontWeight: '700', color: '#0f172a' },
  cartLineRestaurant: { color: '#94a3b8', fontSize: 12 },
  cartLinePrice: { fontWeight: '800', color: AMBER, minWidth: 50, textAlign: 'right' },

  // Pricing
  pricingBox: { backgroundColor: '#fff7ed', borderRadius: 10, padding: 14, gap: 6 },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pricingLabel: { color: '#334155' },
  pricingValue: { color: '#334155' },
  bold: { fontWeight: '800', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },

  // ETA
  etaBox: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#fed7aa' },
  etaMinutes: { fontSize: 36, fontWeight: '900', color: '#9a3412' },
  etaSub: { color: '#7c2d12', marginTop: 2 },

  // Driver
  driverBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, gap: 4 },
  driverLabel: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  driverName: { fontWeight: '800', color: '#1e3a8a', fontSize: 15 },
  driverPhone: { color: '#3b82f6' },

  // Order card
  orderCard: { backgroundColor: CARD_BG, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderWidth: 1, borderColor: '#e5e7eb' },
  orderCardId: { fontWeight: '800', color: '#0f172a' },
  orderCardDate: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  orderCardTotal: { fontWeight: '800', color: AMBER, textAlign: 'right', marginTop: 4 },

  // Status badge
  statusBadge: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginBottom: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#334155' },

  // Order items
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  orderItemName: { color: '#334155' },
  orderItemPrice: { fontWeight: '700', color: '#0f172a' },

  // History
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AMBER, marginTop: 5 },
  historyStatus: { fontWeight: '700', color: '#0f172a' },
  historySub: { color: '#64748b', fontSize: 12 },

  // Section
  section: { gap: 10 },
  sectionLabel: { fontWeight: '800', color: '#334155', fontSize: 15 },

  // Profile
  profileInfo: { gap: 4 },
  profileLabel: { fontWeight: '700', color: '#0f172a' },
  profileSub: { color: '#64748b', fontSize: 13 },

  // Body text
  bodyText: { color: '#334155' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: CARD_BG, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingBottom: Platform.OS === 'ios' ? 16 : 8, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIconWrap: { position: 'relative' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  tabLabelActive: { color: AMBER },
  badge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Empty states
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  emptyText: { color: '#94a3b8', textAlign: 'center' },
});

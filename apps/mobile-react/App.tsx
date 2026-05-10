import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import * as Network from "expo-network";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { io, Socket } from "socket.io-client";
import { api } from "./src/api";
import { config } from "./src/config";
import {
  AdminDashboard,
  DriverOnboardingApplication,
  DriverOrder,
  OrderSummary,
  RestaurantSearchResult,
  Role,
  TrendingRestaurant,
  WalletSummary
} from "./src/types";

type Tab = "driver" | "restaurant" | "admin";

const roleOptions: Role[] = ["driver", "restaurant", "admin", "super_admin", "delivery_admin"];

export default function App() {
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [googleIdToken, setGoogleIdToken] = useState("");
  const [role, setRole] = useState<Role>("driver");
  const [tab, setTab] = useState<Tab>("driver");
  const [notice, setNotice] = useState("Select a role, enter your phone number, and tap Send OTP to begin.");
  const [loading, setLoading] = useState(false);
  const [userSearching, setUserSearching] = useState(false);
  const [orderSearching, setOrderSearching] = useState(false);
  const [uploadStep, setUploadStep] = useState<"" | "reading" | "uploading1" | "uploading2" | "uploading3" | "submitting">("");
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [location, setLocation] = useState({ lat: 28.6139, lng: 77.209 });
  const [restaurants, setRestaurants] = useState<RestaurantSearchResult[]>([]);
  const [trending, setTrending] = useState<TrendingRestaurant[]>([]);
  const [googlePlaces, setGooglePlaces] = useState<Array<{ name: string; address: string; rating: number; lat: number; lng: number; photoUrl: string | null }>>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("00000000-0000-0000-0000-000000000001");
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [eta, setEta] = useState<Awaited<ReturnType<typeof api.orderEta>> | null>(null);
  const [etaLoop, setEtaLoop] = useState<Array<{ id: string; predicted_eta_minutes: number; distance_to_pickup_km: string | null; distance_to_dropoff_km: string | null; source: string; created_at: string }>>([]);
  const [driverOrders, setDriverOrders] = useState<DriverOrder[]>([]);
  const [driverApplication, setDriverApplication] = useState<DriverOnboardingApplication | null>(null);
  const [driverApplications, setDriverApplications] = useState<DriverOnboardingApplication[]>([]);
  const [driverReferrals, setDriverReferrals] = useState<Array<{ id: string; referral_code: string; status: string; reward_paise: number; referrer_phone: string | null; referred_phone: string | null }>>([]);
  const [selectedAadhaarFront, setSelectedAadhaarFront] = useState<string | null>(null);
  const [selectedAadhaarBack, setSelectedAadhaarBack] = useState<string | null>(null);
  const [selectedSelfie, setSelectedSelfie] = useState<string | null>(null);
  const [driverFullName, setDriverFullName] = useState("");
  const [driverAadhaarLast4, setDriverAadhaarLast4] = useState("");
  const [driverBankLast4, setDriverBankLast4] = useState("");
  const [driverUpiId, setDriverUpiId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [restaurantCuisine, setRestaurantCuisine] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<Array<{ id: string; type: string; amount_paise: number; status: string }>>([]);
  const [restaurantAccounts, setRestaurantAccounts] = useState<Array<{ id: string; name: string; approval_status: string; onboarding_status: string }>>([]);
  const [restaurantOrders, setRestaurantOrders] = useState<Array<{ id: string; status: string; total_paise: number }>>([]);
  const [restaurantEarnings, setRestaurantEarnings] = useState<{ orders: string; gross_paise: string; estimated_payout_paise: string } | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [adminRestaurants, setAdminRestaurants] = useState<Array<{ id: string; name: string; address: string; approval_status: string; rejection_reason: string | null; is_active: boolean; cuisine_type?: string | null; owner_phone?: string | null; owner_email?: string | null; created_at?: string }>>([]);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [restaurantSearchResults, setRestaurantSearchResults] = useState<Array<{ id: string; name: string; address: string; approval_status: string; rejection_reason: string | null; is_active: boolean; cuisine_type?: string | null; owner_phone?: string | null; owner_email?: string | null; created_at?: string }> | null>(null);
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; phone: string | null; email: string | null; name: string | null; role: string; is_banned: boolean; created_at?: string }>>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userOrdersMap, setUserOrdersMap] = useState<Record<string, Array<{ id: string; status: string; total_paise: number; restaurant_name: string; created_at: string }>>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<Array<{ id: string; phone: string | null; email: string | null; name: string | null; role: string; is_banned: boolean; created_at?: string }> | null>(null);
  const [userDisplayLimit, setUserDisplayLimit] = useState(10);
  const [adminOrders, setAdminOrders] = useState<Array<{ id: string; status: string; total_paise: number; restaurant_name: string; customer_phone?: string | null; driver_phone?: string | null; created_at?: string }>>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSearchResults, setOrderSearchResults] = useState<Array<{ id: string; status: string; total_paise: number; restaurant_name: string; customer_phone?: string | null; driver_phone?: string | null; created_at: string }> | null>(null);
  const [orderDisplayLimit, setOrderDisplayLimit] = useState(10);
  const [paymentReports, setPaymentReports] = useState<Array<{ provider: string; status: string; transactions: number; amount_paise: number }>>([]);
  const [driverLoad, setDriverLoad] = useState<Array<{ id: string; phone: string | null; active_orders: number; capacity_score: number }>>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<Array<{ id: string; status: string; restaurant_name: string; last_driver_lat: string | null; last_driver_lng: string | null }>>([]);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryDrivers, setDeliveryDrivers] = useState<Array<{ id: string; phone: string | null; name: string | null }>>([]);
  const [zones, setZones] = useState<Array<{ id: string; name: string; city: string; sla_minutes: number; surge_multiplier: string }>>([]);
  const [offers, setOffers] = useState<Array<{ id: string; code: string; title: string; discount_type: string; discount_value: number }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; channel: string; budget_paise: number; status: string; ai_creative: string | null }>>([]);
  const [incentives, setIncentives] = useState<Array<{ id: string; title: string; target_deliveries: number; reward_paise: number; status: string }>>([]);
  const [adminPayouts, setAdminPayouts] = useState<Array<{ id: string; amount_paise: number; method: string; status: string; phone: string | null; role: string }>>([]);
  const [supportTickets, setSupportTickets] = useState<Array<{ id: string; category: string; subject: string; status: string; created_at: string }>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; method: string; path: string; status_code: number }>>([]);
  const [verificationChecks, setVerificationChecks] = useState<Array<{ id: string; provider: string; check_type: string; status: string }>>([]);
  const [analyticsJobs, setAnalyticsJobs] = useState<Array<{ id: string; job_type: string; status: string; summary: unknown; created_at: string }>>([]);
  const [demandPredictions, setDemandPredictions] = useState<Array<{ id: string; zone_key: string; cuisine_type: string | null; hour_start: string; predicted_orders: number; confidence: string }>>([]);
  const [adminMktSnapshot, setAdminMktSnapshot] = useState<{ nearby: number; trending: number; offers: number } | null>(null);
  const [mockAppStatus, setMockAppStatus] = useState<"pending" | "approved" | "rejected">("pending");

  const [ticketFilter, setTicketFilter] = useState<"all" | "open" | "in_progress" | "resolved" | "closed">("all");
  const [ticketDisplayLimit, setTicketDisplayLimit] = useState(10);
  const [auditDisplayLimit, setAuditDisplayLimit] = useState(10);
  const [analyticsTab, setAnalyticsTab] = useState<"jobs" | "predictions">("jobs");

  // Display limits for lists that previously had hardcoded .slice() or no pagination
  const [driverOrdersLimit, setDriverOrdersLimit] = useState(10);
  const [incentivesLimit, setIncentivesLimit] = useState(5);
  const [txLimit, setTxLimit] = useState(5);
  const [restaurantOrdersLimit, setRestaurantOrdersLimit] = useState(10);
  const [zonesLimit, setZonesLimit] = useState(10);
  const [campaignsLimit, setCampaignsLimit] = useState(10);
  const [incentivesZciLimit, setIncentivesZciLimit] = useState(10);
  const [payoutsLimit, setPayoutsLimit] = useState(10);
  const [referralsLimit, setReferralsLimit] = useState(10);
  const [vcLimit, setVcLimit] = useState(5);

  const [zciFormType, setZciFormType] = useState<null | "zone" | "offer" | "campaign" | "incentive">(null);
  const [zciFormData, setZciFormData] = useState<{
    name: string; city: string; radiusKm: string; slaMinutes: string; surgeMultiplier: string;
    code: string; title: string; discountType: "flat" | "percent"; discountValue: string; minOrderRupees: string;
    channel: "push" | "email" | "whatsapp" | "ads"; budgetRupees: string; aiCreative: string;
    targetDeliveries: string; rewardRupees: string;
  }>({
    name: "", city: "Delhi NCR", radiusKm: "3", slaMinutes: "20", surgeMultiplier: "1.0",
    code: "", title: "", discountType: "flat", discountValue: "50", minOrderRupees: "199",
    channel: "push", budgetRupees: "1000", aiCreative: "",
    targetDeliveries: "5", rewardRupees: "75",
  });

  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({
    "Marketplace & Orders": true,
    "Driver Onboarding": true,
    "Active Deliveries": true,
    "Wallet & Earnings": true,
    "Restaurant Onboarding": true,
    "Incoming Orders": true,
    "Order Operations": true,
    "User Management": true,
    "Restaurant Approvals": true,
    "Order + Payment Monitoring": true,
    "Live Tracking + Driver Load": true,
    "Driver Onboarding Admin": true,
    "Zones, Campaigns & Incentives": true,
    "Analytics & Predictions": true,
    "Payouts": true,
    "Support Tickets": true,
    "Security & Audit Logs": true,
  });
  const togglePanel = (label: string) => setCollapsedPanels(prev => ({ ...prev, [label]: !prev[label] }));
  const isCollapsed = (label: string) => Boolean(collapsedPanels[label]);

  const authed = Boolean(token);
  const isAdmin = authed && (role === "admin" || role === "super_admin" || role === "delivery_admin");
  const availableTabs = useMemo(() => {
    if (role === "driver") return ["driver"] as Tab[];
    if (role === "restaurant") return ["restaurant"] as Tab[];
    return ["admin"] as Tab[];
  }, [role]);

  const firstRestaurant = restaurants[0]?.restaurant_id ?? trending[0]?.id ?? selectedRestaurantId;

  const roleHelp = useMemo(() => {
    switch (role) {
      case "driver":
        return "Driver mode — onboarding, live deliveries, wallet and payout requests.";
      case "restaurant":
        return "Restaurant mode — onboarding, menu management, orders and earnings.";
      default:
        return "Admin mode — platform health, approvals, live tracking, analytics and payouts.";
    }
  }, [role]);

  useEffect(() => {
    if (!availableTabs.includes(tab)) {
      setTab(availableTabs[0]);
    }
  }, [availableTabs, tab]);

  const run = useCallback(async (label: string, work: () => Promise<unknown>) => {
    setError(null);
    setLoading(true);
    try {
      setNotice(`${label}…`);
      const result = await work();
      setNotice(`${label} complete.`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error. Check your connection and try again.";
      setError(message);
      setNotice(message);
      Alert.alert(label + " failed", message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Always reads the latest refresh token from SecureStore — no stale-closure issues.
  const silentRefresh = useCallback(async (): Promise<string | null> => {
    const stored = await SecureStore.getItemAsync("amberkitchen.refresh_token");
    if (!stored) return null;
    try {
      const result = await api.refreshSession(stored);
      await Promise.all([
        SecureStore.setItemAsync("amberkitchen.token", result.token),
        SecureStore.setItemAsync("amberkitchen.refresh_token", result.refreshToken)
      ]);
      setToken(result.token);
      return result.token;
    } catch {
      setToken("");
      await Promise.all([
        SecureStore.deleteItemAsync("amberkitchen.token"),
        SecureStore.deleteItemAsync("amberkitchen.refresh_token")
      ]);
      return null;
    }
  }, []);

  useEffect(() => {
    api.setOnRefresh(silentRefresh);
  }, [silentRefresh]);

  useEffect(() => {
    void SecureStore.getItemAsync("amberkitchen.token").then(saved => {
      if (!saved) return;
      try {
        const payload = JSON.parse(atob(saved.split(".")[1]));
        if (payload?.role && roleOptions.includes(payload.role)) {
          setRole(payload.role as Role);
        }
      } catch {
        // malformed token — ignore, verifyOtp will clear it on next login
      }
      setToken(saved);
    });
  }, []);

  useEffect(() => {
    const updateNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOffline(!state.isConnected || state.isInternetReachable === false);
      } catch {
        setIsOffline(true);
      }
    };
    updateNetwork();
    const interval = setInterval(updateNetwork, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (role === "driver") setTab("driver");
    else if (role === "restaurant") setTab("restaurant");
    else setTab("admin");
  }, [role]);

  useEffect(() => {
    if (!token) return;
    if (role === "driver") void loadDriverWork();
    else if (role === "restaurant") void loadRestaurantPanel();
    else void loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  useEffect(() => {
    if (!token || !orderId) return undefined;
    const socket: Socket = io(config.socketUrl, { auth: { token }, transports: ["websocket"] });
    socket.emit("join-order", orderId);
    socket.on("order:update", payload => {
      setNotice(`Live update: order status → ${payload?.status ?? "updated"}`);
      void loadOrder();
    });
    socket.on("tracking:location", payload => {
      if (payload?.lat && payload?.lng) {
        setLocation({ lat: Number(payload.lat), lng: Number(payload.lng) });
      }
    });
    return () => { socket.disconnect(); };
  }, [token, orderId]);

  async function saveToken(nextToken: string, nextRefreshToken?: string) {
    setToken(nextToken);
    await SecureStore.setItemAsync("amberkitchen.token", nextToken);
    if (nextRefreshToken) {
      await SecureStore.setItemAsync("amberkitchen.refresh_token", nextRefreshToken);
    }
  }

  async function logout() {
    setToken("");
    setNotice("Logged out successfully.");
    setError(null);
    setTab("driver");
    setOtpSent(false);
    setOtp("");
    setOrder(null);
    setOrderId("");
    setWallet(null);
    setDashboard(null);
    await Promise.all([
      SecureStore.deleteItemAsync("amberkitchen.token"),
      SecureStore.deleteItemAsync("amberkitchen.refresh_token")
    ]);
  }

  function validatePhone(p: string): string | null {
    const digits = p.replace(/\D/g, "");
    if (!digits) return "Phone number is required.";
    if (digits.length < 10) return "Enter a valid 10-digit phone number.";
    if (digits.length > 12) return "Phone number is too long.";
    return null;
  }

  function validateOtp(o: string): string | null {
    const digits = o.replace(/\D/g, "");
    if (!digits) return "OTP is required.";
    if (digits.length !== 6) return "OTP must be exactly 6 digits.";
    return null;
  }

  // Consistent timestamp formatter used everywhere: "9 May, 2:30 PM"
  function fmtTs(ts: string | null | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // Date-only variant: "9 May 2026"
  function fmtDate(ts: string | null | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts as string;
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  }

  async function requestOtp() {
    const err = validatePhone(phone);
    if (err) { Alert.alert("Invalid phone number", err); return; }
    const response = await run("Sending OTP", () => api.requestOtp(phone));
    if (response != null) {
      setOtpSent(true);
      if (__DEV__ && typeof response === "object" && "devCode" in response && response.devCode) {
        setOtp(String(response.devCode));
      }
    }
  }

  async function verifyOtp() {
    const phoneErr = validatePhone(phone);
    if (phoneErr) { Alert.alert("Invalid phone number", phoneErr); return; }
    const otpErr = validateOtp(otp);
    if (otpErr) { Alert.alert("Invalid OTP", otpErr); return; }
    const response = await run("Verifying OTP", () => api.verifyOtp(phone, otp, role));
    if (response && typeof response === "object" && "token" in response) {
      const r = response as { token: string; refreshToken?: string; user?: { role?: string } };
      const userRole = r.user?.role;
      if (userRole && roleOptions.includes(userRole as Role)) setRole(userRole as Role);
      setToken(r.token);
      void saveToken(r.token, r.refreshToken);
    }
  }

  async function loginWithGoogleToken() {
    if (!googleIdToken.trim()) {
      Alert.alert("Token required", "Paste a Google ID token to sign in with Google.");
      return;
    }
    const response = await run("Google login", () => api.googleLogin(googleIdToken, role));
    if (response && typeof response === "object" && "token" in response) {
      const r = response as { token: string; refreshToken?: string };
      await saveToken(r.token, r.refreshToken);
    }
  }

  async function enablePush() {
    if (!token) { Alert.alert("Login required", "Log in before registering for push notifications."); return; }
    await run("Registering push", async () => {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error("Push notification permission denied. Enable it in Settings.");
      const pushToken = await Notifications.getExpoPushTokenAsync();
      await api.registerDeviceToken(token, pushToken.data);
    });
  }

  async function sendPushTest() {
    if (!token) return;
    await run("Sending test push", () => api.sendTestNotification(token));
  }

  async function useCurrentLocation() {
    await run("Getting location", async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission denied. Enable it in Settings.");
      const current = await Location.getCurrentPositionAsync({});
      setLocation({ lat: current.coords.latitude, lng: current.coords.longitude });
    });
  }

  async function loadMarketplace() {
    if (!token) return;
    await run("Loading marketplace", async () => {
      const [nearbyResult, hotResult, placesResult, offersResult] = await Promise.allSettled([
        api.searchRestaurants(token, { q: "", diet: "all", minRating: 3, sort: "distance", lat: location.lat, lng: location.lng }),
        api.trendingRestaurants(token, location.lat, location.lng),
        api.googlePlacesDelhiNcr(token, 3),
        api.marketplaceOffers(token)
      ]);
      const nearby = nearbyResult.status === "fulfilled" ? nearbyResult.value : [];
      const hot = hotResult.status === "fulfilled" ? hotResult.value : [];
      const places = placesResult.status === "fulfilled" ? placesResult.value : { restaurants: [] };
      const activeOffers = offersResult.status === "fulfilled" ? offersResult.value : [];
      setRestaurants(nearby);
      setTrending(hot);
      setGooglePlaces(places.restaurants);
      setOffers(activeOffers);
      setSelectedRestaurantId(nearby[0]?.restaurant_id ?? hot[0]?.id ?? selectedRestaurantId);
      setAdminMktSnapshot({ nearby: nearby.length, trending: hot.length, offers: activeOffers.length });
    });
  }

  async function createOrder() {
    if (!token) return;
    const response = await run("Creating order", () => api.createOrder(token, firstRestaurant, location.lat, location.lng));
    if (response && typeof response === "object" && "id" in response) {
      setOrderId(String((response as { id: string }).id));
    }
  }

  async function loadOrder() {
    if (!token || !orderId) { Alert.alert("Order required", "Create or accept an order first."); return; }
    const response = await run("Loading order", () => api.getOrder(token, orderId));
    if (response) setOrder(response as OrderSummary);
  }

  async function pay(provider: "paytm" | "phonepe" | "razorpay") {
    if (!token || !orderId) return;
    const response = await run(`Initiating ${provider} payment`, () => api.createPayment(token, provider, orderId));
    const url = response && typeof response === "object"
      ? (response as { redirectUrl?: string; paymentUrl?: string }).redirectUrl ?? (response as { paymentUrl?: string }).paymentUrl
      : undefined;
    if (url) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Payment gateway", "No redirect URL returned. Payment gateway may not be configured for test mode.");
    }
  }

  async function loadEta() {
    if (!token || !orderId) { Alert.alert("Order required", "Create or accept an order first."); return; }
    const response = await run("Calculating ETA", async () => {
      const [nextEta, loop] = await Promise.all([api.orderEta(token, orderId), api.orderEtaLoop(token, orderId)]);
      setEtaLoop(loop);
      return nextEta;
    });
    if (response) setEta(response as Awaited<ReturnType<typeof api.orderEta>>);
  }

  async function openNavigation() {
    const destination = eta?.route.dropoff ?? { lat: location.lat, lng: location.lng };
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`);
  }

  async function pickImage(setValue: (uri: string | null) => void) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission denied", "Photo library access is required for document uploads."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]?.uri) setValue(result.assets[0].uri);
  }

  async function loadDriverWork() {
    if (!token) return;
    await run("Loading driver workspace", async () => {
      const [available, application, walletSummary, transactions, incentivesList] = await Promise.all([
        api.availableDeliveryOrders(token),
        api.myDriverOnboarding(token),
        api.walletSummary(token),
        api.walletTransactions(token),
        api.driverIncentives(token)
      ]);
      setDriverOrders(available);
      setDriverApplication(application);
      setWallet(walletSummary);
      setWalletTransactions(transactions);
      setIncentives(incentivesList);
    });
  }

  async function shareDriverLocation() {
    if (!token || !orderId) { Alert.alert("Order required", "Accept a delivery order first before sharing location."); return; }
    await useCurrentLocation();
    await run("Sharing live location", () => api.sendDriverLocation(token, orderId, location.lat, location.lng));
  }

  async function submitDriverOnboarding() {
    if (!token) return;
    if (!driverFullName || !driverAadhaarLast4 || !selectedAadhaarFront || !selectedAadhaarBack || !selectedSelfie) {
      Alert.alert("Incomplete form", "Fill in your name, Aadhaar last 4, and attach all three documents (Aadhaar front, back, and selfie).");
      return;
    }
    const response = await run("Submitting onboarding", async () => {
      setUploadStep("reading");
      const [frontData, backData, selfieData] = await Promise.all([
        FileSystem.readAsStringAsync(selectedAadhaarFront, { encoding: FileSystem.EncodingType.Base64 }),
        FileSystem.readAsStringAsync(selectedAadhaarBack, { encoding: FileSystem.EncodingType.Base64 }),
        FileSystem.readAsStringAsync(selectedSelfie, { encoding: FileSystem.EncodingType.Base64 })
      ]);
      setUploadStep("uploading1");
      const frontAsset = await api.createAzureBlobAsset(token, "aadhaar-front.jpg", "image/jpeg", 250000, frontData);
      setUploadStep("uploading2");
      const backAsset = await api.createAzureBlobAsset(token, "aadhaar-back.jpg", "image/jpeg", 250000, backData);
      setUploadStep("uploading3");
      const selfieAsset = await api.createAzureBlobAsset(token, "selfie.jpg", "image/jpeg", 200000, selfieData);
      setUploadStep("submitting");
      return api.submitDriverOnboarding(token, {
        fullName: driverFullName,
        aadhaarLast4: driverAadhaarLast4,
        aadhaarFrontUrl: (frontAsset as { url: string }).url,
        aadhaarBackUrl: (backAsset as { url: string }).url,
        selfieUrl: (selfieAsset as { url: string }).url,
        bankAccountLast4: driverBankLast4,
        upiId: driverUpiId
      });
    });
    setUploadStep("");
    if (response) {
      setDriverApplication(response as DriverOnboardingApplication);
      setSelectedAadhaarFront(null);
      setSelectedAadhaarBack(null);
      setSelectedSelfie(null);
    }
  }

  async function loadRestaurantPanel() {
    if (!token) return;
    await run("Loading restaurant panel", async () => {
      const mine = await api.myRestaurants(token);
      setRestaurantAccounts(mine);
      if (mine[0]?.id) {
        const [orders, earnings] = await Promise.all([
          api.restaurantOrders(token, mine[0].id),
          api.restaurantEarnings(token, mine[0].id)
        ]);
        setRestaurantOrders(orders);
        setRestaurantEarnings(earnings);
      }
    });
  }

  async function onboardRestaurant() {
    if (!token) return;
    if (!restaurantName.trim()) {
      Alert.alert("Name required", "Enter the restaurant name.");
      return;
    }
    if (!restaurantAddress.trim()) {
      Alert.alert("Address required", "Enter the restaurant address.");
      return;
    }
    const phoneErr = validatePhone(restaurantPhone);
    if (phoneErr) { Alert.alert("Invalid contact phone", phoneErr); return; }

    await run("Submitting restaurant onboarding", () => api.onboardRestaurant(token, {
      name: restaurantName,
      address: restaurantAddress,
      contactName: restaurantName,
      contactPhone: restaurantPhone,
      cuisineType: restaurantCuisine || "General"
    }));
    await loadRestaurantPanel();
  }

  async function addMenuItem() {
    if (!token || !restaurantAccounts[0]?.id) return;
    if (!restaurantName) { Alert.alert("Name required", "Enter a restaurant name or item name in the field above."); return; }
    await run("Adding menu item", () => api.createMenuItem(token, restaurantAccounts[0].id, {
      name: `${restaurantName} Special`,
      description: "Added from AK Ops mobile app",
      pricePaise: 29900,
      photoUrl: "",
      isVeg: true,
      cuisineType: restaurantCuisine || "General",
      rating: 4.0
    }));
  }

  async function importMobileMenu() {
    if (!token || !restaurantAccounts[0]?.id) return;
    if (googlePlaces.length === 0) {
      Alert.alert("No Google Places data", "Load marketplace data first (use Load Marketplace in the Driver tab or Admin tab).");
      return;
    }
    const items = googlePlaces.slice(0, 3).map(place => ({
      name: place.name,
      description: `Imported item (rating ${place.rating})`,
      pricePaise: 34900,
      photoUrl: place.photoUrl ?? "",
      isVeg: true,
      cuisineType: restaurantCuisine || "General",
      rating: place.rating,
      googlePlaceId: place.name
    }));
    await run("Importing menu items", () => api.importMenuItems(token, restaurantAccounts[0].id, items));
  }

  async function runVerificationChecks() {
    if (!token) return;
    if (!selectedAadhaarFront || !selectedAadhaarBack || !selectedSelfie) {
      Alert.alert("Documents required", "Pick Aadhaar front, Aadhaar back, and selfie before running verification.");
      return;
    }
    await run("Running Azure verification", async () => {
      const [frontData, backData, selfieData] = await Promise.all([
        FileSystem.readAsStringAsync(selectedAadhaarFront, { encoding: FileSystem.EncodingType.Base64 }),
        FileSystem.readAsStringAsync(selectedAadhaarBack, { encoding: FileSystem.EncodingType.Base64 }),
        FileSystem.readAsStringAsync(selectedSelfie, { encoding: FileSystem.EncodingType.Base64 })
      ]);
      const [frontAsset, backAsset, selfieAsset] = await Promise.all([
        api.createAzureBlobAsset(token, "aadhaar-front.jpg", "image/jpeg", 250000, frontData),
        api.createAzureBlobAsset(token, "aadhaar-back.jpg", "image/jpeg", 250000, backData),
        api.createAzureBlobAsset(token, "selfie.jpg", "image/jpeg", 200000, selfieData)
      ]);
      await api.verifyAzureOcr(token, (frontAsset as { url: string }).url);
      await api.verifyAzureFace(token, (selfieAsset as { url: string }).url, (frontAsset as { url: string }).url);
      void backAsset;
    });
  }

  async function loadAdmin() {
    if (!token) return;
    await run("Loading admin dashboard", async () => {
      const results = await Promise.allSettled([
        api.adminDashboard(token),
        api.adminRestaurants(token),
        api.adminUsers(token),
        api.adminAllOrders(token),
        api.paymentReports(token),
        api.deliveryAdminOrders(token),
        api.deliveryDrivers(token),
        api.driverLoadBalancing(token),
        api.marketplaceZones(token),
        api.marketplaceOffers(token),
        api.campaigns(token),
        api.driverIncentives(token),
        api.adminPayouts(token),
        api.supportTickets(token),
        api.auditLogs(token),
        api.verificationChecks(token),
        api.analyticsJobs(token),
        api.demandPredictions(token),
        api.driverOnboardingApplications(token),
        api.driverReferrals(token)
      ]);
      const ok = <T,>(r: PromiseSettledResult<T>, fallback: T): T => r.status === "fulfilled" ? r.value : fallback;
      setDashboard(ok(results[0], null) as AdminDashboard | null);
      setAdminRestaurants(ok(results[1], []));
      setAdminUsers(ok(results[2], []));
      setAdminOrders(ok(results[3], []));
      setPaymentReports(ok(results[4], []));
      setDeliveryOrders(ok(results[5], []));
      setDeliveryDrivers(ok(results[6], []));
      setDriverLoad(ok(results[7], []));
      setZones(ok(results[8], []));
      setOffers(ok(results[9], []));
      setCampaigns(ok(results[10], []));
      setIncentives(ok(results[11], []));
      setAdminPayouts(ok(results[12], []));
      setSupportTickets(ok(results[13], []));
      setAuditLogs(ok(results[14], []));
      setVerificationChecks(ok(results[15], []));
      setAnalyticsJobs(ok(results[16], []));
      setDemandPredictions(ok(results[17], []));
      setDriverApplications(ok(results[18], []));
      setDriverReferrals(ok(results[19], []));
      setLastSynced(new Date());
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed > 0) {
        setNotice(`Admin dashboard loaded (${failed} section${failed > 1 ? "s" : ""} unavailable — check backend logs).`);
      }
    });
  }

  async function refreshZCI() {
    if (!token) return;
    const [zonesRes, campaignsRes, incentivesRes] = await Promise.allSettled([
      api.marketplaceZones(token),
      api.campaigns(token),
      api.driverIncentives(token),
    ]);
    if (zonesRes.status === "fulfilled") setZones(zonesRes.value as typeof zones);
    if (campaignsRes.status === "fulfilled") setCampaigns(campaignsRes.value as typeof campaigns);
    if (incentivesRes.status === "fulfilled") setIncentives(incentivesRes.value as typeof incentives);
  }

  async function submitZCIForm() {
    const formType = zciFormType;
    if (!token || !formType) return;
    const f = zciFormData;
    const autoId = () => Date.now().toString(36).slice(-4).toUpperCase();

    if (formType === "zone") {
      if (!f.name.trim()) { Alert.alert("Name required", "Enter a zone name."); return; }
      if (!f.city.trim()) { Alert.alert("City required", "Enter a city for this zone."); return; }
      const radius = Number(f.radiusKm);
      if (!f.radiusKm.trim() || isNaN(radius) || radius <= 0) {
        Alert.alert("Invalid radius", "Radius must be a positive number (e.g. 3)."); return;
      }
      const sla = Number(f.slaMinutes);
      if (!f.slaMinutes.trim() || isNaN(sla) || sla <= 0 || !Number.isInteger(sla)) {
        Alert.alert("Invalid SLA", "SLA must be a whole number of minutes (e.g. 20)."); return;
      }
      const surge = Number(f.surgeMultiplier);
      if (isNaN(surge) || surge < 1) {
        Alert.alert("Invalid surge multiplier", "Surge multiplier must be 1.0 or higher."); return;
      }
      setZciFormType(null);
      await run("Creating zone", () => api.createZone(token, f.name.trim(), f.city.trim(), location.lat, location.lng, radius, sla));

    } else if (formType === "offer") {
      if (!f.title.trim()) { Alert.alert("Title required", "Enter an offer title."); return; }
      const discountVal = Number(f.discountValue);
      if (!f.discountValue.trim() || isNaN(discountVal) || discountVal <= 0) {
        Alert.alert("Invalid discount", "Discount value must be a positive number."); return;
      }
      if (f.discountType === "percent" && discountVal > 100) {
        Alert.alert("Invalid discount", "Percent discount cannot exceed 100%."); return;
      }
      const minOrder = Number(f.minOrderRupees);
      if (f.minOrderRupees.trim() && (isNaN(minOrder) || minOrder < 0)) {
        Alert.alert("Invalid minimum order", "Minimum order must be a positive number."); return;
      }
      setZciFormType(null);
      await run("Creating offer", () => api.createOffer(
        token,
        f.code.trim() || `MOB${Date.now().toString(36).slice(-5).toUpperCase()}`,
        f.title.trim(),
        f.discountType,
        Math.round(discountVal * 100),
        Math.round((minOrder || 0) * 100)
      ));

    } else if (formType === "campaign") {
      if (!f.name.trim()) { Alert.alert("Name required", "Enter a campaign name."); return; }
      const budget = Number(f.budgetRupees);
      if (!f.budgetRupees.trim() || isNaN(budget) || budget <= 0) {
        Alert.alert("Invalid budget", "Budget must be a positive number (in ₹)."); return;
      }
      setZciFormType(null);
      await run("Creating campaign", () => api.createCampaign(
        token,
        f.name.trim(),
        f.channel,
        Math.round(budget * 100),
        f.aiCreative.trim() || undefined
      ));

    } else {
      if (!f.title.trim()) { Alert.alert("Title required", "Enter an incentive title."); return; }
      const target = Number(f.targetDeliveries);
      if (!f.targetDeliveries.trim() || isNaN(target) || target <= 0 || !Number.isInteger(target)) {
        Alert.alert("Invalid target", "Target deliveries must be a whole number (e.g. 50)."); return;
      }
      const reward = Number(f.rewardRupees);
      if (!f.rewardRupees.trim() || isNaN(reward) || reward <= 0) {
        Alert.alert("Invalid reward", "Reward must be a positive amount in ₹."); return;
      }
      setZciFormType(null);
      await run("Creating incentive", () => api.createDriverIncentive(
        token,
        f.title.trim(),
        target,
        Math.round(reward * 100)
      ));
    }
    await refreshZCI();
  }

  const zciF = (k: keyof typeof zciFormData, v: string) => setZciFormData(d => ({ ...d, [k]: v }));
  const zciAccent = zciFormType === "zone" ? "#2563eb" : zciFormType === "offer" ? "#7c3aed" : zciFormType === "campaign" ? "#d97706" : "#0f766e";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── ZCI Create Form Modal ── */}
      <Modal visible={zciFormType !== null} transparent animationType="slide" onRequestClose={() => setZciFormType(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.zciModalOverlay}>
          <View style={[styles.zciModalSheet, { borderTopColor: zciAccent }]}>
            <View style={styles.zciModalHeader}>
              <Text style={[styles.zciModalTitle, { color: zciAccent }]}>
                {zciFormType === "zone" ? "🗺️ New Delivery Zone" : zciFormType === "offer" ? "🏷️ New Discount Offer" : zciFormType === "campaign" ? "📣 New Campaign" : "🎁 New Driver Incentive"}
              </Text>
              <Pressable onPress={() => setZciFormType(null)} style={styles.zciModalClose}>
                <Text style={styles.zciModalCloseText}>✕</Text>
              </Pressable>
            </View>

            {zciFormType === "zone" && (
              <>
                <Text style={styles.zciFieldLabel}>Zone Name</Text>
                <TextInput style={styles.zciFieldInput} placeholder="e.g. Connaught Place" placeholderTextColor="#555555" value={zciFormData.name} onChangeText={v => zciF("name", v)} />
                <Text style={styles.zciFieldLabel}>City</Text>
                <TextInput style={styles.zciFieldInput} placeholder="Delhi NCR" placeholderTextColor="#555555" value={zciFormData.city} onChangeText={v => zciF("city", v)} />
                <View style={styles.zciFieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zciFieldLabel}>Radius (km)</Text>
                    <TextInput style={styles.zciFieldInput} keyboardType="numeric" placeholder="3" placeholderTextColor="#555555" value={zciFormData.radiusKm} onChangeText={v => zciF("radiusKm", v)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zciFieldLabel}>SLA (min)</Text>
                    <TextInput style={styles.zciFieldInput} keyboardType="numeric" placeholder="20" placeholderTextColor="#555555" value={zciFormData.slaMinutes} onChangeText={v => zciF("slaMinutes", v)} />
                  </View>
                </View>
                <Text style={styles.zciFieldHint}>📍 Centre lat/lng taken from your device location automatically.</Text>
              </>
            )}

            {zciFormType === "offer" && (
              <>
                <Text style={styles.zciFieldLabel}>Offer Code (auto-generated if blank)</Text>
                <TextInput style={styles.zciFieldInput} placeholder="MOB2025A" placeholderTextColor="#555555" autoCapitalize="characters" value={zciFormData.code} onChangeText={v => zciF("code", v)} />
                <Text style={styles.zciFieldLabel}>Title</Text>
                <TextInput style={styles.zciFieldInput} placeholder="Weekend Flat ₹50 Off" placeholderTextColor="#555555" value={zciFormData.title} onChangeText={v => zciF("title", v)} />
                <Text style={styles.zciFieldLabel}>Discount Type</Text>
                <View style={styles.zciSegment}>
                  {(["flat", "percent"] as const).map(t => (
                    <Pressable key={t} style={[styles.zciSegmentBtn, zciFormData.discountType === t && { backgroundColor: "#7c3aed" }]} onPress={() => zciF("discountType", t)}>
                      <Text style={[styles.zciSegmentText, zciFormData.discountType === t && { color: "#fff" }]}>{t === "flat" ? "₹ Flat" : "% Percent"}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.zciFieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zciFieldLabel}>{zciFormData.discountType === "flat" ? "Discount (₹)" : "Discount (%)"}</Text>
                    <TextInput style={styles.zciFieldInput} keyboardType="numeric" placeholder={zciFormData.discountType === "flat" ? "50" : "10"} placeholderTextColor="#555555" value={zciFormData.discountValue} onChangeText={v => zciF("discountValue", v)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zciFieldLabel}>Min Order (₹)</Text>
                    <TextInput style={styles.zciFieldInput} keyboardType="numeric" placeholder="199" placeholderTextColor="#555555" value={zciFormData.minOrderRupees} onChangeText={v => zciF("minOrderRupees", v)} />
                  </View>
                </View>
              </>
            )}

            {zciFormType === "campaign" && (
              <>
                <Text style={styles.zciFieldLabel}>Campaign Name</Text>
                <TextInput style={styles.zciFieldInput} placeholder="Summer Launch 2025" placeholderTextColor="#555555" value={zciFormData.name} onChangeText={v => zciF("name", v)} />
                <Text style={styles.zciFieldLabel}>Channel</Text>
                <View style={styles.zciSegment}>
                  {(["push", "email", "whatsapp", "ads"] as const).map(ch => (
                    <Pressable key={ch} style={[styles.zciSegmentBtn, zciFormData.channel === ch && { backgroundColor: "#d97706" }]} onPress={() => zciF("channel", ch)}>
                      <Text style={[styles.zciSegmentText, zciFormData.channel === ch && { color: "#fff" }]}>{ch === "push" ? "📲 Push" : ch === "email" ? "📧 Email" : ch === "whatsapp" ? "💬 WA" : "📢 Ads"}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.zciFieldLabel}>Budget (₹)</Text>
                <TextInput style={styles.zciFieldInput} keyboardType="numeric" placeholder="1000" placeholderTextColor="#555555" value={zciFormData.budgetRupees} onChangeText={v => zciF("budgetRupees", v)} />
                <Text style={styles.zciFieldLabel}>AI Creative (optional)</Text>
                <TextInput style={[styles.zciFieldInput, styles.zciFieldMultiline]} placeholder="Describe the ad creative…" placeholderTextColor="#555555" multiline numberOfLines={3} value={zciFormData.aiCreative} onChangeText={v => zciF("aiCreative", v)} />
              </>
            )}

            {zciFormType === "incentive" && (
              <>
                <Text style={styles.zciFieldLabel}>Incentive Title</Text>
                <TextInput style={styles.zciFieldInput} placeholder="Weekend Delivery Bonus" placeholderTextColor="#555555" value={zciFormData.title} onChangeText={v => zciF("title", v)} />
                <View style={styles.zciFieldRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zciFieldLabel}>Target Deliveries</Text>
                    <TextInput style={styles.zciFieldInput} keyboardType="numeric" placeholder="5" placeholderTextColor="#555555" value={zciFormData.targetDeliveries} onChangeText={v => zciF("targetDeliveries", v)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.zciFieldLabel}>Reward (₹)</Text>
                    <TextInput style={styles.zciFieldInput} keyboardType="numeric" placeholder="75" placeholderTextColor="#555555" value={zciFormData.rewardRupees} onChangeText={v => zciF("rewardRupees", v)} />
                  </View>
                </View>
                <Text style={styles.zciFieldHint}>🎁 Reward is paid when the driver completes the target number of deliveries.</Text>
              </>
            )}

            <View style={styles.zciModalActions}>
              <Pressable style={styles.zciModalCancel} onPress={() => setZciFormType(null)}>
                <Text style={styles.zciModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.zciModalSubmit, { backgroundColor: zciAccent }]} onPress={submitZCIForm} disabled={loading}>
                <Text style={styles.zciModalSubmitText}>{loading ? "Creating…" : "Create"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView contentContainerStyle={styles.container}>

        {/* ── Login Panel ── */}
        {!authed ? (
          <View style={styles.loginPanel}>
            {/* Brand header */}
            <View style={styles.loginBrand}>
              <View style={styles.loginLogo}>
                <Text style={styles.loginLogoText}>🍳</Text>
              </View>
              <View>
                <Text style={styles.loginBrandName}>AmberKitchen</Text>
                <Text style={styles.loginBrandTagline}>Operations Platform</Text>
              </View>
            </View>

            {/* Alerts */}
            {isOffline && (
              <View style={styles.loginAlert}>
                <Text style={styles.loginAlertIcon}>⚠</Text>
                <Text style={styles.loginAlertText}>No internet connection</Text>
              </View>
            )}
            {error && !isOffline && (
              <View style={[styles.loginAlert, styles.loginAlertError]}>
                <Text style={styles.loginAlertIcon}>✕</Text>
                <Text style={styles.loginAlertText}>{error}</Text>
              </View>
            )}

            {!otpSent ? (
              <>
                <View style={styles.loginField}>
                  <Text style={styles.loginFieldLabel}>Role</Text>
                  <RoleDropdown value={role} onChange={r => setRole(r)} />
                </View>
                <View style={styles.loginField}>
                  <Text style={styles.loginFieldLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.loginInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+91 9999 000 003"
                    keyboardType="phone-pad"
                    placeholderTextColor="#aaaaaa"
                  />
                </View>
                <Pressable
                  style={[styles.loginPrimaryBtn, (phone.replace(/\D/g, "").length < 10 || loading) && styles.loginPrimaryBtnDisabled]}
                  onPress={requestOtp}
                  disabled={phone.replace(/\D/g, "").length < 10 || loading}
                >
                  <Text style={styles.loginPrimaryBtnText}>{loading ? "Sending…" : "Send OTP"}</Text>
                </Pressable>
                <View style={styles.loginDividerRow}>
                  <View style={styles.loginDividerLine} />
                  <Text style={styles.loginDividerText}>or</Text>
                  <View style={styles.loginDividerLine} />
                </View>
                <View style={styles.loginSecondaryRow}>
                  <Pressable style={styles.loginSecondaryBtn} onPress={loginWithGoogleToken}>
                    <Text style={styles.loginSecondaryBtnText}>G  Google</Text>
                  </Pressable>
                  <Pressable style={styles.loginSecondaryBtn} onPress={enablePush}>
                    <Text style={styles.loginSecondaryBtnText}>🔔  Push</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.loginInput, styles.loginInputSubtle]}
                  value={googleIdToken}
                  onChangeText={setGoogleIdToken}
                  placeholder="Google ID token (optional)"
                  placeholderTextColor="#cbd5e1"
                />
              </>
            ) : (
              <>
                <View style={styles.loginOtpInfo}>
                  <Text style={styles.loginOtpInfoText}>OTP sent to</Text>
                  <Text style={styles.loginOtpPhone}>{phone}</Text>
                </View>
                <View style={styles.loginField}>
                  <Text style={styles.loginFieldLabel}>One-Time Password</Text>
                  <TextInput
                    style={styles.loginInput}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="Enter OTP"
                    keyboardType="number-pad"
                    placeholderTextColor="#aaaaaa"
                    autoFocus
                  />
                </View>
                <Pressable
                  style={[styles.loginPrimaryBtn, (otp.replace(/\D/g, "").length !== 6 || loading) && styles.loginPrimaryBtnDisabled]}
                  onPress={verifyOtp}
                  disabled={otp.replace(/\D/g, "").length !== 6 || loading}
                >
                  <Text style={styles.loginPrimaryBtnText}>{loading ? "Verifying…" : "Verify OTP"}</Text>
                </Pressable>
                <Pressable style={styles.loginBackBtn} onPress={() => { setOtpSent(false); setOtp(""); setError(null); }}>
                  <Text style={styles.loginBackBtnText}>← Change number or role</Text>
                </Pressable>
                <Pressable style={styles.loginSecondaryBtnSm} onPress={sendPushTest}>
                  <Text style={styles.loginSecondaryBtnSmText}>Send test push notification</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View style={styles.loginSignedIn}>
            <View style={styles.loginSignedInInfo}>
              <View style={styles.loginSignedInDot} />
              <View>
                <Text style={styles.loginSignedInPhone}>{phone || "Signed in"}</Text>
                <Text style={styles.loginSignedInRole}>{role.replace(/_/g, " ").toUpperCase()}</Text>
              </View>
            </View>
            <Pressable style={styles.loginLogoutBtn} onPress={logout}>
              <Text style={styles.loginLogoutBtnText}>Logout</Text>
            </Pressable>
          </View>
        )}

        {authed && tab !== "admin" && (
          <Segmented values={availableTabs} value={tab} onChange={next => setTab(next as Tab)} />
        )}

        {isAdmin && tab === "admin" && (
          <>
          <View style={styles.adminHeader}>
            <View style={styles.adminHeaderTop}>
              <View>
                <Text style={styles.adminHeaderTitle}>AmberKitchen</Text>
                <Text style={styles.adminHeaderConsole}>Operations Console</Text>
              </View>
              <View style={styles.adminHeaderRight}>
                {lastSynced && (
                  <Text style={styles.adminHeaderSync}>
                    Synced {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
                <Pressable style={styles.adminRefreshBtn} onPress={loadAdmin} disabled={loading}>
                  <Text style={styles.adminRefreshBtnText}>{loading ? "…" : "↻ Refresh"}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.adminHeaderBottom}>
              <View style={styles.adminRoleBadge}>
                <Text style={styles.adminRoleBadgeText}>{role.replace("_", " ").toUpperCase()}</Text>
              </View>
              <View style={styles.adminStatusDot} />
              <Text style={styles.adminStatusText}>
                {loading && !lastSynced ? "Fetching 20 endpoints…" : dashboard ? "Dashboard loaded" : "Loading…"}
              </Text>
            </View>
            {loading && lastSynced && (
              <View style={styles.adminRefreshBanner}>
                <ActivityIndicator size="small" color="#0f766e" style={{ marginRight: 8 }} />
                <Text style={styles.adminRefreshBannerText}>Refreshing dashboard…</Text>
              </View>
            )}
          </View>
          {loading && !lastSynced && (
            <View style={styles.adminLoadingOverlay}>
              <ActivityIndicator size="large" color="#0f766e" />
              <Text style={styles.adminLoadingTitle}>Loading Admin Dashboard</Text>
              <Text style={styles.adminLoadingHint}>Fetching 20 endpoints in parallel…</Text>
            </View>
          )}
          </>
        )}

        {/* ── Driver Tab ── */}
        {authed && tab === "driver" && (
          <Card title="Delivery Partner App">
            <Text style={styles.sectionHint}>Onboard, browse orders, manage deliveries, and track earnings.</Text>
            <View style={styles.actions}>
              <Button label="Load Driver Workspace" onPress={loadDriverWork} disabled={!authed} />
              <Button label="Run Background Check" onPress={() => run("Background check", () => api.runDriverBackgroundCheck(token))} disabled={!authed} />
            </View>

            {/* Marketplace & Orders */}
            <Divider label="Marketplace & Orders" icon="🛒" subtitle="Restaurants, orders, payments and ETA" collapsed={isCollapsed("Marketplace & Orders")} onPress={() => togglePanel("Marketplace & Orders")} />
            {!isCollapsed("Marketplace & Orders") && (
              <>
            {/* Primary actions */}
            <View style={styles.mkTopRow}>
              <Pressable style={[styles.mkPrimaryBtn, (!authed || loading) && styles.mkPrimaryBtnDisabled]} onPress={loadMarketplace} disabled={!authed || loading}>
                <Text style={styles.mkPrimaryBtnIcon}>{loading ? "⏳" : "🔄"}</Text>
                <Text style={styles.mkPrimaryBtnText}>{loading ? "Loading…" : "Load Marketplace"}</Text>
              </Pressable>
              <Pressable style={[styles.mkSecondaryBtn, !authed && styles.mkSecondaryBtnDisabled]} onPress={createOrder} disabled={!authed}>
                <Text style={styles.mkSecondaryBtnText}>+ New Order</Text>
              </Pressable>
            </View>

            {/* Stats strip */}
            {(restaurants.length > 0 || trending.length > 0 || offers.length > 0) && (
              <View style={styles.mkStatsStrip}>
                {restaurants.length > 0 && <View style={styles.mkStatPill}><Text style={styles.mkStatPillIcon}>🏪</Text><Text style={styles.mkStatPillText}>{restaurants.length} nearby</Text></View>}
                {trending.length > 0 && <View style={styles.mkStatPill}><Text style={styles.mkStatPillIcon}>🔥</Text><Text style={styles.mkStatPillText}>{trending.length} trending</Text></View>}
                {offers.length > 0 && <View style={styles.mkStatPill}><Text style={styles.mkStatPillIcon}>🏷️</Text><Text style={styles.mkStatPillText}>{offers.length} offers</Text></View>}
              </View>
            )}

            {/* Empty state */}
            {restaurants.length === 0 && trending.length === 0 && (
              <Text style={styles.emptyHint}>Tap "Load Marketplace" to fetch nearby restaurants.</Text>
            )}

            {/* Nearby restaurants */}
            {restaurants.length > 0 && (
              <>
                <View style={styles.mkSectionHeader}>
                  <Text style={styles.mkSectionHeaderIcon}>🏪</Text>
                  <Text style={styles.mkSectionHeaderText}>Nearby Restaurants</Text>
                </View>
                {restaurants.slice(0, 3).map(item => (
                  <View key={item.menu_item_id} style={styles.mkCard}>
                    <View style={styles.mkCardTop}>
                      <View style={styles.mkRestaurantIcon}><Text style={styles.mkRestaurantEmoji}>🍽️</Text></View>
                      <View style={styles.mkRestaurantInfo}>
                        <Text style={styles.mkRestaurantName}>{item.restaurant_name}</Text>
                        <Text style={styles.mkDishName}>{item.menu_item_name}</Text>
                      </View>
                      <Pressable style={styles.mkSelectBtn} onPress={() => setSelectedRestaurantId(item.restaurant_id)}>
                        <Text style={styles.mkSelectBtnText}>Select</Text>
                      </Pressable>
                    </View>
                    <View style={styles.mkCardMeta}>
                      <Text style={styles.mkPrice}>₹{(item.price_paise / 100).toFixed(0)}</Text>
                      {item.is_veg && <View style={styles.mkVegBadge}><Text style={styles.mkVegDot}>●</Text></View>}
                      {item.distance_km ? <View style={styles.mkDistBadge}><Text style={styles.mkDistText}>{Number(item.distance_km).toFixed(1)} km</Text></View> : null}
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Trending */}
            {trending.length > 0 && (
              <>
                <View style={styles.mkSectionHeader}>
                  <Text style={styles.mkSectionHeaderIcon}>🔥</Text>
                  <Text style={styles.mkSectionHeaderText}>Trending</Text>
                </View>
                {trending.slice(0, 2).map(item => (
                  <View key={item.id} style={styles.mkCard}>
                    <View style={styles.mkCardTop}>
                      <View style={[styles.mkRestaurantIcon, { backgroundColor: "#fff7ed" }]}><Text style={styles.mkRestaurantEmoji}>🔥</Text></View>
                      <View style={styles.mkRestaurantInfo}>
                        <Text style={styles.mkRestaurantName}>{item.name}</Text>
                        <Text style={styles.mkDishName}>{item.recent_orders} recent orders</Text>
                      </View>
                      {item.distance_km ? <View style={styles.mkDistBadge}><Text style={styles.mkDistText}>{Number(item.distance_km).toFixed(1)} km</Text></View> : null}
                    </View>
                    <Pressable style={styles.mkSelectBtn} onPress={() => setSelectedRestaurantId(item.id)}>
                      <Text style={styles.mkSelectBtnText}>Select</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            {/* Offers */}
            {offers.length > 0 && (
              <>
                <View style={styles.mkSectionHeader}>
                  <Text style={styles.mkSectionHeaderIcon}>🏷️</Text>
                  <Text style={styles.mkSectionHeaderText}>Active Offers</Text>
                </View>
                <View style={styles.mkOfferChips}>
                  {offers.slice(0, 3).map(item => (
                    <View key={item.id} style={styles.mkOfferChip}>
                      <Text style={styles.mkOfferCode}>{item.code}</Text>
                      <Text style={styles.mkOfferDesc}>{item.discount_type === "flat" ? `₹${item.discount_value / 100}` : `${item.discount_value}%`} off — {item.title}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Active order card */}
            {orderId ? (
              <View style={styles.mkOrderCard}>
                <View style={styles.mkOrderCardHeader}>
                  <View style={styles.mkOrderIdBadge}>
                    <Text style={styles.mkOrderIdText}>#{orderId.slice(-10).toUpperCase()}</Text>
                  </View>
                  {order && <View style={[styles.mkOrderStatusDot, { backgroundColor: orderStatusColor(order.status) }]} />}
                </View>

                {order && (
                  <View style={styles.mkOrderDetail}>
                    <Text style={styles.mkOrderStatus}>{titleCase(order.status)}</Text>
                    <Text style={styles.mkOrderTotal}>{formatCurrency(order.total_paise)}</Text>
                  </View>
                )}
                {order?.delivery_address ? <Text style={styles.mkOrderAddress}>{order.delivery_address}</Text> : null}
                {order?.driver_name ? <Text style={styles.mkOrderDriver}>🚗 {order.driver_name}</Text> : null}

                <View style={styles.mkActionRow}>
                  <Pressable style={styles.mkActionBtn} onPress={loadOrder}>
                    <Text style={styles.mkActionIcon}>📋</Text>
                    <Text style={styles.mkActionLabel}>Details</Text>
                  </Pressable>
                  <Pressable style={styles.mkActionBtn} onPress={loadEta}>
                    <Text style={styles.mkActionIcon}>⏱</Text>
                    <Text style={styles.mkActionLabel}>ETA</Text>
                  </Pressable>
                  <Pressable style={styles.mkActionBtn} onPress={openNavigation}>
                    <Text style={styles.mkActionIcon}>🗺️</Text>
                    <Text style={styles.mkActionLabel}>Navigate</Text>
                  </Pressable>
                </View>

                <View style={styles.mkPayRow}>
                  <Pressable style={[styles.mkPayBtn, { backgroundColor: "#00457c" }]} onPress={() => pay("paytm")}>
                    <Text style={styles.mkPayBtnText}>Paytm</Text>
                  </Pressable>
                  <Pressable style={[styles.mkPayBtn, { backgroundColor: "#5f259f" }]} onPress={() => pay("phonepe")}>
                    <Text style={styles.mkPayBtnText}>PhonePe</Text>
                  </Pressable>
                  <Pressable style={[styles.mkPayBtn, { backgroundColor: "#2d81f7" }]} onPress={() => pay("razorpay")}>
                    <Text style={styles.mkPayBtnText}>Razorpay</Text>
                  </Pressable>
                </View>

                <View style={styles.mkDangerRow}>
                  <Pressable style={styles.mkDangerBtn} onPress={() => run("Cancelling order", () => api.cancelOrder(token, orderId, "Test cancellation from AK Ops"))}>
                    <Text style={styles.mkDangerBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.mkDangerBtn} onPress={() => run("Requesting refund", () => api.requestRefund(token, orderId, "Test refund from AK Ops"))}>
                    <Text style={styles.mkDangerBtnText}>Refund</Text>
                  </Pressable>
                  <Pressable style={styles.mkDangerBtn} onPress={async () => {
                    const res = await run("Reordering", () => api.reorder(token, orderId));
                    if (res && typeof res === "object" && "id" in res) setOrderId(String((res as { id: string }).id));
                  }}>
                    <Text style={styles.mkDangerBtnText}>Reorder</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* ETA card */}
            {eta && (
              <View style={styles.mkEtaCard}>
                <View style={styles.mkEtaHeader}>
                  <Text style={styles.mkEtaMinutes}>{eta.predictedEtaMinutes}</Text>
                  <Text style={styles.mkEtaUnit}>min ETA</Text>
                </View>
                <View style={styles.mkEtaRoute}>
                  <View style={styles.mkEtaRouteItem}>
                    <Text style={styles.mkEtaRouteLabel}>To Pickup</Text>
                    <Text style={styles.mkEtaRouteValue}>{eta.route.distanceToPickupKm.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.mkEtaRouteItem}>
                    <Text style={styles.mkEtaRouteLabel}>To Dropoff</Text>
                    <Text style={styles.mkEtaRouteValue}>{eta.route.distanceToDropoffKm.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.mkEtaRouteItem}>
                    <Text style={styles.mkEtaRouteLabel}>Arrives By</Text>
                    <Text style={styles.mkEtaRouteValue}>{fmtTs(eta.predictedDeliveryAt)}</Text>
                  </View>
                </View>
              </View>
            )}
            {etaLoop.slice(0, 2).map(item => (
              <View key={item.id} style={styles.mkEtaLoopRow}>
                <Text style={styles.mkEtaLoopMin}>{item.predicted_eta_minutes} min</Text>
                <Text style={styles.mkEtaLoopSrc}>{item.source}</Text>
                <Text style={styles.mkEtaLoopTime}>{fmtTs(item.created_at)}</Text>
              </View>
            ))}
              </>
            )}

            {/* Driver Onboarding */}
            <Divider label="Driver Onboarding" icon="🚗" subtitle="Documents, verification and application status" collapsed={isCollapsed("Driver Onboarding")} onPress={() => togglePanel("Driver Onboarding")} />
            {!isCollapsed("Driver Onboarding") && (
              <>
            <TextInput style={styles.input} value={driverFullName} onChangeText={setDriverFullName} placeholder="Full name" />
            <TextInput style={styles.input} value={driverAadhaarLast4} onChangeText={setDriverAadhaarLast4} placeholder="Aadhaar last 4 digits" keyboardType="number-pad" />
            <TextInput style={styles.input} value={driverBankLast4} onChangeText={setDriverBankLast4} placeholder="Bank account last 4 digits (optional)" keyboardType="number-pad" />
            <TextInput style={styles.input} value={driverUpiId} onChangeText={setDriverUpiId} placeholder="UPI ID (e.g. name@upi)" />
            <View style={styles.actions}>
              <Button label="Pick Aadhaar Front" onPress={() => pickImage(setSelectedAadhaarFront)} disabled={!authed} />
              <Button label="Pick Aadhaar Back" onPress={() => pickImage(setSelectedAadhaarBack)} disabled={!authed} />
              <Button label="Pick Selfie" onPress={() => pickImage(setSelectedSelfie)} disabled={!authed} />
            </View>
            <View style={[styles.actions, styles.uploadPreviews]}>
              {selectedAadhaarFront ? <Image source={{ uri: selectedAadhaarFront }} style={styles.uploadPreview} /> : null}
              {selectedAadhaarBack ? <Image source={{ uri: selectedAadhaarBack }} style={styles.uploadPreview} /> : null}
              {selectedSelfie ? <Image source={{ uri: selectedSelfie }} style={styles.uploadPreview} /> : null}
            </View>
            {(!selectedAadhaarFront || !selectedAadhaarBack || !selectedSelfie) && (
              <Text style={styles.emptyHint}>
                {`Attached: ${[selectedAadhaarFront ? "Aadhaar front ✓" : null, selectedAadhaarBack ? "Aadhaar back ✓" : null, selectedSelfie ? "Selfie ✓" : null].filter(Boolean).join(", ") || "none yet"}`}
              </Text>
            )}
            <View style={styles.actions}>
              <Button label="Submit Onboarding" onPress={submitDriverOnboarding} disabled={!authed || !!uploadStep} />
              <Button label="Run Verification Checks" onPress={runVerificationChecks} disabled={!authed} />
            </View>
            {!!uploadStep && (
              <View style={styles.uploadProgressBar}>
                <ActivityIndicator size="small" color="#0f766e" style={{ marginRight: 10 }} />
                <Text style={styles.uploadProgressText}>
                  {uploadStep === "reading" && "Reading documents…"}
                  {uploadStep === "uploading1" && "Uploading Aadhaar front (1/3)…"}
                  {uploadStep === "uploading2" && "Uploading Aadhaar back (2/3)…"}
                  {uploadStep === "uploading3" && "Uploading selfie (3/3)…"}
                  {uploadStep === "submitting" && "Submitting application…"}
                </Text>
              </View>
            )}
            {driverApplication ? (
              <Summary title="Onboarding Status" lines={[
                driverApplication.full_name,
                `OCR: ${driverApplication.ocr_status}`,
                `Selfie: ${driverApplication.selfie_status}`,
                `Background check: ${driverApplication.background_check_status}`,
                `Approval: ${driverApplication.approval_status}`,
                ...(driverApplication.referral_code ? [`Referral code: ${driverApplication.referral_code}`] : []),
                ...(driverApplication.admin_note ? [`Admin note: ${driverApplication.admin_note}`] : [])
              ]} />
            ) : (
              <Text style={styles.emptyHint}>No onboarding application found for this account.</Text>
            )}
              </>
            )}

            {/* Active Deliveries */}
            <Divider label="Active Deliveries" icon="📍" subtitle="Live location, delivery status and navigation" collapsed={isCollapsed("Active Deliveries")} onPress={() => togglePanel("Active Deliveries")} />
            {!isCollapsed("Active Deliveries") && (
              <>
            <View style={styles.actions}>
              <Button label="Share Live Location" onPress={shareDriverLocation} disabled={!orderId} />
            </View>
            {driverOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📭</Text>
                <Text style={styles.emptyStateText}>No available delivery orders</Text>
                <Text style={styles.emptyStateHint}>New orders will appear here automatically.</Text>
                <Pressable style={styles.emptyStateBtn} onPress={loadDriverWork}><Text style={styles.emptyStateBtnText}>Refresh</Text></Pressable>
              </View>
            ) : (
              <>
                {driverOrders.slice(0, driverOrdersLimit).map(item => (
                  <ListItem
                    key={item.id}
                    title={`${item.restaurant_name} → ${item.delivery_address}`}
                    subtitle={`${titleCase(item.status)} · ${formatCurrency(item.total_paise)} — Tap to accept`}
                    onPress={() => {
                      setOrderId(item.id);
                      void run("Accepting delivery", () => api.acceptDeliveryOrder(token, item.id));
                    }}
                  />
                ))}
                {driverOrders.length > driverOrdersLimit && (
                  <Pressable style={styles.loadMoreBtn} onPress={() => setDriverOrdersLimit(l => l + 10)}>
                    <Text style={styles.loadMoreBtnText}>Load more ({driverOrders.length - driverOrdersLimit} remaining)</Text>
                  </Pressable>
                )}
              </>
            )}
            <View style={styles.actions}>
              <Button
                label="Mark Picked Up"
                onPress={() => run("Marking picked up", () => api.updateOrderStatus(token, orderId, "picked_up"))}
                disabled={!orderId}
              />
              <Button
                label="Mark Delivered"
                onPress={() => run("Marking delivered", () => api.updateOrderStatus(token, orderId, "delivered"))}
                disabled={!orderId}
              />
              <Button
                label="Request Payout"
                onPress={() => run("Requesting payout", () => api.requestPayout(token, 50000, "upi", "driver@upi"))}
                disabled={!authed}
              />
            </View>

            {/* Incentives */}
            <Text style={styles.sectionTitle}>Driver Incentives</Text>
            {incentives.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🎁</Text>
                <Text style={styles.emptyStateText}>No active incentives</Text>
                <Text style={styles.emptyStateHint}>Admins can create delivery bonuses in the Admin tab.</Text>
              </View>
            ) : (
              <>
                {incentives.slice(0, incentivesLimit).map(item => (
                  <ListItem key={item.id} title={item.title} subtitle={`${item.target_deliveries} deliveries → ${formatCurrency(item.reward_paise)} · ${titleCase(item.status)}`} />
                ))}
                {incentives.length > incentivesLimit && (
                  <Pressable style={styles.loadMoreBtn} onPress={() => setIncentivesLimit(l => l + 5)}>
                    <Text style={styles.loadMoreBtnText}>Load more ({incentives.length - incentivesLimit} remaining)</Text>
                  </Pressable>
                )}
              </>
            )}
              </>
            )}

            {/* Wallet */}
            <Divider label="Wallet & Earnings" icon="💰" subtitle="Balance, transactions and payout requests" collapsed={isCollapsed("Wallet & Earnings")} onPress={() => togglePanel("Wallet & Earnings")} />
            {!isCollapsed("Wallet & Earnings") && (
              <>
            {wallet ? (
              <Summary title="Wallet Summary" lines={[
                `Balance: ${formatCurrency(wallet.wallet.balance_paise)}`,
                `Total earnings: ${formatCurrency(Number(wallet.earnings.earned_paise ?? 0))}`,
                `Deliveries completed: ${wallet.earnings.deliveries}`,
                `Pending payout: ${formatCurrency(Number(wallet.pendingPayouts?.requested_paise ?? 0))}`
              ]} />
            ) : (
              <Text style={styles.emptyHint}>Wallet data not loaded. Tap "Load Driver Workspace" above.</Text>
            )}
            {walletTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>💳</Text>
                <Text style={styles.emptyStateText}>No transactions yet</Text>
                <Text style={styles.emptyStateHint}>Earnings from deliveries and payouts will appear here.</Text>
              </View>
            ) : (
              <>
                {walletTransactions.slice(0, txLimit).map(item => (
                  <ListItem key={item.id} title={`${titleCase(item.type)} — ${formatCurrency(item.amount_paise)}`} subtitle={titleCase(item.status)} />
                ))}
                {walletTransactions.length > txLimit && (
                  <Pressable style={styles.loadMoreBtn} onPress={() => setTxLimit(l => l + 5)}>
                    <Text style={styles.loadMoreBtnText}>Load more ({walletTransactions.length - txLimit} remaining)</Text>
                  </Pressable>
                )}
              </>
            )}
              </>
            )}
          </Card>
        )}

        {/* ── Restaurant Tab ── */}
        {authed && tab === "restaurant" && (
          <Card title="Restaurant Panel">
            <Text style={styles.sectionHint}>Manage onboarding, menu items, incoming orders and earnings.</Text>

            <Divider label="Restaurant Onboarding" icon="🏪" subtitle="Register your restaurant and upload documents" collapsed={isCollapsed("Restaurant Onboarding")} onPress={() => togglePanel("Restaurant Onboarding")} />
            {!isCollapsed("Restaurant Onboarding") && (
              <>
            <TextInput style={styles.input} value={restaurantName} onChangeText={setRestaurantName} placeholder="Restaurant name" />
            <TextInput style={styles.input} value={restaurantAddress} onChangeText={setRestaurantAddress} placeholder="Restaurant address" />
            <TextInput style={styles.input} value={restaurantPhone} onChangeText={setRestaurantPhone} placeholder="Contact phone" keyboardType="phone-pad" />
            <TextInput style={styles.input} value={restaurantCuisine} onChangeText={setRestaurantCuisine} placeholder="Cuisine type (e.g. North Indian)" />
            <View style={styles.actions}>
              <Button label="Onboard Restaurant" onPress={onboardRestaurant} disabled={!authed} />
              <Button label="Load My Restaurants" onPress={loadRestaurantPanel} disabled={!authed} />
            </View>
            {restaurantAccounts.length === 0
              ? <Text style={styles.emptyHint}>No restaurants found. Fill the form and tap "Onboard Restaurant", or tap "Load My Restaurants" to refresh.</Text>
              : restaurantAccounts.map(item => (
                <ListItem key={item.id} title={item.name} subtitle={`${titleCase(item.approval_status)} · ${titleCase(item.onboarding_status)}`} />
              ))
            }

            {restaurantAccounts[0]?.id && (
              <>
                <Divider label="Menu Management" />
                <Text style={styles.sectionHint}>Add items individually or import a batch from Google Places data.</Text>
                <View style={styles.actions}>
                  <Button label="Add Menu Item" onPress={addMenuItem} disabled={!restaurantAccounts[0]?.id} />
                  <Button label="Import Menu Items" onPress={importMobileMenu} disabled={!restaurantAccounts[0]?.id} />
                </View>
              </>
            )}
              </>
            )}

            <Divider label="Incoming Orders" icon="📥" subtitle="Accept, prepare and track customer orders" collapsed={isCollapsed("Incoming Orders")} onPress={() => togglePanel("Incoming Orders")} />
            {!isCollapsed("Incoming Orders") && (
              <>
            <View style={styles.actions}>
              <Button label="Refresh Orders" onPress={loadRestaurantPanel} disabled={!authed} />
            </View>
            {restaurantOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📥</Text>
                <Text style={styles.emptyStateText}>No pending orders</Text>
                <Text style={styles.emptyStateHint}>Incoming customer orders will appear here. Tap Refresh to check.</Text>
                <Pressable style={styles.emptyStateBtn} onPress={loadRestaurantPanel}><Text style={styles.emptyStateBtnText}>Refresh Orders</Text></Pressable>
              </View>
            ) : (
              <>
                {restaurantOrders.slice(0, restaurantOrdersLimit).map(item => (
                  <View key={item.id} style={styles.orderCard}>
                    <Text style={styles.listTitle}>Order #{item.id.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.listSubtitle}>{titleCase(item.status)} · {formatCurrency(item.total_paise)}</Text>
                    <View style={[styles.actions, { marginTop: 8 }]}>
                      <Button
                        label="Accept"
                        onPress={() => run("Accepting order", () => api.decideRestaurantOrder(token, item.id, "accepted"))}
                      />
                      <Button
                        label="Reject"
                        onPress={() => run("Rejecting order", () => api.decideRestaurantOrder(token, item.id, "cancelled"))}
                      />
                    </View>
                  </View>
                ))}
                {restaurantOrders.length > restaurantOrdersLimit && (
                  <Pressable style={styles.loadMoreBtn} onPress={() => setRestaurantOrdersLimit(l => l + 10)}>
                    <Text style={styles.loadMoreBtnText}>Load more ({restaurantOrders.length - restaurantOrdersLimit} remaining)</Text>
                  </Pressable>
                )}
              </>
            )}

            {restaurantEarnings && (
              <Summary title="Earnings Summary" lines={[
                `Orders: ${restaurantEarnings.orders}`,
                `Gross: ${formatCurrency(Number(restaurantEarnings.gross_paise))}`,
                `Estimated payout: ${formatCurrency(Number(restaurantEarnings.estimated_payout_paise))}`
              ]} />
            )}
              </>
            )}
          </Card>
        )}

        {/* ── Admin Tab ── */}
        {isAdmin && tab === "admin" && (
          <Card>

            {/* KPI Grid */}
            <View style={styles.kpiGrid}>
              <KpiCard label="Users"       value={dashboard ? String(dashboard.users) : "—"}              accent="#0f766e" icon="👥" />
              <KpiCard label="Revenue"     value={dashboard ? formatCurrency(dashboard.revenuePaise) : "—"} accent="#7c3aed" icon="₹" />
              <KpiCard label="Restaurants" value={String(adminRestaurants.length) || "—"}                  accent="#d97706" icon="🏪" />
              <KpiCard label="Orders"      value={String(adminOrders.length) || "—"}                       accent="#2563eb" icon="📦" />
              <KpiCard label="Drivers"     value={String(driverLoad.length) || "—"}                        accent="#16a34a" icon="🚗" />
              <KpiCard label="Live"        value={String(deliveryOrders.length) || "—"}                    accent="#dc2626" icon="⚡" />
            </View>

            {/* Order status strip */}
            {dashboard && dashboard.ordersByStatus.length > 0 && (
              <View style={styles.statusStrip}>
                {dashboard.ordersByStatus.map(s => (
                  <View key={s.status} style={styles.statusPill}>
                    <View style={[styles.statusPillDot, { backgroundColor: orderStatusColor(s.status) }]} />
                    <Text style={styles.statusPillName}>{titleCase(s.status)}</Text>
                    <Text style={styles.statusPillCount}>{s.count}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent orders */}
            {dashboard && dashboard.recentOrders.length > 0 && (
              <>
                <View style={styles.recentOrdersHeader}>
                  <Text style={styles.recentOrdersTitle}>Recent Orders</Text>
                  <View style={styles.recentOrdersCount}>
                    <Text style={styles.recentOrdersCountText}>{dashboard.recentOrders.length}</Text>
                  </View>
                </View>
                {dashboard.recentOrders.slice(0, 3).map(o => {
                  const statusColor = orderStatusColor(o.status);
                  return (
                    <View key={o.id} style={[styles.recentOrderCard, { borderLeftColor: statusColor }]}>
                      <View style={styles.recentOrderCardTop}>
                        <Text style={styles.recentOrderRestaurant} numberOfLines={1}>{o.restaurant_name ?? "Unknown"}</Text>
                        <View style={[styles.recentOrderBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                          <View style={[styles.recentOrderBadgeDot, { backgroundColor: statusColor }]} />
                          <Text style={[styles.recentOrderBadgeText, { color: statusColor }]}>{titleCase(o.status)}</Text>
                        </View>
                      </View>
                      <View style={styles.recentOrderCardBottom}>
                        <Text style={styles.recentOrderCardId}>#{String(o.id).slice(-8).toUpperCase()}</Text>
                        <Text style={styles.recentOrderCardDot}>·</Text>
                        <Text style={[styles.recentOrderCardAmount, { color: statusColor }]}>{formatCurrency(o.total_paise)}</Text>
                        <Text style={styles.recentOrderCardDot}>·</Text>
                        <Text style={styles.recentOrderCardDate}>{fmtTs(o.created_at)}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Quick actions */}
            <View style={styles.quickActions}>
              <Pressable style={[styles.quickActionBtn, styles.quickActionBtnSecondary]} onPress={loadMarketplace} disabled={!authed || loading}>
                <Text style={styles.quickActionIcon}>🛒</Text>
                <Text style={styles.quickActionLabel}>Marketplace</Text>
              </Pressable>
              <Pressable style={[styles.quickActionBtn, styles.quickActionBtnSecondary]}
                onPress={() => run("AI demand prediction", () => api.runDemandPredictionJob(token))}
                disabled={!authed}>
                <Text style={styles.quickActionIcon}>🤖</Text>
                <Text style={styles.quickActionLabel}>AI Prediction</Text>
              </Pressable>
            </View>

            {/* Marketplace quick-load results */}
            {adminMktSnapshot && (
              <View style={styles.adminMktStrip}>
                <View style={styles.adminMktStripHeader}>
                  <Text style={styles.adminMktStripTitle}>🛒 Marketplace Snapshot</Text>
                  <Text style={styles.adminMktStripSub}>Live data</Text>
                </View>
                <View style={styles.adminMktPills}>
                  {adminMktSnapshot.nearby > 0 && (
                    <View style={[styles.adminMktPill, { borderLeftColor: "#0f766e" }]}>
                      <Text style={styles.adminMktPillIcon}>🏪</Text>
                      <View>
                        <Text style={[styles.adminMktPillValue, { color: "#0f766e" }]}>{adminMktSnapshot.nearby}</Text>
                        <Text style={styles.adminMktPillLabel}>Nearby</Text>
                      </View>
                    </View>
                  )}
                  {adminMktSnapshot.trending > 0 && (
                    <View style={[styles.adminMktPill, { borderLeftColor: "#d97706" }]}>
                      <Text style={styles.adminMktPillIcon}>🔥</Text>
                      <View>
                        <Text style={[styles.adminMktPillValue, { color: "#d97706" }]}>{adminMktSnapshot.trending}</Text>
                        <Text style={styles.adminMktPillLabel}>Trending</Text>
                      </View>
                    </View>
                  )}
                  {adminMktSnapshot.offers > 0 && (
                    <View style={[styles.adminMktPill, { borderLeftColor: "#7c3aed" }]}>
                      <Text style={styles.adminMktPillIcon}>🏷️</Text>
                      <View>
                        <Text style={[styles.adminMktPillValue, { color: "#7c3aed" }]}>{adminMktSnapshot.offers}</Text>
                        <Text style={styles.adminMktPillLabel}>Offers</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Order Operations */}
            <Divider label="Order Operations" icon="⚙️" subtitle={orderId ? `Active: #${orderId.slice(0, 8).toUpperCase()}` : "Assign drivers and manage active orders"} collapsed={isCollapsed("Order Operations")} onPress={() => togglePanel("Order Operations")} />
            {!isCollapsed("Order Operations") && (
              <>
                {/* Order ID input */}
                <View style={styles.ooInputRow}>
                  <View style={styles.ooInputWrap}>
                    <Text style={styles.ooInputIcon}>📋</Text>
                    <TextInput
                      style={styles.ooInput}
                      value={orderId}
                      onChangeText={setOrderId}
                      placeholder="Paste Order ID…"
                      placeholderTextColor="#555555"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {orderId.length > 0 && (
                      <Pressable onPress={() => setOrderId("")}>
                        <Text style={styles.ooInputClear}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    style={[styles.ooLoadBtn, (!orderId.trim() || loading) && styles.ooLoadBtnDisabled]}
                    disabled={!orderId.trim() || loading}
                    onPress={loadOrder}
                  >
                    <Text style={styles.ooLoadBtnIcon}>{loading ? "⏳" : "📦"}</Text>
                    <Text style={styles.ooLoadBtnText}>{loading ? "Loading…" : "Load Order"}</Text>
                  </Pressable>
                </View>

                {/* Loaded order preview */}
                {order && orderId && (
                  <View style={[styles.ooOrderPreview, { borderLeftColor: orderStatusColor(order.status) }]}>
                    <View style={styles.ooOrderPreviewHeader}>
                      <Text style={styles.ooOrderPreviewId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                      <View style={[styles.raStatusBadge, { backgroundColor: orderStatusColor(order.status) + "22", borderColor: orderStatusColor(order.status) }]}>
                        <View style={[styles.raStatusDot, { backgroundColor: orderStatusColor(order.status) }]} />
                        <Text style={[styles.raStatusText, { color: orderStatusColor(order.status) }]}>{titleCase(order.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.ooOrderPreviewAmount}>{formatCurrency(order.total_paise)}</Text>
                    {order.delivery_address ? (
                      <View style={styles.raMetaRow}>
                        <Text style={styles.raMetaIcon}>📍</Text>
                        <Text style={styles.raMetaText} numberOfLines={1}>{order.delivery_address}</Text>
                      </View>
                    ) : null}
                    {order.driver_name || order.driver_phone ? (
                      <View style={styles.raMetaRow}>
                        <Text style={styles.raMetaIcon}>🚗</Text>
                        <Text style={styles.raMetaText}>{order.driver_name ?? order.driver_phone ?? "Driver assigned"}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* No order hint */}
                {!orderId && (
                  <View style={styles.ooHint}>
                    <Text style={styles.ooHintIcon}>💡</Text>
                    <Text style={styles.ooHintText}>Paste an Order ID above or pick one from Order + Payment Monitoring.</Text>
                  </View>
                )}

                {/* Driver assignment */}
                <View style={styles.ooSection}>
                  <Text style={styles.ooSectionTitle}>Driver Assignment</Text>
                  <View style={styles.ooDriverMeta}>
                    <View style={styles.ooDriverChip}>
                      <Text style={styles.ooDriverChipIcon}>🚗</Text>
                      <Text style={styles.ooDriverChipText}>{deliveryDrivers.length} drivers available</Text>
                    </View>
                    {driverLoad.length > 0 && (
                      <View style={styles.ooDriverChip}>
                        <Text style={styles.ooDriverChipIcon}>⚡</Text>
                        <Text style={styles.ooDriverChipText}>{driverLoad.filter(d => d.active_orders > 0).length} active</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.ooAssignRow}>
                    <Pressable
                      style={[styles.ooAssignBtn, (!orderId || loading) && styles.ooAssignBtnDisabled]}
                      disabled={!orderId || loading}
                      onPress={() => run("Assigning best driver", () => api.assignBestDriver(token, orderId))}
                    >
                      <Text style={styles.ooAssignBtnIcon}>🎯</Text>
                      <View>
                        <Text style={styles.ooAssignBtnLabel}>Assign Best Driver</Text>
                        <Text style={styles.ooAssignBtnSub}>AI-optimised selection</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={[styles.ooAssignBtn, styles.ooAssignBtnSecondary, (!orderId || !deliveryDrivers[0] || loading) && styles.ooAssignBtnDisabled]}
                      disabled={!orderId || !deliveryDrivers[0] || loading}
                      onPress={() => run("Assigning driver", () => api.assignDriver(token, orderId, deliveryDrivers[0].id))}
                    >
                      <Text style={styles.ooAssignBtnIcon}>👤</Text>
                      <View>
                        <Text style={styles.ooAssignBtnLabel}>First Available</Text>
                        <Text style={styles.ooAssignBtnSub}>{deliveryDrivers[0]?.phone ?? "No driver"}</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {/* Status actions */}
                {orderId && (
                  <View style={styles.ooSection}>
                    <Text style={styles.ooSectionTitle}>Status Override</Text>
                    <View style={styles.ooStatusRow}>
                      {(["preparing", "ready", "picked_up", "delivered"] as const).map(s => (
                        <Pressable
                          key={s}
                          style={[styles.ooStatusBtn, { borderColor: orderStatusColor(s) }]}
                          onPress={() => run(`Marking ${s}`, () => api.updateOrderStatus(token, orderId, s))}
                        >
                          <View style={[styles.ooStatusBtnDot, { backgroundColor: orderStatusColor(s) }]} />
                          <Text style={[styles.ooStatusBtnText, { color: orderStatusColor(s) }]}>{titleCase(s)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* Danger zone */}
                {orderId && (
                  <View style={styles.ooDangerZone}>
                    <Text style={styles.ooDangerTitle}>⚠️ Danger Zone</Text>
                    <View style={styles.ooDangerRow}>
                      <Pressable
                        style={styles.ooDangerBtn}
                        onPress={() => Alert.alert("Cancel Order", "This will cancel the order. Are you sure?", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Confirm", style: "destructive", onPress: () => run("Cancelling order", () => api.cancelOrder(token, orderId, "Admin cancellation")) }
                        ])}
                      >
                        <Text style={styles.ooDangerBtnText}>✕ Cancel Order</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.ooDangerBtn, styles.ooDangerBtnAlt]}
                        onPress={() => Alert.alert("Request Refund", "Issue a full refund for this order?", [
                          { text: "No", style: "cancel" },
                          { text: "Refund", style: "destructive", onPress: () => run("Requesting refund", () => api.requestRefund(token, orderId, "Admin refund")) }
                        ])}
                      >
                        <Text style={styles.ooDangerBtnText}>↩ Refund</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* User Management */}
            <Divider label="User Management" icon="👥" subtitle={adminUsers.length > 0 ? `${adminUsers.length} users · ${adminUsers.filter(u => u.is_banned).length} banned` : "Search or load dashboard to see users"} collapsed={isCollapsed("User Management")} onPress={() => togglePanel("User Management")} />
            {!isCollapsed("User Management") && (
              <>
                {/* Role distribution stats */}
                {adminUsers.length > 0 && (
                  <View style={styles.umRoleStats}>
                    {(["customer", "driver", "restaurant", "admin", "super_admin", "delivery_admin"] as const).map(r => {
                      const count = adminUsers.filter(u => u.role === r).length;
                      if (count === 0) return null;
                      const accent = roleAccent(r);
                      return (
                        <View key={r} style={[styles.umRoleStatPill, { borderColor: accent + "44" }]}>
                          <View style={[styles.umRoleStatDot, { backgroundColor: accent }]} />
                          <Text style={[styles.umRoleStatCount, { color: accent }]}>{count}</Text>
                          <Text style={styles.umRoleStatLabel}>{r === "super_admin" ? "S.Admin" : r === "delivery_admin" ? "D.Admin" : titleCase(r)}</Text>
                        </View>
                      );
                    })}
                    {adminUsers.filter(u => u.is_banned).length > 0 && (
                      <View style={[styles.umRoleStatPill, { borderColor: "#ef444444" }]}>
                        <View style={[styles.umRoleStatDot, { backgroundColor: "#ef4444" }]} />
                        <Text style={[styles.umRoleStatCount, { color: "#ef4444" }]}>{adminUsers.filter(u => u.is_banned).length}</Text>
                        <Text style={styles.umRoleStatLabel}>Banned</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Search bar */}
                <View style={styles.raSearchRow}>
                  <Text style={styles.raSearchIcon}>🔍</Text>
                  <TextInput
                    style={styles.raSearchInput}
                    placeholder="Name, phone, email or User ID…"
                    placeholderTextColor="#555555"
                    value={userSearch}
                    onChangeText={text => { setUserSearch(text); setUserDisplayLimit(10); if (!text) setUserSearchResults(null); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {userSearch.length > 0 && (
                    <Pressable onPress={() => { setUserSearch(""); setUserSearchResults(null); }}>
                      <Text style={styles.ooInputClear}>✕</Text>
                    </Pressable>
                  )}
                  {userSearch.trim().length > 0 && (
                    <Pressable
                      style={[styles.raSearchBtn, (!userSearch.trim() || userSearching) && { opacity: 0.4 }]}
                      disabled={!userSearch.trim() || userSearching}
                      onPress={async () => {
                        setUserSearching(true);
                        try {
                          const result = await api.adminUsersSearch(token, userSearch.trim());
                          if (result) setUserSearchResults(result as typeof userSearchResults);
                        } catch (err) {
                          Alert.alert("Search failed", err instanceof Error ? err.message : "Could not search users.");
                        } finally {
                          setUserSearching(false);
                        }
                      }}
                    >
                      {userSearching
                        ? <ActivityIndicator size="small" color="#ffffff" />
                        : <Text style={styles.raSearchBtnText}>Search</Text>}
                    </Pressable>
                  )}
                </View>

                {/* User cards */}
                {userSearching && (
                  <View style={styles.searchingRow}>
                    <ActivityIndicator size="small" color="#0f766e" style={{ marginRight: 8 }} />
                    <Text style={styles.searchingText}>Searching users…</Text>
                  </View>
                )}
                {!userSearching && (() => {
                  const q = userSearch.trim().toLowerCase();
                  const displayUsers = userSearchResults
                    ?? (q
                      ? adminUsers.filter(u =>
                          (u.name ?? "").toLowerCase().includes(q) ||
                          (u.phone ?? "").includes(q) ||
                          (u.email ?? "").toLowerCase().includes(q) ||
                          u.id.toLowerCase().startsWith(q)
                        )
                      : adminUsers);

                  const visibleUsers = displayUsers.slice(0, userDisplayLimit);
                  const remaining = displayUsers.length - visibleUsers.length;

                  if (adminUsers.length === 0 && !userSearchResults) {
                    return (
                      <View style={styles.raEmpty}>
                        <Text style={styles.raEmptyIcon}>👥</Text>
                        <Text style={styles.raEmptyText}>No users loaded</Text>
                        <Text style={styles.raEmptyHint}>Refresh the admin dashboard to load user data.</Text>
                      </View>
                    );
                  }
                  if (displayUsers.length === 0) {
                    return (
                      <View style={styles.raEmpty}>
                        <Text style={styles.raEmptyIcon}>🔍</Text>
                        <Text style={styles.raEmptyText}>No results for "{userSearch}"</Text>
                      </View>
                    );
                  }

                  return (
                    <>
                      <View style={styles.umResultsMeta}>
                        <Text style={styles.umResultsCount}>{visibleUsers.length} of {displayUsers.length} user{displayUsers.length !== 1 ? "s" : ""}</Text>
                        {userSearchResults && (
                          <View style={styles.umResultsTag}>
                            <Text style={styles.umResultsTagText}>Search results</Text>
                          </View>
                        )}
                      </View>
                      {visibleUsers.map(item => {
                        const isExpanded = expandedUserId === item.id;
                        const orders = userOrdersMap[item.id];
                        const displayName = item.name ?? item.phone ?? item.email ?? item.id.slice(0, 8);
                        const accent = roleAccent(item.role);
                        const initial = (displayName[0] ?? "?").toUpperCase();
                        return (
                          <View key={item.id} style={[styles.umCard, { borderLeftColor: accent }, item.is_banned && styles.umCardBanned]}>
                            <Pressable onPress={() => setExpandedUserId(isExpanded ? null : item.id)}>
                              <View style={styles.umCardHeader}>
                                <View style={[styles.umAvatar, { backgroundColor: accent + "22" }]}>
                                  <Text style={[styles.umAvatarText, { color: accent }]}>{initial}</Text>
                                </View>
                                <View style={styles.umInfo}>
                                  <View style={styles.umNameRow}>
                                    <Text style={styles.umName} numberOfLines={1}>{displayName}</Text>
                                    {item.is_banned && (
                                      <View style={styles.umBannedBadge}>
                                        <Text style={styles.umBannedBadgeText}>BANNED</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.umContact} numberOfLines={1}>
                                    {item.phone ?? item.email ?? item.id.slice(0, 16)}
                                  </Text>
                                  {item.created_at && (
                                    <Text style={styles.umJoined}>Joined {fmtDate(item.created_at)}</Text>
                                  )}
                                </View>
                                <View style={styles.umCardRight}>
                                  <View style={[styles.umRoleBadge, { backgroundColor: accent + "18", borderColor: accent + "44" }]}>
                                    <Text style={[styles.umRoleBadgeText, { color: accent }]}>{titleCase(item.role)}</Text>
                                  </View>
                                  <Text style={styles.umChevron}>{isExpanded ? "▲" : "▼"}</Text>
                                </View>
                              </View>
                            </Pressable>

                            {isExpanded && (
                              <View style={styles.umExpanded}>
                                <Text style={styles.umSectionLabel}>CHANGE ROLE</Text>
                                <View style={styles.umRoleChips}>
                                  {(["customer", "driver", "restaurant", "admin", "super_admin", "delivery_admin"] as const).map(r => (
                                    <Pressable
                                      key={r}
                                      style={[
                                        styles.umRoleChip,
                                        { borderColor: roleAccent(r) + "55" },
                                        item.role === r && { backgroundColor: roleAccent(r), borderColor: roleAccent(r) }
                                      ]}
                                      disabled={loading || item.role === r}
                                      onPress={() => {
                                        Alert.alert(
                                          "Change Role",
                                          `Change ${item.phone ?? item.email ?? "this user"}'s role from ${titleCase(item.role)} to ${titleCase(r)}?`,
                                          [
                                            { text: "Cancel", style: "cancel" },
                                            { text: "Change Role", style: "destructive", onPress: async () => {
                                              try {
                                                const updated = await api.changeUserRole(token, item.id, r);
                                                const patch = { role: updated.role };
                                                setAdminUsers(prev => prev.map(u => u.id === item.id ? { ...u, ...patch } : u));
                                                setUserSearchResults(prev => prev ? prev.map(u => u.id === item.id ? { ...u, ...patch } : u) : null);
                                              } catch (err) {
                                                Alert.alert("Role change failed", err instanceof Error ? err.message : "Unexpected error");
                                              }
                                            }}
                                          ]
                                        );
                                      }}
                                    >
                                      <Text style={[styles.umRoleChipText, item.role === r && { color: "#fff" }]}>{titleCase(r)}</Text>
                                    </Pressable>
                                  ))}
                                </View>

                                <View style={styles.umActions}>
                                  <Pressable
                                    style={[styles.umActionBtn, item.is_banned ? styles.umActionBtnUnban : styles.umActionBtnBan]}
                                    disabled={loading}
                                    onPress={() => {
                                      const action = item.is_banned ? "Unban" : "Ban";
                                      const user = item.phone ?? item.email ?? "this user";
                                      Alert.alert(
                                        `${action} User`,
                                        item.is_banned
                                          ? `Restore access for ${user}? They will be able to log in again.`
                                          : `Ban ${user}? They will be immediately locked out.`,
                                        [
                                          { text: "Cancel", style: "cancel" },
                                          { text: action, style: "destructive", onPress: async () => {
                                            const updated = await run(item.is_banned ? "Unbanning user" : "Banning user", () => api.banUser(token, item.id, !item.is_banned));
                                            if (updated) {
                                              const patch = { is_banned: (updated as typeof item).is_banned };
                                              setAdminUsers(prev => prev.map(u => u.id === item.id ? { ...u, ...patch } : u));
                                              setUserSearchResults(prev => prev ? prev.map(u => u.id === item.id ? { ...u, ...patch } : u) : null);
                                            }
                                          }}
                                        ]
                                      );
                                    }}
                                  >
                                    <Text style={[styles.umActionBtnText, item.is_banned ? { color: "#fbbf24" } : { color: "#fca5a5" }]}>
                                      {item.is_banned ? "🔓 Unban User" : "🚫 Ban User"}
                                    </Text>
                                  </Pressable>
                                  <Pressable
                                    style={styles.umActionBtn}
                                    disabled={loading}
                                    onPress={async () => {
                                      if (orders) { setUserOrdersMap(prev => { const next = { ...prev }; delete next[item.id]; return next; }); return; }
                                      const result = await run("Loading order history", () => api.adminUserOrders(token, item.id));
                                      if (result) setUserOrdersMap(prev => ({ ...prev, [item.id]: result as typeof orders }));
                                    }}
                                  >
                                    <Text style={styles.umActionBtnText}>{orders ? "▲ Hide Orders" : "📦 Order History"}</Text>
                                  </Pressable>
                                </View>

                                {orders && orders.length === 0 && (
                                  <Text style={styles.umOrderEmpty}>No orders for this user.</Text>
                                )}
                                {orders && orders.map(o => (
                                  <View key={o.id} style={styles.umOrderRow}>
                                    <View style={[styles.umOrderDot, { backgroundColor: orderStatusColor(o.status) }]} />
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.umOrderName}>{o.restaurant_name ?? "—"}</Text>
                                      <Text style={styles.umOrderMeta}>{titleCase(o.status)} · {formatCurrency(o.total_paise)} · {fmtDate(o.created_at)}</Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {remaining > 0 && (
                        <Pressable style={styles.umLoadMoreBtn} onPress={() => setUserDisplayLimit(l => l + 10)}>
                          <Text style={styles.umLoadMoreText}>Show {Math.min(remaining, 10)} more</Text>
                          <Text style={styles.umLoadMoreCount}>{remaining} remaining</Text>
                        </Pressable>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* Restaurant Approvals */}
            <Divider label="Restaurant Approvals" icon="✅" subtitle={adminRestaurants.length > 0 ? `${adminRestaurants.filter(r => r.approval_status === "pending").length} pending · ${adminRestaurants.length} total` : "Approve, reject or offboard restaurants"} collapsed={isCollapsed("Restaurant Approvals")} onPress={() => togglePanel("Restaurant Approvals")} />
            {!isCollapsed("Restaurant Approvals") && (
              <>
                {/* Status summary */}
                {adminRestaurants.length > 0 && (
                  <View style={styles.raStatsRow}>
                    {[
                      { label: "Pending",  color: "#eab308", count: adminRestaurants.filter(r => r.approval_status === "pending").length },
                      { label: "Approved", color: "#22c55e", count: adminRestaurants.filter(r => r.approval_status === "approved").length },
                      { label: "Rejected", color: "#ef4444", count: adminRestaurants.filter(r => r.approval_status === "rejected").length },
                      { label: "Inactive", color: "#888888", count: adminRestaurants.filter(r => !r.is_active).length },
                    ].map(s => (
                      <View key={s.label} style={styles.raStatPill}>
                        <View style={[styles.raStatDot, { backgroundColor: s.color }]} />
                        <Text style={[styles.raStatCount, { color: s.color }]}>{s.count}</Text>
                        <Text style={styles.raStatLabel}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Search */}
                <View style={styles.raSearchRow}>
                  <Text style={styles.raSearchIcon}>🔍</Text>
                  <TextInput
                    style={styles.raSearchInput}
                    placeholder="Search by restaurant name…"
                    placeholderTextColor="#555555"
                    value={restaurantSearch}
                    onChangeText={text => { setRestaurantSearch(text); if (!text) setRestaurantSearchResults(null); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {restaurantSearch.trim().length > 0 && (
                    <Pressable
                      style={[styles.raSearchBtn, (!restaurantSearch.trim() || loading) && { opacity: 0.4 }]}
                      disabled={!restaurantSearch.trim() || loading}
                      onPress={async () => {
                        const result = await run("Searching restaurants", () => api.adminRestaurantsSearch(token, restaurantSearch.trim()));
                        if (result) setRestaurantSearchResults(result as typeof restaurantSearchResults);
                      }}
                    >
                      <Text style={styles.raSearchBtnText}>Search</Text>
                    </Pressable>
                  )}
                </View>

                {/* Restaurant cards */}
                {(() => {
                  const q = restaurantSearch.trim().toLowerCase();
                  const displayRestaurants = restaurantSearchResults
                    ?? (q
                      ? adminRestaurants.filter(r => r.name.toLowerCase().includes(q))
                      : adminRestaurants.slice(0, 10));
                  if (adminRestaurants.length === 0 && !restaurantSearchResults) {
                    return (
                      <View style={styles.raEmpty}>
                        <Text style={styles.raEmptyIcon}>🏪</Text>
                        <Text style={styles.raEmptyText}>No restaurants loaded</Text>
                        <Text style={styles.raEmptyHint}>Refresh the admin dashboard to load restaurant data.</Text>
                      </View>
                    );
                  }
                  if (displayRestaurants.length === 0) {
                    return (
                      <View style={styles.raEmpty}>
                        <Text style={styles.raEmptyIcon}>🔍</Text>
                        <Text style={styles.raEmptyText}>No results for "{restaurantSearch}"</Text>
                      </View>
                    );
                  }
                  return displayRestaurants.map(item => {
                    const statusColor = restaurantStatusColor(item.approval_status);
                    return (
                      <View key={item.id} style={[styles.raCard, { borderLeftColor: statusColor }]}>
                        {/* Header */}
                        <View style={styles.raCardHeader}>
                          <View style={styles.raCardTitleRow}>
                            <Text style={styles.raCardName} numberOfLines={1}>{item.name}</Text>
                            {item.cuisine_type && (
                              <View style={styles.raCuisinePill}>
                                <Text style={styles.raCuisineText}>{item.cuisine_type}</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.raStatusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                            <View style={[styles.raStatusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.raStatusText, { color: statusColor }]}>{titleCase(item.approval_status)}</Text>
                          </View>
                        </View>

                        {/* Meta */}
                        <View style={styles.raCardMeta}>
                          {item.address ? (
                            <View style={styles.raMetaRow}>
                              <Text style={styles.raMetaIcon}>📍</Text>
                              <Text style={styles.raMetaText} numberOfLines={1}>{item.address}</Text>
                            </View>
                          ) : null}
                          {item.owner_phone ? (
                            <View style={styles.raMetaRow}>
                              <Text style={styles.raMetaIcon}>☎</Text>
                              <Text style={styles.raMetaText}>{item.owner_phone}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Rejection reason */}
                        {item.approval_status === "rejected" && item.rejection_reason ? (
                          <View style={styles.raRejectCallout}>
                            <Text style={styles.raRejectIcon}>⚠️</Text>
                            <Text style={styles.raRejectText}>{item.rejection_reason}</Text>
                          </View>
                        ) : null}

                        {/* Inactive notice */}
                        {item.is_active === false && item.approval_status === "approved" ? (
                          <View style={styles.raInactiveCallout}>
                            <Text style={styles.raInactiveText}>⊘ Offboarded — not visible to customers</Text>
                          </View>
                        ) : null}

                        {/* Actions */}
                        {(item.approval_status !== "approved" || (item.approval_status === "approved" && item.is_active)) && (
                          <View style={styles.raActions}>
                            {item.approval_status !== "approved" && (
                              <Pressable style={styles.raApproveBtn} onPress={() => {
                                Alert.alert(
                                  "Approve Restaurant",
                                  `Approve "${item.name}"? It will become visible to customers immediately.`,
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Approve", onPress: async () => {
                                      const result = await run("Approving restaurant", () => api.updateRestaurantApproval(token, item.id, "approved"));
                                      if (result) {
                                        setAdminRestaurants(prev => prev.map(r => r.id === item.id ? { ...r, approval_status: "approved", rejection_reason: null } : r));
                                        setRestaurantSearchResults(prev => prev ? prev.map(r => r.id === item.id ? { ...r, approval_status: "approved", rejection_reason: null } : r) : null);
                                      }
                                    }}
                                  ]
                                );
                              }}>
                                <Text style={styles.raApproveBtnText}>✓ Approve</Text>
                              </Pressable>
                            )}
                            {item.approval_status === "pending" && (
                              <Pressable style={styles.raRejectBtn} onPress={() => {
                                Alert.prompt("Reject Restaurant", "Enter rejection reason:", [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Reject", style: "destructive", onPress: async (reason) => {
                                      const result = await run("Rejecting restaurant", () => api.updateRestaurantApproval(token, item.id, "rejected", reason ?? ""));
                                      if (result) {
                                        setAdminRestaurants(prev => prev.map(r => r.id === item.id ? { ...r, approval_status: "rejected", rejection_reason: reason ?? null } : r));
                                        setRestaurantSearchResults(prev => prev ? prev.map(r => r.id === item.id ? { ...r, approval_status: "rejected", rejection_reason: reason ?? null } : r) : null);
                                      }
                                    }
                                  }
                                ], "plain-text");
                              }}>
                                <Text style={styles.raRejectBtnText}>✕ Reject</Text>
                              </Pressable>
                            )}
                            {item.approval_status === "approved" && item.is_active && (
                              <Pressable style={styles.raOffboardBtn} onPress={() => {
                                Alert.alert("Offboard Restaurant", `Deactivate "${item.name}"? Customers will not be able to order from it.`, [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Offboard", style: "destructive", onPress: async () => {
                                      const result = await run("Offboarding restaurant", () => api.offboardRestaurant(token, item.id));
                                      if (result) {
                                        setAdminRestaurants(prev => prev.map(r => r.id === item.id ? { ...r, is_active: false } : r));
                                        setRestaurantSearchResults(prev => prev ? prev.map(r => r.id === item.id ? { ...r, is_active: false } : r) : null);
                                      }
                                    }
                                  }
                                ]);
                              }}>
                                <Text style={styles.raOffboardBtnText}>⊘ Offboard</Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  });
                })()}
              </>
            )}

            {/* Order + Payment Monitoring */}
            <Divider label="Order + Payment Monitoring" icon="📊" subtitle={adminOrders.length > 0 ? `${adminOrders.length} orders · ${paymentReports.reduce((s, r) => s + r.transactions, 0)} payments` : "Search and monitor orders across all restaurants"} collapsed={isCollapsed("Order + Payment Monitoring")} onPress={() => togglePanel("Order + Payment Monitoring")} />
            {!isCollapsed("Order + Payment Monitoring") && (
              <>
                {/* Order status summary */}
                {dashboard && dashboard.ordersByStatus.length > 0 && (
                  <View style={styles.opmStatusRow}>
                    {dashboard.ordersByStatus.map(s => (
                      <View key={s.status} style={styles.opmStatusPill}>
                        <View style={[styles.opmStatusDot, { backgroundColor: orderStatusColor(s.status) }]} />
                        <Text style={[styles.opmStatusCount, { color: orderStatusColor(s.status) }]}>{s.count}</Text>
                        <Text style={styles.opmStatusLabel}>{titleCase(s.status)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Payment provider cards */}
                {paymentReports.length > 0 && (
                  <View style={styles.opmPaySection}>
                    <Text style={styles.opmPayTitle}>💳 Payment Providers</Text>
                    <View style={styles.opmPayGrid}>
                      {paymentReports.map(item => {
                        const isSuccess = item.status === "success" || item.status === "captured";
                        const accent = isSuccess ? "#22c55e" : item.status === "failed" ? "#ef4444" : "#eab308";
                        return (
                          <View key={`${item.provider}-${item.status}`} style={[styles.opmPayCard, { borderTopColor: accent }]}>
                            <View style={styles.opmPayCardHeader}>
                              <Text style={styles.opmPayProvider}>{titleCase(item.provider)}</Text>
                              <View style={[styles.opmPayStatus, { backgroundColor: accent + "22" }]}>
                                <View style={[styles.opmPayStatusDot, { backgroundColor: accent }]} />
                                <Text style={[styles.opmPayStatusText, { color: accent }]}>{titleCase(item.status)}</Text>
                              </View>
                            </View>
                            <Text style={[styles.opmPayAmount, { color: accent }]}>{formatCurrency(item.amount_paise)}</Text>
                            <Text style={styles.opmPayTx}>{item.transactions} transactions</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Search */}
                <View style={styles.raSearchRow}>
                  <Text style={styles.raSearchIcon}>🔍</Text>
                  <TextInput
                    style={styles.raSearchInput}
                    placeholder="Restaurant name or Order ID…"
                    placeholderTextColor="#555555"
                    value={orderSearch}
                    onChangeText={text => { setOrderSearch(text); setOrderDisplayLimit(10); if (!text) setOrderSearchResults(null); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {orderSearch.trim().length > 0 && (
                    <Pressable
                      style={[styles.raSearchBtn, (!orderSearch.trim() || orderSearching) && { opacity: 0.4 }]}
                      disabled={!orderSearch.trim() || orderSearching}
                      onPress={async () => {
                        setOrderSearching(true);
                        try {
                          const result = await api.adminOrdersSearch(token, orderSearch.trim());
                          if (result) setOrderSearchResults(result as typeof orderSearchResults);
                        } catch (err) {
                          Alert.alert("Search failed", err instanceof Error ? err.message : "Could not search orders.");
                        } finally {
                          setOrderSearching(false);
                        }
                      }}
                    >
                      {orderSearching
                        ? <ActivityIndicator size="small" color="#ffffff" />
                        : <Text style={styles.raSearchBtnText}>Search</Text>}
                    </Pressable>
                  )}
                </View>

                {/* Order cards */}
                {orderSearching && (
                  <View style={styles.searchingRow}>
                    <ActivityIndicator size="small" color="#0f766e" style={{ marginRight: 8 }} />
                    <Text style={styles.searchingText}>Searching orders…</Text>
                  </View>
                )}
                {!orderSearching && (() => {
                  const q = orderSearch.trim().toLowerCase();
                  const displayOrders = orderSearchResults
                    ?? (q
                      ? adminOrders.filter(o =>
                          (o.restaurant_name ?? "").toLowerCase().includes(q) ||
                          o.id.toLowerCase().startsWith(q)
                        )
                      : adminOrders);

                  const visibleOrders = displayOrders.slice(0, orderDisplayLimit);
                  const remainingOrders = displayOrders.length - visibleOrders.length;

                  if (adminOrders.length === 0 && !orderSearchResults) {
                    return (
                      <View style={styles.raEmpty}>
                        <Text style={styles.raEmptyIcon}>📦</Text>
                        <Text style={styles.raEmptyText}>No orders loaded</Text>
                        <Text style={styles.raEmptyHint}>Refresh the admin dashboard to load order data.</Text>
                      </View>
                    );
                  }
                  if (displayOrders.length === 0) {
                    return (
                      <View style={styles.raEmpty}>
                        <Text style={styles.raEmptyIcon}>🔍</Text>
                        <Text style={styles.raEmptyText}>No results for "{orderSearch}"</Text>
                      </View>
                    );
                  }
                  return (
                    <>
                      <Text style={styles.umResultsCount}>{visibleOrders.length} of {displayOrders.length} order{displayOrders.length !== 1 ? "s" : ""}</Text>
                      {visibleOrders.map(item => {
                        const statusColor = orderStatusColor(item.status);
                        return (
                          <View key={item.id} style={[styles.opmOrderCard, { borderLeftColor: statusColor }]}>
                            <View style={styles.opmOrderHeader}>
                              <Text style={styles.opmOrderRestaurant} numberOfLines={1}>{item.restaurant_name ?? "Unknown Restaurant"}</Text>
                              <View style={[styles.raStatusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                                <View style={[styles.raStatusDot, { backgroundColor: statusColor }]} />
                                <Text style={[styles.raStatusText, { color: statusColor }]}>{titleCase(item.status)}</Text>
                              </View>
                            </View>
                            <View style={styles.opmOrderMeta}>
                              <Text style={styles.opmOrderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                              <Text style={styles.opmOrderDot}>·</Text>
                              <Text style={[styles.opmOrderAmount, { color: statusColor }]}>{formatCurrency(item.total_paise)}</Text>
                              {item.created_at && (
                                <>
                                  <Text style={styles.opmOrderDot}>·</Text>
                                  <Text style={styles.opmOrderDate}>{fmtTs(item.created_at)}</Text>
                                </>
                              )}
                            </View>
                            {(item.customer_phone || item.driver_phone) && (
                              <View style={styles.opmOrderPhones}>
                                {item.customer_phone && (
                                  <View style={styles.opmPhoneChip}>
                                    <Text style={styles.opmPhoneChipIcon}>👤</Text>
                                    <Text style={styles.opmPhoneChipText}>{item.customer_phone}</Text>
                                  </View>
                                )}
                                {item.driver_phone && (
                                  <View style={styles.opmPhoneChip}>
                                    <Text style={styles.opmPhoneChipIcon}>🚗</Text>
                                    <Text style={styles.opmPhoneChipText}>{item.driver_phone}</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                      {remainingOrders > 0 && (
                        <Pressable style={styles.umLoadMoreBtn} onPress={() => setOrderDisplayLimit(l => l + 10)}>
                          <Text style={styles.umLoadMoreText}>Show {Math.min(remainingOrders, 10)} more</Text>
                          <Text style={styles.umLoadMoreCount}>{remainingOrders} remaining</Text>
                        </Pressable>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* Live Tracking */}
            <Divider label="Live Tracking + Driver Load" icon="📡" subtitle={deliveryOrders.length > 0 ? `${deliveryOrders.length} active · ${driverLoad.filter(d => d.active_orders > 0).length} busy · ${driverLoad.length} drivers` : "Real-time delivery and driver availability"} collapsed={isCollapsed("Live Tracking + Driver Load")} onPress={() => togglePanel("Live Tracking + Driver Load")} />
            {!isCollapsed("Live Tracking + Driver Load") && (
              <>
                {/* Live stats */}
                {(deliveryOrders.length > 0 || driverLoad.length > 0) && (
                  <View style={styles.ltStatsRow}>
                    <View style={styles.ltStatCard}>
                      <Text style={[styles.ltStatValue, { color: "#3b82f6" }]}>{deliveryOrders.length}</Text>
                      <Text style={styles.ltStatLabel}>Active{"\n"}Deliveries</Text>
                    </View>
                    <View style={styles.ltStatCard}>
                      <Text style={[styles.ltStatValue, { color: "#22c55e" }]}>{driverLoad.length}</Text>
                      <Text style={styles.ltStatLabel}>Drivers{"\n"}Online</Text>
                    </View>
                    <View style={styles.ltStatCard}>
                      <Text style={[styles.ltStatValue, { color: "#ef4444" }]}>{driverLoad.filter(d => d.active_orders > 0).length}</Text>
                      <Text style={styles.ltStatLabel}>Drivers{"\n"}Busy</Text>
                    </View>
                    <View style={styles.ltStatCard}>
                      <Text style={[styles.ltStatValue, { color: "#eab308" }]}>{driverLoad.filter(d => d.active_orders === 0).length}</Text>
                      <Text style={styles.ltStatLabel}>Drivers{"\n"}Free</Text>
                    </View>
                  </View>
                )}

                {/* Search */}
                <View style={styles.raSearchRow}>
                  <Text style={styles.raSearchIcon}>🔍</Text>
                  <TextInput
                    style={styles.raSearchInput}
                    placeholder="Restaurant name, Order ID or driver phone…"
                    placeholderTextColor="#555555"
                    value={deliverySearch}
                    onChangeText={setDeliverySearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {deliverySearch.length > 0 && (
                    <Pressable onPress={() => setDeliverySearch("")}>
                      <Text style={styles.ooInputClear}>✕</Text>
                    </Pressable>
                  )}
                </View>

                {deliveryOrders.length === 0 && driverLoad.length === 0 ? (
                  <View style={styles.raEmpty}>
                    <Text style={styles.raEmptyIcon}>📡</Text>
                    <Text style={styles.raEmptyText}>No active deliveries or drivers</Text>
                    <Text style={styles.raEmptyHint}>Live data appears here when drivers are on delivery.</Text>
                  </View>
                ) : (() => {
                  const q = deliverySearch.trim().toLowerCase();
                  const filteredOrders = q
                    ? deliveryOrders.filter(o => (o.restaurant_name ?? "").toLowerCase().includes(q) || o.id.toLowerCase().startsWith(q))
                    : deliveryOrders;
                  const filteredDrivers = q
                    ? driverLoad.filter(d => (d.phone ?? "").includes(q) || d.id.toLowerCase().startsWith(q))
                    : driverLoad;

                  return (
                    <>
                      {/* Active Deliveries */}
                      {filteredOrders.length > 0 && (
                        <>
                          <Text style={styles.ltSectionTitle}>⚡ Active Deliveries</Text>
                          {filteredOrders.map(o => {
                            const statusColor = orderStatusColor(o.status);
                            const hasLocation = o.last_driver_lat && o.last_driver_lng;
                            return (
                              <View key={o.id} style={[styles.ltOrderCard, { borderLeftColor: statusColor }]}>
                                <View style={styles.ltOrderCardHeader}>
                                  <Text style={styles.ltOrderRestaurant} numberOfLines={1}>{o.restaurant_name ?? "Unknown"}</Text>
                                  <View style={[styles.raStatusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                                    <View style={[styles.raStatusDot, { backgroundColor: statusColor }]} />
                                    <Text style={[styles.raStatusText, { color: statusColor }]}>{titleCase(o.status)}</Text>
                                  </View>
                                </View>
                                <View style={styles.ltOrderMeta}>
                                  <Text style={styles.ltOrderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                                  <Text style={styles.ltOrderDot}>·</Text>
                                  {hasLocation ? (
                                    <Text style={styles.ltLocationText}>📍 {parseFloat(o.last_driver_lat!).toFixed(4)}, {parseFloat(o.last_driver_lng!).toFixed(4)}</Text>
                                  ) : (
                                    <Text style={styles.ltNoLocation}>📍 Location unavailable</Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </>
                      )}

                      {/* Driver Load */}
                      {filteredDrivers.length > 0 && (
                        <>
                          <Text style={[styles.ltSectionTitle, { marginTop: filteredOrders.length > 0 ? 8 : 0 }]}>🚗 Driver Load</Text>
                          {filteredDrivers.map(d => {
                            const capacityColor = d.capacity_score >= 0.7 ? "#22c55e" : d.capacity_score >= 0.4 ? "#eab308" : "#ef4444";
                            const capacityLabel = d.capacity_score >= 0.7 ? "Available" : d.capacity_score >= 0.4 ? "Busy" : "Overloaded";
                            const barWidth = `${Math.round(d.capacity_score * 100)}%`;
                            return (
                              <View key={d.id} style={[styles.ltDriverCard, { borderLeftColor: capacityColor }]}>
                                <View style={styles.ltDriverCardHeader}>
                                  <View style={styles.ltDriverInfo}>
                                    <Text style={styles.ltDriverPhone}>{d.phone ?? d.id.slice(0, 12)}</Text>
                                    <Text style={styles.ltDriverOrders}>{d.active_orders} active order{d.active_orders !== 1 ? "s" : ""}</Text>
                                  </View>
                                  <View style={[styles.ltCapacityBadge, { backgroundColor: capacityColor + "22", borderColor: capacityColor }]}>
                                    <View style={[styles.raStatusDot, { backgroundColor: capacityColor }]} />
                                    <Text style={[styles.raStatusText, { color: capacityColor }]}>{capacityLabel}</Text>
                                  </View>
                                </View>
                                <View style={styles.ltCapacityBarBg}>
                                  <View style={[styles.ltCapacityBarFill, { width: barWidth as `${number}%`, backgroundColor: capacityColor }]} />
                                </View>
                                <Text style={styles.ltCapacityScore}>Capacity score: {Math.round(d.capacity_score * 100)}%</Text>
                              </View>
                            );
                          })}
                        </>
                      )}

                      {q && filteredOrders.length === 0 && filteredDrivers.length === 0 && (
                        <View style={styles.raEmpty}>
                          <Text style={styles.raEmptyIcon}>🔍</Text>
                          <Text style={styles.raEmptyText}>No results for "{deliverySearch}"</Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* Driver Onboarding Admin */}
            <Divider label="Driver Onboarding Admin" icon="🪪" subtitle={driverApplications.length > 0 ? `${driverApplications.filter(a => a.approval_status === "pending").length} pending · ${driverApplications.length} total · ${driverReferrals.length} referrals` : "Review driver applications and referrals"} collapsed={isCollapsed("Driver Onboarding Admin")} onPress={() => togglePanel("Driver Onboarding Admin")} />
            {!isCollapsed("Driver Onboarding Admin") && (
              <>
                {/* Stats row */}
                {driverApplications.length > 0 && (
                  <View style={styles.raStatsRow}>
                    {[
                      { label: "Pending",  color: "#eab308", count: driverApplications.filter(a => a.approval_status === "pending").length },
                      { label: "Approved", color: "#22c55e", count: driverApplications.filter(a => a.approval_status === "approved").length },
                      { label: "Rejected", color: "#ef4444", count: driverApplications.filter(a => a.approval_status === "rejected").length },
                      { label: "Referrals", color: "#7c3aed", count: driverReferrals.length },
                    ].map(s => (
                      <View key={s.label} style={styles.raStatPill}>
                        <View style={[styles.raStatDot, { backgroundColor: s.color }]} />
                        <Text style={[styles.raStatCount, { color: s.color }]}>{s.count}</Text>
                        <Text style={styles.raStatLabel}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Applications */}
                <Text style={styles.doaSectionTitle}>🪪 Applications</Text>
                {(() => {
                  const mockApp = __DEV__ ? [{
                    id: "dev-mock-001",
                    full_name: "Ramesh Kumar (Demo)",
                    phone: "+91 98765 43210",
                    aadhaar_last4: "4821",
                    ocr_status: "verified",
                    selfie_status: "verified",
                    background_check_status: "pending",
                    bank_account_last4: "7733",
                    upi_id: "ramesh@upi",
                    referral_code: "DEMO2025",
                    approval_status: mockAppStatus as string,
                    admin_note: null,
                  }] : [];
                  const displayApps = [...mockApp, ...driverApplications];
                  if (displayApps.length === 0) return (
                    <View style={styles.raEmpty}>
                      <Text style={styles.raEmptyIcon}>🪪</Text>
                      <Text style={styles.raEmptyText}>No driver applications</Text>
                      <Text style={styles.raEmptyHint}>Applications will appear here once drivers submit their documents.</Text>
                    </View>
                  );
                  return displayApps.map(item => {
                  const statusColor = restaurantStatusColor(item.approval_status);
                  const checks = [
                    { label: "OCR",   status: item.ocr_status },
                    { label: "Selfie", status: item.selfie_status },
                    { label: "BG",    status: item.background_check_status },
                  ];
                  const checkColor = (s: string) => s === "verified" || s === "passed" ? "#22c55e" : s === "failed" ? "#ef4444" : "#eab308";
                  return (
                    <View key={item.id} style={[styles.doaCard, { borderLeftColor: statusColor }]}>
                      {/* Header */}
                      <View style={styles.doaCardHeader}>
                        <View style={styles.doaCardTitleRow}>
                          <Text style={styles.doaCardName}>{item.full_name}</Text>
                          {item.phone && <Text style={styles.doaCardPhone}>{item.phone}</Text>}
                        </View>
                        <View style={[styles.raStatusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                          <View style={[styles.raStatusDot, { backgroundColor: statusColor }]} />
                          <Text style={[styles.raStatusText, { color: statusColor }]}>{titleCase(item.approval_status)}</Text>
                        </View>
                      </View>

                      {/* Verification checks */}
                      <View style={styles.doaChecks}>
                        {checks.map(c => (
                          <View key={c.label} style={styles.doaCheckChip}>
                            <View style={[styles.doaCheckDot, { backgroundColor: checkColor(c.status) }]} />
                            <Text style={styles.doaCheckLabel}>{c.label}</Text>
                            <Text style={[styles.doaCheckStatus, { color: checkColor(c.status) }]}>{titleCase(c.status)}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Meta */}
                      <View style={styles.doaCardMeta}>
                        {item.aadhaar_last4 && (
                          <View style={styles.doaMetaChip}>
                            <Text style={styles.doaMetaChipIcon}>🪪</Text>
                            <Text style={styles.doaMetaChipText}>Aadhaar ••••{item.aadhaar_last4}</Text>
                          </View>
                        )}
                        {item.bank_account_last4 && (
                          <View style={styles.doaMetaChip}>
                            <Text style={styles.doaMetaChipIcon}>🏦</Text>
                            <Text style={styles.doaMetaChipText}>Bank ••••{item.bank_account_last4}</Text>
                          </View>
                        )}
                        {item.upi_id && (
                          <View style={styles.doaMetaChip}>
                            <Text style={styles.doaMetaChipIcon}>💳</Text>
                            <Text style={styles.doaMetaChipText}>{item.upi_id}</Text>
                          </View>
                        )}
                        {item.referral_code && (
                          <View style={styles.doaMetaChip}>
                            <Text style={styles.doaMetaChipIcon}>🔗</Text>
                            <Text style={styles.doaMetaChipText}>{item.referral_code}</Text>
                          </View>
                        )}
                      </View>

                      {/* Admin note */}
                      {item.admin_note && (
                        <View style={styles.doaAdminNote}>
                          <Text style={styles.doaAdminNoteText}>📝 {item.admin_note}</Text>
                        </View>
                      )}

                      {/* Actions */}
                      {item.approval_status !== "approved" && (
                        <View style={styles.raActions}>
                          <Pressable
                            style={styles.raApproveBtn}
                            onPress={() => Alert.alert("Approve Driver", `Approve application for ${item.full_name}?`, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Approve", onPress: async () => {
                                if (item.id === "dev-mock-001") { setMockAppStatus("approved"); return; }
                                const result = await run("Approving application", () => api.updateDriverApplicationApproval(token, item.id, "approved", "Approved from AK Ops mobile"));
                                if (result) setDriverApplications(prev => prev.map(a => a.id === item.id ? { ...a, approval_status: "approved" } : a));
                              }}
                            ])}
                          >
                            <Text style={styles.raApproveBtnText}>✓ Approve</Text>
                          </Pressable>
                          {item.approval_status === "pending" && (
                            <Pressable
                              style={styles.raRejectBtn}
                              onPress={() => Alert.prompt("Reject Application", "Enter reason for rejection:", [
                                { text: "Cancel", style: "cancel" },
                                { text: "Reject", style: "destructive", onPress: async (note) => {
                                  if (item.id === "dev-mock-001") { setMockAppStatus("rejected"); return; }
                                  const result = await run("Rejecting application", () => api.updateDriverApplicationApproval(token, item.id, "rejected", note ?? "Rejected from AK Ops mobile"));
                                  if (result) setDriverApplications(prev => prev.map(a => a.id === item.id ? { ...a, approval_status: "rejected", admin_note: note ?? null } : a));
                                }}
                              ], "plain-text")}
                            >
                              <Text style={styles.raRejectBtnText}>✕ Reject</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  );
                });
                })()}

                {/* Referrals */}
                <>
                  <Text style={[styles.doaSectionTitle, { marginTop: 8 }]}>🔗 Referrals</Text>
                  {driverReferrals.length === 0 ? (
                    <View style={styles.raEmpty}>
                      <Text style={styles.raEmptyIcon}>🔗</Text>
                      <Text style={styles.raEmptyText}>No referrals yet</Text>
                      <Text style={styles.raEmptyHint}>Driver referral rewards will appear here once codes are used.</Text>
                    </View>
                  ) : (
                    <>
                      {driverReferrals.slice(0, referralsLimit).map(item => {
                        const refColor = item.status === "rewarded" ? "#22c55e" : item.status === "pending" ? "#eab308" : "#aaaaaa";
                        return (
                          <View key={item.id} style={[styles.doaRefCard, { borderLeftColor: refColor }]}>
                            <View style={styles.doaRefHeader}>
                              <View style={styles.doaRefCodeWrap}>
                                <Text style={styles.doaRefCodeLabel}>Code</Text>
                                <Text style={styles.doaRefCode}>{item.referral_code}</Text>
                              </View>
                              <View style={[styles.raStatusBadge, { backgroundColor: refColor + "22", borderColor: refColor }]}>
                                <View style={[styles.raStatusDot, { backgroundColor: refColor }]} />
                                <Text style={[styles.raStatusText, { color: refColor }]}>{titleCase(item.status)}</Text>
                              </View>
                            </View>
                            <View style={styles.doaRefMeta}>
                              <Text style={styles.doaRefPhone}>{item.referrer_phone ?? "—"}</Text>
                              <Text style={styles.doaRefArrow}>→</Text>
                              <Text style={styles.doaRefPhone}>{item.referred_phone ?? "—"}</Text>
                              <Text style={[styles.doaRefReward, { color: refColor }]}>{formatCurrency(item.reward_paise)}</Text>
                            </View>
                          </View>
                        );
                      })}
                      {driverReferrals.length > referralsLimit && (
                        <Pressable style={styles.loadMoreBtn} onPress={() => setReferralsLimit(l => l + 10)}>
                          <Text style={styles.loadMoreBtnText}>Load more ({driverReferrals.length - referralsLimit} remaining)</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </>
              </>
            )}

            {/* Zones / Campaigns / Incentives */}
            <Divider label="Zones, Campaigns & Incentives" icon="🎯" subtitle={zones.length > 0 || campaigns.length > 0 || incentives.length > 0 ? `${zones.length} zones · ${campaigns.length} campaigns · ${incentives.length} incentives` : "Delivery zones, discount offers and driver rewards"} collapsed={isCollapsed("Zones, Campaigns & Incentives")} onPress={() => togglePanel("Zones, Campaigns & Incentives")} />
            {!isCollapsed("Zones, Campaigns & Incentives") && (
              <>
                {/* Create action buttons */}
                <View style={styles.zciActionGrid}>
                  {[
                    { icon: "🗺️", label: "Create Zone",      sub: "Delhi NCR · SLA 3min",     accent: "#2563eb", onPress: () => { setZciFormData(d => ({ ...d, name: "", city: "Delhi NCR", radiusKm: "3", slaMinutes: "20" })); setZciFormType("zone"); } },
                    { icon: "🏷️", label: "Create Offer",     sub: "₹50 flat · min ₹199",      accent: "#7c3aed", onPress: () => { setZciFormData(d => ({ ...d, code: `MOB${Date.now().toString(36).slice(-5).toUpperCase()}`, title: "", discountType: "flat", discountValue: "50", minOrderRupees: "199" })); setZciFormType("offer"); } },
                    { icon: "📣", label: "Create Campaign",  sub: "Push · ₹1,000 budget",     accent: "#d97706", onPress: () => { setZciFormData(d => ({ ...d, name: "", channel: "push", budgetRupees: "1000", aiCreative: "" })); setZciFormType("campaign"); } },
                    { icon: "🎁", label: "Create Incentive", sub: "5 deliveries → ₹75 bonus", accent: "#0f766e", onPress: () => { setZciFormData(d => ({ ...d, title: "", targetDeliveries: "5", rewardRupees: "75" })); setZciFormType("incentive"); } },
                  ].map(btn => (
                    <Pressable
                      key={btn.label}
                      style={[styles.zciActionBtn, { borderColor: btn.accent + "55" }, !authed && styles.zciActionBtnDisabled]}
                      disabled={!authed || loading}
                      onPress={btn.onPress}
                    >
                      <Text style={styles.zciActionIcon}>{btn.icon}</Text>
                      <Text style={[styles.zciActionLabel, { color: btn.accent }]}>{btn.label}</Text>
                      <Text style={styles.zciActionSub}>{btn.sub}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Zones */}
                <Text style={styles.zciSectionTitle}>🗺️ Zones</Text>
                {zones.length === 0 ? (
                  <View style={styles.zciEmptyRow}>
                    <Text style={styles.zciEmptyText}>No zones yet — tap Create Zone above to add your first delivery zone.</Text>
                  </View>
                ) : (
                  <>
                    {zones.slice(0, zonesLimit).map(item => (
                      <View key={item.id} style={[styles.zciCard, { borderLeftColor: "#2563eb" }]}>
                        <View style={styles.zciCardHeader}>
                          <Text style={styles.zciCardName}>{item.name}</Text>
                          <View style={styles.zciCityChip}>
                            <Text style={styles.zciCityChipText}>{item.city}</Text>
                          </View>
                        </View>
                        <View style={styles.zciCardMeta}>
                          <View style={styles.zciMetaChip}>
                            <Text style={styles.zciMetaChipIcon}>⏱</Text>
                            <Text style={styles.zciMetaChipText}>SLA {item.sla_minutes} min</Text>
                          </View>
                          <View style={styles.zciMetaChip}>
                            <Text style={styles.zciMetaChipIcon}>⚡</Text>
                            <Text style={styles.zciMetaChipText}>Surge {item.surge_multiplier}×</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                    {zones.length > zonesLimit && (
                      <Pressable style={styles.loadMoreBtn} onPress={() => setZonesLimit(l => l + 10)}>
                        <Text style={styles.loadMoreBtnText}>Load more ({zones.length - zonesLimit} remaining)</Text>
                      </Pressable>
                    )}
                  </>
                )}

                {/* Campaigns */}
                <Text style={[styles.zciSectionTitle, { marginTop: 8 }]}>📣 Campaigns</Text>
                {campaigns.length === 0 ? (
                  <View style={styles.zciEmptyRow}>
                    <Text style={styles.zciEmptyText}>No campaigns yet — tap Create Campaign above to launch your first campaign.</Text>
                  </View>
                ) : (
                  <>
                    {campaigns.slice(0, campaignsLimit).map(item => {
                      const campColor = item.status === "active" ? "#22c55e" : item.status === "paused" ? "#eab308" : "#888888";
                      return (
                        <View key={item.id} style={[styles.zciCard, { borderLeftColor: "#d97706" }]}>
                          <View style={styles.zciCardHeader}>
                            <Text style={styles.zciCardName} numberOfLines={1}>{item.name}</Text>
                            <View style={[styles.raStatusBadge, { backgroundColor: campColor + "22", borderColor: campColor }]}>
                              <View style={[styles.raStatusDot, { backgroundColor: campColor }]} />
                              <Text style={[styles.raStatusText, { color: campColor }]}>{titleCase(item.status)}</Text>
                            </View>
                          </View>
                          <View style={styles.zciCardMeta}>
                            <View style={styles.zciMetaChip}>
                              <Text style={styles.zciMetaChipIcon}>📡</Text>
                              <Text style={styles.zciMetaChipText}>{titleCase(item.channel)}</Text>
                            </View>
                            <View style={styles.zciMetaChip}>
                              <Text style={styles.zciMetaChipIcon}>💰</Text>
                              <Text style={styles.zciMetaChipText}>{formatCurrency(item.budget_paise)}</Text>
                            </View>
                          </View>
                          {item.ai_creative && (
                            <Text style={styles.zciAiCreative} numberOfLines={2}>🤖 {item.ai_creative}</Text>
                          )}
                        </View>
                      );
                    })}
                    {campaigns.length > campaignsLimit && (
                      <Pressable style={styles.loadMoreBtn} onPress={() => setCampaignsLimit(l => l + 10)}>
                        <Text style={styles.loadMoreBtnText}>Load more ({campaigns.length - campaignsLimit} remaining)</Text>
                      </Pressable>
                    )}
                  </>
                )}

                {/* Incentives */}
                <Text style={[styles.zciSectionTitle, { marginTop: 8 }]}>🎁 Driver Incentives</Text>
                {incentives.length === 0 ? (
                  <View style={styles.zciEmptyRow}>
                    <Text style={styles.zciEmptyText}>No incentives yet — tap Create Incentive above to reward drivers.</Text>
                  </View>
                ) : incentives.slice(0, incentivesZciLimit).map(item => {
                  const incColor = item.status === "active" ? "#22c55e" : item.status === "completed" ? "#3b82f6" : "#888888";
                  return (
                    <View key={item.id} style={[styles.zciCard, { borderLeftColor: "#0f766e" }]}>
                      <View style={styles.zciCardHeader}>
                        <Text style={styles.zciCardName} numberOfLines={1}>{item.title}</Text>
                        <View style={[styles.raStatusBadge, { backgroundColor: incColor + "22", borderColor: incColor }]}>
                          <View style={[styles.raStatusDot, { backgroundColor: incColor }]} />
                          <Text style={[styles.raStatusText, { color: incColor }]}>{titleCase(item.status)}</Text>
                        </View>
                      </View>
                      <View style={styles.zciCardMeta}>
                        <View style={styles.zciMetaChip}>
                          <Text style={styles.zciMetaChipIcon}>🚗</Text>
                          <Text style={styles.zciMetaChipText}>{item.target_deliveries} deliveries</Text>
                        </View>
                        <View style={styles.zciMetaChip}>
                          <Text style={[styles.zciMetaChipIcon, { color: "#0f766e" }]}>🎁</Text>
                          <Text style={[styles.zciMetaChipText, { color: "#0f766e", fontWeight: "700" as const }]}>{formatCurrency(item.reward_paise)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
                {incentives.length > incentivesZciLimit && (
                  <Pressable style={styles.loadMoreBtn} onPress={() => setIncentivesZciLimit(l => l + 10)}>
                    <Text style={styles.loadMoreBtnText}>Load more ({incentives.length - incentivesZciLimit} remaining)</Text>
                  </Pressable>
                )}
              </>
            )}

            {/* Analytics & Predictions */}
            <Divider
              label="Analytics & Predictions"
              icon="📈"
              subtitle={analyticsJobs.length > 0 ? `${analyticsJobs.length} jobs · ${demandPredictions.length} predictions` : "AI-powered demand forecasts and order trends"}
              collapsed={isCollapsed("Analytics & Predictions")}
              onPress={() => togglePanel("Analytics & Predictions")}
            />
            {!isCollapsed("Analytics & Predictions") && (() => {
              const jobStatusColor = (s: string) => s === "completed" ? "#22c55e" : s === "running" ? "#3b82f6" : s === "failed" ? "#ef4444" : "#aaaaaa";
              const completedJobs = analyticsJobs.filter(j => j.status === "completed").length;
              const runningJobs  = analyticsJobs.filter(j => j.status === "running").length;
              const failedJobs   = analyticsJobs.filter(j => j.status === "failed").length;
              return (
                <>
                  {/* Run button */}
                  <Pressable
                    style={[styles.anlRunBtn, (!authed || loading) && styles.anlRunBtnDisabled]}
                    disabled={!authed || loading}
                    onPress={async () => {
                      const result = await run("Running AI demand prediction", () => api.runDemandPredictionJob(token));
                      if (result) {
                        const [jobs, preds] = await Promise.allSettled([api.analyticsJobs(token), api.demandPredictions(token)]);
                        if (jobs.status === "fulfilled") setAnalyticsJobs(jobs.value);
                        if (preds.status === "fulfilled") setDemandPredictions(preds.value);
                      }
                    }}
                  >
                    <Text style={styles.anlRunIcon}>🤖</Text>
                    <View>
                      <Text style={styles.anlRunLabel}>Run AI Demand Prediction</Text>
                      <Text style={styles.anlRunSub}>Generates zone-level order forecasts</Text>
                    </View>
                  </Pressable>

                  {/* Stats */}
                  {analyticsJobs.length > 0 && (
                    <View style={styles.raStatsRow}>
                      {[
                        { label: "Total",     color: "#aaaaaa", count: analyticsJobs.length },
                        { label: "Completed", color: "#22c55e", count: completedJobs },
                        { label: "Running",   color: "#3b82f6", count: runningJobs },
                        { label: "Failed",    color: "#ef4444", count: failedJobs },
                      ].map(s => (
                        <View key={s.label} style={styles.raStatPill}>
                          <View style={[styles.raStatDot, { backgroundColor: s.color }]} />
                          <Text style={[styles.raStatCount, { color: s.color }]}>{s.count}</Text>
                          <Text style={styles.raStatLabel}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Tab toggle */}
                  <View style={styles.anlTabRow}>
                    {(["jobs", "predictions"] as const).map(t => (
                      <Pressable key={t} style={[styles.anlTab, analyticsTab === t && styles.anlTabActive]} onPress={() => setAnalyticsTab(t)}>
                        <Text style={[styles.anlTabText, analyticsTab === t && styles.anlTabTextActive]}>
                          {t === "jobs" ? `⚙️ Jobs (${analyticsJobs.length})` : `🔮 Predictions (${demandPredictions.length})`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {analyticsTab === "jobs" && (analyticsJobs.length === 0 ? (
                    <View style={styles.raEmpty}>
                      <Text style={styles.raEmptyIcon}>📊</Text>
                      <Text style={styles.raEmptyText}>No jobs yet</Text>
                      <Text style={styles.raEmptyHint}>Tap "Run AI Demand Prediction" to trigger your first analytics job.</Text>
                    </View>
                  ) : analyticsJobs.slice(0, 10).map(item => {
                    const jColor = jobStatusColor(item.status);
                    const summary = item.summary && typeof item.summary === "object" && "predictions" in (item.summary as object)
                      ? `${(item.summary as { predictions: number }).predictions} predictions generated`
                      : null;
                    return (
                      <View key={item.id} style={[styles.anlJobCard, { borderLeftColor: jColor }]}>
                        <View style={styles.anlJobTop}>
                          <Text style={styles.anlJobType}>{item.job_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Text>
                          <View style={[styles.raStatusBadge, { backgroundColor: jColor + "22", borderColor: jColor }]}>
                            <View style={[styles.raStatusDot, { backgroundColor: jColor }]} />
                            <Text style={[styles.raStatusText, { color: jColor }]}>{titleCase(item.status)}</Text>
                          </View>
                        </View>
                        <View style={styles.anlJobMeta}>
                          <Text style={styles.anlJobDate}>{fmtTs(item.created_at)}</Text>
                          {summary && <Text style={styles.anlJobSummary}>· {summary}</Text>}
                        </View>
                      </View>
                    );
                  }))}

                  {analyticsTab === "predictions" && (demandPredictions.length === 0 ? (
                    <View style={styles.raEmpty}>
                      <Text style={styles.raEmptyIcon}>🔮</Text>
                      <Text style={styles.raEmptyText}>No predictions yet</Text>
                      <Text style={styles.raEmptyHint}>Run an AI demand prediction job to see zone-level forecasts here.</Text>
                    </View>
                  ) : demandPredictions.slice(0, 20).map(item => {
                    const conf = parseFloat(item.confidence);
                    const confColor = conf >= 80 ? "#22c55e" : conf >= 60 ? "#eab308" : "#ef4444";
                    return (
                      <View key={item.id} style={[styles.anlPredCard, { borderLeftColor: confColor }]}>
                        <View style={styles.anlPredTop}>
                          <Text style={styles.anlPredZone} numberOfLines={1}>{item.zone_key}</Text>
                          <Text style={[styles.anlPredOrders, { color: confColor }]}>{item.predicted_orders} orders</Text>
                        </View>
                        <View style={styles.anlPredMeta}>
                          <View style={styles.anlPredChip}>
                            <Text style={styles.anlPredChipText}>{item.cuisine_type ?? "All cuisines"}</Text>
                          </View>
                          <View style={styles.anlPredChip}>
                            <Text style={styles.anlPredChipText}>⏰ {fmtTs(item.hour_start)}</Text>
                          </View>
                        </View>
                        <View style={styles.anlConfRow}>
                          <Text style={styles.anlConfLabel}>Confidence</Text>
                          <View style={styles.anlConfBarBg}>
                            <View style={[styles.anlConfBarFill, { width: `${conf}%` as `${number}%`, backgroundColor: confColor }]} />
                          </View>
                          <Text style={[styles.anlConfValue, { color: confColor }]}>{conf.toFixed(1)}%</Text>
                        </View>
                      </View>
                    );
                  }))}
                </>
              );
            })()}

            {/* Payouts */}
            <Divider label="Payouts" icon="💸" subtitle={adminPayouts.length > 0 ? `${adminPayouts.filter(p => p.status === "pending").length} pending · ${adminPayouts.length} total` : "Driver and restaurant payout management"} collapsed={isCollapsed("Payouts")} onPress={() => togglePanel("Payouts")} />
            {!isCollapsed("Payouts") && (
              <>
                {/* Stats row */}
                {adminPayouts.length > 0 && (
                  <View style={styles.raStatsRow}>
                    {[
                      { label: "Pending",  color: "#eab308", count: adminPayouts.filter(p => p.status === "pending").length },
                      { label: "Approved", color: "#3b82f6", count: adminPayouts.filter(p => p.status === "approved").length },
                      { label: "Paid",     color: "#22c55e", count: adminPayouts.filter(p => p.status === "paid").length },
                      { label: "Rejected", color: "#ef4444", count: adminPayouts.filter(p => p.status === "rejected").length },
                    ].map(s => (
                      <View key={s.label} style={styles.raStatPill}>
                        <View style={[styles.raStatDot, { backgroundColor: s.color }]} />
                        <Text style={[styles.raStatCount, { color: s.color }]}>{s.count}</Text>
                        <Text style={styles.raStatLabel}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Total pending amount */}
                {adminPayouts.filter(p => p.status === "pending").length > 0 && (
                  <View style={styles.payoutTotalCard}>
                    <Text style={styles.payoutTotalLabel}>Total Pending</Text>
                    <Text style={styles.payoutTotalAmount}>
                      {formatCurrency(adminPayouts.filter(p => p.status === "pending").reduce((s, p) => s + p.amount_paise, 0))}
                    </Text>
                  </View>
                )}

                {/* Payout cards */}
                {adminPayouts.length === 0 ? (
                  <View style={styles.raEmpty}>
                    <Text style={styles.raEmptyIcon}>💸</Text>
                    <Text style={styles.raEmptyText}>No payouts</Text>
                    <Text style={styles.raEmptyHint}>Payout requests will appear here when drivers or restaurants request payments.</Text>
                  </View>
                ) : adminPayouts.slice(0, payoutsLimit).map(item => {
                  const payoutStatusColor = (s: string) =>
                    s === "paid" ? "#22c55e" : s === "approved" ? "#3b82f6" : s === "rejected" ? "#ef4444" : "#eab308";
                  const statusColor = payoutStatusColor(item.status);
                  const roleColor = roleAccent(item.role);
                  return (
                    <View key={item.id} style={[styles.payoutCard, { borderLeftColor: statusColor }]}>
                      {/* Header */}
                      <View style={styles.payoutCardHeader}>
                        <View style={styles.payoutCardLeft}>
                          <View style={[styles.payoutRolePill, { backgroundColor: roleColor + "22", borderColor: roleColor + "55" }]}>
                            <Text style={[styles.payoutRolePillText, { color: roleColor }]}>{titleCase(item.role)}</Text>
                          </View>
                          {item.phone && <Text style={styles.payoutPhone}>{item.phone}</Text>}
                        </View>
                        <View style={[styles.raStatusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
                          <View style={[styles.raStatusDot, { backgroundColor: statusColor }]} />
                          <Text style={[styles.raStatusText, { color: statusColor }]}>{titleCase(item.status)}</Text>
                        </View>
                      </View>

                      {/* Amount + method */}
                      <View style={styles.payoutAmountRow}>
                        <Text style={[styles.payoutAmount, { color: statusColor }]}>{formatCurrency(item.amount_paise)}</Text>
                        <View style={styles.payoutMethodChip}>
                          <Text style={styles.payoutMethodText}>via {titleCase(item.method)}</Text>
                        </View>
                      </View>

                      {/* Actions */}
                      {(item.status === "pending" || item.status === "approved") && (
                        <View style={styles.raActions}>
                          {item.status === "pending" && (
                            <Pressable
                              style={styles.raApproveBtn}
                              onPress={() => Alert.alert("Approve Payout", `Approve ${formatCurrency(item.amount_paise)} payout?`, [
                                { text: "Cancel", style: "cancel" },
                                { text: "Approve", onPress: async () => {
                                  const result = await run("Approving payout", () => api.updatePayoutApproval(token, item.id, "approved", "Approved from AK Ops mobile"));
                                  if (result) setAdminPayouts(prev => prev.map(p => p.id === item.id ? { ...p, status: "approved" } : p));
                                }}
                              ])}
                            >
                              <Text style={styles.raApproveBtnText}>✓ Approve</Text>
                            </Pressable>
                          )}
                          {item.status === "approved" && (
                            <Pressable
                              style={[styles.raApproveBtn, { backgroundColor: "#0c2d1a", borderColor: "#22c55e" }]}
                              onPress={() => Alert.alert("Mark as Paid", `Confirm payment of ${formatCurrency(item.amount_paise)}?`, [
                                { text: "Cancel", style: "cancel" },
                                { text: "Mark Paid", onPress: async () => {
                                  const result = await run("Marking payout paid", () => api.updatePayoutApproval(token, item.id, "paid"));
                                  if (result) setAdminPayouts(prev => prev.map(p => p.id === item.id ? { ...p, status: "paid" } : p));
                                }}
                              ])}
                            >
                              <Text style={[styles.raApproveBtnText, { color: "#4ade80" }]}>💳 Mark Paid</Text>
                            </Pressable>
                          )}
                          <Pressable
                            style={styles.raRejectBtn}
                            onPress={() => Alert.prompt("Reject Payout", "Enter reason for rejection:", [
                              { text: "Cancel", style: "cancel" },
                              { text: "Reject", style: "destructive", onPress: async (note) => {
                                const result = await run("Rejecting payout", () => api.updatePayoutApproval(token, item.id, "rejected", note ?? "Rejected from AK Ops mobile"));
                                if (result) setAdminPayouts(prev => prev.map(p => p.id === item.id ? { ...p, status: "rejected" } : p));
                              }}
                            ], "plain-text")}
                          >
                            <Text style={styles.raRejectBtnText}>✕ Reject</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
                {adminPayouts.length > payoutsLimit && (
                  <Pressable style={styles.loadMoreBtn} onPress={() => setPayoutsLimit(l => l + 10)}>
                    <Text style={styles.loadMoreBtnText}>Load more ({adminPayouts.length - payoutsLimit} remaining)</Text>
                  </Pressable>
                )}
              </>
            )}

            {/* Support Tickets */}
            <Divider
              label="Support Tickets"
              icon="🎫"
              subtitle={supportTickets.length > 0 ? `${supportTickets.filter(t => t.status === "open").length} open · ${supportTickets.length} total` : "Customer support and issue resolution"}
              collapsed={isCollapsed("Support Tickets")}
              onPress={() => togglePanel("Support Tickets")}
            />
            {!isCollapsed("Support Tickets") && (() => {
              const ticketStatusColor = (s: string) => s === "open" ? "#eab308" : s === "in_progress" ? "#3b82f6" : s === "resolved" ? "#22c55e" : "#555555";
              const ticketCategoryColor = (c: string) => c === "technical" ? "#7c3aed" : c === "billing" ? "#d97706" : c === "delivery" ? "#0f766e" : "#555555";
              const filtered = ticketFilter === "all" ? supportTickets : supportTickets.filter(t => t.status === ticketFilter);
              const visible = filtered.slice(0, ticketDisplayLimit);
              const remaining = filtered.length - visible.length;
              return (
                <>
                  {/* Stats row */}
                  {supportTickets.length > 0 && (
                    <View style={styles.raStatsRow}>
                      {[
                        { label: "Open",        color: "#eab308", count: supportTickets.filter(t => t.status === "open").length },
                        { label: "In Progress", color: "#3b82f6", count: supportTickets.filter(t => t.status === "in_progress").length },
                        { label: "Resolved",    color: "#22c55e", count: supportTickets.filter(t => t.status === "resolved").length },
                        { label: "Closed",      color: "#555555", count: supportTickets.filter(t => t.status === "closed").length },
                      ].map(s => (
                        <View key={s.label} style={styles.raStatPill}>
                          <View style={[styles.raStatDot, { backgroundColor: s.color }]} />
                          <Text style={[styles.raStatCount, { color: s.color }]}>{s.count}</Text>
                          <Text style={styles.raStatLabel}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Filter chips */}
                  <View style={styles.stFilterRow}>
                    {(["all", "open", "in_progress", "resolved", "closed"] as const).map(f => (
                      <Pressable
                        key={f}
                        style={[styles.stFilterChip, ticketFilter === f && styles.stFilterChipActive]}
                        onPress={() => { setTicketFilter(f); setTicketDisplayLimit(10); }}
                      >
                        <Text style={[styles.stFilterChipText, ticketFilter === f && styles.stFilterChipTextActive]}>
                          {f === "all" ? "All" : f === "in_progress" ? "In Progress" : titleCase(f)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Create test ticket */}
                  <Pressable
                    style={[styles.stCreateBtn, (!authed || loading) && { opacity: 0.5 }]}
                    disabled={!authed || loading}
                    onPress={async () => {
                      const result = await run("Creating support ticket", () => api.createSupportTicket(token, "technical", `Mobile test ticket ${new Date().toLocaleTimeString()}`, "Test ticket created from AK Ops mobile app."));
                      if (result) {
                        const fresh = await api.supportTickets(token).catch(() => null);
                        if (fresh) setSupportTickets(fresh);
                      }
                    }}
                  >
                    <Text style={styles.stCreateBtnText}>＋ Create Test Ticket</Text>
                  </Pressable>

                  {filtered.length === 0 ? (
                    <View style={styles.raEmpty}>
                      <Text style={styles.raEmptyIcon}>🎫</Text>
                      <Text style={styles.raEmptyText}>{ticketFilter === "all" ? "No tickets yet" : `No ${ticketFilter.replace("_", " ")} tickets`}</Text>
                      <Text style={styles.raEmptyHint}>Customer support requests will appear here.</Text>
                    </View>
                  ) : (
                    <>
                      {visible.map(item => {
                        const sColor = ticketStatusColor(item.status);
                        const cColor = ticketCategoryColor(item.category);
                        return (
                          <View key={item.id} style={[styles.stCard, { borderLeftColor: sColor }]}>
                            <View style={styles.stCardHeader}>
                              <View style={[styles.stCategoryChip, { backgroundColor: cColor + "22", borderColor: cColor + "55" }]}>
                                <Text style={[styles.stCategoryText, { color: cColor }]}>{titleCase(item.category)}</Text>
                              </View>
                              <View style={[styles.raStatusBadge, { backgroundColor: sColor + "22", borderColor: sColor }]}>
                                <View style={[styles.raStatusDot, { backgroundColor: sColor }]} />
                                <Text style={[styles.raStatusText, { color: sColor }]}>{item.status === "in_progress" ? "In Progress" : titleCase(item.status)}</Text>
                              </View>
                            </View>
                            <Text style={styles.stSubject} numberOfLines={2}>{item.subject}</Text>
                            <View style={styles.stCardMeta}>
                              <Text style={styles.stCardId}>#{String(item.id).slice(-8).toUpperCase()}</Text>
                              <Text style={styles.stCardDot}>·</Text>
                              <Text style={styles.stCardDate}>{fmtTs(item.created_at)}</Text>
                            </View>
                          </View>
                        );
                      })}
                      {remaining > 0 && (
                        <Pressable style={styles.umLoadMoreBtn} onPress={() => setTicketDisplayLimit(l => l + 10)}>
                          <Text style={styles.umLoadMoreText}>Show {Math.min(remaining, 10)} more</Text>
                          <Text style={styles.umLoadMoreCount}>{remaining} remaining</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </>
              );
            })()}

            {/* Security & Audit Logs */}
            <Divider
              label="Security & Audit Logs"
              icon="🔒"
              subtitle={auditLogs.length > 0 ? `${auditLogs.length} audit entries · ${verificationChecks.length} verifications` : "Access logs, audit trail and identity verification"}
              collapsed={isCollapsed("Security & Audit Logs")}
              onPress={() => togglePanel("Security & Audit Logs")}
            />
            {!isCollapsed("Security & Audit Logs") && (() => {
              const methodColor = (m: string) => m === "GET" ? "#3b82f6" : m === "POST" ? "#22c55e" : m === "PATCH" || m === "PUT" ? "#eab308" : m === "DELETE" ? "#ef4444" : "#aaaaaa";
              const statusCodeColor = (c: number) => c >= 500 ? "#ef4444" : c >= 400 ? "#eab308" : c >= 200 ? "#22c55e" : "#aaaaaa";
              const checkStatusColor = (s: string) => s === "passed" ? "#22c55e" : s === "failed" ? "#ef4444" : s === "pending" ? "#eab308" : "#aaaaaa";
              const visibleLogs = auditLogs.slice(0, auditDisplayLimit);
              const remainingLogs = auditLogs.length - visibleLogs.length;
              return (
                <>
                  {/* Audit stats */}
                  {auditLogs.length > 0 && (
                    <View style={styles.raStatsRow}>
                      {[
                        { label: "Total",    color: "#aaaaaa", count: auditLogs.length },
                        { label: "Errors",   color: "#ef4444", count: auditLogs.filter(l => l.status_code >= 500).length },
                        { label: "Warnings", color: "#eab308", count: auditLogs.filter(l => l.status_code >= 400 && l.status_code < 500).length },
                        { label: "OK",       color: "#22c55e", count: auditLogs.filter(l => l.status_code >= 200 && l.status_code < 400).length },
                      ].map(s => (
                        <View key={s.label} style={styles.raStatPill}>
                          <View style={[styles.raStatDot, { backgroundColor: s.color }]} />
                          <Text style={[styles.raStatCount, { color: s.color }]}>{s.count}</Text>
                          <Text style={styles.raStatLabel}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Verification Checks */}
                  <Text style={styles.audSectionLabel}>🔐 Identity Verifications</Text>
                  {verificationChecks.length === 0 ? (
                    <View style={styles.raEmpty}>
                      <Text style={styles.raEmptyIcon}>🔐</Text>
                      <Text style={styles.raEmptyText}>No verification checks</Text>
                      <Text style={styles.raEmptyHint}>Identity verification records will appear here once drivers submit documents.</Text>
                    </View>
                  ) : (
                    <>
                      {verificationChecks.slice(0, vcLimit).map(item => {
                        const vcColor = checkStatusColor(item.status);
                        return (
                          <View key={item.id} style={[styles.audVcCard, { borderLeftColor: vcColor }]}>
                            <View style={styles.audVcRow}>
                              <View style={styles.audVcLeft}>
                                <Text style={styles.audVcProvider}>{titleCase(item.provider)}</Text>
                                <Text style={styles.audVcType}>{item.check_type.replace(/_/g, " ")}</Text>
                              </View>
                              <View style={[styles.raStatusBadge, { backgroundColor: vcColor + "22", borderColor: vcColor }]}>
                                <View style={[styles.raStatusDot, { backgroundColor: vcColor }]} />
                                <Text style={[styles.raStatusText, { color: vcColor }]}>{titleCase(item.status)}</Text>
                              </View>
                            </View>
                            {"created_at" in item && (
                              <Text style={styles.audVcDate}>{fmtTs((item as { created_at: string }).created_at)}</Text>
                            )}
                          </View>
                        );
                      })}
                      {verificationChecks.length > vcLimit && (
                        <Pressable style={styles.loadMoreBtn} onPress={() => setVcLimit(l => l + 5)}>
                          <Text style={styles.loadMoreBtnText}>Load more ({verificationChecks.length - vcLimit} remaining)</Text>
                        </Pressable>
                      )}
                    </>
                  )}

                  {/* Audit Logs */}
                  <Text style={[styles.audSectionLabel, { marginTop: verificationChecks.length > 0 ? 12 : 0 }]}>📋 Audit Trail</Text>
                  {auditLogs.length === 0 ? (
                    <View style={styles.raEmpty}>
                      <Text style={styles.raEmptyIcon}>🔒</Text>
                      <Text style={styles.raEmptyText}>No audit logs yet</Text>
                      <Text style={styles.raEmptyHint}>Every API action is logged here. Perform operations to see the trail.</Text>
                    </View>
                  ) : (
                    <>
                      {visibleLogs.map(item => {
                        const mColor = methodColor(item.method);
                        const sColor = statusCodeColor(item.status_code);
                        const pathShort = item.path.replace(/\/api\/v1/, "").replace(/\/[0-9a-f-]{36}/g, "/:id");
                        return (
                          <View key={item.id} style={[styles.audLogCard, { borderLeftColor: sColor }]}>
                            <View style={styles.audLogRow}>
                              <View style={[styles.audMethodChip, { backgroundColor: mColor + "22", borderColor: mColor + "55" }]}>
                                <Text style={[styles.audMethodText, { color: mColor }]}>{item.method}</Text>
                              </View>
                              <Text style={styles.audLogPath} numberOfLines={1}>{pathShort}</Text>
                              <View style={[styles.audStatusCodeChip, { backgroundColor: sColor + "22" }]}>
                                <Text style={[styles.audStatusCodeText, { color: sColor }]}>{item.status_code}</Text>
                              </View>
                            </View>
                            {"created_at" in item && (
                              <Text style={styles.audLogDate}>{fmtTs((item as { created_at: string }).created_at)}</Text>
                            )}
                          </View>
                        );
                      })}
                      {remainingLogs > 0 && (
                        <Pressable style={styles.umLoadMoreBtn} onPress={() => setAuditDisplayLimit(l => l + 10)}>
                          <Text style={styles.umLoadMoreText}>Show {Math.min(remainingLogs, 10)} more</Text>
                          <Text style={styles.umLoadMoreCount}>{remainingLogs} remaining</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function KpiCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: string }) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: accent }]}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function RoleDropdown({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable style={styles.roleDropdown} onPress={() => setOpen(o => !o)}>
        <Text style={styles.roleDropdownValue}>{titleCase(value)}</Text>
        <Text style={styles.roleDropdownChevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <View style={styles.roleDropdownMenu}>
          {roleOptions.map(r => (
            <Pressable
              key={r}
              style={[styles.roleDropdownItem, r === value && styles.roleDropdownItemActive]}
              onPress={() => { onChange(r); setOpen(false); }}
            >
              <Text style={[styles.roleDropdownItemText, r === value && styles.roleDropdownItemTextActive]}>
                {titleCase(r)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Divider({ label, icon, subtitle, collapsed, onPress }: {
  label: string;
  icon?: string;
  subtitle?: string;
  collapsed?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.divider} onPress={onPress}>
      <View style={styles.dividerInner}>
        {icon && (
          <View style={styles.dividerIconWrap}>
            <Text style={styles.dividerIconText}>{icon}</Text>
          </View>
        )}
        <View style={styles.dividerTextBlock}>
          <Text style={styles.dividerLabel}>{label}</Text>
          {subtitle ? <Text style={styles.dividerSubtitle}>{subtitle}</Text> : null}
        </View>
        {onPress && (
          <View style={[styles.dividerChevronPill, !collapsed && styles.dividerChevronPillOpen]}>
            <Text style={styles.dividerChevron}>{collapsed ? "▶" : "▼"}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => unknown | Promise<unknown>; disabled?: boolean }) {
  return (
    <Pressable style={[styles.button, disabled && styles.buttonDisabled]} onPress={() => void onPress()} disabled={disabled}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Segmented({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmented}>
      {values.map(item => (
        <Pressable key={item} style={[styles.segment, value === item && styles.segmentActive]} onPress={() => onChange(item)}>
          <Text style={[styles.segmentText, value === item && styles.segmentTextActive]}>{titleCase(item)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function roleAccent(role: string): string {
  switch (role) {
    case "super_admin":    return "#7c3aed";
    case "admin":          return "#0f766e";
    case "delivery_admin": return "#4f46e5";
    case "restaurant":     return "#d97706";
    case "driver":         return "#2563eb";
    default:               return "#888888";
  }
}

function orderStatusColor(status: string) {
  switch (status) {
    case "created":   return "#92400e";
    case "accepted":  return "#f97316";
    case "preparing": return "#3b82f6";
    case "ready":     return "#eab308";
    case "picked_up": return "#14b8a6";
    case "delivered": return "#22c55e";
    case "cancelled": return "#ef4444";
    default:          return "#aaaaaa";
  }
}

function OrderRow({ restaurantName, orderId, status, totalPaise }: { restaurantName: string; orderId: string; status: string; totalPaise: number }) {
  const color = orderStatusColor(status);
  return (
    <View style={styles.listItem}>
      <View style={styles.orderRowHeader}>
        <Text style={[styles.listTitle, { flex: 1 }]}>{restaurantName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color }]}>
          <Text style={[styles.statusBadgeText, { color }]}>{titleCase(status)}</Text>
        </View>
      </View>
      <Text style={styles.listSubtitle}>#{orderId.slice(0, 8)} · {formatCurrency(totalPaise)}</Text>
    </View>
  );
}

function restaurantStatusColor(status: string) {
  switch (status) {
    case "approved": return "#22c55e";
    case "rejected": return "#ef4444";
    case "pending":  return "#eab308";
    default:         return "#aaaaaa";
  }
}

function RestaurantRow({ name, approvalStatus, isActive, rejectionReason, onApprove, onReject, onOffboard }: {
  name: string;
  approvalStatus: string;
  isActive?: boolean;
  rejectionReason?: string | null;
  onApprove?: () => void;
  onReject?: () => void;
  onOffboard?: () => void;
}) {
  const color = restaurantStatusColor(approvalStatus);
  return (
    <View style={styles.listItem}>
      <View style={styles.orderRowHeader}>
        <Text style={[styles.listTitle, { flex: 1 }]}>{name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color }]}>
          <Text style={[styles.statusBadgeText, { color }]}>{titleCase(approvalStatus)}</Text>
        </View>
      </View>
      {approvalStatus === "rejected" && rejectionReason ? (
        <Text style={styles.rejectionReason}>Reason: {rejectionReason}</Text>
      ) : null}
      {isActive === false && (
        <Text style={[styles.rejectionReason, { color: "#aaaaaa" }]}>Deactivated — not visible to customers</Text>
      )}
      {(onApprove || onReject || onOffboard) && (
        <View style={[styles.actions, { marginTop: 8 }]}>
          {onApprove && (
            <Pressable style={styles.button} onPress={onApprove}>
              <Text style={styles.buttonText}>Approve ›</Text>
            </Pressable>
          )}
          {onReject && (
            <Pressable style={[styles.button, styles.buttonBan]} onPress={onReject}>
              <Text style={styles.buttonText}>Reject ›</Text>
            </Pressable>
          )}
          {onOffboard && (
            <Pressable style={[styles.button, { backgroundColor: "#6b7280" }]} onPress={onOffboard}>
              <Text style={styles.buttonText}>Offboard ›</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function ListItem({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress?: () => void }) {
  return (
    <Pressable style={[styles.listItem, onPress && styles.listItemTappable]} onPress={onPress}>
      <Text style={styles.listTitle}>{title}</Text>
      {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      {onPress ? <Text style={styles.listTapHint}>Click to Approve ›</Text> : null}
    </Pressable>
  );
}

function Summary({ title, lines }: { title: string; lines: string[] }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {lines.map((line, i) => <Text key={i} style={styles.summaryLine}>{line}</Text>)}
    </View>
  );
}

function formatCurrency(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

// ── Styles ─────────────────────────────────────────────────────────────────

const TEAL = "#E23744";
const TEAL_DARK = "#c42e3b";
const CREAM = "#0f0f0f";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: "#ffffff" },
  subtitle: { color: "#888888", fontSize: 15 },
  testHint: { color: "#aaaaaa", fontSize: 12, marginTop: 4 },

  // Login status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 6
  },
  statusRowOffline: { backgroundColor: "#1f0e10" },
  statusRowError: { backgroundColor: "#1f0e10" },
  statusDot: { fontSize: 14, color: TEAL, fontWeight: "700" },
  statusText: { color: TEAL, fontWeight: "700", flex: 1, fontSize: 13 },

  notice: { backgroundColor: "#1e1e1e", color: "#aaaaaa", padding: 10, borderRadius: 6, fontSize: 13 },

  // Cards
  card: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2e2e2e",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    shadowColor: "#1a1a1a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#ffffff" },

  // Divider (production panel button)
  divider: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    marginTop: 6,
    marginBottom: 2,
    shadowColor: "#1a1a1a",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dividerInner: { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 12, paddingVertical: 11, gap: 10 },
  dividerIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#2e2e2e", alignItems: "center" as const, justifyContent: "center" as const },
  dividerIconText: { fontSize: 16 },
  dividerTextBlock: { flex: 1, gap: 1 },
  dividerLabel: { fontSize: 13, fontWeight: "700" as const, color: "#ffffff" },
  dividerSubtitle: { fontSize: 11, color: "#aaaaaa" },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#2e2e2e" },
  dividerChevronPill: { backgroundColor: "#2e2e2e", borderRadius: 6, width: 26, height: 26, alignItems: "center" as const, justifyContent: "center" as const },
  dividerChevronPillOpen: { backgroundColor: "#E23744" },

  sectionTitle: { fontWeight: "800", color: "#ffffff" },
  sectionHint: { color: "#555555", fontSize: 13, lineHeight: 18 },
  helperText: { color: "#555555", fontSize: 13, lineHeight: 18 },
  emptyHint: { color: "#aaaaaa", fontSize: 13, fontStyle: "italic", textAlign: "center", paddingVertical: 6 },

  // Inputs
  input: {
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 6,
    padding: Platform.OS === "ios" ? 12 : 9,
    backgroundColor: "#1a1a1a",
    fontSize: 14
  },

  // Buttons
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: { backgroundColor: TEAL, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12 },
  buttonDisabled: { backgroundColor: "#cbd5e1" },
  buttonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },

  // Upload previews
  uploadPreviews: { justifyContent: "flex-start" },
  uploadPreview: { width: 80, height: 80, borderRadius: 8 },

  // Login panel
  loginPanel: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 22,
    gap: 14,
    shadowColor: "#1a1a1a",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  loginBrand: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: 4,
  },
  loginLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0f766e",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginLogoText: { fontSize: 26 },
  loginBrandName: { fontSize: 22, fontWeight: "800" as const, color: "#ffffff" },
  loginBrandTagline: { color: "#888888", fontSize: 12, fontWeight: "500" as const, marginTop: 2 },
  loginAlert: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: "#222222",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1e4d30",
  },
  loginAlertError: { backgroundColor: "#1f0e10", borderColor: "#5e1a25" },
  loginAlertIcon: { fontSize: 14, fontWeight: "700" as const, color: "#aaaaaa" },
  loginAlertText: { color: "#ffffff", fontSize: 13, flex: 1, fontWeight: "500" as const },
  loginField: { gap: 6 },
  loginFieldLabel: { color: "#aaaaaa", fontSize: 13, fontWeight: "600" as const },
  loginInput: {
    borderWidth: 1.5,
    borderColor: "#2e2e2e",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 15,
    color: "#ffffff",
    backgroundColor: "#1e1e1e",
  },
  loginInputSubtle: {
    borderColor: "#ffffff",
    backgroundColor: "#1e1e1e",
    fontSize: 12,
    color: "#aaaaaa",
    paddingVertical: Platform.OS === "ios" ? 9 : 6,
  },
  loginPrimaryBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center" as const,
    marginTop: 2,
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginPrimaryBtnDisabled: { backgroundColor: "#cbd5e1", shadowOpacity: 0, elevation: 0 },
  loginPrimaryBtnText: { color: "#ffffff", fontWeight: "700" as const, fontSize: 16 },
  loginDividerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  loginDividerLine: { flex: 1, height: 1, backgroundColor: "#2e2e2e" },
  loginDividerText: { color: "#aaaaaa", fontSize: 12, fontWeight: "500" as const },
  loginSecondaryRow: { flexDirection: "row" as const, gap: 8 },
  loginSecondaryBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#2e2e2e",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center" as const,
    backgroundColor: "#1e1e1e",
  },
  loginSecondaryBtnText: { color: "#ffffff", fontWeight: "600" as const, fontSize: 13 },
  loginOtpInfo: { alignItems: "center" as const, gap: 3, paddingVertical: 4 },
  loginOtpInfoText: { color: "#888888", fontSize: 13 },
  loginOtpPhone: { color: "#ffffff", fontSize: 17, fontWeight: "700" as const },
  loginBackBtn: { alignItems: "center" as const, paddingVertical: 6 },
  loginBackBtnText: { color: "#888888", fontSize: 13, fontWeight: "500" as const },
  loginSecondaryBtnSm: { alignItems: "center" as const, paddingVertical: 4 },
  loginSecondaryBtnSmText: { color: "#aaaaaa", fontSize: 12 },
  loginSignedIn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    shadowColor: "#1a1a1a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  loginSignedInInfo: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  loginSignedInDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" },
  loginSignedInPhone: { color: "#ffffff", fontSize: 14, fontWeight: "600" as const },
  loginSignedInRole: { color: "#0f766e", fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, marginTop: 1 },
  loginLogoutBtn: { backgroundColor: "#1f0e10", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  loginLogoutBtnText: { color: "#ef4444", fontWeight: "700" as const, fontSize: 13 },

  // Admin header (production)
  adminHeader: {
    backgroundColor: "#0a0f1e",
    borderRadius: 14,
    padding: 18,
    gap: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  adminHeaderTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  adminHeaderTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800" as const,
    letterSpacing: 0.3,
  },
  adminHeaderConsole: {
    color: "#14b8a6",
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 2.5,
    marginTop: 3,
    textTransform: "uppercase" as const,
  },
  adminHeaderRight: {
    alignItems: "flex-end" as const,
    gap: 6,
  },
  adminHeaderSync: {
    color: "#555555",
    fontSize: 11,
    fontWeight: "500" as const,
  },
  adminRefreshBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  adminRefreshBtnText: {
    color: "#ffffff",
    fontWeight: "800" as const,
    fontSize: 15,
  },
  adminHeaderBottom: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  adminRoleBadge: {
    backgroundColor: "#14b8a6",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start" as const,
  },
  adminRoleBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 2,
  },
  adminStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  adminStatusText: {
    color: "#555555",
    fontSize: 11,
  },

  // KPI grid
  kpiGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: "30%" as const,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 3,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: "800" as const,
  },
  kpiLabel: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: "center" as const,
  },

  // Order status strip
  statusStrip: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
  },
  statusPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#1e1e1e",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 5,
    borderWidth: 1,
    borderColor: "#2e2e2e",
  },
  statusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillName: {
    color: "#555555",
    fontSize: 11,
    fontWeight: "600" as const,
  },
  statusPillCount: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800" as const,
  },

  // Recent orders rows
  recentOrdersHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 8,
  },
  recentOrdersTitle: {
    color: "#aaaaaa",
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  recentOrdersCount: {
    backgroundColor: "#222222",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  recentOrdersCountText: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "700" as const,
  },
  recentOrderCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "#222222",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 5,
  },
  recentOrderCardTop: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  },
  recentOrderRestaurant: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const,
    flex: 1,
  },
  recentOrderBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  recentOrderBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  recentOrderBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
  },
  recentOrderCardBottom: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
  },
  recentOrderCardId: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600" as const,
  },
  recentOrderCardDot: {
    color: "#ffffff",
    fontSize: 10,
  },
  recentOrderCardAmount: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
  recentOrderCardDate: {
    color: "#555555",
    fontSize: 10,
  },
  /* legacy dot/row kept for safety */
  recentOrderRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: "#1a1a1a", borderRadius: 8, padding: 10, gap: 10, borderWidth: 1, borderColor: "#222222" },
  recentOrderDot: { width: 10, height: 10, borderRadius: 5 },
  recentOrderInfo: { flex: 1 },
  recentOrderName: { color: "#ffffff", fontSize: 13, fontWeight: "600" as const },
  recentOrderMeta: { color: "#888888", fontSize: 11, marginTop: 1 },
  recentOrderId: { color: "#aaaaaa", fontSize: 10, fontWeight: "700" as const },

  // Quick action row
  quickActions: {
    flexDirection: "row" as const,
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 2,
  },
  quickActionBtnSecondary: {
    backgroundColor: "#222222",
  },
  quickActionIcon: {
    fontSize: 18,
  },
  quickActionLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },

  // Segmented control
  segmented: { gap: 8, paddingVertical: 2 },
  segment: { borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#1a1a1a" },
  segmentActive: { backgroundColor: TEAL, borderColor: TEAL_DARK },
  segmentText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: "#ffffff" },

  // List items
  listItem: {
    padding: 12,
    borderColor: "#2e2e2e",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    gap: 2
  },
  listItemTappable: { borderLeftColor: TEAL },
  listTitle: { fontWeight: "700", color: "#1f2937", fontSize: 14 },
  listSubtitle: { color: "#888888", fontSize: 13 },
  listTapHint: { color: TEAL, fontSize: 11, fontWeight: "700", marginTop: 2 },

  // Summary box
  summary: { gap: 4, backgroundColor: "#1e1e1e", borderRadius: 8, padding: 12, borderColor: "#2e2e2e", borderWidth: 1 },
  summaryLine: { color: "#ffffff", fontSize: 13 },

  // Order management
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222222",
    borderRadius: 6,
    padding: 8,
    borderColor: "#1e4d30",
    borderWidth: 1
  },
  fieldLabel: { color: "#888888", fontSize: 13 },
  fieldValue: { color: TEAL, fontWeight: "700", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // Restaurant order card
  orderCard: {
    borderColor: "#2e2e2e",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    backgroundColor: "#1a1a1a"
  },

  // Stats banner (admin dashboard)
  statsBanner: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "#222222",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1e4d30"
  },
  statsBannerEmpty: {
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    alignItems: "center" as const
  },
  statsBannerEmptyText: {
    color: "#aaaaaa",
    fontSize: 13,
    fontStyle: "italic" as const
  },
  statChip: {
    alignItems: "center" as const,
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    minWidth: 60
  },
  statChipValue: {
    color: TEAL,
    fontWeight: "800" as const,
    fontSize: 15
  },
  statChipLabel: {
    color: "#888888",
    fontSize: 11,
    marginTop: 1
  },

  // User Management
  listItemBanned: { borderLeftColor: "#ef4444", backgroundColor: "#fff5f5" },
  userRowHeader: { flexDirection: "row" as const, alignItems: "center" as const },
  userExpandedPanel: { marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: "#2e2e2e", paddingTop: 10 },
  userPanelLabel: { color: "#888888", fontSize: 12, fontWeight: "700" as const, marginBottom: 4 },
  roleChip: { borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#1e1e1e" },
  roleChipActive: { backgroundColor: TEAL, borderColor: TEAL_DARK },
  roleChipText: { color: "#ffffff", fontSize: 12, fontWeight: "600" as const },
  roleChipTextActive: { color: "#ffffff" },
  buttonBan: { backgroundColor: "#ef4444" },
  buttonUnban: { backgroundColor: "#f59e0b" },
  userOrderRow: { padding: 8, borderRadius: 6, backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#2e2e2e", gap: 2 },

  // Marketplace
  mkTopRow: { flexDirection: "row" as const, gap: 8 },
  mkPrimaryBtn: {
    flex: 1, backgroundColor: TEAL, borderRadius: 12, paddingVertical: 13,
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  mkPrimaryBtnDisabled: { backgroundColor: "#cbd5e1", shadowOpacity: 0, elevation: 0 },
  mkPrimaryBtnIcon: { fontSize: 15 },
  mkPrimaryBtnText: { color: "#ffffff", fontWeight: "700" as const, fontSize: 14 },
  mkSecondaryBtn: {
    borderWidth: 1.5, borderColor: TEAL, borderRadius: 12, paddingVertical: 13,
    paddingHorizontal: 14, alignItems: "center" as const, justifyContent: "center" as const,
  },
  mkSecondaryBtnDisabled: { borderColor: "#cbd5e1" },
  mkSecondaryBtnText: { color: TEAL, fontWeight: "700" as const, fontSize: 14 },
  mkStatsStrip: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  mkStatPill: {
    flexDirection: "row" as const, alignItems: "center" as const,
    backgroundColor: "#222222", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    gap: 4, borderWidth: 1, borderColor: "#1e4d30",
  },
  mkStatPillIcon: { fontSize: 12 },
  mkStatPillText: { color: "#166534", fontSize: 12, fontWeight: "600" as const },
  mkSectionHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: 2 },
  mkSectionHeaderIcon: { fontSize: 13 },
  mkSectionHeaderText: { color: "#888888", fontSize: 11, fontWeight: "700" as const, letterSpacing: 1 },
  mkCard: {
    backgroundColor: "#1a1a1a", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#ffffff", gap: 8,
    shadowColor: "#1a1a1a", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  mkCardTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  mkRestaurantIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#222222", alignItems: "center" as const, justifyContent: "center" as const },
  mkRestaurantEmoji: { fontSize: 20 },
  mkRestaurantInfo: { flex: 1, gap: 2 },
  mkRestaurantName: { fontSize: 14, fontWeight: "700" as const, color: "#ffffff" },
  mkDishName: { fontSize: 12, color: "#888888" },
  mkSelectBtn: { backgroundColor: TEAL, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  mkSelectBtnText: { color: "#ffffff", fontWeight: "700" as const, fontSize: 12 },
  mkCardMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  mkPrice: { color: "#ffffff", fontWeight: "700" as const, fontSize: 14 },
  mkVegBadge: { width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: "#16a34a", alignItems: "center" as const, justifyContent: "center" as const },
  mkVegDot: { color: "#16a34a", fontSize: 8 },
  mkDistBadge: { backgroundColor: "#ffffff", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  mkDistText: { color: "#888888", fontSize: 11, fontWeight: "600" as const },
  mkOfferChips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  mkOfferChip: { backgroundColor: "#fff7ed", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#fed7aa", gap: 2 },
  mkOfferCode: { color: "#c2410c", fontSize: 12, fontWeight: "800" as const },
  mkOfferDesc: { color: "#92400e", fontSize: 11 },
  mkOrderCard: { backgroundColor: "#0a0f1e", borderRadius: 14, padding: 14, gap: 10 },
  mkOrderCardHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  mkOrderIdBadge: { backgroundColor: "#222222", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  mkOrderIdText: { color: "#aaaaaa", fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5 },
  mkOrderStatusDot: { width: 10, height: 10, borderRadius: 5 },
  mkOrderDetail: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  mkOrderStatus: { color: "#ffffff", fontSize: 16, fontWeight: "700" as const },
  mkOrderTotal: { color: "#14b8a6", fontSize: 16, fontWeight: "800" as const },
  mkOrderAddress: { color: "#888888", fontSize: 12 },
  mkOrderDriver: { color: "#aaaaaa", fontSize: 12, fontWeight: "600" as const },
  mkActionRow: { flexDirection: "row" as const, gap: 8 },
  mkActionBtn: { flex: 1, backgroundColor: "#222222", borderRadius: 10, paddingVertical: 10, alignItems: "center" as const, gap: 3 },
  mkActionIcon: { fontSize: 16 },
  mkActionLabel: { color: "#aaaaaa", fontSize: 10, fontWeight: "600" as const },
  mkPayRow: { flexDirection: "row" as const, gap: 6 },
  mkPayBtn: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" as const },
  mkPayBtnText: { color: "#ffffff", fontWeight: "700" as const, fontSize: 12 },
  mkDangerRow: { flexDirection: "row" as const, gap: 6 },
  mkDangerBtn: { flex: 1, backgroundColor: "#222222", borderRadius: 8, paddingVertical: 8, alignItems: "center" as const, borderWidth: 1, borderColor: "#2e2e2e" },
  mkDangerBtnText: { color: "#aaaaaa", fontSize: 12, fontWeight: "600" as const },
  mkEtaCard: { backgroundColor: "#222222", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1e4d30", gap: 8 },
  mkEtaHeader: { flexDirection: "row" as const, alignItems: "baseline" as const, gap: 6 },
  mkEtaMinutes: { fontSize: 32, fontWeight: "800" as const, color: TEAL },
  mkEtaUnit: { color: "#16a34a", fontSize: 14, fontWeight: "600" as const },
  mkEtaRoute: { flexDirection: "row" as const, gap: 16 },
  mkEtaRouteItem: { gap: 2 },
  mkEtaRouteLabel: { color: "#888888", fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.8 },
  mkEtaRouteValue: { color: "#ffffff", fontSize: 13, fontWeight: "700" as const },
  mkEtaLoopRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#ffffff" },
  mkEtaLoopMin: { color: TEAL, fontWeight: "700" as const, fontSize: 13, width: 50 },
  mkEtaLoopSrc: { color: "#888888", fontSize: 12, flex: 1 },
  mkEtaLoopTime: { color: "#aaaaaa", fontSize: 11 },

  // User Management (production)
  umSearchRow: { flexDirection: "row" as const, gap: 8, alignItems: "center" as const },
  umSearchInputWrap: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#1e1e1e",
    borderWidth: 1.5,
    borderColor: "#2e2e2e",
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  /* role stats */
  umRoleStats: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginBottom: 12 },
  umRoleStatPill: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, backgroundColor: "#222222", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  umRoleStatDot: { width: 6, height: 6, borderRadius: 3 },
  umRoleStatCount: { fontSize: 13, fontWeight: "700" as const },
  umRoleStatLabel: { color: "#888888", fontSize: 11 },
  /* results meta */
  umResultsMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginBottom: 8 },
  umResultsCount: { color: "#888888", fontSize: 12, fontWeight: "600" as const },
  umResultsTag: { backgroundColor: "#0f2d1e", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "#166534" },
  umResultsTagText: { color: "#4ade80", fontSize: 11, fontWeight: "700" as const },
  /* card */
  umCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#222222",
    overflow: "hidden" as const,
    marginBottom: 8,
  },
  umCardBanned: { borderColor: "#7f1d1d", backgroundColor: "#1c0a0a" },
  umCardHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, padding: 12 },
  umAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center" as const, justifyContent: "center" as const },
  umAvatarText: { fontSize: 18, fontWeight: "800" as const },
  umInfo: { flex: 1, gap: 2 },
  umNameRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  umName: { fontSize: 14, fontWeight: "700" as const, color: "#ffffff", flex: 1 },
  umBannedBadge: { backgroundColor: "#450a0a", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: "#dc2626" },
  umBannedBadgeText: { color: "#fca5a5", fontSize: 9, fontWeight: "800" as const, letterSpacing: 0.5 },
  umContact: { fontSize: 12, color: "#888888" },
  umJoined: { fontSize: 10, color: "#ffffff", marginTop: 1 },
  umCardRight: { alignItems: "flex-end" as const, gap: 4 },
  umRoleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  umRoleBadgeText: { fontSize: 11, fontWeight: "700" as const },
  umChevron: { color: "#555555", fontSize: 11 },
  /* expanded section */
  umExpanded: {
    borderTopWidth: 1,
    borderTopColor: "#222222",
    padding: 12,
    gap: 10,
    backgroundColor: "#080f1a",
  },
  umSectionLabel: { color: "#555555", fontSize: 10, fontWeight: "700" as const, letterSpacing: 1.5 },
  umRoleChips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  umRoleChip: {
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    backgroundColor: "#1a1a1a",
  },
  umRoleChipText: { color: "#aaaaaa", fontSize: 12, fontWeight: "600" as const },
  umActions: { flexDirection: "row" as const, gap: 8 },
  umActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center" as const,
    backgroundColor: "#222222",
    borderWidth: 1,
    borderColor: "#2e2e2e",
  },
  umActionBtnBan: { backgroundColor: "#1c0a0a", borderColor: "#dc2626" },
  umActionBtnUnban: { backgroundColor: "#1c1200", borderColor: "#d97706" },
  umActionBtnText: { fontSize: 12, fontWeight: "700" as const, color: "#aaaaaa" },
  umOrderEmpty: { color: "#555555", fontSize: 12, textAlign: "center" as const, paddingVertical: 8 },
  umOrderRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#222222" },
  umOrderDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  umOrderName: { fontSize: 13, fontWeight: "600" as const, color: "#cbd5e1" },
  umOrderMeta: { fontSize: 11, color: "#555555", marginTop: 1 },
  umLoadMoreBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: "#222222",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 4,
  },
  umLoadMoreText: {
    color: "#aaaaaa",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  umLoadMoreCount: {
    color: "#555555",
    fontSize: 11,
  },

  /* ── Driver Onboarding Admin panel ── */
  doaSectionTitle: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  doaCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  doaCardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    gap: 8,
  },
  doaCardTitleRow: {
    flex: 1,
    gap: 3,
  },
  doaCardName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  doaCardPhone: {
    color: "#888888",
    fontSize: 12,
  },
  doaChecks: {
    flexDirection: "row" as const,
    gap: 6,
    flexWrap: "wrap" as const,
  },
  doaCheckChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doaCheckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  doaCheckLabel: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "700" as const,
  },
  doaCheckStatus: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  doaCardMeta: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
  },
  doaMetaChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doaMetaChipIcon: {
    fontSize: 11,
  },
  doaMetaChipText: {
    color: "#aaaaaa",
    fontSize: 11,
  },
  doaAdminNote: {
    backgroundColor: "#222222",
    borderRadius: 8,
    padding: 8,
  },
  doaAdminNoteText: {
    color: "#aaaaaa",
    fontSize: 12,
    lineHeight: 17,
  },
  doaRefCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  doaRefHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  doaRefCodeWrap: {
    gap: 2,
  },
  doaRefCodeLabel: {
    color: "#555555",
    fontSize: 9,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  doaRefCode: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  doaRefMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  doaRefPhone: {
    color: "#888888",
    fontSize: 12,
  },
  doaRefArrow: {
    color: "#ffffff",
    fontSize: 12,
  },
  doaRefReward: {
    fontSize: 13,
    fontWeight: "700" as const,
    marginLeft: "auto" as const,
  },

  /* ── Payouts panel ── */
  payoutTotalCard: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eab30844",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  payoutTotalLabel: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
  },
  payoutTotalAmount: {
    color: "#eab308",
    fontSize: 20,
    fontWeight: "800" as const,
  },
  payoutCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  payoutCardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  payoutCardLeft: {
    gap: 4,
  },
  payoutRolePill: {
    alignSelf: "flex-start" as const,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  payoutRolePillText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  payoutPhone: {
    color: "#888888",
    fontSize: 12,
  },
  payoutAmountRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  payoutAmount: {
    fontSize: 22,
    fontWeight: "800" as const,
  },
  payoutMethodChip: {
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  payoutMethodText: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "600" as const,
  },

  /* ── Live Tracking + Driver Load panel ── */
  ltStatsRow: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 12,
  },
  ltStatCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222222",
    paddingVertical: 10,
    alignItems: "center" as const,
    gap: 4,
  },
  ltStatValue: {
    fontSize: 20,
    fontWeight: "800" as const,
    lineHeight: 22,
  },
  ltStatLabel: {
    color: "#555555",
    fontSize: 9,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
    textAlign: "center" as const,
  },
  ltSectionTitle: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  ltOrderCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 12,
    marginBottom: 8,
    gap: 6,
  },
  ltOrderCardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  ltOrderRestaurant: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const,
    flex: 1,
  },
  ltOrderMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  ltOrderId: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600" as const,
  },
  ltOrderDot: {
    color: "#ffffff",
    fontSize: 10,
  },
  ltLocationText: {
    color: "#3b82f6",
    fontSize: 11,
  },
  ltNoLocation: {
    color: "#ffffff",
    fontSize: 11,
  },
  ltDriverCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  ltDriverCardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  ltDriverInfo: {
    gap: 2,
  },
  ltDriverPhone: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const,
  },
  ltDriverOrders: {
    color: "#888888",
    fontSize: 11,
  },
  ltCapacityBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ltCapacityBarBg: {
    height: 4,
    backgroundColor: "#222222",
    borderRadius: 2,
    overflow: "hidden" as const,
  },
  ltCapacityBarFill: {
    height: 4,
    borderRadius: 2,
  },
  ltCapacityScore: {
    color: "#555555",
    fontSize: 10,
  },
  /* legacy - kept for other uses */
  umSearchIcon: { fontSize: 14 },
  umSearchInput: { flex: 1, paddingVertical: Platform.OS === "ios" ? 11 : 8, fontSize: 14, color: "#ffffff" },
  umSearchClear: { color: "#aaaaaa", fontSize: 14, fontWeight: "700" as const, padding: 4 },
  umSearchBtn: { backgroundColor: TEAL, borderRadius: 10, paddingHorizontal: 16, paddingVertical: Platform.OS === "ios" ? 12 : 9 },
  umSearchBtnDisabled: { backgroundColor: "#cbd5e1" },
  umSearchBtnText: { color: "#ffffff", fontWeight: "700" as const, fontSize: 14 },
  umMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  umMetaCount: { color: "#888888", fontSize: 12, fontWeight: "600" as const },
  umMetaTag: { backgroundColor: "#222222", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "#1e4d30" },
  umMetaTagText: { color: "#15803d", fontSize: 11, fontWeight: "700" as const },

  orderSearchRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const
  },

  orderRowHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8
  },
  statusBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const
  },

  rejectionReason: {
    color: "#ef4444",
    fontSize: 12,
    fontStyle: "italic" as const,
    marginTop: 4
  },

  dividerChevron: {
    color: "#888888",
    fontSize: 10,
    fontWeight: "700" as const
  },

  roleDropdown: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: Platform.OS === "ios" ? 12 : 9,
    backgroundColor: "#1a1a1a"
  },
  roleDropdownValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600" as const
  },
  roleDropdownChevron: {
    fontSize: 12,
    color: "#888888"
  },
  roleDropdownMenu: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    overflow: "hidden" as const,
    marginTop: 2
  },
  roleDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff"
  },
  roleDropdownItemActive: {
    backgroundColor: "#222222"
  },
  roleDropdownItemText: {
    fontSize: 14,
    color: "#ffffff"
  },
  roleDropdownItemTextActive: {
    color: TEAL,
    fontWeight: "700" as const
  },
  adminMktStrip: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#222222"
  },
  adminMktStripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  adminMktStripTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const
  },
  adminMktStripSub: {
    color: "#888888",
    fontSize: 11
  },
  adminMktPills: {
    flexDirection: "row",
    gap: 10
  },
  adminMktPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#222222",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3
  },
  adminMktPillIcon: {
    fontSize: 18
  },
  adminMktPillValue: {
    fontSize: 20,
    fontWeight: "800" as const,
    lineHeight: 22
  },
  adminMktPillLabel: {
    color: "#aaaaaa",
    fontSize: 10,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },

  /* ── Restaurant Approvals panel ── */
  raStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  raStatPill: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#222222",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 3
  },
  raStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  raStatCount: {
    fontSize: 16,
    fontWeight: "800" as const,
    lineHeight: 18
  },
  raStatLabel: {
    color: "#888888",
    fontSize: 9,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4
  },
  raSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222222",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 44
  },
  raSearchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  raSearchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    height: 44
  },
  raSearchBtn: {
    backgroundColor: "#222222",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginLeft: 8
  },
  raSearchBtnText: {
    color: "#aaaaaa",
    fontSize: 12,
    fontWeight: "700" as const
  },
  raCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 14,
    marginBottom: 10
  },
  raCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8
  },
  raCardTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  raCardName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700" as const,
    flexShrink: 1
  },
  raCuisinePill: {
    backgroundColor: "#222222",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  raCuisineText: {
    color: "#aaaaaa",
    fontSize: 10,
    fontWeight: "600" as const
  },
  raStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  raStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3
  },
  raStatusText: {
    fontSize: 11,
    fontWeight: "700" as const
  },
  raCardMeta: {
    gap: 4,
    marginBottom: 8
  },
  raMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  raMetaIcon: {
    fontSize: 11
  },
  raMetaText: {
    color: "#888888",
    fontSize: 12,
    flex: 1
  },
  raRejectCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#450a0a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8
  },
  raRejectIcon: {
    fontSize: 13
  },
  raRejectText: {
    color: "#fca5a5",
    fontSize: 12,
    flex: 1,
    lineHeight: 17
  },
  raInactiveCallout: {
    backgroundColor: "#222222",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8
  },
  raInactiveText: {
    color: "#888888",
    fontSize: 12
  },
  raActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  raApproveBtn: {
    flex: 1,
    backgroundColor: "#14532d",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#16a34a"
  },
  raApproveBtnText: {
    color: "#4ade80",
    fontSize: 13,
    fontWeight: "700" as const
  },
  raRejectBtn: {
    flex: 1,
    backgroundColor: "#450a0a",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dc2626"
  },
  raRejectBtnText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "700" as const
  },
  raOffboardBtn: {
    flex: 1,
    backgroundColor: "#222222",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555555"
  },
  raOffboardBtnText: {
    color: "#aaaaaa",
    fontSize: 13,
    fontWeight: "700" as const
  },
  raEmpty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 6
  },
  raEmptyIcon: {
    fontSize: 32
  },
  raEmptyText: {
    color: "#aaaaaa",
    fontSize: 14,
    fontWeight: "600" as const
  },
  raEmptyHint: {
    color: "#555555",
    fontSize: 12,
    textAlign: "center"
  },

  /* ── Order + Payment Monitoring panel ── */
  opmStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12
  },
  opmStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#222222",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  opmStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  opmStatusCount: {
    fontSize: 13,
    fontWeight: "700" as const
  },
  opmStatusLabel: {
    color: "#888888",
    fontSize: 11
  },
  opmPaySection: {
    marginBottom: 12
  },
  opmPayTitle: {
    color: "#aaaaaa",
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 8
  },
  opmPayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  opmPayCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 10
  },
  opmPayCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  opmPayProvider: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700" as const
  },
  opmPayStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  opmPayStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3
  },
  opmPayStatusText: {
    fontSize: 10,
    fontWeight: "700" as const
  },
  opmPayAmount: {
    fontSize: 16,
    fontWeight: "800" as const,
    marginBottom: 2
  },
  opmPayTx: {
    color: "#888888",
    fontSize: 10
  },
  opmOrderCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 12,
    marginBottom: 8
  },
  opmOrderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6
  },
  opmOrderRestaurant: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const,
    flex: 1
  },
  opmOrderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  opmOrderId: {
    color: "#555555",
    fontSize: 11,
    fontFamily: "monospace"
  },
  opmOrderDot: {
    color: "#ffffff",
    fontSize: 11
  },
  opmOrderAmount: {
    fontSize: 13,
    fontWeight: "700" as const
  },
  opmOrderDate: {
    color: "#555555",
    fontSize: 11
  },
  opmOrderPhones: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  opmPhoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  opmPhoneChipIcon: {
    fontSize: 10
  },
  opmPhoneChipText: {
    color: "#aaaaaa",
    fontSize: 11
  },

  /* ── Order Operations panel ── */
  ooInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  ooInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222222",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    paddingHorizontal: 12,
    height: 44
  },
  ooInputIcon: {
    fontSize: 14,
    marginRight: 8
  },
  ooInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13,
    height: 44
  },
  ooInputClear: {
    color: "#555555",
    fontSize: 14,
    paddingLeft: 6
  },
  ooLoadBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    backgroundColor: "#222222",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ooLoadBtnDisabled: {
    opacity: 0.4
  },
  ooLoadBtnIcon: {
    fontSize: 14
  },
  ooLoadBtnText: {
    color: "#aaaaaa",
    fontSize: 13,
    fontWeight: "700" as const
  },
  ooOrderPreview: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#222222",
    padding: 12,
    marginBottom: 12,
    gap: 4
  },
  ooOrderPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  ooOrderPreviewId: {
    color: "#aaaaaa",
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.5
  },
  ooOrderPreviewAmount: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800" as const,
    marginBottom: 4
  },
  ooHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#222222",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  ooHintIcon: {
    fontSize: 14
  },
  ooHintText: {
    color: "#888888",
    fontSize: 12,
    flex: 1,
    lineHeight: 17
  },
  ooSection: {
    marginBottom: 14
  },
  ooSectionTitle: {
    color: "#aaaaaa",
    fontSize: 10,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.7,
    marginBottom: 8
  },
  ooDriverMeta: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8
  },
  ooDriverChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#222222",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  ooDriverChipIcon: {
    fontSize: 11
  },
  ooDriverChipText: {
    color: "#888888",
    fontSize: 11
  },
  ooAssignRow: {
    flexDirection: "row",
    gap: 8
  },
  ooAssignBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TEAL,
    padding: 12
  },
  ooAssignBtnSecondary: {
    borderColor: "#2e2e2e"
  },
  ooAssignBtnDisabled: {
    opacity: 0.35
  },
  ooAssignBtnIcon: {
    fontSize: 20
  },
  ooAssignBtnLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700" as const
  },
  ooAssignBtnSub: {
    color: "#888888",
    fontSize: 10,
    marginTop: 1
  },
  ooStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  ooStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  ooStatusBtnDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  ooStatusBtnText: {
    fontSize: 12,
    fontWeight: "600" as const
  },
  ooDangerZone: {
    backgroundColor: "#1c0a0a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 12,
    marginTop: 4
  },
  ooDangerTitle: {
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: "700" as const,
    marginBottom: 10
  },
  ooDangerRow: {
    flexDirection: "row",
    gap: 8
  },
  ooDangerBtn: {
    flex: 1,
    backgroundColor: "#450a0a",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dc2626"
  },
  ooDangerBtnAlt: {
    backgroundColor: "#222222",
    borderColor: "#555555"
  },
  ooDangerBtnText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "700" as const
  },

  // ── Zones, Campaigns & Incentives ────────────────────────────────────────
  zciActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20
  },
  zciActionBtn: {
    width: "47%",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4
  },
  zciActionBtnDisabled: {
    opacity: 0.4
  },
  zciActionIcon: {
    fontSize: 24,
    marginBottom: 2
  },
  zciActionLabel: {
    fontSize: 13,
    fontWeight: "700" as const
  },
  zciActionSub: {
    fontSize: 11,
    color: "#888888"
  },
  zciSectionTitle: {
    color: "#aaaaaa",
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    marginBottom: 8
  },
  zciCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222222",
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8
  },
  zciCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  zciCardName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const,
    flex: 1
  },
  zciCityChip: {
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8
  },
  zciCityChipText: {
    color: "#aaaaaa",
    fontSize: 11,
    fontWeight: "600" as const
  },
  zciCardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  zciMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  zciMetaChipIcon: {
    fontSize: 12
  },
  zciMetaChipText: {
    color: "#aaaaaa",
    fontSize: 11,
    fontWeight: "600" as const
  },
  zciAiCreative: {
    color: "#888888",
    fontSize: 11,
    fontStyle: "italic" as const,
    marginTop: 6,
    lineHeight: 16
  },
  zciEmptyRow: {
    paddingVertical: 12,
    alignItems: "center"
  },
  zciEmptyText: {
    color: "#555555",
    fontSize: 13
  },

  // ── ZCI Create Form Modal ─────────────────────────────────────────────────
  zciModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)"
  },
  zciModalSheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 3,
    padding: 20,
    paddingBottom: 36
  },
  zciModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20
  },
  zciModalTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    flex: 1
  },
  zciModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#222222",
    alignItems: "center",
    justifyContent: "center"
  },
  zciModalCloseText: {
    color: "#aaaaaa",
    fontSize: 14,
    fontWeight: "700" as const
  },
  zciFieldLabel: {
    color: "#aaaaaa",
    fontSize: 12,
    fontWeight: "600" as const,
    marginBottom: 6,
    marginTop: 12
  },
  zciFieldInput: {
    backgroundColor: "#222222",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    color: "#ffffff",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  zciFieldMultiline: {
    minHeight: 80,
    textAlignVertical: "top" as const,
    paddingTop: 11
  },
  zciFieldRow: {
    flexDirection: "row",
    gap: 10
  },
  zciFieldHint: {
    color: "#555555",
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18
  },
  zciSegment: {
    flexDirection: "row",
    backgroundColor: "#222222",
    borderRadius: 10,
    padding: 3,
    gap: 2
  },
  zciSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center"
  },
  zciSegmentText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600" as const
  },
  zciModalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24
  },
  zciModalCancel: {
    flex: 1,
    backgroundColor: "#222222",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2e2e2e"
  },
  zciModalCancelText: {
    color: "#aaaaaa",
    fontSize: 15,
    fontWeight: "600" as const
  },
  zciModalSubmit: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center"
  },
  zciModalSubmitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700" as const
  },

  // ── Analytics & Predictions ───────────────────────────────────────────────
  anlRunBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0f766e",
    padding: 16,
    marginBottom: 14
  },
  anlRunBtnDisabled: { opacity: 0.4 },
  anlRunIcon: { fontSize: 28 },
  anlRunLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const
  },
  anlRunSub: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2
  },
  anlTabRow: {
    flexDirection: "row",
    backgroundColor: "#222222",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    gap: 2
  },
  anlTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center"
  },
  anlTabActive: { backgroundColor: "#1a1a1a" },
  anlTabText: {
    color: "#888888",
    fontSize: 13,
    fontWeight: "600" as const
  },
  anlTabTextActive: { color: "#ffffff" },
  anlJobCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222222",
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8
  },
  anlJobTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6
  },
  anlJobType: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const,
    flex: 1
  },
  anlJobMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  anlJobDate: {
    color: "#888888",
    fontSize: 12
  },
  anlJobSummary: {
    color: "#aaaaaa",
    fontSize: 12
  },
  anlPredCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222222",
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8
  },
  anlPredTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  anlPredZone: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const,
    flex: 1
  },
  anlPredOrders: {
    fontSize: 15,
    fontWeight: "700" as const
  },
  anlPredMeta: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10
  },
  anlPredChip: {
    backgroundColor: "#222222",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  anlPredChipText: {
    color: "#aaaaaa",
    fontSize: 11,
    fontWeight: "600" as const
  },
  anlConfRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  anlConfLabel: {
    color: "#888888",
    fontSize: 11,
    width: 68
  },
  anlConfBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: "#222222",
    borderRadius: 3,
    overflow: "hidden"
  },
  anlConfBarFill: {
    height: 5,
    borderRadius: 3
  },
  anlConfValue: {
    fontSize: 11,
    fontWeight: "700" as const,
    width: 42,
    textAlign: "right" as const
  },

  // ── Support Tickets ───────────────────────────────────────────────────────
  stFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12
  },
  stFilterChip: {
    backgroundColor: "#222222",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2e2e2e"
  },
  stFilterChipActive: {
    backgroundColor: "#1a1a1a",
    borderColor: "#0f766e"
  },
  stFilterChipText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600" as const
  },
  stFilterChipTextActive: { color: "#0f766e" },
  stCreateBtn: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12
  },
  stCreateBtnText: {
    color: "#aaaaaa",
    fontSize: 13,
    fontWeight: "600" as const
  },
  stCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222222",
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8
  },
  stCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  stCategoryChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1
  },
  stCategoryText: {
    fontSize: 11,
    fontWeight: "700" as const
  },
  stSubject: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 8,
    lineHeight: 20
  },
  stCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  stCardId: {
    color: "#555555",
    fontSize: 11,
    fontFamily: "monospace"
  },
  stCardDot: {
    color: "#ffffff",
    fontSize: 11
  },
  stCardDate: {
    color: "#555555",
    fontSize: 11
  },

  // ── Security & Audit Logs ─────────────────────────────────────────────────
  audSectionLabel: {
    color: "#aaaaaa",
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    marginBottom: 8
  },
  audVcCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222222",
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 6
  },
  audVcRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  audVcLeft: { flex: 1 },
  audVcProvider: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const
  },
  audVcType: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize" as const
  },
  audVcDate: {
    color: "#555555",
    fontSize: 11,
    marginTop: 6
  },
  audLogCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#222222",
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 5
  },
  audLogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  audMethodChip: {
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  audMethodText: {
    fontSize: 10,
    fontWeight: "700" as const,
    fontFamily: "monospace"
  },
  audLogPath: {
    flex: 1,
    color: "#aaaaaa",
    fontSize: 12,
    fontFamily: "monospace"
  },
  audStatusCodeChip: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  audStatusCodeText: {
    fontSize: 11,
    fontWeight: "700" as const
  },
  audLogDate: {
    color: "#555555",
    fontSize: 11,
    marginTop: 5
  },

  // ── Access Denied ─────────────────────────────────────────────────────────
  accessDeniedCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    padding: 32,
    alignItems: "center",
    gap: 12,
    marginTop: 8
  },
  accessDeniedIcon: {
    fontSize: 48,
    marginBottom: 4
  },
  accessDeniedTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800" as const
  },
  accessDeniedText: {
    color: "#888888",
    fontSize: 14,
    textAlign: "center" as const,
    lineHeight: 22
  },
  accessDeniedRole: {
    color: "#E23744",
    fontWeight: "700" as const
  },
  accessDeniedLogoutBtn: {
    marginTop: 8,
    backgroundColor: "#E23744",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32
  },
  accessDeniedLogoutText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700" as const
  },
  emptyState: {
    alignItems: "center" as const,
    paddingVertical: 32,
    paddingHorizontal: 16
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 10
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#1e293b",
    marginBottom: 6,
    textAlign: "center" as const
  },
  emptyStateHint: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center" as const,
    marginBottom: 14,
    lineHeight: 18
  },
  emptyStateBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20
  },
  emptyStateBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const
  },
  loadMoreBtn: {
    alignItems: "center" as const,
    paddingVertical: 12,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc"
  },
  loadMoreBtnText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600" as const
  },
  adminLoadingOverlay: {
    alignItems: "center" as const,
    paddingVertical: 48,
    gap: 12
  },
  adminLoadingTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#1e293b"
  },
  adminLoadingHint: {
    fontSize: 13,
    color: "#64748b"
  },
  adminRefreshBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f0fdf4",
    borderTopWidth: 1,
    borderTopColor: "#bbf7d0"
  },
  adminRefreshBannerText: {
    fontSize: 13,
    color: "#15803d",
    fontWeight: "600" as const
  },
  searchingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 16,
    paddingHorizontal: 4,
    justifyContent: "center" as const
  },
  searchingText: {
    fontSize: 14,
    color: "#64748b"
  },
  uploadProgressBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginTop: 8
  },
  uploadProgressText: {
    fontSize: 13,
    color: "#15803d",
    fontWeight: "600" as const,
    flexShrink: 1
  }
});

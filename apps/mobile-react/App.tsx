import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
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
  const [adminRestaurants, setAdminRestaurants] = useState<Array<{ id: string; name: string; address: string; approval_status: string; rejection_reason: string | null; is_active: boolean }>>([]);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [restaurantSearchResults, setRestaurantSearchResults] = useState<Array<{ id: string; name: string; address: string; approval_status: string; rejection_reason: string | null; is_active: boolean }> | null>(null);
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; phone: string | null; email: string | null; name: string | null; role: string; is_banned: boolean }>>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userOrdersMap, setUserOrdersMap] = useState<Record<string, Array<{ id: string; status: string; total_paise: number; restaurant_name: string; created_at: string }>>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<Array<{ id: string; phone: string | null; email: string | null; name: string | null; role: string; is_banned: boolean }> | null>(null);
  const [adminOrders, setAdminOrders] = useState<Array<{ id: string; status: string; total_paise: number; restaurant_name: string }>>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSearchResults, setOrderSearchResults] = useState<Array<{ id: string; status: string; total_paise: number; restaurant_name: string; created_at: string }> | null>(null);
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
  const [supportTickets, setSupportTickets] = useState<Array<{ id: string; category: string; subject: string; status: string }>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; method: string; path: string; status_code: number }>>([]);
  const [verificationChecks, setVerificationChecks] = useState<Array<{ id: string; provider: string; check_type: string; status: string }>>([]);
  const [analyticsJobs, setAnalyticsJobs] = useState<Array<{ id: string; job_type: string; status: string; summary: unknown; created_at: string }>>([]);
  const [demandPredictions, setDemandPredictions] = useState<Array<{ id: string; zone_key: string; cuisine_type: string | null; hour_start: string; predicted_orders: number; confidence: string }>>([]);

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

  useEffect(() => {
    void SecureStore.getItemAsync("amberkitchen.token").then(saved => {
      if (!saved) return;
      // Decode role from JWT payload (base64 middle segment) so the correct
      // tab and data-load function are used without requiring a fresh login.
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

  async function saveToken(nextToken: string) {
    setToken(nextToken);
    await SecureStore.setItemAsync("amberkitchen.token", nextToken);
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
    await SecureStore.deleteItemAsync("amberkitchen.token");
  }

  async function requestOtp() {
    if (!phone.trim()) {
      Alert.alert("Phone required", "Enter your phone number before requesting an OTP.");
      return;
    }
    const response = await run("Sending OTP", () => api.requestOtp(phone));
    if (response != null) {
      setOtpSent(true);
      if (__DEV__ && typeof response === "object" && "devCode" in response && response.devCode) {
        setOtp(String(response.devCode));
      }
    }
  }

  async function verifyOtp() {
    if (!phone.trim() || !otp.trim()) {
      Alert.alert("Fields required", "Enter both phone number and OTP.");
      return;
    }
    const response = await run("Verifying OTP", () => api.verifyOtp(phone, otp, role));
    if (response && typeof response === "object" && "token" in response) {
      const userRole = (response as { user?: { role?: string } }).user?.role;
      // Set role and token in the same synchronous block so React 18 batches
      // them into one render — useEffect([token,role]) then fires with the
      // correct role and calls loadAdmin() instead of loadDriverWork().
      if (userRole && roleOptions.includes(userRole as Role)) setRole(userRole as Role);
      setToken(String(response.token));
      void SecureStore.setItemAsync("amberkitchen.token", String(response.token));
    }
  }

  async function loginWithGoogleToken() {
    if (!googleIdToken.trim()) {
      Alert.alert("Token required", "Paste a Google ID token to sign in with Google.");
      return;
    }
    const response = await run("Google login", () => api.googleLogin(googleIdToken, role));
    if (response && typeof response === "object" && "token" in response) {
      await saveToken(String(response.token));
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
    if (!restaurantName || !restaurantAddress || !restaurantPhone) {
      Alert.alert("Incomplete form", "Provide restaurant name, address, and contact phone number.");
      return;
    }
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
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
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <Pressable
                  style={[styles.loginPrimaryBtn, (!phone.trim() || loading) && styles.loginPrimaryBtnDisabled]}
                  onPress={requestOtp}
                  disabled={!phone.trim() || loading}
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
                    placeholderTextColor="#94a3b8"
                    autoFocus
                  />
                </View>
                <Pressable
                  style={[styles.loginPrimaryBtn, (!otp.trim() || loading) && styles.loginPrimaryBtnDisabled]}
                  onPress={verifyOtp}
                  disabled={!otp.trim() || loading}
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

        {authed && tab === "admin" && (
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
                {dashboard ? "Dashboard loaded" : "Loading…"}
              </Text>
            </View>
          </View>
        )}

        {/* ── Driver Tab ── */}
        {tab === "driver" && (
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
            <Text style={styles.sectionHint}>Load restaurants, create a test order, then pay and track end-to-end.</Text>
            <View style={styles.actions}>
              <Button label={loading ? "Loading…" : "Load Marketplace"} onPress={loadMarketplace} disabled={!authed || loading} />
              <Button label="Create Order" onPress={createOrder} disabled={!authed} />
            </View>

            {restaurants.length === 0 && trending.length === 0
              ? <Text style={styles.emptyHint}>No restaurants loaded — tap "Load Marketplace" first.</Text>
              : null
            }
            {restaurants.slice(0, 3).map(item => (
              <ListItem
                key={item.menu_item_id}
                title={`${item.restaurant_name} — ${item.menu_item_name}`}
                subtitle={`₹${(item.price_paise / 100).toFixed(0)}${item.distance_km ? ` · ${Number(item.distance_km).toFixed(1)} km` : ""}${item.is_veg ? " · 🟢 Veg" : ""}`}
                onPress={() => setSelectedRestaurantId(item.restaurant_id)}
              />
            ))}
            {trending.slice(0, 2).map(item => (
              <ListItem
                key={item.id}
                title={`${item.name} (Trending)`}
                subtitle={`${item.recent_orders} recent orders${item.distance_km ? ` · ${Number(item.distance_km).toFixed(1)} km` : ""}`}
                onPress={() => setSelectedRestaurantId(item.id)}
              />
            ))}
            {offers.slice(0, 2).map(item => (
              <ListItem key={item.id} title={`Offer: ${item.code} — ${item.title}`} subtitle={`${item.discount_type === "flat" ? `₹${item.discount_value / 100}` : `${item.discount_value}%`} off`} />
            ))}

            {orderId ? (
              <View style={styles.orderIdRow}>
                <Text style={styles.fieldLabel}>Active Order ID: </Text>
                <Text style={styles.fieldValue}>{orderId.slice(-12).toUpperCase()}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button label="Load Order" onPress={loadOrder} disabled={!orderId} />
              <Button label="Load ETA" onPress={loadEta} disabled={!orderId} />
              <Button label="Navigate" onPress={openNavigation} disabled={!orderId} />
            </View>
            <View style={styles.actions}>
              <Button label="Pay Paytm" onPress={() => pay("paytm")} disabled={!orderId} />
              <Button label="Pay PhonePe" onPress={() => pay("phonepe")} disabled={!orderId} />
              <Button label="Pay Razorpay" onPress={() => pay("razorpay")} disabled={!orderId} />
            </View>
            <View style={styles.actions}>
              <Button
                label="Cancel Order"
                onPress={() => run("Cancelling order", () => api.cancelOrder(token, orderId, "Test cancellation from AK Ops"))}
                disabled={!orderId}
              />
              <Button
                label="Request Refund"
                onPress={() => run("Requesting refund", () => api.requestRefund(token, orderId, "Test refund from AK Ops"))}
                disabled={!orderId}
              />
              <Button
                label="Reorder"
                onPress={async () => {
                  const res = await run("Reordering", () => api.reorder(token, orderId));
                  if (res && typeof res === "object" && "id" in res) setOrderId(String((res as { id: string }).id));
                }}
                disabled={!orderId}
              />
            </View>

            {order && (
              <Summary title="Order Details" lines={[
                `Status: ${titleCase(order.status)}`,
                `Total: ${formatCurrency(order.total_paise)}`,
                `Address: ${order.delivery_address}`,
                order.driver_name ? `Driver: ${order.driver_name}` : "No driver assigned yet",
                ...(order.history.slice(0, 2).map(h => `  ${titleCase(h.status)}${h.note ? ` — ${h.note}` : ""}`))
              ]} />
            )}
            {eta && (
              <Summary title="Delivery ETA" lines={[
                `ETA: ${eta.predictedEtaMinutes} min`,
                `To pickup: ${eta.route.distanceToPickupKm.toFixed(1)} km`,
                `To dropoff: ${eta.route.distanceToDropoffKm.toFixed(1)} km`,
                `Delivery by: ${new Date(eta.predictedDeliveryAt).toLocaleTimeString()}`
              ]} />
            )}
            {etaLoop.slice(0, 2).map(item => (
              <ListItem key={item.id} title={`ETA ${item.predicted_eta_minutes} min (${item.source})`} subtitle={new Date(item.created_at).toLocaleTimeString()} />
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
              <Button label="Submit Onboarding" onPress={submitDriverOnboarding} disabled={!authed} />
              <Button label="Run Verification Checks" onPress={runVerificationChecks} disabled={!authed} />
            </View>
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
            {driverOrders.length === 0
              ? <Text style={styles.emptyHint}>No available delivery orders. Load driver workspace to refresh.</Text>
              : driverOrders.map(item => (
                <ListItem
                  key={item.id}
                  title={`${item.restaurant_name} → ${item.delivery_address}`}
                  subtitle={`${titleCase(item.status)} · ${formatCurrency(item.total_paise)} — Tap to accept`}
                  onPress={() => {
                    setOrderId(item.id);
                    void run("Accepting delivery", () => api.acceptDeliveryOrder(token, item.id));
                  }}
                />
              ))
            }
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
            {incentives.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Driver Incentives</Text>
                {incentives.slice(0, 3).map(item => (
                  <ListItem key={item.id} title={item.title} subtitle={`${item.target_deliveries} deliveries → ${formatCurrency(item.reward_paise)} · ${titleCase(item.status)}`} />
                ))}
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
            {walletTransactions.length === 0
              ? <Text style={styles.emptyHint}>No wallet transactions yet.</Text>
              : walletTransactions.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${titleCase(item.type)} — ${formatCurrency(item.amount_paise)}`} subtitle={titleCase(item.status)} />
              ))
            }
              </>
            )}
          </Card>
        )}

        {/* ── Restaurant Tab ── */}
        {tab === "restaurant" && (
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
            {restaurantOrders.length === 0
              ? <Text style={styles.emptyHint}>No pending orders. Create a test order from the Driver tab first.</Text>
              : restaurantOrders.map(item => (
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
              ))
            }

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
        {tab === "admin" && (
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
                <Text style={styles.recentOrdersTitle}>Recent Orders</Text>
                {dashboard.recentOrders.slice(0, 3).map(o => (
                  <View key={o.id} style={styles.recentOrderRow}>
                    <View style={[styles.recentOrderDot, { backgroundColor: orderStatusColor(o.status) }]} />
                    <View style={styles.recentOrderInfo}>
                      <Text style={styles.recentOrderName}>{o.restaurant_name}</Text>
                      <Text style={styles.recentOrderMeta}>{titleCase(o.status)} · {formatCurrency(o.total_paise)}</Text>
                    </View>
                    <Text style={styles.recentOrderId}>#{String(o.id).slice(-6).toUpperCase()}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Quick actions */}
            <View style={styles.quickActions}>
              <Pressable style={styles.quickActionBtn} onPress={loadMarketplace} disabled={!authed || loading}>
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

            {/* Order Operations */}
            <Divider label="Order Operations" icon="⚙️" subtitle="Assign drivers and manage active orders" collapsed={isCollapsed("Order Operations")} onPress={() => togglePanel("Order Operations")} />
            {!isCollapsed("Order Operations") && (
              <>
            <TextInput
              style={styles.input}
              value={orderId}
              onChangeText={setOrderId}
              placeholder="Paste Order ID for driver assignment"
            />
            {!orderId && <Text style={styles.emptyHint}>Enter an Order ID above to enable driver assignment.</Text>}
            <View style={styles.actions}>
              <Button
                label="Assign Best Driver"
                onPress={() => run("Assigning best driver", () => api.assignBestDriver(token, orderId))}
                disabled={!orderId}
              />
              <Button
                label="Assign First Available"
                onPress={() => run("Assigning driver", () => api.assignDriver(token, orderId, deliveryDrivers[0].id))}
                disabled={!orderId || !deliveryDrivers[0]}
              />
            </View>
              </>
            )}

            {/* User Management */}
            <Divider label="User Management" icon="👥" subtitle={adminUsers.length > 0 ? `${adminUsers.length} users loaded · search by name, phone or role` : "Search or load dashboard to see users"} collapsed={isCollapsed("User Management")} onPress={() => togglePanel("User Management")} />
            {!isCollapsed("User Management") && (
              <>
            {/* Search bar */}
            <View style={styles.umSearchRow}>
              <View style={styles.umSearchInputWrap}>
                <Text style={styles.umSearchIcon}>🔍</Text>
                <TextInput
                  style={styles.umSearchInput}
                  placeholder="Name, phone, email or User ID…"
                  placeholderTextColor="#94a3b8"
                  value={userSearch}
                  onChangeText={text => { setUserSearch(text); if (!text) setUserSearchResults(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {userSearch.length > 0 && (
                  <Pressable onPress={() => { setUserSearch(""); setUserSearchResults(null); }}>
                    <Text style={styles.umSearchClear}>✕</Text>
                  </Pressable>
                )}
              </View>
              <Pressable
                style={[styles.umSearchBtn, (!userSearch.trim() || loading) && styles.umSearchBtnDisabled]}
                disabled={!userSearch.trim() || loading}
                onPress={async () => {
                  const result = await run("Searching users", () => api.adminUsersSearch(token, userSearch.trim()));
                  if (result) setUserSearchResults(result as typeof userSearchResults);
                }}
              >
                <Text style={styles.umSearchBtnText}>{loading ? "…" : "Search"}</Text>
              </Pressable>
            </View>

            {(() => {
              const q = userSearch.trim().toLowerCase();
              const displayUsers = userSearchResults
                ?? (q
                  ? adminUsers.filter(u =>
                      (u.name ?? "").toLowerCase().includes(q) ||
                      (u.phone ?? "").includes(q) ||
                      (u.email ?? "").toLowerCase().includes(q) ||
                      u.id.toLowerCase().startsWith(q)
                    )
                  : Object.values(
                      adminUsers.reduce<Record<string, typeof adminUsers[0]>>((acc, u) => {
                        if (!acc[u.role]) acc[u.role] = u;
                        return acc;
                      }, {})
                    ).slice(0, 5));

              if (adminUsers.length === 0 && !userSearchResults) {
                return <Text style={styles.emptyHint}>Load admin dashboard to see users.</Text>;
              }
              if (displayUsers.length === 0) {
                return <Text style={styles.emptyHint}>No users match "{userSearch}".</Text>;
              }

              return (
                <>
                  <View style={styles.umMeta}>
                    <Text style={styles.umMetaCount}>{displayUsers.length} user{displayUsers.length !== 1 ? "s" : ""}</Text>
                    {userSearchResults && <View style={styles.umMetaTag}><Text style={styles.umMetaTagText}>Search results</Text></View>}
                  </View>
                  {displayUsers.map(item => {
                    const isExpanded = expandedUserId === item.id;
                    const orders = userOrdersMap[item.id];
                    const displayName = item.name ?? item.phone ?? item.email ?? item.id.slice(0, 8);
                    const accent = roleAccent(item.role);
                    const initial = (displayName[0] ?? "?").toUpperCase();
                    return (
                      <View key={item.id} style={[styles.umCard, item.is_banned && styles.umCardBanned]}>
                        <Pressable onPress={() => setExpandedUserId(isExpanded ? null : item.id)}>
                          <View style={styles.umCardHeader}>
                            <View style={[styles.umAvatar, { backgroundColor: accent + "22" }]}>
                              <Text style={[styles.umAvatarText, { color: accent }]}>{initial}</Text>
                            </View>
                            <View style={styles.umInfo}>
                              <View style={styles.umNameRow}>
                                <Text style={styles.umName} numberOfLines={1}>{displayName}</Text>
                                {item.is_banned && <View style={styles.umBannedBadge}><Text style={styles.umBannedBadgeText}>BANNED</Text></View>}
                              </View>
                              <Text style={styles.umContact} numberOfLines={1}>{item.phone ?? item.email ?? item.id.slice(0, 16)}</Text>
                            </View>
                            <View style={styles.umCardRight}>
                              <View style={[styles.umRoleBadge, { backgroundColor: accent + "18" }]}>
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
                                  onPress={async () => {
                                    try {
                                      const updated = await api.changeUserRole(token, item.id, r);
                                      const patch = { role: updated.role };
                                      setAdminUsers(prev => prev.map(u => u.id === item.id ? { ...u, ...patch } : u));
                                      setUserSearchResults(prev => prev ? prev.map(u => u.id === item.id ? { ...u, ...patch } : u) : null);
                                    } catch (err) {
                                      Alert.alert("Role change failed", err instanceof Error ? err.message : "Unexpected error");
                                    }
                                  }}
                                >
                                  <Text style={[styles.umRoleChipText, item.role === r && { color: "#ffffff" }]}>{titleCase(r)}</Text>
                                </Pressable>
                              ))}
                            </View>

                            <View style={styles.umActions}>
                              <Pressable
                                style={[styles.umActionBtn, item.is_banned ? styles.umActionBtnUnban : styles.umActionBtnBan]}
                                disabled={loading}
                                onPress={async () => {
                                  const updated = await run(item.is_banned ? "Unbanning user" : "Banning user", () => api.banUser(token, item.id, !item.is_banned));
                                  if (updated) {
                                    const patch = { is_banned: (updated as typeof item).is_banned };
                                    setAdminUsers(prev => prev.map(u => u.id === item.id ? { ...u, ...patch } : u));
                                    setUserSearchResults(prev => prev ? prev.map(u => u.id === item.id ? { ...u, ...patch } : u) : null);
                                  }
                                }}
                              >
                                <Text style={[styles.umActionBtnText, item.is_banned ? { color: "#d97706" } : { color: "#ef4444" }]}>
                                  {item.is_banned ? "🔓 Unban" : "🚫 Ban"}
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
                                <Text style={styles.umActionBtnText}>{orders ? "Hide Orders" : "📦 Orders"}</Text>
                              </Pressable>
                            </View>

                            {orders && orders.length === 0 && <Text style={styles.emptyHint}>No orders for this user.</Text>}
                            {orders && orders.map(o => (
                              <View key={o.id} style={styles.umOrderRow}>
                                <View style={[styles.umOrderDot, { backgroundColor: orderStatusColor(o.status) }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.umOrderName}>{o.restaurant_name ?? "—"}</Text>
                                  <Text style={styles.umOrderMeta}>{titleCase(o.status)} · {formatCurrency(o.total_paise)} · {new Date(o.created_at).toLocaleDateString()}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              );
            })()}
              </>
            )}

            {/* Restaurant Approvals */}
            <Divider label="Restaurant Approvals" icon="✅" subtitle={adminRestaurants.length > 0 ? `${adminRestaurants.filter(r => r.approval_status === "pending").length} pending · ${adminRestaurants.length} total` : "Approve, reject or offboard restaurants"} collapsed={isCollapsed("Restaurant Approvals")} onPress={() => togglePanel("Restaurant Approvals")} />
            {!isCollapsed("Restaurant Approvals") && (
              <>
            <View style={styles.orderSearchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Search restaurant name…"
                placeholderTextColor="#94a3b8"
                value={restaurantSearch}
                onChangeText={text => { setRestaurantSearch(text); if (!text) setRestaurantSearchResults(null); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.button, { marginLeft: 8 }, (!restaurantSearch.trim() || loading) && styles.buttonDisabled]}
                disabled={!restaurantSearch.trim() || loading}
                onPress={async () => {
                  const result = await run("Searching restaurants", () => api.adminRestaurantsSearch(token, restaurantSearch.trim()));
                  if (result) setRestaurantSearchResults(result as typeof restaurantSearchResults);
                }}
              >
                <Text style={styles.buttonText}>Load</Text>
              </Pressable>
            </View>
            {(() => {
              const q = restaurantSearch.trim().toLowerCase();
              const displayRestaurants = restaurantSearchResults
                ?? (q
                  ? adminRestaurants.filter(r => r.name.toLowerCase().includes(q))
                  : Object.values(
                      adminRestaurants.reduce<Record<string, typeof adminRestaurants[0]>>((acc, r) => {
                        if (!acc[r.approval_status]) acc[r.approval_status] = r;
                        return acc;
                      }, {})
                    ).slice(0, 5));
              if (adminRestaurants.length === 0 && !restaurantSearchResults) {
                return <Text style={styles.emptyHint}>No restaurants to review. Load admin dashboard first.</Text>;
              }
              if (displayRestaurants.length === 0) {
                return <Text style={styles.emptyHint}>{q ? `No restaurants match "${restaurantSearch}".` : "No pending approvals."}</Text>;
              }
              return displayRestaurants.map(item => (
                <RestaurantRow
                  key={item.id}
                  name={item.name}
                  approvalStatus={item.approval_status}
                  isActive={item.is_active}
                  rejectionReason={item.rejection_reason}
                  onApprove={item.approval_status === "approved" ? undefined : async () => {
                    const result = await run("Approving restaurant", () => api.updateRestaurantApproval(token, item.id, "approved"));
                    if (result) {
                      setAdminRestaurants(prev => prev.map(r => r.id === item.id ? { ...r, approval_status: "approved", rejection_reason: null } : r));
                      setRestaurantSearchResults(prev => prev ? prev.map(r => r.id === item.id ? { ...r, approval_status: "approved", rejection_reason: null } : r) : null);
                    }
                  }}
                  onReject={item.approval_status === "pending" ? () => {
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
                  } : undefined}
                  onOffboard={item.approval_status === "approved" && item.is_active ? async () => {
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
                  } : undefined}
                />
              ));
            })()}
              </>
            )}

            {/* Order + Payment Monitoring */}
            <Divider label="Order + Payment Monitoring" icon="📊" subtitle="Search and monitor orders across all restaurants" collapsed={isCollapsed("Order + Payment Monitoring")} onPress={() => togglePanel("Order + Payment Monitoring")} />
            {!isCollapsed("Order + Payment Monitoring") && (
              <>
            <View style={styles.orderSearchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Restaurant name or Order ID…"
                placeholderTextColor="#94a3b8"
                value={orderSearch}
                onChangeText={text => { setOrderSearch(text); if (!text) setOrderSearchResults(null); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.button, { marginLeft: 8 }, (!orderSearch.trim() || loading) && styles.buttonDisabled]}
                disabled={!orderSearch.trim() || loading}
                onPress={async () => {
                  const result = await run("Searching orders", () => api.adminOrdersSearch(token, orderSearch.trim()));
                  if (result) setOrderSearchResults(result as typeof orderSearchResults);
                }}
              >
                <Text style={styles.buttonText}>Load</Text>
              </Pressable>
            </View>
            {(() => {
              const q = orderSearch.trim().toLowerCase();
              const displayOrders = orderSearchResults
                ?? (q
                  ? adminOrders.filter(o =>
                      (o.restaurant_name ?? "").toLowerCase().includes(q) ||
                      o.id.toLowerCase().startsWith(q)
                    )
                  : Object.values(
                      adminOrders.reduce<Record<string, typeof adminOrders[0]>>((acc, o) => {
                        if (!acc[o.status]) acc[o.status] = o;
                        return acc;
                      }, {})
                    ).slice(0, 5));
              if (adminOrders.length === 0 && !orderSearchResults) {
                return <Text style={styles.emptyHint}>No orders yet. Load admin dashboard first.</Text>;
              }
              if (displayOrders.length === 0) {
                return <Text style={styles.emptyHint}>No orders match "{orderSearch}".</Text>;
              }
              return displayOrders.map(item => (
                <OrderRow key={item.id} restaurantName={item.restaurant_name ?? "Unknown Restaurant"} orderId={item.id} status={item.status} totalPaise={item.total_paise} />
              ));
            })()}
            {paymentReports.length === 0
              ? <Text style={styles.emptyHint}>No payment report data.</Text>
              : paymentReports.slice(0, 5).map(item => (
                <ListItem key={`${item.provider}-${item.status}`} title={`${titleCase(item.provider)} — ${titleCase(item.status)}`} subtitle={`${item.transactions} tx · ${formatCurrency(item.amount_paise)}`} />
              ))
            }
              </>
            )}

            {/* Live Tracking */}
            <Divider label="Live Tracking + Driver Load" icon="📡" subtitle={deliveryOrders.length > 0 ? `${deliveryOrders.length} active deliveries · ${driverLoad.length} drivers` : "Real-time delivery and driver availability"} collapsed={isCollapsed("Live Tracking + Driver Load")} onPress={() => togglePanel("Live Tracking + Driver Load")} />
            {!isCollapsed("Live Tracking + Driver Load") && (
              <>
            <View style={styles.orderSearchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Restaurant name, Order ID or driver phone…"
                placeholderTextColor="#94a3b8"
                value={deliverySearch}
                onChangeText={setDeliverySearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {(() => {
              const q = deliverySearch.trim().toLowerCase();
              const deliveries = q
                ? deliveryOrders.filter(o =>
                    (o.restaurant_name ?? "").toLowerCase().includes(q) ||
                    o.id.toLowerCase().startsWith(q)
                  )
                : deliveryOrders;
              const drivers = q
                ? driverLoad.filter(d => (d.phone ?? "").includes(q) || d.id.toLowerCase().startsWith(q))
                : driverLoad;
              const combined = [
                ...deliveries.map(o => ({ key: o.id, title: `${o.restaurant_name} — ${titleCase(o.status)}`, subtitle: o.last_driver_lat ? `Driver at ${o.last_driver_lat}, ${o.last_driver_lng}` : "Driver location not available" })),
                ...drivers.map(d => ({ key: d.id, title: d.phone ?? d.id, subtitle: `Active orders: ${d.active_orders} · Capacity score: ${d.capacity_score}` }))
              ].slice(0, 5);
              if (deliveryOrders.length === 0 && driverLoad.length === 0) {
                return <Text style={styles.emptyHint}>No active deliveries or drivers.</Text>;
              }
              if (q && combined.length === 0) {
                return <Text style={styles.emptyHint}>No results match "{deliverySearch}".</Text>;
              }
              return combined.map(item => (
                <ListItem key={item.key} title={item.title} subtitle={item.subtitle} />
              ));
            })()}
              </>
            )}

            {/* Driver Onboarding Admin */}
            <Divider label="Driver Onboarding Admin" icon="🪪" subtitle={driverApplications.length > 0 ? `${driverApplications.length} applications · ${driverReferrals.length} referrals` : "Review driver applications and referrals"} collapsed={isCollapsed("Driver Onboarding Admin")} onPress={() => togglePanel("Driver Onboarding Admin")} />
            {!isCollapsed("Driver Onboarding Admin") && (
              <>
            {driverApplications.length === 0
              ? <Text style={styles.emptyHint}>No driver applications pending.</Text>
              : driverApplications.slice(0, 5).map(item => (
                <ListItem
                  key={item.id}
                  title={`${item.full_name} — ${titleCase(item.approval_status)}`}
                  subtitle={`OCR: ${item.ocr_status} · Selfie: ${item.selfie_status}`}
                  onPress={async () => {
                    const result = await run("Approving application", () => api.updateDriverApplicationApproval(token, item.id, "approved", "Approved from AK Ops mobile"));
                    if (result) setDriverApplications(prev => prev.map(a => a.id === item.id ? { ...a, approval_status: "approved" } : a));
                  }}
                />
              ))
            }
            {driverReferrals.length === 0
              ? <Text style={styles.emptyHint}>No driver referral records.</Text>
              : driverReferrals.slice(0, 5).map(item => (
                <ListItem key={item.id} title={`${item.referral_code} — ${titleCase(item.status)}`} subtitle={`${item.referrer_phone ?? "–"} → ${item.referred_phone ?? "–"} · ${formatCurrency(item.reward_paise)}`} />
              ))
            }
              </>
            )}

            {/* Zones / Campaigns / Incentives */}
            <Divider label="Zones, Campaigns & Incentives" icon="🎯" subtitle="Delivery zones, discount offers and driver rewards" collapsed={isCollapsed("Zones, Campaigns & Incentives")} onPress={() => togglePanel("Zones, Campaigns & Incentives")} />
            {!isCollapsed("Zones, Campaigns & Incentives") && (
              <>
            <View style={styles.actions}>
              <Button label="Create Zone" onPress={() => run("Creating zone", () => api.createZone(token, `Zone ${Date.now().toString(36).slice(-4).toUpperCase()}`, "Delhi NCR", location.lat, location.lng, 3, 20))} disabled={!authed} />
              <Button label="Create Offer" onPress={() => run("Creating offer", () => api.createOffer(token, `MOB${Date.now().toString(36).slice(-5).toUpperCase()}`, "Mobile Offer", "flat", 5000, 19900))} disabled={!authed} />
            </View>
            <View style={styles.actions}>
              <Button label="Create Campaign" onPress={() => run("Creating campaign", () => api.createCampaign(token, `Campaign ${Date.now().toString(36).slice(-4).toUpperCase()}`, "push", 100000, "AI mobile launch creative"))} disabled={!authed} />
              <Button label="Create Incentive" onPress={() => run("Creating incentive", () => api.createDriverIncentive(token, `Delivery Bonus ${Date.now().toString(36).slice(-4).toUpperCase()}`, 5, 7500))} disabled={!authed} />
            </View>
            {zones.length === 0
              ? <Text style={styles.emptyHint}>No zones. Tap "Create Zone" to add one.</Text>
              : zones.slice(0, 2).map(item => (
                <ListItem key={item.id} title={`${item.name} — ${item.city}`} subtitle={`SLA ${item.sla_minutes} min · Surge ${item.surge_multiplier}x`} />
              ))
            }
            {campaigns.length === 0
              ? <Text style={styles.emptyHint}>No campaigns. Tap "Create Campaign" to add one.</Text>
              : campaigns.slice(0, 2).map(item => (
                <ListItem key={item.id} title={`${item.name} (${item.channel})`} subtitle={`${titleCase(item.status)} · ${formatCurrency(item.budget_paise)}`} />
              ))
            }
            {incentives.length === 0
              ? <Text style={styles.emptyHint}>No driver incentives. Tap "Create Incentive" to add one.</Text>
              : incentives.slice(0, 1).map(item => (
                <ListItem key={item.id} title={item.title} subtitle={`${item.target_deliveries} deliveries → ${formatCurrency(item.reward_paise)} · ${titleCase(item.status)}`} />
              ))
            }
              </>
            )}

            {/* Analytics */}
            <Divider label="Analytics & Predictions" icon="📈" subtitle="AI-powered demand forecasts and order trends" collapsed={isCollapsed("Analytics & Predictions")} onPress={() => togglePanel("Analytics & Predictions")} />
            {!isCollapsed("Analytics & Predictions") && (
              <>
            {analyticsJobs.length === 0
              ? <Text style={styles.emptyHint}>No analytics jobs yet. Tap "Run Demand Prediction" to trigger one.</Text>
              : analyticsJobs.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.job_type} — ${titleCase(item.status)}`} subtitle={new Date(item.created_at).toLocaleString()} />
              ))
            }
            {demandPredictions.length === 0
              ? <Text style={styles.emptyHint}>No demand predictions yet.</Text>
              : demandPredictions.slice(0, 2).map(item => (
                <ListItem key={item.id} title={`${item.zone_key} — ${item.predicted_orders} predicted orders`} subtitle={`${item.cuisine_type ?? "All cuisines"} · Confidence: ${item.confidence}`} />
              ))
            }
              </>
            )}

            {/* Payouts */}
            <Divider label="Payouts" icon="💸" subtitle={adminPayouts.length > 0 ? `${adminPayouts.length} payout${adminPayouts.length !== 1 ? "s" : ""} pending` : "Driver and restaurant payout management"} collapsed={isCollapsed("Payouts")} onPress={() => togglePanel("Payouts")} />
            {!isCollapsed("Payouts") && (
              <>
            {adminPayouts.length === 0
              ? <Text style={styles.emptyHint}>No pending payouts.</Text>
              : adminPayouts.slice(0, 5).map(item => (
                <ListItem
                  key={item.id}
                  title={`${titleCase(item.role)} payout — ${titleCase(item.status)}`}
                  subtitle={`${item.phone ?? "–"} · ${formatCurrency(item.amount_paise)} via ${item.method}`}
                  onPress={async () => {
                    const result = await run("Approving payout", () => api.updatePayoutApproval(token, item.id, "approved", "Approved from AK Ops mobile"));
                    if (result) setAdminPayouts(prev => prev.map(p => p.id === item.id ? { ...p, status: "approved" } : p));
                  }}
                />
              ))
            }
              </>
            )}

            {/* Support Tickets */}
            <Divider label="Support Tickets" icon="🎫" subtitle={supportTickets.length > 0 ? `${supportTickets.length} ticket${supportTickets.length !== 1 ? "s" : ""}` : "Customer support and issue resolution"} collapsed={isCollapsed("Support Tickets")} onPress={() => togglePanel("Support Tickets")} />
            {!isCollapsed("Support Tickets") && (
              <>
            <View style={styles.actions}>
              <Button
                label="Create Test Ticket"
                onPress={() => run("Creating support ticket", () => api.createSupportTicket(token, "technical", "Mobile test ticket", "Test ticket created from AK Ops mobile app."))}
                disabled={!authed}
              />
            </View>
            {supportTickets.length === 0
              ? <Text style={styles.emptyHint}>No support tickets. Tap "Create Test Ticket" to add one.</Text>
              : supportTickets.slice(0, 5).map(item => (
                <ListItem key={item.id} title={`${titleCase(item.category)} — ${titleCase(item.status)}`} subtitle={item.subject} />
              ))
            }
              </>
            )}

            {/* Security & Audit */}
            <Divider label="Security & Audit Logs" icon="🔒" subtitle={auditLogs.length > 0 ? `${auditLogs.length} log entries · ${verificationChecks.length} verification checks` : "Access logs, audit trail and verification"} collapsed={isCollapsed("Security & Audit Logs")} onPress={() => togglePanel("Security & Audit Logs")} />
            {!isCollapsed("Security & Audit Logs") && (
              <>
            {auditLogs.length === 0
              ? <Text style={styles.emptyHint}>No audit logs yet. Perform actions to generate entries.</Text>
              : auditLogs.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.method} ${item.path}`} subtitle={`HTTP ${item.status_code}`} />
              ))
            }
            {verificationChecks.length === 0
              ? <Text style={styles.emptyHint}>No verification checks yet.</Text>
              : verificationChecks.slice(0, 2).map(item => (
                <ListItem key={item.id} title={`${item.provider} — ${item.check_type}`} subtitle={titleCase(item.status)} />
              ))
            }
              </>
            )}
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
    default:               return "#64748b";
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
    default:          return "#94a3b8";
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
    default:         return "#94a3b8";
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
        <Text style={[styles.rejectionReason, { color: "#94a3b8" }]}>Deactivated — not visible to customers</Text>
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

const TEAL = "#0f766e";
const TEAL_DARK = "#0d5e57";
const CREAM = "#f7f4ef";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: "#12312d" },
  subtitle: { color: "#64748b", fontSize: 15 },
  testHint: { color: "#94a3b8", fontSize: 12, marginTop: 4 },

  // Login status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 6
  },
  statusRowOffline: { backgroundColor: "#fef2f2" },
  statusRowError: { backgroundColor: "#fef2f2" },
  statusDot: { fontSize: 14, color: TEAL, fontWeight: "700" },
  statusText: { color: TEAL, fontWeight: "700", flex: 1, fontSize: 13 },

  notice: { backgroundColor: "#f8fafc", color: "#334155", padding: 10, borderRadius: 6, fontSize: 13 },

  // Cards
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },

  // Divider (production panel button)
  divider: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    marginTop: 6,
    marginBottom: 2,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dividerInner: { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 12, paddingVertical: 11, gap: 10 },
  dividerIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#f0fdf4", alignItems: "center" as const, justifyContent: "center" as const },
  dividerIconText: { fontSize: 16 },
  dividerTextBlock: { flex: 1, gap: 1 },
  dividerLabel: { fontSize: 13, fontWeight: "700" as const, color: "#1e293b" },
  dividerSubtitle: { fontSize: 11, color: "#94a3b8" },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#d1fae5" },
  dividerChevronPill: { backgroundColor: "#f1f5f9", borderRadius: 6, width: 26, height: 26, alignItems: "center" as const, justifyContent: "center" as const },
  dividerChevronPillOpen: { backgroundColor: "#f0fdf4" },

  sectionTitle: { fontWeight: "800", color: "#334155" },
  sectionHint: { color: "#475569", fontSize: 13, lineHeight: 18 },
  helperText: { color: "#475569", fontSize: 13, lineHeight: 18 },
  emptyHint: { color: "#94a3b8", fontSize: 13, fontStyle: "italic", textAlign: "center", paddingVertical: 6 },

  // Inputs
  input: {
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 6,
    padding: Platform.OS === "ios" ? 12 : 9,
    backgroundColor: "#ffffff",
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 22,
    gap: 14,
    shadowColor: "#0f172a",
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
  loginBrandName: { fontSize: 22, fontWeight: "800" as const, color: "#0f172a" },
  loginBrandTagline: { color: "#64748b", fontSize: 12, fontWeight: "500" as const, marginTop: 2 },
  loginAlert: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  loginAlertError: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  loginAlertIcon: { fontSize: 14, fontWeight: "700" as const, color: "#374151" },
  loginAlertText: { color: "#1e293b", fontSize: 13, flex: 1, fontWeight: "500" as const },
  loginField: { gap: 6 },
  loginFieldLabel: { color: "#374151", fontSize: 13, fontWeight: "600" as const },
  loginInput: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
  },
  loginInputSubtle: {
    borderColor: "#f1f5f9",
    backgroundColor: "#fafafa",
    fontSize: 12,
    color: "#94a3b8",
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
  loginDividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  loginDividerText: { color: "#94a3b8", fontSize: 12, fontWeight: "500" as const },
  loginSecondaryRow: { flexDirection: "row" as const, gap: 8 },
  loginSecondaryBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center" as const,
    backgroundColor: "#f8fafc",
  },
  loginSecondaryBtnText: { color: "#334155", fontWeight: "600" as const, fontSize: 13 },
  loginOtpInfo: { alignItems: "center" as const, gap: 3, paddingVertical: 4 },
  loginOtpInfoText: { color: "#64748b", fontSize: 13 },
  loginOtpPhone: { color: "#0f172a", fontSize: 17, fontWeight: "700" as const },
  loginBackBtn: { alignItems: "center" as const, paddingVertical: 6 },
  loginBackBtnText: { color: "#64748b", fontSize: 13, fontWeight: "500" as const },
  loginSecondaryBtnSm: { alignItems: "center" as const, paddingVertical: 4 },
  loginSecondaryBtnSmText: { color: "#94a3b8", fontSize: 12 },
  loginSignedIn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#d1fae5",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  loginSignedInInfo: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  loginSignedInDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" },
  loginSignedInPhone: { color: "#0f172a", fontSize: 14, fontWeight: "600" as const },
  loginSignedInRole: { color: "#0f766e", fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, marginTop: 1 },
  loginLogoutBtn: { backgroundColor: "#fef2f2", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
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
    color: "#475569",
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
    color: "#475569",
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
    backgroundColor: "#ffffff",
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
    color: "#64748b",
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
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 5,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillName: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "600" as const,
  },
  statusPillCount: {
    color: "#1e293b",
    fontSize: 11,
    fontWeight: "800" as const,
  },

  // Recent orders rows
  recentOrdersTitle: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: 2,
  },
  recentOrderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  recentOrderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recentOrderInfo: {
    flex: 1,
  },
  recentOrderName: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  recentOrderMeta: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 1,
  },
  recentOrderId: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700" as const,
  },

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
    backgroundColor: "#1e293b",
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
  segment: { borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#ffffff" },
  segmentActive: { backgroundColor: TEAL, borderColor: TEAL_DARK },
  segmentText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: "#ffffff" },

  // List items
  listItem: {
    padding: 12,
    borderColor: "#d1fae5",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    gap: 2
  },
  listItemTappable: { borderLeftColor: TEAL },
  listTitle: { fontWeight: "700", color: "#1f2937", fontSize: 14 },
  listSubtitle: { color: "#64748b", fontSize: 13 },
  listTapHint: { color: TEAL, fontSize: 11, fontWeight: "700", marginTop: 2 },

  // Summary box
  summary: { gap: 4, backgroundColor: "#f8fafc", borderRadius: 8, padding: 12, borderColor: "#e5e7eb", borderWidth: 1 },
  summaryLine: { color: "#334155", fontSize: 13 },

  // Order management
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    padding: 8,
    borderColor: "#bbf7d0",
    borderWidth: 1
  },
  fieldLabel: { color: "#64748b", fontSize: 13 },
  fieldValue: { color: TEAL, fontWeight: "700", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // Restaurant order card
  orderCard: {
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    backgroundColor: "#ffffff"
  },

  // Stats banner (admin dashboard)
  statsBanner: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0"
  },
  statsBannerEmpty: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center" as const
  },
  statsBannerEmptyText: {
    color: "#94a3b8",
    fontSize: 13,
    fontStyle: "italic" as const
  },
  statChip: {
    alignItems: "center" as const,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#d1fae5",
    minWidth: 60
  },
  statChipValue: {
    color: TEAL,
    fontWeight: "800" as const,
    fontSize: 15
  },
  statChipLabel: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 1
  },

  // User Management
  listItemBanned: { borderLeftColor: "#ef4444", backgroundColor: "#fff5f5" },
  userRowHeader: { flexDirection: "row" as const, alignItems: "center" as const },
  userExpandedPanel: { marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 },
  userPanelLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" as const, marginBottom: 4 },
  roleChip: { borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#f8fafc" },
  roleChipActive: { backgroundColor: TEAL, borderColor: TEAL_DARK },
  roleChipText: { color: "#334155", fontSize: 12, fontWeight: "600" as const },
  roleChipTextActive: { color: "#ffffff" },
  buttonBan: { backgroundColor: "#ef4444" },
  buttonUnban: { backgroundColor: "#f59e0b" },
  userOrderRow: { padding: 8, borderRadius: 6, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e5e7eb", gap: 2 },

  // User Management (production)
  umSearchRow: { flexDirection: "row" as const, gap: 8, alignItems: "center" as const },
  umSearchInputWrap: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
  },
  umSearchIcon: { fontSize: 14 },
  umSearchInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    fontSize: 14,
    color: "#1e293b",
  },
  umSearchClear: { color: "#94a3b8", fontSize: 14, fontWeight: "700" as const, padding: 4 },
  umSearchBtn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
  },
  umSearchBtnDisabled: { backgroundColor: "#cbd5e1" },
  umSearchBtnText: { color: "#ffffff", fontWeight: "700" as const, fontSize: 14 },
  umMeta: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  umMetaCount: { color: "#64748b", fontSize: 12, fontWeight: "600" as const },
  umMetaTag: { backgroundColor: "#f0fdf4", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "#bbf7d0" },
  umMetaTagText: { color: "#15803d", fontSize: 11, fontWeight: "700" as const },
  umCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden" as const,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  umCardBanned: { borderColor: "#fecaca", backgroundColor: "#fff8f8" },
  umCardHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, padding: 12 },
  umAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center" as const, justifyContent: "center" as const },
  umAvatarText: { fontSize: 18, fontWeight: "800" as const },
  umInfo: { flex: 1, gap: 2 },
  umNameRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  umName: { fontSize: 14, fontWeight: "700" as const, color: "#0f172a", flex: 1 },
  umBannedBadge: { backgroundColor: "#fef2f2", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: "#fecaca" },
  umBannedBadgeText: { color: "#ef4444", fontSize: 9, fontWeight: "800" as const, letterSpacing: 0.5 },
  umContact: { fontSize: 12, color: "#64748b" },
  umCardRight: { alignItems: "flex-end" as const, gap: 4 },
  umRoleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  umRoleBadgeText: { fontSize: 11, fontWeight: "700" as const },
  umChevron: { color: "#94a3b8", fontSize: 11 },
  umExpanded: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    padding: 12,
    gap: 10,
    backgroundColor: "#fafafa",
  },
  umSectionLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "700" as const, letterSpacing: 1.5 },
  umRoleChips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6 },
  umRoleChip: {
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    backgroundColor: "#f8fafc",
  },
  umRoleChipText: { color: "#334155", fontSize: 12, fontWeight: "600" as const },
  umActions: { flexDirection: "row" as const, gap: 8 },
  umActionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center" as const,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  umActionBtnBan: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  umActionBtnUnban: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  umActionBtnText: { fontSize: 12, fontWeight: "700" as const, color: "#374151" },
  umOrderRow: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  umOrderDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  umOrderName: { fontSize: 13, fontWeight: "600" as const, color: "#1e293b" },
  umOrderMeta: { fontSize: 11, color: "#64748b", marginTop: 1 },

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
    color: "#64748b",
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
    backgroundColor: "#ffffff"
  },
  roleDropdownValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600" as const
  },
  roleDropdownChevron: {
    fontSize: 12,
    color: "#64748b"
  },
  roleDropdownMenu: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    backgroundColor: "#ffffff",
    overflow: "hidden" as const,
    marginTop: 2
  },
  roleDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  roleDropdownItemActive: {
    backgroundColor: "#f0fdf4"
  },
  roleDropdownItemText: {
    fontSize: 14,
    color: "#334155"
  },
  roleDropdownItemTextActive: {
    color: TEAL,
    fontWeight: "700" as const
  }
});

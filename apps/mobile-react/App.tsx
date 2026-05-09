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
  const [adminRestaurants, setAdminRestaurants] = useState<Array<{ id: string; name: string; address: string; approval_status: string }>>([]);
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; phone: string | null; email: string | null; name: string | null; role: string }>>([]);
  const [adminOrders, setAdminOrders] = useState<Array<{ id: string; status: string; total_paise: number; restaurant_name: string }>>([]);
  const [paymentReports, setPaymentReports] = useState<Array<{ provider: string; status: string; transactions: number; amount_paise: number }>>([]);
  const [driverLoad, setDriverLoad] = useState<Array<{ id: string; phone: string | null; active_orders: number; capacity_score: number }>>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<Array<{ id: string; status: string; restaurant_name: string; last_driver_lat: string | null; last_driver_lng: string | null }>>([]);
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
    if (__DEV__ && response && typeof response === "object" && "devCode" in response && response.devCode) {
      setOtp(String(response.devCode));
      setNotice(`OTP sent. Dev code auto-filled: ${String(response.devCode)}`);
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

  async function useCurrentLocation() {
    await run("Getting location", async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Location permission denied. Enable it in Settings.");
      const current = await Location.getCurrentPositionAsync({});
      setLocation({ lat: current.coords.latitude, lng: current.coords.longitude });
    });
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

        <Text style={styles.title}>AK Ops</Text>
        <Text style={styles.subtitle}>Operations platform for drivers, restaurants and admins.</Text>

        {/* ── Login Card ── */}
        <Card title="Login">
          <Text style={styles.notice}>{notice}</Text>

          {/* Status pill */}
          <View style={[styles.statusRow, isOffline && styles.statusRowOffline, !!error && !isOffline && styles.statusRowError]}>
            <Text style={styles.statusDot}>{isOffline ? "⚠" : error ? "✕" : loading ? "↻" : "●"}</Text>
            <Text style={styles.statusText}>
              {isOffline
                ? "Offline — check your connection"
                : loading
                  ? "Loading…"
                  : error
                    ? error
                    : authed
                      ? `Signed in as ${titleCase(role)}`
                      : "Not signed in"}
            </Text>
          </View>

          <Text style={styles.helperText}>{roleHelp}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone (e.g. +919999000003)" keyboardType="phone-pad" />
          <TextInput style={styles.input} value={otp} onChangeText={setOtp} placeholder="OTP (auto-filled in dev mode)" keyboardType="number-pad" />
          <Segmented values={roleOptions} value={role} onChange={next => setRole(next as Role)} />
          <View style={styles.actions}>
            <Button label="Send OTP" onPress={requestOtp} />
            <Button label="Verify OTP" onPress={verifyOtp} />
          </View>
          <TextInput style={styles.input} value={googleIdToken} onChangeText={setGoogleIdToken} placeholder="Google ID token (optional)" />
          <Button label="Login With Google Token" onPress={loginWithGoogleToken} />
          <View style={styles.actions}>
            <Button label="Use Location" onPress={useCurrentLocation} />
            <Button label="Enable Push" onPress={enablePush} disabled={!authed} />
            <Button label="Test Push" onPress={sendPushTest} disabled={!authed} />
            {authed ? <Button label="Logout" onPress={logout} /> : null}
          </View>
          <Text style={styles.testHint}>Test accounts: driver +919999000003 | restaurant +919999000002 | admin +919999000004</Text>
        </Card>

        {authed && (
          <Segmented values={availableTabs} value={tab} onChange={next => setTab(next as Tab)} />
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
            <Divider label="Marketplace & Orders" />
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

            {/* Driver Onboarding */}
            <Divider label="Driver Onboarding" />
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

            {/* Active Deliveries */}
            <Divider label="Active Deliveries" />
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

            {/* Wallet */}
            <Divider label="Wallet & Earnings" />
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
          </Card>
        )}

        {/* ── Restaurant Tab ── */}
        {tab === "restaurant" && (
          <Card title="Restaurant Panel">
            <Text style={styles.sectionHint}>Manage onboarding, menu items, incoming orders and earnings.</Text>

            <Divider label="Restaurant Onboarding" />
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

            <Divider label="Incoming Orders" />
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
          </Card>
        )}

        {/* ── Admin Tab ── */}
        {tab === "admin" && (
          <Card title="Admin + Operations Dashboard">

            {/* ── Stats banner — changes immediately when data loads ── */}
            {dashboard ? (
              <View style={styles.statsBanner}>
                <StatChip label="Users" value={String(dashboard.users)} />
                <StatChip label="Revenue" value={formatCurrency(dashboard.revenuePaise)} />
                <StatChip label="Restaurants" value={String(adminRestaurants.length)} />
                <StatChip label="Orders" value={String(adminOrders.length)} />
                <StatChip label="Drivers" value={String(driverLoad.length)} />
              </View>
            ) : (
              <View style={styles.statsBannerEmpty}>
                <Text style={styles.statsBannerEmptyText}>No data loaded — tap "Load Admin Dashboard" below</Text>
              </View>
            )}

            {dashboard && (
              <View style={styles.statsBanner}>
                {dashboard.ordersByStatus.map(s => (
                  <StatChip key={s.status} label={titleCase(s.status)} value={String(s.count)} />
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <Button label={loading ? "Loading…" : "Load Admin Dashboard"} onPress={loadAdmin} disabled={!authed || loading} />
              <Button label={loading ? "Loading…" : "Load Marketplace"} onPress={loadMarketplace} disabled={!authed || loading} />
            </View>

            {(restaurants.length > 0 || trending.length > 0) && (
              <View style={styles.statsBanner}>
                <StatChip label="Nearby" value={String(restaurants.length)} />
                <StatChip label="Trending" value={String(trending.length)} />
                <StatChip label="Offers" value={String(offers.length)} />
              </View>
            )}

            <View style={styles.actions}>
              <Button
                label="Run Demand Prediction"
                onPress={() => run("AI demand prediction", () => api.runDemandPredictionJob(token))}
                disabled={!authed}
              />
            </View>

            {dashboard && (
              <Summary title="Recent Orders" lines={
                dashboard.recentOrders.slice(0, 3).map(o =>
                  `${o.restaurant_name} — ${titleCase(o.status)} · ${formatCurrency(o.total_paise)}`
                )
              } />
            )}

            {/* Order Operations */}
            <Divider label="Order Operations" />
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

            {/* User Management */}
            <Divider label="User Management" />
            {adminUsers.length === 0
              ? <Text style={styles.emptyHint}>Load admin dashboard to see users.</Text>
              : adminUsers.slice(0, 5).map(item => (
                <ListItem key={item.id} title={item.name ?? item.phone ?? item.email ?? item.id} subtitle={titleCase(item.role)} />
              ))
            }

            {/* Restaurant Approvals */}
            <Divider label="Restaurant Approvals" />
            {adminRestaurants.length === 0
              ? <Text style={styles.emptyHint}>No restaurants to review. Load admin dashboard first.</Text>
              : adminRestaurants.slice(0, 6).map(item => (
                <ListItem
                  key={item.id}
                  title={item.name}
                  subtitle={titleCase(item.approval_status)}
                  onPress={async () => {
                    const result = await run("Approving restaurant", () => api.updateRestaurantApproval(token, item.id, "approved"));
                    if (result) setAdminRestaurants(prev => prev.map(r => r.id === item.id ? { ...r, approval_status: "approved" } : r));
                  }}
                />
              ))
            }

            {/* Order + Payment Monitoring */}
            <Divider label="Order + Payment Monitoring" />
            {adminOrders.length === 0
              ? <Text style={styles.emptyHint}>No orders yet.</Text>
              : adminOrders.slice(0, 4).map(item => (
                <ListItem key={item.id} title={`${item.restaurant_name} — ${titleCase(item.status)}`} subtitle={formatCurrency(item.total_paise)} />
              ))
            }
            {paymentReports.length === 0
              ? <Text style={styles.emptyHint}>No payment report data.</Text>
              : paymentReports.map(item => (
                <ListItem key={`${item.provider}-${item.status}`} title={`${titleCase(item.provider)} — ${titleCase(item.status)}`} subtitle={`${item.transactions} tx · ${formatCurrency(item.amount_paise)}`} />
              ))
            }

            {/* Live Tracking */}
            <Divider label="Live Tracking + Driver Load" />
            {deliveryOrders.length === 0
              ? <Text style={styles.emptyHint}>No active deliveries in progress.</Text>
              : deliveryOrders.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.restaurant_name} — ${titleCase(item.status)}`} subtitle={item.last_driver_lat ? `Driver at ${item.last_driver_lat}, ${item.last_driver_lng}` : "Driver location not available"} />
              ))
            }
            {driverLoad.length === 0
              ? <Text style={styles.emptyHint}>No driver load data.</Text>
              : driverLoad.slice(0, 3).map(item => (
                <ListItem key={item.id} title={item.phone ?? item.id} subtitle={`Active orders: ${item.active_orders} · Capacity score: ${item.capacity_score}`} />
              ))
            }

            {/* Zones / Campaigns / Incentives */}
            <Divider label="Zones, Campaigns & Incentives" />
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
              : zones.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.name} — ${item.city}`} subtitle={`SLA ${item.sla_minutes} min · Surge ${item.surge_multiplier}x`} />
              ))
            }
            {campaigns.length === 0
              ? <Text style={styles.emptyHint}>No campaigns. Tap "Create Campaign" to add one.</Text>
              : campaigns.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.name} (${item.channel})`} subtitle={`${titleCase(item.status)} · ${formatCurrency(item.budget_paise)}`} />
              ))
            }
            {incentives.length === 0
              ? <Text style={styles.emptyHint}>No driver incentives. Tap "Create Incentive" to add one.</Text>
              : incentives.slice(0, 3).map(item => (
                <ListItem key={item.id} title={item.title} subtitle={`${item.target_deliveries} deliveries → ${formatCurrency(item.reward_paise)} · ${titleCase(item.status)}`} />
              ))
            }

            {/* Analytics */}
            <Divider label="Analytics & Predictions" />
            {analyticsJobs.length === 0
              ? <Text style={styles.emptyHint}>No analytics jobs yet. Tap "Run Demand Prediction" to trigger one.</Text>
              : analyticsJobs.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.job_type} — ${titleCase(item.status)}`} subtitle={new Date(item.created_at).toLocaleString()} />
              ))
            }
            {demandPredictions.length === 0
              ? <Text style={styles.emptyHint}>No demand predictions yet.</Text>
              : demandPredictions.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.zone_key} — ${item.predicted_orders} predicted orders`} subtitle={`${item.cuisine_type ?? "All cuisines"} · Confidence: ${item.confidence}`} />
              ))
            }

            {/* Driver Onboarding Admin */}
            <Divider label="Driver Onboarding Admin" />
            {driverApplications.length === 0
              ? <Text style={styles.emptyHint}>No driver applications pending.</Text>
              : driverApplications.slice(0, 4).map(item => (
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
              : driverReferrals.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.referral_code} — ${titleCase(item.status)}`} subtitle={`${item.referrer_phone ?? "–"} → ${item.referred_phone ?? "–"} · ${formatCurrency(item.reward_paise)}`} />
              ))
            }

            {/* Payouts */}
            <Divider label="Payouts" />
            {adminPayouts.length === 0
              ? <Text style={styles.emptyHint}>No pending payouts.</Text>
              : adminPayouts.slice(0, 4).map(item => (
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

            {/* Support Tickets */}
            <Divider label="Support Tickets" />
            <View style={styles.actions}>
              <Button
                label="Create Test Ticket"
                onPress={() => run("Creating support ticket", () => api.createSupportTicket(token, "technical", "Mobile test ticket", "Test ticket created from AK Ops mobile app."))}
                disabled={!authed}
              />
            </View>
            {supportTickets.length === 0
              ? <Text style={styles.emptyHint}>No support tickets. Tap "Create Test Ticket" to add one.</Text>
              : supportTickets.slice(0, 4).map(item => (
                <ListItem key={item.id} title={`${titleCase(item.category)} — ${titleCase(item.status)}`} subtitle={item.subject} />
              ))
            }

            {/* Security & Audit */}
            <Divider label="Security & Audit Logs" />
            {auditLogs.length === 0
              ? <Text style={styles.emptyHint}>No audit logs yet. Perform actions to generate entries.</Text>
              : auditLogs.slice(0, 4).map(item => (
                <ListItem key={item.id} title={`${item.method} ${item.path}`} subtitle={`HTTP ${item.status_code}`} />
              ))
            }
            {verificationChecks.length === 0
              ? <Text style={styles.emptyHint}>No verification checks yet.</Text>
              : verificationChecks.slice(0, 3).map(item => (
                <ListItem key={item.id} title={`${item.provider} — ${item.check_type}`} subtitle={titleCase(item.status)} />
              ))
            }
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
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

  // Divider
  divider: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  dividerLabel: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },

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

  // Segmented control
  segmented: { gap: 8, paddingVertical: 2 },
  segment: { borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#ffffff" },
  segmentActive: { backgroundColor: TEAL, borderColor: TEAL_DARK },
  segmentText: { color: "#334155", fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: "#ffffff" },

  // List items
  listItem: { padding: 12, borderColor: "#e5e7eb", borderWidth: 1, borderRadius: 8, backgroundColor: "#ffffff", gap: 2 },
  listItemTappable: { borderColor: TEAL, borderLeftWidth: 3 },
  listTitle: { fontWeight: "700", color: "#1f2937", fontSize: 14 },
  listSubtitle: { color: "#64748b", fontSize: 13 },
  listTapHint: { color: TEAL, fontSize: 11, fontWeight: "600", marginTop: 2 },

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
  }
});

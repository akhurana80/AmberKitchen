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
import MapView, { Marker, Polyline } from "react-native-maps";
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
  const [notice, setNotice] = useState("Ready for operations login, dispatch, restaurant, and admin workflows.");
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
        return "Driver mode guides delivery partners through onboarding, live orders, and payout readiness.";
      case "restaurant":
        return "Restaurant mode helps you manage onboarding, menu items, active orders, and earnings.";
      default:
        return "Admin mode gives you fast access to platform health, approvals, monitoring, and launch controls.";
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
      setNotice(`${label}...`);
      const result = await work();
      setNotice(`${label} complete.`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected mobile app error";
      setError(message);
      setNotice(message);
      Alert.alert(label, message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void SecureStore.getItemAsync("amberkitchen.token").then(saved => {
      if (saved) {
        setToken(saved);
      }
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
    if (role === "driver") {
      setTab("driver");
    } else if (role === "restaurant") {
      setTab("restaurant");
    } else {
      setTab("admin");
    }
  }, [role]);

  useEffect(() => {
    if (!token || !orderId) {
      return undefined;
    }

    const socket: Socket = io(config.socketUrl, { auth: { token }, transports: ["websocket"] });
    socket.emit("join-order", orderId);
    socket.on("order:update", payload => {
      setNotice(`Live order update: ${payload?.status ?? "updated"}`);
      void loadOrder();
    });
    socket.on("tracking:location", payload => {
      if (payload?.lat && payload?.lng) {
        setLocation({ lat: Number(payload.lat), lng: Number(payload.lng) });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [token, orderId]);

  async function saveToken(nextToken: string) {
    setToken(nextToken);
    await SecureStore.setItemAsync("amberkitchen.token", nextToken);
  }

  async function logout() {
    setToken("");
    setNotice("Logged out.");
    setError(null);
    setTab("driver");
    await SecureStore.deleteItemAsync("amberkitchen.token");
  }

  async function requestOtp() {
    const response = await run("Sending OTP", () => api.requestOtp(phone));
    if (__DEV__ && response && typeof response === "object" && "devCode" in response && response.devCode) {
      setOtp(String(response.devCode));
    }
  }

  async function verifyOtp() {
    const response = await run("Verifying OTP", () => api.verifyOtp(phone, otp, role));
    if (response && typeof response === "object" && "token" in response) {
      await saveToken(String(response.token));
    }
  }

  async function loginWithGoogleToken() {
    const response = await run("Google login", () => api.googleLogin(googleIdToken, role));
    if (response && typeof response === "object" && "token" in response) {
      await saveToken(String(response.token));
    }
  }

  async function useCurrentLocation() {
    await run("Getting mobile location", async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location permission is required for live tracking and nearby restaurants.");
      }
      const current = await Location.getCurrentPositionAsync({});
      setLocation({ lat: current.coords.latitude, lng: current.coords.longitude });
    });
  }

  async function enablePush() {
    if (!token) {
      Alert.alert("Login required", "Login before registering push notifications.");
      return;
    }
    await run("Registering push notifications", async () => {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Push notification permission was not granted.");
      }
      const pushToken = await Notifications.getExpoPushTokenAsync();
      await api.registerDeviceToken(token, pushToken.data);
    });
  }

  async function sendPushTest() {
    if (!token) {
      return;
    }
    await run("Sending test push", () => api.sendTestNotification(token));
  }

  async function loadMarketplace() {
    if (!token) {
      return;
    }
    await run("Loading restaurants", async () => {
      const [nearby, hot, places, activeOffers] = await Promise.all([
        api.searchRestaurants(token, {
          q: "",
          diet: "all",
          minRating: 3,
          sort: "distance",
          lat: location.lat,
          lng: location.lng
        }),
        api.trendingRestaurants(token, location.lat, location.lng),
        api.googlePlacesDelhiNcr(token, 3),
        api.marketplaceOffers(token)
      ]);
      setRestaurants(nearby);
      setTrending(hot);
      setGooglePlaces(places.restaurants);
      setOffers(activeOffers);
      setSelectedRestaurantId(nearby[0]?.restaurant_id ?? hot[0]?.id ?? selectedRestaurantId);
    });
  }

  async function createOrder() {
    if (!token) {
      return;
    }
    const response = await run("Creating order", () => api.createOrder(token, firstRestaurant, location.lat, location.lng));
    if (response && typeof response === "object" && "id" in response) {
      setOrderId(String(response.id));
    }
  }

  async function loadOrder() {
    if (!token || !orderId) {
      return;
    }
    const response = await run("Loading order", () => api.getOrder(token, orderId));
    if (response) {
      setOrder(response as OrderSummary);
    }
  }

  async function pay(provider: "paytm" | "phonepe" | "razorpay") {
    if (!token || !orderId) {
      return;
    }
    const response = await run(`Starting ${provider}`, () => api.createPayment(token, provider, orderId));
    const url = response && typeof response === "object" ? (response as { redirectUrl?: string; paymentUrl?: string }).redirectUrl ?? (response as { paymentUrl?: string }).paymentUrl : undefined;
    if (url) {
      await Linking.openURL(url);
    }
  }

  async function loadEta() {
    if (!token || !orderId) {
      return;
    }
    const response = await run("Calculating ETA", async () => {
      const [nextEta, loop] = await Promise.all([
        api.orderEta(token, orderId),
        api.orderEtaLoop(token, orderId)
      ]);
      setEtaLoop(loop);
      return nextEta;
    });
    if (response) {
      setEta(response as Awaited<ReturnType<typeof api.orderEta>>);
    }
  }

  async function openNavigation() {
    const destination = eta?.route.dropoff ?? { lat: location.lat, lng: location.lng };
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`);
  }

  async function pickImage(setValue: (uri: string | null) => void) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Photo access is required for driver onboarding documents.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setValue(result.assets[0].uri);
    }
  }

  async function loadDriverWork() {
    if (!token) {
      return;
    }
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
    if (!token || !orderId) {
      return;
    }
    await useCurrentLocation();
    await run("Sharing live driver location", () => api.sendDriverLocation(token, orderId, location.lat, location.lng));
  }

  async function submitDriverOnboarding() {
    if (!token) {
      return;
    }
    if (!driverFullName || !driverAadhaarLast4 || !selectedAadhaarFront || !selectedAadhaarBack || !selectedSelfie) {
      Alert.alert("Driver onboarding", "Please complete the onboarding form and attach Aadhaar front/back and a selfie.");
      return;
    }

    const response = await run("Submitting driver onboarding with uploads", async () => {
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

      const frontUrl = (frontAsset as { url: string }).url;
      const backUrl = (backAsset as { url: string }).url;
      const selfieUrl = (selfieAsset as { url: string }).url;

      return api.submitDriverOnboarding(token, {
        fullName: driverFullName,
        aadhaarLast4: driverAadhaarLast4,
        aadhaarFrontUrl: frontUrl,
        aadhaarBackUrl: backUrl,
        selfieUrl: selfieUrl,
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
    if (!token) {
      return;
    }
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
    if (!token) {
      return;
    }
    if (!restaurantName || !restaurantAddress || !restaurantPhone) {
      Alert.alert("Restaurant onboarding", "Please provide name, address, and contact phone.");
      return;
    }
    await run("Submitting restaurant onboarding", () => api.onboardRestaurant(token, {
      name: restaurantName,
      address: restaurantAddress,
      contactName: restaurantName,
      contactPhone: restaurantPhone,
      cuisineType: restaurantCuisine || "General",
      fssaiLicense: "",
      gstNumber: "",
      bankAccountLast4: ""
    }));
    await loadRestaurantPanel();
  }

  async function addMenuItem() {
    if (!token || !restaurantAccounts[0]?.id) {
      return;
    }
    if (!restaurantName) {
      Alert.alert("Menu item", "Enter restaurant name and item details first.");
      return;
    }
    await run("Adding menu item", () => api.createMenuItem(token, restaurantAccounts[0].id, {
      name: `${restaurantName} Menu Item`,
      description: "Created from mobile operations app",
      pricePaise: 29900,
      photoUrl: "",
      isVeg: true,
      cuisineType: restaurantCuisine || "General",
      rating: 4.0
    }));
  }

  async function importMobileMenu() {
    if (!token || !restaurantAccounts[0]?.id) {
      return;
    }
    if (googlePlaces.length === 0) {
      Alert.alert("Import menu", "Load Google Places restaurants first to import menu items.");
      return;
    }
    const items = googlePlaces.slice(0, 3).map(place => ({
      name: place.name,
      description: `Imported restaurant item (rating ${place.rating})`,
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
    if (!token) {
      return;
    }
    if (!selectedAadhaarFront || !selectedAadhaarBack || !selectedSelfie) {
      Alert.alert("Verification checks", "Select Aadhaar front, back, and selfie before running verification.");
      return;
    }
    await run("Running Azure verification checks", async () => {
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

      const frontUrl = (frontAsset as { url: string }).url;
      const backUrl = (backAsset as { url: string }).url;
      const selfieUrl = (selfieAsset as { url: string }).url;

      await api.verifyAzureOcr(token, frontUrl);
      await api.verifyAzureFace(token, selfieUrl, frontUrl);
    });
  }

  async function loadAdmin() {
    if (!token) {
      return;
    }
    await run("Loading admin operations", async () => {
      const [dash, restaurantsList, users, orders, reports, liveOrders, drivers, load, zoneList, offerList, campaignList, incentiveList, payouts, tickets, audits, checks, jobs, predictions, onboardingApps, referrals] = await Promise.all([
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
      setDashboard(dash);
      setAdminRestaurants(restaurantsList);
      setAdminUsers(users);
      setAdminOrders(orders);
      setPaymentReports(reports);
      setDeliveryOrders(liveOrders);
      setDeliveryDrivers(drivers);
      setDriverLoad(load);
      setZones(zoneList);
      setOffers(offerList);
      setCampaigns(campaignList);
      setIncentives(incentiveList);
      setAdminPayouts(payouts);
      setSupportTickets(tickets);
      setAuditLogs(audits);
      setVerificationChecks(checks);
      setAnalyticsJobs(jobs);
      setDemandPredictions(predictions);
      setDriverApplications(onboardingApps);
      setDriverReferrals(referrals);
    });
  }

  const routeLine = useMemo(() => {
    if (!eta) {
      return [];
    }
    return [eta.route.origin, eta.route.pickup, eta.route.dropoff];
  }, [eta]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>AmberKitchen Mobile</Text>
        <Text style={styles.subtitle}>React Native app for iPhone and Android.</Text>

        <Card title="Login">
          <Text style={styles.notice}>{notice}</Text>
          <Text style={[styles.status, isOffline && styles.statusOffline]}>{isOffline ? "Offline connection detected" : loading ? "Loading..." : error ? `Error: ${error}` : `Role: ${titleCase(role)}`}</Text>
          <Text style={styles.helperText}>{roleHelp}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
          <TextInput style={styles.input} value={otp} onChangeText={setOtp} placeholder="OTP" keyboardType="number-pad" />
          <Segmented values={roleOptions} value={role} onChange={next => setRole(next as Role)} />
          <View style={styles.actions}>
            <Button label="Send OTP" onPress={requestOtp} />
            <Button label="Verify OTP" onPress={verifyOtp} />
          </View>
          <TextInput style={styles.input} value={googleIdToken} onChangeText={setGoogleIdToken} placeholder="Google ID token for mobile login" />
          <Button label="Login With Google Token" onPress={loginWithGoogleToken} />
          <View style={styles.actions}>
            <Button label="Use Location" onPress={useCurrentLocation} />
            <Button label="Enable Push" onPress={enablePush} disabled={!authed} />
            <Button label="Test Push" onPress={sendPushTest} disabled={!authed} />
            {authed ? <Button label="Logout" onPress={logout} /> : null}
          </View>
        </Card>

        <Segmented values={availableTabs} value={tab} onChange={next => setTab(next as Tab)} />

        {tab === "driver" && (
          <Card title="Delivery Partner App">
            <Text style={styles.sectionHint}>Start here to onboard safely, accept deliveries and stay visible while on shift.</Text>
            <View style={styles.actions}>
              <Button label="Load driver workspace" onPress={loadDriverWork} disabled={!authed} />
              <Button label="Run background check" onPress={() => token && run("Background check", () => api.runDriverBackgroundCheck(token))} disabled={!authed} />
              <Button label="Share live location" onPress={shareDriverLocation} disabled={!orderId} />
            </View>
            <Text style={styles.sectionTitle}>Driver onboarding</Text>
            <TextInput style={styles.input} value={driverFullName} onChangeText={setDriverFullName} placeholder="Full name" />
            <TextInput style={styles.input} value={driverAadhaarLast4} onChangeText={setDriverAadhaarLast4} placeholder="Aadhaar last 4 digits" keyboardType="number-pad" />
            <TextInput style={styles.input} value={driverBankLast4} onChangeText={setDriverBankLast4} placeholder="Bank account last 4 digits" keyboardType="number-pad" />
            <TextInput style={styles.input} value={driverUpiId} onChangeText={setDriverUpiId} placeholder="UPI ID" />
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
            <View style={styles.actions}>
              <Button label="Submit onboarding" onPress={submitDriverOnboarding} disabled={!authed} />
              <Button label="Run verification checks" onPress={runVerificationChecks} disabled={!authed} />
            </View>
            {driverApplication && <Summary title="Onboarding" lines={[driverApplication.full_name, `OCR: ${driverApplication.ocr_status}`, `Selfie: ${driverApplication.selfie_status}`, `Approval: ${driverApplication.approval_status}`]} />}
            {incentives.slice(0, 2).map(item => <ListItem key={item.id} title={item.title} subtitle={`${item.target_deliveries} deliveries | ${formatCurrency(item.reward_paise)}`} />)}
            {driverOrders.map(item => (
              <ListItem key={item.id} title={`${item.restaurant_name} -> ${item.delivery_address}`} subtitle={`${item.status} | ${formatCurrency(item.total_paise)}`} onPress={() => {
                setOrderId(item.id);
                void (token && api.acceptDeliveryOrder(token, item.id));
              }} />
            ))}
            <View style={styles.actions}>
              <Button label="Picked Up" onPress={() => token && orderId && api.updateOrderStatus(token, orderId, "picked_up")} disabled={!orderId} />
              <Button label="Delivered" onPress={() => token && orderId && api.updateOrderStatus(token, orderId, "delivered")} disabled={!orderId} />
              <Button label="Request Payout" onPress={() => token && api.requestPayout(token, 50000, "upi", "driver@upi")} disabled={!authed} />
            </View>
            {wallet && <Summary title="Wallet + Earnings" lines={[`Balance: ${formatCurrency(wallet.wallet.balance_paise)}`, `Earnings: ${formatCurrency(Number(wallet.earnings.earned_paise ?? 0))}`, `Deliveries: ${wallet.earnings.deliveries}`]} />}
            {walletTransactions.slice(0, 3).map(item => <ListItem key={item.id} title={`${item.type} ${formatCurrency(item.amount_paise)}`} subtitle={item.status} />)}
          </Card>
        )}

        {tab === "restaurant" && (
          <Card title="Restaurant Panel">
            <Text style={styles.sectionHint}>Use restaurant mode to approve menus, monitor earnings, and manage your first active orders.</Text>
            <Text style={styles.sectionTitle}>Restaurant onboarding details</Text>
            <TextInput style={styles.input} value={restaurantName} onChangeText={setRestaurantName} placeholder="Restaurant name" />
            <TextInput style={styles.input} value={restaurantAddress} onChangeText={setRestaurantAddress} placeholder="Restaurant address" />
            <TextInput style={styles.input} value={restaurantPhone} onChangeText={setRestaurantPhone} placeholder="Contact phone" keyboardType="phone-pad" />
            <TextInput style={styles.input} value={restaurantCuisine} onChangeText={setRestaurantCuisine} placeholder="Cuisine type" />
            <View style={styles.actions}>
              <Button label="Onboard restaurant" onPress={onboardRestaurant} disabled={!authed} />
              <Button label="Load restaurant panel" onPress={loadRestaurantPanel} disabled={!authed} />
            </View>
            <Text style={styles.sectionHint}>After onboarding, load your restaurant panel, then add menu items or import sample photos for launch testing.</Text>
            <View style={styles.actions}>
              <Button label="Add menu item" onPress={addMenuItem} disabled={!restaurantAccounts[0]?.id} />
              <Button label="Import menu items" onPress={importMobileMenu} disabled={!restaurantAccounts[0]?.id} />
            </View>
            {restaurantAccounts.map(item => <ListItem key={item.id} title={item.name} subtitle={`${item.approval_status} | ${item.onboarding_status}`} />)}
            {restaurantOrders.map(item => (
              <ListItem key={item.id} title={`Order ${item.status}`} subtitle={formatCurrency(item.total_paise)} onPress={() => token && api.decideRestaurantOrder(token, item.id, "accepted")} />
            ))}
            {restaurantEarnings && <Summary title="Restaurant Earnings" lines={[`${restaurantEarnings.orders} orders`, `Gross ${formatCurrency(Number(restaurantEarnings.gross_paise))}`, `Payout ${formatCurrency(Number(restaurantEarnings.estimated_payout_paise))}`]} />}
          </Card>
        )}

        {tab === "admin" && (
          <Card title="Admin + Operations Dashboard">
            <Text style={styles.sectionHint}>Admin mode gives you a concise control plane for launch readiness: platform health, approvals, orders, and payouts.</Text>
            <View style={styles.actions}>
              <Button label="Load admin dashboard" onPress={loadAdmin} disabled={!authed} />
              <Button label="Run demand prediction" onPress={() => token && run("Running AI demand prediction", () => api.runDemandPredictionJob(token))} disabled={!authed} />
            </View>
            <View style={styles.actions}>
              <Button label="Assign best driver" onPress={() => token && orderId && api.assignBestDriver(token, orderId)} disabled={!orderId} />
              <Button label="Assign first available driver" onPress={() => token && orderId && deliveryDrivers[0]?.id && api.assignDriver(token, orderId, deliveryDrivers[0].id)} disabled={!orderId || !deliveryDrivers[0]} />
            </View>
            <View style={styles.actions}>
              <Button label="Create zone" onPress={() => token && api.createZone(token, "Mobile Zone", "Delhi NCR", location.lat, location.lng, 3, 20)} disabled={!authed} />
              <Button label="Create offer" onPress={() => token && api.createOffer(token, "MOBILE50", "Mobile Offer", "flat", 5000, 19900)} disabled={!authed} />
            </View>
            <View style={styles.actions}>
              <Button label="Create campaign" onPress={() => token && api.createCampaign(token, "Mobile Push Campaign", "push", 100000, "AI mobile lunch creative")} disabled={!authed} />
              <Button label="Create incentive" onPress={() => token && api.createDriverIncentive(token, "Mobile delivery bonus", 5, 7500)} disabled={!authed} />
            </View>
            {dashboard && <Summary title="Platform Analytics" lines={[`Users ${dashboard.users}`, `Revenue ${formatCurrency(dashboard.revenuePaise)}`, `${dashboard.recentOrders.length} recent orders`]} />}
            <Text style={styles.sectionTitle}>User Management</Text>
            {adminUsers.slice(0, 4).map(item => <ListItem key={item.id} title={item.name ?? item.phone ?? item.email ?? item.id} subtitle={item.role} />)}
            <Text style={styles.sectionTitle}>Restaurant Approvals</Text>
            {adminRestaurants.slice(0, 5).map(item => (
              <ListItem key={item.id} title={item.name} subtitle={item.approval_status} onPress={() => token && api.updateRestaurantApproval(token, item.id, "approved")} />
            ))}
            <Text style={styles.sectionTitle}>Order + Payment Monitoring</Text>
            {adminOrders.slice(0, 4).map(item => <ListItem key={item.id} title={`${item.restaurant_name} ${item.status}`} subtitle={formatCurrency(item.total_paise)} />)}
            {paymentReports.map(item => <ListItem key={`${item.provider}-${item.status}`} title={`${item.provider} ${item.status}`} subtitle={`${item.transactions} tx | ${formatCurrency(item.amount_paise)}`} />)}
            <Text style={styles.sectionTitle}>Live Tracking + Driver Load</Text>
            {deliveryOrders.slice(0, 3).map(item => <ListItem key={item.id} title={`${item.restaurant_name} ${item.status}`} subtitle={`${item.last_driver_lat ?? "-"}, ${item.last_driver_lng ?? "-"}`} />)}
            {driverLoad.slice(0, 3).map(item => <ListItem key={item.id} title={item.phone ?? item.id} subtitle={`Active ${item.active_orders} | capacity ${item.capacity_score}`} />)}
            <Text style={styles.sectionTitle}>Zones, Campaigns, Incentives</Text>
            {zones.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.name} ${item.city}`} subtitle={`SLA ${item.sla_minutes} min | surge ${item.surge_multiplier}`} />)}
            {campaigns.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.name} ${item.channel}`} subtitle={`${item.status} | ${formatCurrency(item.budget_paise)}`} />)}
            {incentives.slice(0, 2).map(item => <ListItem key={item.id} title={item.title} subtitle={`${item.target_deliveries} deliveries | ${formatCurrency(item.reward_paise)}`} />)}
            {analyticsJobs.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.job_type} ${item.status}`} subtitle={item.created_at} />)}
            {demandPredictions.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.zone_key} ${item.predicted_orders} orders`} subtitle={`${item.cuisine_type ?? "all cuisines"} | confidence ${item.confidence}`} />)}
            <Text style={styles.sectionTitle}>Driver Onboarding Admin</Text>
            {driverApplications.slice(0, 2).map(item => (
              <ListItem key={item.id} title={`${item.full_name} ${item.approval_status}`} subtitle={`OCR ${item.ocr_status} | Selfie ${item.selfie_status}`} onPress={() => token && api.updateDriverApplicationApproval(token, item.id, "approved", "Approved from mobile admin")} />
            ))}
            {driverReferrals.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.referral_code} ${item.status}`} subtitle={`${item.referrer_phone ?? "-"} -> ${item.referred_phone ?? "-"} | ${formatCurrency(item.reward_paise)}`} />)}
            <Text style={styles.sectionTitle}>Payouts, Support, Security</Text>
            {adminPayouts.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.role} payout ${item.status}`} subtitle={`${item.phone ?? "-"} | ${formatCurrency(item.amount_paise)}`} onPress={() => token && api.updatePayoutApproval(token, item.id, "approved", "Approved from mobile admin")} />)}
            {supportTickets.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.category} ${item.status}`} subtitle={item.subject} />)}
            {auditLogs.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.method} ${item.path}`} subtitle={`HTTP ${item.status_code}`} />)}
            {verificationChecks.slice(0, 2).map(item => <ListItem key={item.id} title={`${item.provider} ${item.check_type}`} subtitle={item.status} />)}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MobileMap({ location, order, routeLine }: {
  location: { lat: number; lng: number };
  order: OrderSummary | null;
  routeLine: Array<{ lat: number; lng: number }>;
}) {
  const markers = [
    { key: "current", title: "Current", coordinate: { latitude: location.lat, longitude: location.lng } },
    ...(order ? [{ key: "dropoff", title: "Dropoff", coordinate: { latitude: Number(order.delivery_lat), longitude: Number(order.delivery_lng) } }] : [])
  ];
  return (
    <MapView
      style={styles.map}
      initialRegion={{ latitude: location.lat, longitude: location.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      region={{ latitude: location.lat, longitude: location.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
    >
      {markers.map(marker => <Marker key={marker.key} title={marker.title} coordinate={marker.coordinate} />)}
      {routeLine.length > 1 && (
        <Polyline
          coordinates={routeLine.map(point => ({ latitude: point.lat, longitude: point.lng }))}
          strokeColor="#0f766e"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
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
    <Pressable style={styles.listItem} onPress={onPress}>
      <Text style={styles.listTitle}>{title}</Text>
      {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

function Summary({ title, lines }: { title: string; lines: string[] }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {lines.map(line => <Text key={line} style={styles.summaryLine}>{line}</Text>)}
    </View>
  );
}

function formatCurrency(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f7f4ef"
  },
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 40
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#12312d"
  },
  subtitle: {
    color: "#64748b",
    fontSize: 15
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  sectionTitle: {
    fontWeight: "800",
    color: "#334155"
  },
  notice: {
    backgroundColor: "#f8fafc",
    color: "#334155",
    padding: 10,
    borderRadius: 6
  },
  status: {
    color: "#0f766e",
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 6
  },
  statusOffline: {
    color: "#b91c1c"
  },
  input: {
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 6,
    padding: Platform.OS === "ios" ? 12 : 9,
    backgroundColor: "#ffffff"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  button: {
    backgroundColor: "#0f766e",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8"
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  uploadPreviews: {
    justifyContent: "flex-start"
  },
  uploadPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginTop: 8
  },
  segmented: {
    gap: 8,
    paddingVertical: 2
  },
  segment: {
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff"
  },
  segmentActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  segmentText: {
    color: "#334155",
    fontWeight: "700"
  },
  segmentTextActive: {
    color: "#ffffff"
  },
  map: {
    height: 280,
    borderRadius: 8,
    overflow: "hidden"
  },
  listItem: {
    padding: 12,
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#ffffff"
  },
  listTitle: {
    fontWeight: "800",
    color: "#1f2937"
  },
  listSubtitle: {
    color: "#64748b",
    marginTop: 4
  },
  summary: {
    gap: 4,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12
  },
  helperText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8
  },
  sectionHint: {
    color: "#475569",
    fontSize: 14,
    marginBottom: 10
  },
  summaryLine: {
    color: "#334155"
  }
});

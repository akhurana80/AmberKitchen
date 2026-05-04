import 'dart:async';
import 'dart:convert';

import 'package:app_links/app_links.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'config.dart';
import 'customer_repository.dart';

const apiBaseUrl = AppConfig.apiBaseUrl;
const googleClientId = AppConfig.googleClientId;
const googleServerClientId = AppConfig.googleServerClientId;
const serviceRegionName = AppConfig.serviceRegionName;
final serviceRegionCenter = GeoPoint(
  lat: AppConfig.serviceRegionLat,
  lng: AppConfig.serviceRegionLng,
);

enum CustomerScreenKey {
  auth,
  home,
  location,
  restaurants,
  cart,
  checkout,
  payment,
  tracking,
  orders,
  profile,
  support,
}

class ScreenLoadState {
  const ScreenLoadState({
    this.loading = false,
    this.error,
    this.offline = false,
    this.updatedAt,
  });

  final bool loading;
  final String? error;
  final bool offline;
  final DateTime? updatedAt;

  ScreenLoadState copyWith({
    bool? loading,
    String? error,
    bool clearError = false,
    bool? offline,
    DateTime? updatedAt,
  }) {
    return ScreenLoadState(
      loading: loading ?? this.loading,
      error: clearError ? null : error ?? this.error,
      offline: offline ?? this.offline,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

void main() {
  runApp(const AmberKitchenFlutterApp());
}

class AmberKitchenFlutterApp extends StatefulWidget {
  const AmberKitchenFlutterApp({super.key});

  @override
  State<AmberKitchenFlutterApp> createState() => _AmberKitchenFlutterAppState();
}

class _AmberKitchenFlutterAppState extends State<AmberKitchenFlutterApp> {
  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) {
        final state = CustomerAppState(
          repository:
              CustomerRepository(api: AmberApiClient(baseUrl: apiBaseUrl)),
          storage: const FlutterSecureStorage(),
        );
        unawaited(state.initialize());
        return state;
      },
      child: MaterialApp(
        title: 'AmberKitchen',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff0f766e)),
          useMaterial3: true,
          scaffoldBackgroundColor: const Color(0xfff7f4ef),
          inputDecorationTheme:
              const InputDecorationTheme(border: OutlineInputBorder()),
        ),
        home: Consumer<CustomerAppState>(
          builder: (context, state, _) => CustomerShell(state: state),
        ),
      ),
    );
  }
}

class CustomerAppState extends ChangeNotifier with WidgetsBindingObserver {
  CustomerAppState({required this.repository, required this.storage});

  static const tokenStorageKey = 'amberkitchen.customer.token';
  static const lastOrderStorageKey = 'amberkitchen.customer.lastOrderId';
  static const cartStorageKey = 'amberkitchen.customer.cart';
  static const checkoutIntentStorageKey =
      'amberkitchen.customer.checkoutIntent';

  final CustomerRepository repository;
  final FlutterSecureStorage storage;
  final AppLinks paymentLinks = AppLinks();
  final filters = RestaurantFilters();
  final cart = CustomerCart();

  bool initialized = false;
  bool busy = false;
  bool offline = false;
  String? error;
  String? notice;
  String? configError;
  int tabIndex = 0;
  double? currentLat;
  double? currentLng;
  String deliveryAddress = '';
  String selectedPaymentProvider = 'phonepe';
  String? selectedRestaurantId;
  List<MenuSearchItem> menuItems = [];
  List<TrendingRestaurant> trending = [];
  List<Offer> offers = [];
  List<OrderSummary> orders = [];
  OrderDetails? activeOrder;
  OrderEta? activeEta;
  List<EtaEvent> etaEvents = [];
  GeoPoint? liveDriverLocation;
  String trackingStatus = 'Tracking starts after checkout.';
  String? locationProblem;
  String? trackingMapProblem;
  bool trackingLiveConnected = false;
  bool mapFallbackEnabled = false;
  DateTime? lastDriverLocationAt;
  DateTime? lastTrackingRefreshAt;
  String paymentStatus = '';
  String paymentStage = 'not_started';
  PaymentStart? activePaymentStart;
  PaymentStatusSnapshot? paymentSnapshot;
  io.Socket? socket;
  Timer? trackingTimer;
  Timer? paymentStatusTimer;
  StreamSubscription<Uri>? paymentLinkSubscription;
  String? checkoutIntentKey;
  String? checkoutIntentHash;
  final screenStates = {
    for (final key in CustomerScreenKey.values) key: const ScreenLoadState()
  };

  bool get signedIn => repository.signedIn;
  bool get hasServiceRegionConfig =>
      serviceRegionCenter.lat != 0 || serviceRegionCenter.lng != 0;
  int get cartTotalPaise => cartPricing.totalPaise;
  Offer? get appliedOffer {
    final code = cart.couponCode.trim().toUpperCase();
    if (code.isEmpty) {
      return null;
    }
    return offers
        .where((offer) => offer.code.toUpperCase() == code)
        .firstOrNull;
  }

  String? get couponProblem {
    final code = cart.couponCode.trim().toUpperCase();
    if (code.isEmpty) {
      return null;
    }
    final offer = appliedOffer;
    if (offer == null) {
      return 'Coupon is not active for this account.';
    }
    if (cart.subtotalPaise < offer.minOrderPaise) {
      return 'Add ${formatCurrency(offer.minOrderPaise - cart.subtotalPaise)} more to use $code.';
    }
    return null;
  }

  CartPricing get cartPricing =>
      cart.pricingFor(offer: couponProblem == null ? appliedOffer : null);
  bool get canCheckout =>
      cart.lines.isNotEmpty &&
      deliveryAddress.trim().length >= 5 &&
      currentLat != null &&
      currentLng != null;
  bool get hasConfig => configError == null;
  bool get shouldUseTrackingFallback =>
      mapFallbackEnabled || locationProblem != null;
  bool get hasActiveTrackingOrder {
    final status = activeOrder?.status;
    return status != null &&
        !{'delivered', 'cancelled'}.contains(status.toLowerCase());
  }

  bool get isDriverLocationStale {
    if (!hasActiveTrackingOrder || lastDriverLocationAt == null) {
      return false;
    }
    return DateTime.now().difference(lastDriverLocationAt!).inMinutes >= 3;
  }

  int? get deliveryDelayMinutes {
    final promised = parseDateTime(activeOrder?.estimatedDeliveryAt ??
        activeEta?.currentEstimatedDeliveryAt);
    final predicted = parseDateTime(activeEta?.predictedDeliveryAt);
    if (promised == null || predicted == null) {
      return null;
    }
    final minutes = predicted.difference(promised).inMinutes;
    return minutes > 5 ? minutes : null;
  }

  String? get trackingDelayMessage {
    final delay = deliveryDelayMinutes;
    if (delay != null) {
      return 'ETA delayed by $delay min. We are refreshing the route automatically.';
    }
    if (isDriverLocationStale) {
      return 'Driver location is delayed. ETA fallback refresh is active.';
    }
    return null;
  }

  String get driverMarkerStatus {
    if (liveDriverLocation == null) {
      return activeOrder?.driverPhone == null
          ? 'Driver assignment pending.'
          : 'Waiting for first driver location.';
    }
    final age = lastDriverLocationAt == null
        ? null
        : DateTime.now().difference(lastDriverLocationAt!);
    if (age == null || age.inSeconds < 60) {
      return 'Driver marker updated just now.';
    }
    return 'Driver marker updated ${age.inMinutes} min ago.';
  }

  List<RestaurantSummary> get restaurantSummaries {
    final byRestaurant = <String, RestaurantSummary>{};
    for (final item in menuItems) {
      final existing = byRestaurant[item.restaurantId];
      if (existing == null) {
        byRestaurant[item.restaurantId] = RestaurantSummary(
          id: item.restaurantId,
          name: item.restaurantName,
          address: item.restaurantAddress,
          cuisineType: item.cuisineType,
          rating: item.rating,
          startingPricePaise: item.pricePaise,
          photoUrl: item.photoUrl,
          distanceKm: item.distanceKm,
          menuCount: 1,
        );
      } else {
        byRestaurant[item.restaurantId] = existing.copyWith(
          cuisineType: existing.cuisineType ?? item.cuisineType,
          rating: existing.rating ?? item.rating,
          startingPricePaise: item.pricePaise < existing.startingPricePaise
              ? item.pricePaise
              : existing.startingPricePaise,
          photoUrl: existing.photoUrl ?? item.photoUrl,
          distanceKm: existing.distanceKm ?? item.distanceKm,
          menuCount: existing.menuCount + 1,
        );
      }
    }
    for (final restaurant in trending) {
      final existing = byRestaurant[restaurant.id];
      if (existing == null) {
        byRestaurant[restaurant.id] = RestaurantSummary(
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          cuisineType: restaurant.cuisineType,
          rating: restaurant.rating,
          startingPricePaise: restaurant.startingPricePaise ?? 0,
          photoUrl: restaurant.photoUrl,
          distanceKm: restaurant.distanceKm,
          predictedEtaMinutes: restaurant.predictedEtaMinutes,
          menuCount: 0,
        );
      } else {
        byRestaurant[restaurant.id] = existing.copyWith(
          cuisineType: existing.cuisineType ?? restaurant.cuisineType,
          rating: existing.rating ?? restaurant.rating,
          startingPricePaise: existing.startingPricePaise == 0 &&
                  restaurant.startingPricePaise != null
              ? restaurant.startingPricePaise!
              : existing.startingPricePaise,
          photoUrl: existing.photoUrl ?? restaurant.photoUrl,
          distanceKm: existing.distanceKm ?? restaurant.distanceKm,
          predictedEtaMinutes: restaurant.predictedEtaMinutes,
        );
      }
    }
    final restaurants = byRestaurant.values.toList();
    restaurants.sort((a, b) {
      switch (filters.sort) {
        case 'rating_desc':
          final ratingCompare = b.ratingValue.compareTo(a.ratingValue);
          if (ratingCompare != 0) return ratingCompare;
          return (a.distanceKm ?? double.infinity)
              .compareTo(b.distanceKm ?? double.infinity);
        case 'price_asc':
          final priceCompare = a.startingPricePaise
              .compareTo(b.startingPricePaise);
          if (priceCompare != 0) return priceCompare;
          return b.ratingValue.compareTo(a.ratingValue);
        case 'price_desc':
          final priceCompare = b.startingPricePaise
              .compareTo(a.startingPricePaise);
          if (priceCompare != 0) return priceCompare;
          return b.ratingValue.compareTo(a.ratingValue);
        case 'eta':
          final etaCompare = (a.predictedEtaMinutes ?? 9999)
              .compareTo(b.predictedEtaMinutes ?? 9999);
          if (etaCompare != 0) return etaCompare;
          return (a.distanceKm ?? double.infinity)
              .compareTo(b.distanceKm ?? double.infinity);
        default:
          final distanceCompare = (a.distanceKm ?? double.infinity)
              .compareTo(b.distanceKm ?? double.infinity);
          if (distanceCompare != 0) {
            return distanceCompare;
          }
          return b.ratingValue.compareTo(a.ratingValue);
      }
    });
    return restaurants;
  }

  RestaurantSummary? get selectedRestaurant {
    final restaurants = restaurantSummaries;
    if (restaurants.isEmpty) {
      return null;
    }
    return restaurants
            .where((restaurant) => restaurant.id == selectedRestaurantId)
            .firstOrNull ??
        restaurants.first;
  }

  List<MenuSearchItem> get selectedRestaurantMenuItems {
    final restaurant = selectedRestaurant;
    if (restaurant == null) {
      return menuItems;
    }
    final selectedItems =
        menuItems.where((item) => item.restaurantId == restaurant.id).toList();
    return selectedItems;
  }

  ScreenLoadState screenState(CustomerScreenKey key) =>
      screenStates[key] ?? const ScreenLoadState();

  CustomerScreenKey screenForTab(int index) {
    return switch (index) {
      0 => CustomerScreenKey.home,
      1 => CustomerScreenKey.restaurants,
      2 => CustomerScreenKey.cart,
      3 => CustomerScreenKey.orders,
      _ => CustomerScreenKey.profile,
    };
  }

  bool canNavigateToTab(int index) {
    return hasConfig && signedIn && index >= 0 && index <= 4;
  }

  void selectTab(int index) {
    if (!canNavigateToTab(index)) {
      error = signedIn
          ? 'This screen is not available until production configuration is ready.'
          : 'Sign in before opening customer screens.';
      notifyListeners();
      return;
    }
    tabIndex = index;
    notifyListeners();
  }

  void openRestaurants() {
    tabIndex = 1;
    notifyListeners();
  }

  void openCart() {
    tabIndex = 2;
    notifyListeners();
  }

  void openOrders() {
    tabIndex = 3;
    notifyListeners();
  }

  Future<void> retryScreen(CustomerScreenKey screen) async {
    switch (screen) {
      case CustomerScreenKey.auth:
        error = null;
        screenStates[screen] = const ScreenLoadState();
        notifyListeners();
        return;
      case CustomerScreenKey.home:
        await refreshCustomerData();
        return;
      case CustomerScreenKey.location:
        await loadLocation();
        return;
      case CustomerScreenKey.restaurants:
        await loadRestaurants();
        return;
      case CustomerScreenKey.cart:
        error = null;
        screenStates[screen] = const ScreenLoadState();
        notifyListeners();
        return;
      case CustomerScreenKey.checkout:
        await checkout();
        return;
      case CustomerScreenKey.payment:
        await refreshPaymentStatus();
        return;
      case CustomerScreenKey.tracking:
        final orderId = activeOrder?.id;
        if (orderId != null) {
          await refreshTracking(orderId);
        }
        return;
      case CustomerScreenKey.orders:
        await loadOrders();
        return;
      case CustomerScreenKey.profile:
      case CustomerScreenKey.support:
        error = null;
        screenStates[screen] = const ScreenLoadState();
        notifyListeners();
        return;
    }
  }

  void selectRestaurant(String restaurantId) {
    selectedRestaurantId = restaurantId;
    tabIndex = 1;
    notifyListeners();
  }

  void setMinRating(double value) {
    filters.minRating = value;
    notifyListeners();
  }

  void setPaymentProvider(String value) {
    selectedPaymentProvider = value;
    notifyListeners();
  }

  void setDeliveryAddress(String value) {
    deliveryAddress = value;
    notifyListeners();
  }

  Future<void> initialize() async {
    if (repository.baseUrl.trim().isEmpty) {
      configError =
          'Set API_BASE_URL at build time before releasing this customer app.';
      initialized = true;
      notifyListeners();
      return;
    }
    if (!hasServiceRegionConfig) {
      configError =
          'Set SERVICE_REGION_LAT and SERVICE_REGION_LNG for $serviceRegionName before releasing this customer app.';
      initialized = true;
      notifyListeners();
      return;
    }

    WidgetsBinding.instance.addObserver(this);
    await _initializeGoogleSignIn();
    await _restoreCart();
    final savedToken = await storage.read(key: tokenStorageKey);
    final savedOrderId = await storage.read(key: lastOrderStorageKey);
    if (savedToken != null && savedToken.isNotEmpty) {
      repository.token = savedToken;
      await refreshCustomerData(orderId: savedOrderId);
      await _initializePaymentLinks();
    }
    initialized = true;
    notifyListeners();
  }

  Future<void> _initializeGoogleSignIn() async {
    try {
      await GoogleSignIn.instance.initialize(
        clientId: googleClientId.isEmpty ? null : googleClientId,
        serverClientId:
            googleServerClientId.isEmpty ? null : googleServerClientId,
      );
    } catch (error) {
      notice =
          'Google Sign-In needs native OAuth configuration before release.';
    }
  }

  Future<void> _initializePaymentLinks() async {
    if (paymentLinkSubscription != null || !signedIn) {
      return;
    }
    try {
      final initialLink = await paymentLinks.getInitialLink();
      if (initialLink != null) {
        await handlePaymentCallback(initialLink);
      }
      paymentLinkSubscription = paymentLinks.uriLinkStream.listen(
        (uri) => unawaited(handlePaymentCallback(uri)),
        onError: (_) {
          paymentStatus = 'Payment return link could not be read.';
          notifyListeners();
        },
      );
    } catch (_) {
      paymentStatus =
          'Payment return links need Android and iOS URL scheme setup.';
      notifyListeners();
    }
  }

  bool _isPaymentCallback(Uri uri) {
    return uri.scheme == 'amberkitchen' &&
        (uri.host == 'payment-callback' || uri.path.contains('payment'));
  }

  bool _isPaymentSuccess(String status) {
    return {
      'paid',
      'success',
      'txn_success',
      'payment_success',
      'completed',
      'captured',
      'authorized',
      'order.paid',
      'payment.captured',
      'payment.authorized',
    }.contains(status);
  }

  bool _isPaymentFailure(String status) {
    return {
      'failed',
      'failure',
      'txn_failure',
      'payment_failed',
      'payment.failed',
      'declined',
      'cancelled',
      'canceled',
      'expired',
      'timed_out',
      'user_dropped',
    }.contains(status);
  }

  Future<void> handlePaymentCallback(Uri uri) async {
    if (!_isPaymentCallback(uri)) {
      return;
    }
    final status = uri.queryParameters['status']?.toLowerCase();
    if (status != null && _isPaymentSuccess(status)) {
      paymentStage = 'success';
      paymentStatus = 'Payment confirmed by gateway return.';
    } else if (status != null && _isPaymentFailure(status)) {
      paymentStage = 'failure';
      paymentStatus = 'Payment was not completed. You can retry.';
    } else {
      paymentStage = 'pending';
      paymentStatus = 'Returned from payment gateway. Checking status...';
    }
    final orderId = uri.queryParameters['orderId'] ?? activeOrder?.id;
    if (orderId != null && orderId.isNotEmpty) {
      await refreshPaymentStatus(orderId: orderId, silent: true);
    }
    tabIndex = 3;
    notifyListeners();
  }

  Future<void> requestOtp(String phone) async {
    final normalizedPhone = normalizePhone(phone);
    if (normalizedPhone == null) {
      error = 'Enter a valid mobile number.';
      screenStates[CustomerScreenKey.auth] = screenState(CustomerScreenKey.auth)
          .copyWith(error: error, loading: false);
      notifyListeners();
      return;
    }
    await guard('OTP sent', () => repository.requestOtp(normalizedPhone),
        screen: CustomerScreenKey.auth);
  }

  Future<void> verifyOtp(String phone, String otp) async {
    final normalizedPhone = normalizePhone(phone);
    if (normalizedPhone == null || otp.trim().isEmpty) {
      error = 'Enter a valid mobile number and OTP.';
      screenStates[CustomerScreenKey.auth] = screenState(CustomerScreenKey.auth)
          .copyWith(error: error, loading: false);
      notifyListeners();
      return;
    }
    final session = await guard<AuthSession>(
        'Signed in', () => repository.verifyOtp(normalizedPhone, otp.trim()),
        screen: CustomerScreenKey.auth);
    if (session?.token != null) {
      await _persistToken(session!.token!);
      await refreshCustomerData();
      await _initializePaymentLinks();
    }
  }

  Future<void> signInWithGoogle() async {
    await guard('Google sign-in complete', () async {
      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        throw const ApiException(
            'Google Sign-In is not available on this platform build.');
      }
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const ApiException(
            'Google did not return an ID token. Check OAuth client setup.');
      }
      final session = await repository.googleLogin(idToken);
      if (session.token != null) {
        await _persistToken(session.token!);
        await refreshCustomerData();
        await _initializePaymentLinks();
      }
      return session;
    }, screen: CustomerScreenKey.auth);
  }

  Future<void> _persistToken(String token) async {
    repository.token = token;
    await storage.write(key: tokenStorageKey, value: token);
  }

  Future<void> _restoreCart() async {
    final raw = await storage.read(key: cartStorageKey);
    if (raw == null || raw.isEmpty) {
      return;
    }
    try {
      cart.restoreFromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } catch (_) {
      await storage.delete(key: cartStorageKey);
    }
  }

  Future<void> _persistCart() async {
    await storage.write(key: cartStorageKey, value: jsonEncode(cart.toJson()));
  }

  Future<void> logout() async {
    socket?.dispose();
    trackingTimer?.cancel();
    paymentStatusTimer?.cancel();
    await paymentLinkSubscription?.cancel();
    paymentLinkSubscription = null;
    repository.token = '';
    cart.clear();
    activeOrder = null;
    activeEta = null;
    activePaymentStart = null;
    paymentSnapshot = null;
    paymentStage = 'not_started';
    paymentStatus = '';
    liveDriverLocation = null;
    trackingLiveConnected = false;
    mapFallbackEnabled = false;
    locationProblem = null;
    trackingMapProblem = null;
    lastDriverLocationAt = null;
    lastTrackingRefreshAt = null;
    trackingStatus = 'Tracking starts after checkout.';
    for (final key in CustomerScreenKey.values) {
      screenStates[key] = const ScreenLoadState();
    }
    orders = [];
    menuItems = [];
    trending = [];
    offers = [];
    await storage.delete(key: tokenStorageKey);
    await storage.delete(key: lastOrderStorageKey);
    await storage.delete(key: cartStorageKey);
    await storage.delete(key: checkoutIntentStorageKey);
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {}
    notifyListeners();
  }

  Future<void> refreshCustomerData({String? orderId}) async {
    if (!signedIn) {
      return;
    }
    await guard('Customer data refreshed', () async {
      await Future.wait([
        loadLocation(silent: true),
        loadRestaurants(),
        loadOrders(),
      ]);
      final nextOrderId =
          orderId?.isNotEmpty == true ? orderId : orders.firstOrNull?.id;
      if (nextOrderId != null && nextOrderId.isNotEmpty) {
        await loadOrder(nextOrderId);
      }
      return true;
    }, quietSuccess: true, screen: CustomerScreenKey.home);
  }

  Future<void> loadLocation({bool silent = false}) async {
    await guard(silent ? null : 'Location updated', () async {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        locationProblem =
            'Turn on location services to show nearby restaurants and delivery tracking.';
        throw ApiException(locationProblem!);
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        locationProblem =
            'Location permission is required for nearby restaurants, checkout, and tracking.';
        throw ApiException(locationProblem!);
      }
      final position = await Geolocator.getCurrentPosition();
      currentLat = position.latitude;
      currentLng = position.longitude;
      filters.lat = currentLat;
      filters.lng = currentLng;
      locationProblem = null;
      return true;
    },
        quietSuccess: silent,
        screen: silent ? null : CustomerScreenKey.location);
  }

  Future<void> loadRestaurants() async {
    if (!signedIn) {
      return;
    }
    await guard('Restaurants updated', () async {
      final searchLat = currentLat ?? serviceRegionCenter.lat;
      final searchLng = currentLng ?? serviceRegionCenter.lng;
      final searchFilters = filters.copyWith(lat: searchLat, lng: searchLng);
      final responses = await Future.wait([
        repository.searchRestaurants(searchFilters),
        repository.trendingRestaurants(lat: searchLat, lng: searchLng),
        repository.marketplaceOffers(),
      ]);
      menuItems = responses[0] as List<MenuSearchItem>;
      trending = responses[1] as List<TrendingRestaurant>;
      offers = responses[2] as List<Offer>;
      final restaurantIds = {
        ...menuItems.map((item) => item.restaurantId),
        ...trending.map((restaurant) => restaurant.id),
      };
      if (restaurantIds.isNotEmpty &&
          (selectedRestaurantId == null ||
              !restaurantIds.contains(selectedRestaurantId))) {
        selectedRestaurantId = restaurantIds.first;
      }
      return true;
    }, quietSuccess: true, screen: CustomerScreenKey.restaurants);
  }

  void addToCart(MenuSearchItem item) {
    error = null;
    try {
      cart.add(item);
      notice = '${item.menuItemName} added to cart.';
      unawaited(_persistCart());
    } on ApiException catch (exception) {
      error = exception.message;
    }
    notifyListeners();
  }

  void incrementCart(String menuItemId) {
    cart.increment(menuItemId);
    unawaited(_persistCart());
    notifyListeners();
  }

  void decrementCart(String menuItemId) {
    cart.decrement(menuItemId);
    unawaited(_persistCart());
    notifyListeners();
  }

  void removeFromCart(String menuItemId) {
    cart.remove(menuItemId);
    unawaited(_persistCart());
    notifyListeners();
  }

  void updateCartLineModifiers(
    String menuItemId, {
    String? spiceLevel,
    bool? includeCutlery,
    String? specialInstructions,
  }) {
    cart.updateModifiers(
      menuItemId,
      spiceLevel: spiceLevel,
      includeCutlery: includeCutlery,
      specialInstructions: specialInstructions,
    );
    unawaited(_persistCart());
    notifyListeners();
  }

  void applyCoupon(String code) {
    cart.applyCoupon(code);
    final problem = couponProblem;
    error = problem;
    notice = problem == null && cart.couponCode.isNotEmpty
        ? '${cart.couponCode} applied.'
        : null;
    unawaited(_persistCart());
    notifyListeners();
  }

  void removeCoupon() {
    cart.removeCoupon();
    error = null;
    notice = 'Coupon removed.';
    unawaited(_persistCart());
    notifyListeners();
  }

  String _checkoutFingerprint(String restaurantId) {
    return jsonEncode({
      'restaurantId': restaurantId,
      'deliveryAddress': deliveryAddress.trim(),
      'deliveryLat': currentLat?.toStringAsFixed(6),
      'deliveryLng': currentLng?.toStringAsFixed(6),
      'couponCode': cart.couponCode.trim().toUpperCase(),
      'items': cart.toOrderItems().map((item) => item.toJson()).toList(),
    });
  }

  Future<String> _checkoutIdempotencyKey(String restaurantId) async {
    final fingerprint = _checkoutFingerprint(restaurantId);
    if (checkoutIntentKey != null && checkoutIntentHash == fingerprint) {
      return checkoutIntentKey!;
    }
    final saved = await storage.read(key: checkoutIntentStorageKey);
    if (saved != null && saved.isNotEmpty) {
      try {
        final data = Map<String, dynamic>.from(jsonDecode(saved) as Map);
        if (data['fingerprint'] == fingerprint &&
            data['key'] is String &&
            (data['key'] as String).isNotEmpty) {
          checkoutIntentHash = fingerprint;
          checkoutIntentKey = data['key'] as String;
          return checkoutIntentKey!;
        }
      } catch (_) {
        await storage.delete(key: checkoutIntentStorageKey);
      }
    }
    checkoutIntentHash = fingerprint;
    checkoutIntentKey =
        'flutter-checkout-${DateTime.now().microsecondsSinceEpoch}';
    await storage.write(
      key: checkoutIntentStorageKey,
      value: jsonEncode({
        'fingerprint': checkoutIntentHash,
        'key': checkoutIntentKey,
      }),
    );
    return checkoutIntentKey!;
  }

  Future<void> _clearCheckoutIntent() async {
    checkoutIntentKey = null;
    checkoutIntentHash = null;
    await storage.delete(key: checkoutIntentStorageKey);
  }

  Future<void> checkout() async {
    if (!canCheckout) {
      error =
          'Add items, allow location, and enter a delivery address before checkout.';
      notifyListeners();
      return;
    }
    final restaurantId = cart.restaurantId;
    if (restaurantId == null) {
      error = 'Your cart is missing a restaurant. Add items again.';
      notifyListeners();
      return;
    }
    if (couponProblem != null) {
      error = couponProblem;
      notifyListeners();
      return;
    }

    final idempotencyKey = await _checkoutIdempotencyKey(restaurantId);
    final created = await guard<CreateOrderResponse>('Order placed', () {
      return repository.createOrder(
        restaurantId: restaurantId,
        deliveryAddress: deliveryAddress.trim(),
        deliveryLat: currentLat!,
        deliveryLng: currentLng!,
        items: cart.toOrderItems(),
        couponCode: cart.couponCode,
        idempotencyKey: idempotencyKey,
      );
    }, screen: CustomerScreenKey.checkout);

    if (created != null) {
      cart.clear();
      await _persistCart();
      await _clearCheckoutIntent();
      await storage.write(key: lastOrderStorageKey, value: created.id);
      await loadOrder(created.id);
      tabIndex = 3;
      notifyListeners();
    }
  }

  Future<void> editActiveOrderFromCart() async {
    if (activeOrder == null || !canCheckout) {
      return;
    }
    if (couponProblem != null) {
      error = couponProblem;
      notifyListeners();
      return;
    }
    await guard('Order updated', () async {
      await repository.editOrderBeforeConfirmation(
        orderId: activeOrder!.id,
        deliveryAddress: deliveryAddress.trim(),
        deliveryLat: currentLat!,
        deliveryLng: currentLng!,
        items: cart.toOrderItems(),
        couponCode: cart.couponCode,
      );
      await loadOrder(activeOrder!.id);
      return true;
    }, screen: CustomerScreenKey.payment);
  }

  Future<void> startPayment() async {
    if (activeOrder == null) {
      error = 'Place an order before starting payment.';
      notifyListeners();
      return;
    }
    paymentStage = 'pending';
    paymentStatus = 'Creating secure payment request...';
    notifyListeners();
    final payment = await guard<PaymentStart>('Payment initialized', () {
      return repository.createPayment(
        provider: selectedPaymentProvider,
        orderId: activeOrder!.id,
        amountPaise: activeOrder!.totalPaise,
      );
    });
    activePaymentStart = payment;
    final url = payment?.launchUrl;
    if (url == null || url.isEmpty) {
      paymentStage = 'pending';
      paymentStatus =
          'Payment request is ready. Open it with the configured provider SDK or gateway URL.';
      _startPaymentStatusPolling(activeOrder!.id);
      notifyListeners();
      return;
    }
    final launched =
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (launched) {
      paymentStage = 'pending';
      paymentStatus = 'Waiting for secure gateway confirmation.';
      _startPaymentStatusPolling(activeOrder!.id);
    } else {
      paymentStage = 'failure';
      paymentStatus = 'Could not open the payment gateway. Please retry.';
    }
    notifyListeners();
  }

  Future<void> refreshPaymentStatus(
      {String? orderId, bool silent = false}) async {
    final targetOrderId = orderId ?? activeOrder?.id;
    if (!signedIn || targetOrderId == null || targetOrderId.isEmpty) {
      return;
    }
    if (!silent) {
      busy = true;
      error = null;
      screenStates[CustomerScreenKey.payment] =
          screenState(CustomerScreenKey.payment)
              .copyWith(loading: true, clearError: true, offline: false);
      notifyListeners();
    }
    try {
      final snapshot = await repository.paymentStatus(targetOrderId);
      _applyPaymentSnapshot(snapshot);
      if (!silent) {
        screenStates[CustomerScreenKey.payment] =
            screenState(CustomerScreenKey.payment).copyWith(
          loading: false,
          clearError: true,
          offline: false,
          updatedAt: DateTime.now(),
        );
        notice = 'Payment status refreshed.';
      }
    } on ApiException catch (exception) {
      if (!silent) {
        offline = exception.offline;
        error = exception.message;
        screenStates[CustomerScreenKey.payment] =
            screenState(CustomerScreenKey.payment).copyWith(
          loading: false,
          error: exception.message,
          offline: exception.offline,
        );
      }
    } catch (exception) {
      if (!silent) {
        error = exception.toString();
        screenStates[CustomerScreenKey.payment] =
            screenState(CustomerScreenKey.payment).copyWith(
          loading: false,
          error: exception.toString(),
        );
      }
    } finally {
      if (!silent) {
        busy = false;
      }
      notifyListeners();
    }
  }

  void _applyPaymentSnapshot(PaymentStatusSnapshot snapshot) {
    paymentSnapshot = snapshot;
    paymentStage = snapshot.state;
    if (snapshot.isSuccess) {
      paymentStatus = 'Payment successful.';
      paymentStatusTimer?.cancel();
    } else if (snapshot.isFailure) {
      paymentStatus = 'Payment failed or expired. Please retry.';
      paymentStatusTimer?.cancel();
    } else if (snapshot.isPending) {
      paymentStatus = 'Payment pending. Waiting for gateway confirmation.';
    } else {
      paymentStatus = 'No payment has been started for this order.';
      paymentStatusTimer?.cancel();
    }
  }

  void _startPaymentStatusPolling(String orderId) {
    paymentStatusTimer?.cancel();
    paymentStatusTimer = Timer.periodic(
      const Duration(seconds: 8),
      (_) => unawaited(refreshPaymentStatus(orderId: orderId, silent: true)),
    );
  }

  Future<void> loadOrders() async {
    if (!signedIn) {
      return;
    }
    await guard(null, () async {
      orders = await repository.orders();
      return true;
    }, quietSuccess: true, screen: CustomerScreenKey.orders);
  }

  Future<void> loadOrder(String orderId) async {
    if (!signedIn) {
      return;
    }
    await guard(null, () async {
      activeOrder = await repository.getOrder(orderId);
      activeEta = await repository.orderEta(orderId);
      etaEvents = await repository.orderEtaLoop(orderId);
      _syncTrackingFromEta(activeEta);
      await storage.write(key: lastOrderStorageKey, value: orderId);
      await refreshPaymentStatus(orderId: orderId, silent: true);
      connectTracking(orderId);
      return true;
    }, quietSuccess: true, screen: CustomerScreenKey.tracking);
  }

  void _syncTrackingFromEta(OrderEta? eta) {
    if (eta == null) {
      return;
    }
    final driverTime = parseDateTime(eta.driverLocationAt);
    if (driverTime != null) {
      lastDriverLocationAt = driverTime;
      liveDriverLocation = eta.origin;
    }
  }

  void connectTracking(String orderId) {
    socket?.dispose();
    trackingTimer?.cancel();
    trackingLiveConnected = false;
    trackingStatus = 'Connecting to live tracking...';
    final options = io.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': repository.token})
        .enableReconnection()
        .disableAutoConnect()
        .build();
    final nextSocket = io.io(repository.baseUrl, options);
    socket = nextSocket;
    nextSocket.onConnect((_) {
      trackingStatus = 'Live tracking connected.';
      trackingLiveConnected = true;
      nextSocket.emit('order:join', orderId);
      notifyListeners();
    });
    nextSocket.onConnectError((_) {
      trackingLiveConnected = false;
      trackingStatus =
          'Live tracking reconnecting. Latest ETA will continue to refresh.';
      notifyListeners();
    });
    nextSocket.onDisconnect((_) {
      trackingLiveConnected = false;
      trackingStatus =
          'Live tracking disconnected. ETA fallback refresh is active.';
      notifyListeners();
    });
    nextSocket.onError((_) {
      trackingLiveConnected = false;
      trackingStatus =
          'Live tracking is retrying. ETA fallback refresh is active.';
      notifyListeners();
    });
    nextSocket.on('tracking:joined', (_) {
      trackingLiveConnected = true;
      trackingStatus = 'Subscribed to live order tracking.';
      notifyListeners();
    });
    nextSocket.on('tracking:error', (payload) {
      final data = payload is Map
          ? Map<String, dynamic>.from(payload)
          : <String, dynamic>{};
      trackingLiveConnected = false;
      trackingStatus =
          data['message']?.toString() ?? 'Live tracking subscription failed.';
      notifyListeners();
    });
    nextSocket.on('order:update', (_) => unawaited(refreshTracking(orderId)));
    nextSocket.on('driver:location', _handleDriverLocation);
    nextSocket.on('tracking:location', _handleDriverLocation);
    nextSocket.connect();
    trackingTimer = Timer.periodic(const Duration(seconds: 20),
        (_) => unawaited(refreshTracking(orderId)));
  }

  void _handleDriverLocation(dynamic payload) {
    final data = payload is Map
        ? Map<String, dynamic>.from(payload)
        : <String, dynamic>{};
    final lat = valueAsDouble(data['lat']);
    final lng = valueAsDouble(data['lng']);
    if (lat != null && lng != null) {
      liveDriverLocation = GeoPoint(lat: lat, lng: lng);
      lastDriverLocationAt = parseDateTime(data['created_at']?.toString() ??
              data['createdAt']?.toString()) ??
          DateTime.now();
      trackingStatus = 'Driver location updated live.';
      notifyListeners();
    }
  }

  Future<void> refreshTracking(String orderId) async {
    if (!signedIn) {
      return;
    }
    screenStates[CustomerScreenKey.tracking] =
        screenState(CustomerScreenKey.tracking)
            .copyWith(loading: true, clearError: true, offline: false);
    try {
      activeOrder = await repository.getOrder(orderId);
      activeEta = await repository.orderEta(orderId);
      etaEvents = await repository.orderEtaLoop(orderId);
      _syncTrackingFromEta(activeEta);
      lastTrackingRefreshAt = DateTime.now();
      trackingStatus = trackingDelayMessage ?? trackingStatus;
      screenStates[CustomerScreenKey.tracking] =
          screenState(CustomerScreenKey.tracking).copyWith(
        loading: false,
        clearError: true,
        offline: false,
        updatedAt: DateTime.now(),
      );
      if (!hasActiveTrackingOrder) {
        trackingTimer?.cancel();
        trackingLiveConnected = false;
      }
      notifyListeners();
    } on ApiException catch (exception) {
      offline = exception.offline;
      trackingStatus = 'Tracking refresh delayed. We will retry automatically.';
      screenStates[CustomerScreenKey.tracking] =
          screenState(CustomerScreenKey.tracking).copyWith(
        loading: false,
        error: exception.message,
        offline: exception.offline,
      );
      notifyListeners();
    } catch (_) {
      trackingStatus = 'Tracking refresh delayed. We will retry automatically.';
      screenStates[CustomerScreenKey.tracking] =
          screenState(CustomerScreenKey.tracking).copyWith(
        loading: false,
        error: 'Tracking refresh delayed. We will retry automatically.',
      );
      notifyListeners();
    }
  }

  Future<void> cancelActiveOrder(String reason) async {
    if (activeOrder == null) {
      return;
    }
    await guard('Order cancelled', () async {
      await repository.cancelOrder(activeOrder!.id, reason);
      await loadOrder(activeOrder!.id);
      return true;
    }, screen: CustomerScreenKey.orders);
  }

  Future<void> reorder(OrderSummary order) async {
    final created = await guard<CreateOrderResponse>(
        'Reorder placed', () => repository.reorder(order.id),
        screen: CustomerScreenKey.orders);
    if (created != null) {
      await loadOrder(created.id);
      tabIndex = 3;
      notifyListeners();
    }
  }

  Future<void> requestRefund(String reason, {int? amountPaise}) async {
    if (activeOrder == null) {
      return;
    }
    final refund = await guard<RefundRecord>(
        'Refund request submitted',
        () => repository.requestRefund(activeOrder!.id, reason,
            amountPaise: amountPaise),
        screen: CustomerScreenKey.payment);
    if (refund != null) {
      await refreshPaymentStatus(orderId: activeOrder!.id, silent: true);
    }
  }

  Future<void> openNavigation() async {
    final eta = activeEta;
    if (eta == null) {
      error = 'Load an active order before opening navigation.';
      notifyListeners();
      return;
    }
    final origin = '${eta.origin.lat},${eta.origin.lng}';
    final waypoint = '${eta.pickup.lat},${eta.pickup.lng}';
    final destination = '${eta.dropoff.lat},${eta.dropoff.lng}';
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&origin=${Uri.encodeComponent(origin)}&destination=${Uri.encodeComponent(destination)}&waypoints=${Uri.encodeComponent(waypoint)}&travelmode=driving',
    );
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  void useTrackingMapFallback() {
    mapFallbackEnabled = true;
    trackingMapProblem = 'Route summary fallback enabled.';
    notifyListeners();
  }

  Future<void> retryTrackingMap() async {
    mapFallbackEnabled = false;
    trackingMapProblem = null;
    await loadLocation();
    notifyListeners();
  }

  Future<void> callDriver() async {
    final phone = activeOrder?.driverPhone;
    if (phone == null || phone.isEmpty) {
      error = 'A driver has not been assigned yet.';
      notifyListeners();
      return;
    }
    await launchUrl(Uri.parse('tel:$phone'));
  }

  Future<void> contactTrackingSupport() async {
    final order = activeOrder;
    if (order == null) {
      error = 'Load an order before contacting support.';
      notifyListeners();
      return;
    }
    await createSupportTicket(
      'Live tracking help for ${shortId(order.id)}',
      [
        'Order ${shortId(order.id)} tracking needs help.',
        trackingDelayMessage,
        trackingStatus,
        driverMarkerStatus,
      ].whereType<String>().join('\n'),
    );
  }

  Future<void> enablePushNotifications() async {
    await guard('Push notifications enabled', () async {
      try {
        if (Firebase.apps.isEmpty) {
          await Firebase.initializeApp();
        }
      } catch (_) {
        throw const ApiException(
            'Firebase is not configured for this build. Add Android/iOS Firebase files before enabling push.');
      }
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        throw const ApiException('Push notification permission was denied.');
      }
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) {
        throw const ApiException(
            'Firebase did not return a push token. Check Firebase setup.');
      }
      await repository.registerDeviceToken(token);
      return true;
    }, screen: CustomerScreenKey.profile);
  }

  Future<void> createSupportTicket(String subject, String message) async {
    await guard('Support ticket created', () {
      return repository.createSupportTicket(
        category: 'order',
        subject: subject.trim(),
        message: message.trim(),
        orderId: activeOrder?.id,
      );
    }, screen: CustomerScreenKey.support);
  }

  Future<void> createReview(
      String restaurantId, int rating, String comment) async {
    await guard(
        'Review submitted',
        () => repository.createRestaurantReview(
            restaurantId, rating, comment.trim(),
            orderId: activeOrder?.id),
        screen: CustomerScreenKey.profile);
  }

  Future<T?> guard<T>(
    String? successMessage,
    Future<T> Function() work, {
    bool quietSuccess = false,
    CustomerScreenKey? screen,
  }) async {
    busy = true;
    error = null;
    offline = false;
    if (screen != null) {
      screenStates[screen] = screenState(screen).copyWith(
        loading: true,
        clearError: true,
        offline: false,
      );
    }
    notifyListeners();
    try {
      final result = await work();
      if (screen != null) {
        screenStates[screen] = screenState(screen).copyWith(
          loading: false,
          clearError: true,
          offline: false,
          updatedAt: DateTime.now(),
        );
      }
      if (!quietSuccess && successMessage != null) {
        notice = successMessage;
      }
      return result;
    } on ApiException catch (exception) {
      offline = exception.offline;
      error = exception.message;
      if (screen != null) {
        screenStates[screen] = screenState(screen).copyWith(
          loading: false,
          error: exception.message,
          offline: exception.offline,
        );
      }
    } catch (exception) {
      error = exception.toString();
      if (screen != null) {
        screenStates[screen] = screenState(screen).copyWith(
          loading: false,
          error: exception.toString(),
        );
      }
    } finally {
      busy = false;
      notifyListeners();
    }
    return null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && paymentStage == 'pending') {
      unawaited(refreshPaymentStatus(silent: true));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    socket?.dispose();
    trackingTimer?.cancel();
    paymentStatusTimer?.cancel();
    unawaited(paymentLinkSubscription?.cancel() ?? Future<void>.value());
    super.dispose();
  }
}

class CustomerCart {
  final List<CartLine> lines = [];
  String couponCode = '';

  String? get restaurantId => lines.firstOrNull?.item.restaurantId;
  String? get restaurantName => lines.firstOrNull?.item.restaurantName;
  int get subtotalPaise =>
      lines.fold(0, (sum, line) => sum + line.lineTotalPaise);
  int get totalPaise => pricingFor().totalPaise;

  void add(MenuSearchItem item) {
    if (restaurantId != null && restaurantId != item.restaurantId) {
      throw const ApiException(
          'Please checkout or clear your cart before ordering from another restaurant.');
    }
    final existing = lines
        .where((line) => line.item.menuItemId == item.menuItemId)
        .firstOrNull;
    if (existing == null) {
      lines.add(CartLine(item: item));
      return;
    }
    existing.quantity += 1;
  }

  void increment(String menuItemId) {
    final line =
        lines.where((item) => item.item.menuItemId == menuItemId).firstOrNull;
    if (line != null) {
      line.quantity += 1;
    }
  }

  void decrement(String menuItemId) {
    final line =
        lines.where((item) => item.item.menuItemId == menuItemId).firstOrNull;
    if (line == null) {
      return;
    }
    line.quantity -= 1;
    if (line.quantity <= 0) {
      lines.remove(line);
    }
  }

  void remove(String menuItemId) {
    lines.removeWhere((line) => line.item.menuItemId == menuItemId);
  }

  void updateModifiers(
    String menuItemId, {
    String? spiceLevel,
    bool? includeCutlery,
    String? specialInstructions,
  }) {
    final line =
        lines.where((item) => item.item.menuItemId == menuItemId).firstOrNull;
    if (line == null) {
      return;
    }
    if (spiceLevel != null) {
      line.spiceLevel = spiceLevel;
    }
    if (includeCutlery != null) {
      line.includeCutlery = includeCutlery;
    }
    if (specialInstructions != null) {
      line.specialInstructions = specialInstructions;
    }
  }

  void applyCoupon(String code) {
    couponCode = code.trim().toUpperCase();
  }

  void removeCoupon() {
    couponCode = '';
  }

  void clear() {
    lines.clear();
    couponCode = '';
  }

  CartPricing pricingFor({Offer? offer}) {
    final subtotal = subtotalPaise;
    final tax = (subtotal * 0.05).round();
    final platformFee = subtotal >= 19900 ? 900 : 0;
    final deliveryFee = lines.isEmpty || subtotal >= 49900 ? 0 : 3900;
    final discount = offer == null
        ? 0
        : offer.discountType == 'flat'
            ? offer.discountValue
            : (subtotal * offer.discountValue / 100).round();
    final totalBeforeDiscount = subtotal + tax + platformFee + deliveryFee;
    final discountPaise = discount.clamp(0, totalBeforeDiscount).toInt();
    return CartPricing(
      subtotalPaise: subtotal,
      taxPaise: tax,
      platformFeePaise: platformFee,
      deliveryFeePaise: deliveryFee,
      discountPaise: discountPaise,
      totalPaise: (totalBeforeDiscount - discountPaise)
          .clamp(0, totalBeforeDiscount)
          .toInt(),
    );
  }

  List<CartItemRequest> toOrderItems() {
    return lines.map((line) {
      return CartItemRequest(
        name: line.item.menuItemName,
        quantity: line.quantity,
        pricePaise: line.item.pricePaise,
        modifiers: line.modifiers
            .map((modifier) => CartItemModifierRequest(
                  name: modifier.name,
                  pricePaise: modifier.pricePaise,
                ))
            .toList(),
      );
    }).toList();
  }

  Map<String, dynamic> toJson() => {
        'couponCode': couponCode,
        'lines': lines.map((line) => line.toJson()).toList(),
      };

  void restoreFromJson(Map<String, dynamic> json) {
    lines
      ..clear()
      ..addAll(((json['lines'] as List?) ?? const []).map(
          (line) => CartLine.fromJson(Map<String, dynamic>.from(line as Map))));
    couponCode = json['couponCode']?.toString() ?? '';
  }
}

class CartLine {
  CartLine({
    required this.item,
    this.quantity = 1,
    this.spiceLevel = 'Regular',
    this.includeCutlery = false,
    this.specialInstructions = '',
  });

  final MenuSearchItem item;
  int quantity;
  String spiceLevel;
  bool includeCutlery;
  String specialInstructions;

  int get modifierTotalPaise =>
      modifiers.fold(0, (sum, modifier) => sum + modifier.pricePaise);
  int get unitPricePaise => item.pricePaise + modifierTotalPaise;
  int get lineTotalPaise => quantity * unitPricePaise;
  List<CartModifier> get modifiers => [
        if (spiceLevel != 'Regular')
          CartModifier(name: 'Spice level: $spiceLevel', pricePaise: 0),
        if (includeCutlery)
          const CartModifier(name: 'Include cutlery', pricePaise: 0),
        if (specialInstructions.trim().isNotEmpty)
          CartModifier(
              name: 'Instructions: ${specialInstructions.trim()}',
              pricePaise: 0),
      ];

  Map<String, dynamic> toJson() => {
        'item': {
          'menuItemId': item.menuItemId,
          'menuItemName': item.menuItemName,
          'description': item.description,
          'pricePaise': item.pricePaise,
          'photoUrl': item.photoUrl,
          'isVeg': item.isVeg,
          'cuisineType': item.cuisineType,
          'rating': item.rating,
          'restaurantId': item.restaurantId,
          'restaurantName': item.restaurantName,
          'restaurantAddress': item.restaurantAddress,
          'distanceKm': item.distanceKm,
        },
        'quantity': quantity,
        'spiceLevel': spiceLevel,
        'includeCutlery': includeCutlery,
        'specialInstructions': specialInstructions,
      };

  factory CartLine.fromJson(Map<String, dynamic> json) {
    final item = Map<String, dynamic>.from((json['item'] as Map?) ?? const {});
    return CartLine(
      item: MenuSearchItem(
        menuItemId: valueAsString(item['menuItemId']),
        menuItemName: valueAsString(item['menuItemName']),
        description: item['description']?.toString(),
        pricePaise: valueAsInt(item['pricePaise']),
        photoUrl: item['photoUrl']?.toString(),
        isVeg: item['isVeg'] is bool ? item['isVeg'] as bool : null,
        cuisineType: item['cuisineType']?.toString(),
        rating: valueAsDouble(item['rating']),
        restaurantId: valueAsString(item['restaurantId']),
        restaurantName: valueAsString(item['restaurantName']),
        restaurantAddress: valueAsString(item['restaurantAddress']),
        distanceKm: valueAsDouble(item['distanceKm']),
      ),
      quantity: valueAsInt(json['quantity']).clamp(1, 99).toInt(),
      spiceLevel: json['spiceLevel']?.toString() ?? 'Regular',
      includeCutlery: json['includeCutlery'] is bool
          ? json['includeCutlery'] as bool
          : false,
      specialInstructions: json['specialInstructions']?.toString() ?? '',
    );
  }
}

class CartModifier {
  const CartModifier({required this.name, required this.pricePaise});

  final String name;
  final int pricePaise;
}

class CartPricing {
  const CartPricing({
    required this.subtotalPaise,
    required this.taxPaise,
    required this.platformFeePaise,
    required this.deliveryFeePaise,
    required this.discountPaise,
    required this.totalPaise,
  });

  final int subtotalPaise;
  final int taxPaise;
  final int platformFeePaise;
  final int deliveryFeePaise;
  final int discountPaise;
  final int totalPaise;
}

class RestaurantSummary {
  const RestaurantSummary({
    required this.id,
    required this.name,
    required this.address,
    required this.startingPricePaise,
    required this.menuCount,
    this.cuisineType,
    this.rating,
    this.photoUrl,
    this.distanceKm,
    this.predictedEtaMinutes,
  });

  final String id;
  final String name;
  final String address;
  final String? cuisineType;
  final double? rating;
  final int startingPricePaise;
  final String? photoUrl;
  final double? distanceKm;
  final int? predictedEtaMinutes;
  final int menuCount;

  double get ratingValue => rating ?? 0;
  bool get isPremium => rating != null && rating! >= 4.3;
  String get etaBadge => predictedEtaMinutes != null
      ? '$predictedEtaMinutes min'
      : 'ETA TBD';
  String get distanceBadge => distanceKm != null
      ? '${distanceKm!.toStringAsFixed(1)} km'
      : 'Nearby';
  String get priceBadge =>
      startingPricePaise > 0 ? 'From ${formatCurrency(startingPricePaise)}' : 'Price TBD';
  String get listingSubtitle {
    final details = <String>[
      cuisineType ?? 'Cuisine',
      if (rating != null) '${rating!.toStringAsFixed(1)} rating',
      if (predictedEtaMinutes != null) '$predictedEtaMinutes min ETA',
      if (distanceKm != null) '${distanceKm!.toStringAsFixed(1)} km',
      if (menuCount > 0) '$menuCount dishes',
    ];
    return details.join(' • ');
  }

  RestaurantSummary copyWith({
    String? cuisineType,
    double? rating,
    int? startingPricePaise,
    String? photoUrl,
    double? distanceKm,
    int? predictedEtaMinutes,
    int? menuCount,
  }) {
    return RestaurantSummary(
      id: id,
      name: name,
      address: address,
      cuisineType: cuisineType ?? this.cuisineType,
      rating: rating ?? this.rating,
      startingPricePaise: startingPricePaise ?? this.startingPricePaise,
      photoUrl: photoUrl ?? this.photoUrl,
      distanceKm: distanceKm ?? this.distanceKm,
      predictedEtaMinutes: predictedEtaMinutes ?? this.predictedEtaMinutes,
      menuCount: menuCount ?? this.menuCount,
    );
  }
}

class CustomerShell extends StatelessWidget {
  const CustomerShell({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    if (!state.initialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!state.hasConfig) {
      return SetupScreen(message: state.configError!);
    }
    if (!state.signedIn) {
      return AuthScreen(state: state);
    }

    final pages = [
      HomeScreen(state: state),
      RestaurantsScreen(state: state),
      CartScreen(state: state),
      OrdersScreen(state: state),
      ProfileScreen(state: state),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('AmberKitchen'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: state.busy ? null : () => state.refreshCustomerData(),
          ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            IndexedStack(index: state.tabIndex, children: pages),
            if (state.busy) const LinearProgressIndicator(minHeight: 3),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: state.tabIndex,
        onDestinationSelected: state.selectTab,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.restaurant_menu), label: 'Restaurants'),
          NavigationDestination(
              icon: Icon(Icons.shopping_bag_outlined), label: 'Cart'),
          NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined), label: 'Orders'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

class SetupScreen extends StatelessWidget {
  const SetupScreen({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.settings, size: 48),
              const SizedBox(height: 16),
              Text('Production setup required',
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final phone = TextEditingController();
  final otp = TextEditingController();

  @override
  void dispose() {
    phone.dispose();
    otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 24),
            Text('AmberKitchen',
                style: Theme.of(context)
                    .textTheme
                    .headlineLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
                'Sign in to order food, checkout securely, and track delivery live.',
                style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 24),
            const AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Quick start',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                  SizedBox(height: 8),
                  Text('1. Enter your phone number and request OTP, or continue with Google.'),
                  Text('2. Allow location access to unlock nearby restaurants and fast checkout.'),
                  Text('3. Browse restaurants and build your cart to place an order.'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            AppBanner(state: widget.state),
            ScreenStateBanner(
                state: widget.state, screen: CustomerScreenKey.auth),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                      controller: phone,
                      keyboardType: TextInputType.phone,
                      decoration:
                          const InputDecoration(labelText: 'Phone number')),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: widget.state.busy
                        ? null
                        : () => widget.state.requestOtp(phone.text),
                    icon: const Icon(Icons.sms_outlined),
                    label: const Text('Send OTP'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                      controller: otp,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'OTP')),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: widget.state.busy
                        ? null
                        : () => widget.state.verifyOtp(phone.text, otp.text),
                    child: const Text('Verify and Continue'),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: widget.state.busy
                        ? null
                        : widget.state.signInWithGoogle,
                    icon: const Icon(Icons.login),
                    label: const Text('Continue with Google'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final order = state.activeOrder;
    return RefreshIndicator(
      onRefresh: state.refreshCustomerData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppBanner(state: state),
          ScreenStateBanner(state: state, screen: CustomerScreenKey.home),
          if (state.deliveryAddress.trim().isEmpty)
            const AppCard(
              child: Text(
                'Add your delivery address early so checkout is faster and more accurate.',
              ),
            ),
          LocationSelectionScreen(state: state, includeAddressField: true),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Home',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: state.openRestaurants,
                  icon: const Icon(Icons.restaurant_menu),
                  label: const Text('Browse restaurants'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: state.cart.lines.isEmpty ? null : state.openCart,
                  icon: const Icon(Icons.shopping_bag_outlined),
                  label: Text(state.cart.lines.isEmpty
                      ? 'Cart is empty'
                      : 'Review cart'),
                ),
              ],
            ),
          ),
          if (state.offers.isNotEmpty) ...[
            const SectionTitle(title: 'Offers'),
            SizedBox(
              height: 112,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: state.offers.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) =>
                    OfferTile(offer: state.offers[index]),
              ),
            ),
          ],
          if (state.restaurantSummaries.isNotEmpty) ...[
            const SectionTitle(title: 'Premium discovery'),
            SizedBox(
              height: 210,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: state.restaurantSummaries
                    .where((restaurant) => restaurant.isPremium)
                    .take(4)
                    .length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final premium = state.restaurantSummaries
                      .where((restaurant) => restaurant.isPremium)
                      .take(4)
                      .toList()[index];
                  return PremiumDiscoveryTile(
                    restaurant: premium,
                    onTap: () => state.selectRestaurant(premium.id),
                  );
                },
              ),
            ),
          ],
          if (state.trending.isNotEmpty) ...[
            const SectionTitle(title: 'Trending restaurants'),
            ...state.trending.take(4).map(
                  (restaurant) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: ItemImage(url: restaurant.photoUrl, size: 52),
                    title: Text(restaurant.name),
                    subtitle: Text(
                        '${restaurant.cuisineType ?? 'Cuisine'} • ${restaurant.predictedEtaMinutes} min ETA'),
                    trailing: restaurant.distanceKm == null
                        ? null
                        : Text(
                            '${restaurant.distanceKm!.toStringAsFixed(1)} km'),
                    onTap: () => state.selectRestaurant(restaurant.id),
                  ),
                ),
          ],
          const SectionTitle(title: 'Active order'),
          if (order == null)
            const EmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'No active order',
                body: 'Checkout to start live tracking.')
          else
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Order ${shortId(order.id)}',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  StatusPill(status: order.status),
                  const SizedBox(height: 8),
                  SummaryRow(
                      label: 'Total', value: formatCurrency(order.totalPaise)),
                  SummaryRow(
                      label: 'ETA',
                      value: state.activeEta == null
                          ? order.estimatedDeliveryAt ?? 'Calculating'
                          : '${state.activeEta!.predictedEtaMinutes} min'),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: state.openOrders,
                    icon: const Icon(Icons.delivery_dining),
                    label: const Text('Track order'),
                  ),
                ],
              ),
            ),
          const SectionTitle(title: 'Order history'),
          if (state.orders.isEmpty)
            const Text('Your orders will appear here.')
          else
            ...state.orders.take(3).map((item) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Order ${shortId(item.id)}'),
                  subtitle: Text(
                      '${titleCase(item.status)} - ${formatCurrency(item.totalPaise)}'),
                  onTap: () async {
                    await state.loadOrder(item.id);
                    state.openOrders();
                  },
                )),
        ],
      ),
    );
  }
}

class LocationSelectionScreen extends StatelessWidget {
  const LocationSelectionScreen({
    required this.state,
    this.includeAddressField = false,
    this.framed = true,
    super.key,
  });

  final CustomerAppState state;
  final bool includeAddressField;
  final bool framed;

  @override
  Widget build(BuildContext context) {
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Location selection',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        ScreenStateBanner(state: state, screen: CustomerScreenKey.location),
        const Text('$serviceRegionName service area'),
        if (includeAddressField) ...[
          const SizedBox(height: 12),
          TextFormField(
            initialValue: state.deliveryAddress,
            minLines: 2,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Delivery address'),
            onChanged: state.setDeliveryAddress,
          ),
        ],
        const SizedBox(height: 12),
        OutlinedButton.icon(
            onPressed: state.busy ? null : state.loadLocation,
            icon: const Icon(Icons.my_location),
            label: const Text('Use current location')),
        if (state.currentLat != null && state.currentLng != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
                'Location ready: ${state.currentLat!.toStringAsFixed(5)}, ${state.currentLng!.toStringAsFixed(5)}'),
          ),
      ],
    );
    return framed ? AppCard(child: content) : content;
  }
}

class RestaurantsScreen extends StatelessWidget {
  const RestaurantsScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: state.loadRestaurants,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppBanner(state: state),
          ScreenStateBanner(
              state: state, screen: CustomerScreenKey.restaurants),
          PremiumDiscoverySection(state: state),
          RestaurantListingScreen(state: state),
          const SizedBox(height: 12),
          RestaurantDetailsScreen(state: state),
          const SizedBox(height: 12),
          MenuBrowsingScreen(state: state),
        ],
      ),
    );
  }
}

class RestaurantListingScreen extends StatelessWidget {
  const RestaurantListingScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final restaurants = state.restaurantSummaries;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Restaurant listing',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: state.filters.query,
            decoration: const InputDecoration(
                labelText: 'Search dishes or restaurants',
                prefixIcon: Icon(Icons.search)),
            onChanged: (value) => state.filters.query = value,
            onFieldSubmitted: (_) => state.loadRestaurants(),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  initialValue: state.filters.cuisine,
                  decoration: const InputDecoration(labelText: 'Cuisine'),
                  onChanged: (value) => state.filters.cuisine = value,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: state.filters.diet,
                  decoration: const InputDecoration(labelText: 'Diet'),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('All')),
                    DropdownMenuItem(value: 'veg', child: Text('Veg')),
                    DropdownMenuItem(value: 'non_veg', child: Text('Non veg')),
                  ],
                  onChanged: (value) => state.filters.diet = value ?? 'all',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: state.filters.sort,
                  decoration: const InputDecoration(labelText: 'Sort'),
                  items: const [
                    DropdownMenuItem(
                        value: 'distance', child: Text('Distance')),
                    DropdownMenuItem(
                        value: 'rating_desc', child: Text('Rating')),
                    DropdownMenuItem(value: 'eta', child: Text('ETA')),
                    DropdownMenuItem(
                        value: 'price_asc', child: Text('Price low')),
                    DropdownMenuItem(
                        value: 'price_desc', child: Text('Price high')),
                  ],
                  onChanged: (value) =>
                      state.filters.sort = value ?? 'distance',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  initialValue: state.filters.maxPricePaise == 0
                      ? ''
                      : state.filters.maxPricePaise.toString(),
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Max price paise'),
                  onChanged: (value) =>
                      state.filters.maxPricePaise = int.tryParse(value) ?? 0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Minimum rating ${state.filters.minRating.toStringAsFixed(1)}'),
          Slider(
            value: state.filters.minRating,
            min: 0,
            max: 5,
            divisions: 10,
            label: state.filters.minRating.toStringAsFixed(1),
            onChanged: state.setMinRating,
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                  onPressed: state.busy ? null : state.loadRestaurants,
                  icon: const Icon(Icons.search),
                  label: const Text('Search')),
              OutlinedButton.icon(
                  onPressed: state.busy ? null : state.loadLocation,
                  icon: const Icon(Icons.my_location),
                  label: const Text('Use location')),
            ],
          ),
          const Divider(height: 28),
          if (restaurants.isEmpty)
            const EmptyInlineState(
                icon: Icons.search_off,
                title: 'No restaurants yet',
                body:
                    'Try fewer filters or refresh after restaurants are live.')
          else ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text('${restaurants.length} restaurants found',
                  style: Theme.of(context).textTheme.bodyLarge),
            ),
            ...restaurants.map((restaurant) {
              final selected = restaurant.id == state.selectedRestaurant?.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: RestaurantSummaryCard(
                  restaurant: restaurant,
                  selected: selected,
                  onTap: () => state.selectRestaurant(restaurant.id),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class PremiumDiscoverySection extends StatelessWidget {
  const PremiumDiscoverySection({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final premiumRecommendations = state.restaurantSummaries
        .where((restaurant) => restaurant.isPremium)
        .take(4)
        .toList();
    if (premiumRecommendations.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle(title: 'Premium discovery'),
        const SizedBox(height: 12),
        SizedBox(
          height: 200,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: premiumRecommendations.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final restaurant = premiumRecommendations[index];
              return SizedBox(
                width: 260,
                child: PremiumDiscoveryTile(
                  restaurant: restaurant,
                  onTap: () => state.selectRestaurant(restaurant.id),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}

class RestaurantDetailsScreen extends StatelessWidget {
  const RestaurantDetailsScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final restaurant = state.selectedRestaurant;
    if (restaurant == null) {
      return const EmptyState(
          icon: Icons.storefront_outlined,
          title: 'Select a restaurant',
          body: 'Restaurants will appear here after search results load.');
    }
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ItemImage(url: restaurant.photoUrl, size: 84),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Restaurant details',
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(restaurant.name,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700)),
                    Text(restaurant.address),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (restaurant.isPremium)
                const Chip(
                  label: Text('Premium'),
                  backgroundColor: Color(0xffd8f5e1),
                ),
              if (restaurant.cuisineType != null)
                Chip(label: Text(restaurant.cuisineType!)),
              if (restaurant.rating != null)
                Chip(
                    label: Text(
                        '${restaurant.rating!.toStringAsFixed(1)} rating')),
              Chip(label: Text(restaurant.etaBadge)),
              Chip(label: Text(restaurant.distanceBadge)),
              Chip(label: Text(restaurant.priceBadge)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: state.selectedRestaurantMenuItems.isEmpty
                      ? null
                      : () => state.addToCart(
                          state.selectedRestaurantMenuItems.first),
                  icon: const Icon(Icons.add_shopping_cart),
                  label: const Text('Add first item'),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: state.selectedRestaurantMenuItems.isEmpty
                    ? null
                    : () => state.openRestaurants(),
                icon: const Icon(Icons.restaurant_menu),
                label: const Text('Browse menu'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class MenuBrowsingScreen extends StatelessWidget {
  const MenuBrowsingScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final items = state.selectedRestaurantMenuItems;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle(title: 'Menu browsing'),
        if (items.isEmpty)
          const EmptyState(
              icon: Icons.menu_book_outlined,
              title: 'No menu items yet',
              body: 'Search with fewer filters or choose another restaurant.')
        else
          ...items.map((item) =>
              MenuItemTile(item: item, onAdd: () => state.addToCart(item))),
      ],
    );
  }
}

class CartScreen extends StatelessWidget {
  const CartScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        AppBanner(state: state),
        ScreenStateBanner(state: state, screen: CustomerScreenKey.cart),
        if (state.cart.lines.isEmpty)
          const EmptyState(
              icon: Icons.shopping_bag_outlined,
              title: 'Your cart is empty',
              body: 'Add items from Restaurants to start checkout.')
        else
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Cart',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
                if (state.cart.restaurantName != null) ...[
                  const SizedBox(height: 4),
                  Text(state.cart.restaurantName!),
                ],
                const SizedBox(height: 12),
                ...state.cart.lines.map((line) => CartLineTile(
                      line: line,
                      onIncrement: () =>
                          state.incrementCart(line.item.menuItemId),
                      onDecrement: () =>
                          state.decrementCart(line.item.menuItemId),
                      onRemove: () =>
                          state.removeFromCart(line.item.menuItemId),
                      onSpiceChanged: (value) => state.updateCartLineModifiers(
                          line.item.menuItemId,
                          spiceLevel: value),
                      onCutleryChanged: (value) =>
                          state.updateCartLineModifiers(line.item.menuItemId,
                              includeCutlery: value),
                      onInstructionsChanged: (value) =>
                          state.updateCartLineModifiers(line.item.menuItemId,
                              specialInstructions: value),
                    )),
                const Divider(),
                SummaryRow(
                    label: 'Cart subtotal',
                    value: formatCurrency(state.cart.subtotalPaise),
                    strong: true),
              ],
            ),
          ),
        const SizedBox(height: 12),
        CheckoutScreen(state: state),
      ],
    );
  }
}

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final pricing = state.cartPricing;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Checkout',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ScreenStateBanner(state: state, screen: CustomerScreenKey.checkout),
          if (!state.canCheckout)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Complete the delivery address and cart items before placing the order.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          LocationSelectionScreen(
            state: state,
            includeAddressField: true,
            framed: false,
          ),
          const Divider(height: 24),
          CouponApplicationSection(state: state),
          const Divider(height: 24),
          Text('Final checkout review',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (state.cart.restaurantName != null)
            SummaryRow(label: 'Restaurant', value: state.cart.restaurantName!),
          SummaryRow(
              label: 'Address',
              value: state.deliveryAddress.trim().isEmpty
                  ? 'Select address'
                  : state.deliveryAddress.trim()),
          SummaryRow(label: 'Items', value: '${state.cart.lines.length}'),
          SummaryRow(
              label: 'Subtotal', value: formatCurrency(pricing.subtotalPaise)),
          SummaryRow(
              label: 'Taxes and platform fee',
              value:
                  formatCurrency(pricing.taxPaise + pricing.platformFeePaise)),
          SummaryRow(
              label: 'Delivery fee',
              value: pricing.deliveryFeePaise == 0
                  ? 'Free'
                  : formatCurrency(pricing.deliveryFeePaise)),
          if (pricing.discountPaise > 0)
            SummaryRow(
                label: 'Coupon discount',
                value: '-${formatCurrency(pricing.discountPaise)}'),
          SummaryRow(
              label: 'Total',
              value: formatCurrency(pricing.totalPaise),
              strong: true),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: state.busy || !state.canCheckout ? null : state.checkout,
            icon: const Icon(Icons.lock_outline),
            label: const Text('Place order'),
          ),
          if (state.activeOrder?.status == 'created' &&
              state.cart.lines.isNotEmpty)
            TextButton(
                onPressed: state.editActiveOrderFromCart,
                child: const Text('Update active order before confirmation')),
        ],
      ),
    );
  }
}

class CouponApplicationSection extends StatefulWidget {
  const CouponApplicationSection({required this.state, super.key});

  final CustomerAppState state;

  @override
  State<CouponApplicationSection> createState() =>
      _CouponApplicationSectionState();
}

class _CouponApplicationSectionState extends State<CouponApplicationSection> {
  late final TextEditingController coupon;

  @override
  void initState() {
    super.initState();
    coupon = TextEditingController(text: widget.state.cart.couponCode);
  }

  @override
  void didUpdateWidget(covariant CouponApplicationSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (coupon.text != widget.state.cart.couponCode) {
      coupon.text = widget.state.cart.couponCode;
    }
  }

  @override
  void dispose() {
    coupon.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final problem = widget.state.couponProblem;
    final applied = widget.state.appliedOffer;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Coupon application',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        TextField(
          controller: coupon,
          textCapitalization: TextCapitalization.characters,
          decoration: InputDecoration(
            labelText: 'Coupon code',
            helperText: applied?.title,
            errorText: problem,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              onPressed: () => widget.state.applyCoupon(coupon.text),
              icon: const Icon(Icons.local_offer_outlined),
              label: const Text('Apply coupon'),
            ),
            OutlinedButton.icon(
              onPressed: widget.state.cart.couponCode.isEmpty
                  ? null
                  : widget.state.removeCoupon,
              icon: const Icon(Icons.close),
              label: const Text('Remove'),
            ),
          ],
        ),
      ],
    );
  }
}

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final order = state.activeOrder;
    return RefreshIndicator(
      onRefresh: () async {
        if (order != null) {
          await state.loadOrder(order.id);
        } else {
          await state.loadOrders();
        }
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppBanner(state: state),
          ScreenStateBanner(state: state, screen: CustomerScreenKey.orders),
          PaymentStatusScreen(state: state),
          const SizedBox(height: 12),
          OrderTrackingScreen(state: state),
          const SizedBox(height: 12),
          OrderHistoryScreen(state: state),
        ],
      ),
    );
  }
}

class PaymentStatusScreen extends StatelessWidget {
  const PaymentStatusScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final order = state.activeOrder;
    final snapshot = state.paymentSnapshot;
    final payment = snapshot?.payment;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Payment status',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ScreenStateBanner(state: state, screen: CustomerScreenKey.payment),
          if (order == null)
            const Text('Place an order to start payment.')
          else ...[
            PaymentStateBanner(stage: state.paymentStage),
            const SizedBox(height: 12),
            SummaryRow(label: 'Order', value: shortId(order.id)),
            SummaryRow(
                label: 'Amount', value: formatCurrency(order.totalPaise)),
            SummaryRow(
                label: 'Payment',
                value: payment == null
                    ? titleCase(state.paymentStage)
                    : titleCase(payment.status)),
            if (payment != null) ...[
              SummaryRow(label: 'Provider', value: titleCase(payment.provider)),
              SummaryRow(label: 'Transaction', value: shortId(payment.id)),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final method in const [
                  (
                    provider: 'phonepe',
                    label: 'PhonePe',
                    icon: Icons.account_balance_wallet_outlined
                  ),
                  (
                    provider: 'paytm',
                    label: 'Paytm',
                    icon: Icons.payments_outlined
                  ),
                  (
                    provider: 'razorpay',
                    label: 'Razorpay',
                    icon: Icons.credit_card
                  ),
                ])
                  PaymentMethodChip(
                    provider: method.provider,
                    label: method.label,
                    icon: method.icon,
                    selected: state.selectedPaymentProvider == method.provider,
                    enabled: state.paymentStage != 'pending',
                    onSelected: () => state.setPaymentProvider(method.provider),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                    onPressed: state.paymentStage == 'pending'
                        ? null
                        : state.startPayment,
                    icon: Icon(state.paymentStage == 'failure'
                        ? Icons.refresh
                        : Icons.payment),
                    label: Text(state.paymentStage == 'failure'
                        ? 'Retry payment'
                        : 'Pay securely')),
                OutlinedButton.icon(
                    onPressed: () => state.refreshPaymentStatus(),
                    icon: const Icon(Icons.sync),
                    label: const Text('Refresh')),
              ],
            ),
            if (state.paymentStatus.isNotEmpty)
              Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(state.paymentStatus)),
            if (state.activePaymentStart?.returnUrl != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Return link ready for ${titleCase(state.activePaymentStart!.provider)}.',
                ),
              ),
            const Divider(height: 24),
            RefundStatusSection(snapshot: snapshot),
          ],
        ],
      ),
    );
  }
}

class PaymentStateBanner extends StatelessWidget {
  const PaymentStateBanner({required this.stage, super.key});

  final String stage;

  @override
  Widget build(BuildContext context) {
    final style = switch (stage) {
      'success' => (
          icon: Icons.check_circle_outline,
          color: const Color(0xff065f46),
          bg: const Color(0xffecfdf5),
          title: 'Payment successful',
          body: 'Your order payment is confirmed.'
        ),
      'failure' => (
          icon: Icons.error_outline,
          color: const Color(0xff9f1239),
          bg: const Color(0xfffff1f2),
          title: 'Payment failed',
          body: 'No charge was confirmed. You can retry safely.'
        ),
      'pending' => (
          icon: Icons.hourglass_top,
          color: const Color(0xff854d0e),
          bg: const Color(0xfffffbeb),
          title: 'Payment pending',
          body: 'Waiting for gateway confirmation.'
        ),
      _ => (
          icon: Icons.payments_outlined,
          color: const Color(0xff334155),
          bg: const Color(0xfff1f5f9),
          title: 'Payment not started',
          body: 'Choose a method and continue.'
        )
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: style.bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(style.icon, color: style.color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(style.title,
                    style: TextStyle(
                        color: style.color, fontWeight: FontWeight.w800)),
                Text(style.body, style: TextStyle(color: style.color)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PaymentMethodChip extends StatelessWidget {
  const PaymentMethodChip({
    required this.provider,
    required this.label,
    required this.icon,
    required this.selected,
    required this.enabled,
    required this.onSelected,
    super.key,
  });

  final String provider;
  final String label;
  final IconData icon;
  final bool selected;
  final bool enabled;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      selected: selected,
      onSelected: enabled ? (_) => onSelected() : null,
    );
  }
}

class RefundStatusSection extends StatelessWidget {
  const RefundStatusSection({required this.snapshot, super.key});

  final PaymentStatusSnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    final refunds = snapshot?.refunds ?? const <RefundRecord>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Refund status',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        if (refunds.isEmpty)
          const Text('No refund requested for this order.')
        else
          ...refunds.map((refund) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.currency_rupee),
                title: Text(
                    '${formatCurrency(refund.amountPaise)} - ${titleCase(refund.status)}'),
                subtitle: Text(refund.reason ?? 'Refund request'),
                trailing: Text(titleCase(refund.provider)),
              )),
      ],
    );
  }
}

class OrderTrackingScreen extends StatelessWidget {
  const OrderTrackingScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final order = state.activeOrder;
    if (order == null) {
      return const EmptyState(
          icon: Icons.delivery_dining,
          title: 'Order tracking',
          body: 'Checkout to start live tracking.');
    }
    return Column(
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Order tracking',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              ScreenStateBanner(
                  state: state, screen: CustomerScreenKey.tracking),
              Text('Order ${shortId(order.id)}'),
              const SizedBox(height: 8),
              StatusPill(status: order.status),
              const SizedBox(height: 12),
              TrackingSignalRow(state: state),
              if (state.trackingDelayMessage != null) ...[
                const SizedBox(height: 12),
                TrackingDelayBanner(message: state.trackingDelayMessage!),
              ],
              const SizedBox(height: 12),
              SummaryRow(
                  label: 'Total', value: formatCurrency(order.totalPaise)),
              SummaryRow(
                  label: 'ETA',
                  value: state.activeEta == null
                      ? order.estimatedDeliveryAt ?? 'Calculating'
                      : '${state.activeEta!.predictedEtaMinutes} min'),
              SummaryRow(
                  label: 'Driver',
                  value: order.driverPhone ?? 'Assigning soon'),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                      onPressed: state.openNavigation,
                      icon: const Icon(Icons.navigation_outlined),
                      label: const Text('Navigate')),
                  OutlinedButton.icon(
                      onPressed: state.callDriver,
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('Call driver')),
                  OutlinedButton.icon(
                      onPressed: state.contactTrackingSupport,
                      icon: const Icon(Icons.support_agent_outlined),
                      label: const Text('Support')),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        TrackingMap(state: state),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Status updates',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(state.trackingStatus),
              const SizedBox(height: 12),
              OrderStatusTimeline(order: order),
            ],
          ),
        ),
      ],
    );
  }
}

class TrackingSignalRow extends StatelessWidget {
  const TrackingSignalRow({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        Chip(
          avatar: Icon(
            state.trackingLiveConnected
                ? Icons.sensors_outlined
                : Icons.sync_problem_outlined,
            size: 18,
          ),
          label: Text(state.trackingLiveConnected ? 'Live socket' : 'ETA sync'),
        ),
        Chip(
          avatar: const Icon(Icons.location_on_outlined, size: 18),
          label: Text(state.driverMarkerStatus),
        ),
      ],
    );
  }
}

class TrackingDelayBanner extends StatelessWidget {
  const TrackingDelayBanner({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xfffffbeb),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xfffde68a)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.schedule_outlined, color: Color(0xff92400e)),
          const SizedBox(width: 10),
          Expanded(
            child:
                Text(message, style: const TextStyle(color: Color(0xff92400e))),
          ),
        ],
      ),
    );
  }
}

class OrderStatusTimeline extends StatelessWidget {
  const OrderStatusTimeline({required this.order, super.key});

  final OrderDetails order;

  static const steps = [
    'created',
    'accepted',
    'preparing',
    'ready',
    'picked_up',
    'delivered'
  ];

  @override
  Widget build(BuildContext context) {
    final historyByStatus = {
      for (final event in order.history) event.status: event,
    };
    final currentIndex = steps.indexOf(order.status);
    return Column(
      children: [
        for (final entry in steps.asMap().entries)
          _TimelineStep(
            label: titleCase(entry.value),
            event: historyByStatus[entry.value],
            completed: currentIndex >= entry.key,
            current: currentIndex == entry.key,
          ),
        if (order.status == 'cancelled')
          _TimelineStep(
            label: 'Cancelled',
            event: historyByStatus['cancelled'],
            completed: true,
            current: true,
          ),
      ],
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.label,
    required this.completed,
    required this.current,
    this.event,
  });

  final String label;
  final bool completed;
  final bool current;
  final OrderHistoryEvent? event;

  @override
  Widget build(BuildContext context) {
    final color = completed ? const Color(0xff0f766e) : const Color(0xff94a3b8);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            current
                ? Icons.radio_button_checked
                : completed
                    ? Icons.check_circle_outline
                    : Icons.radio_button_unchecked,
            color: color,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontWeight: current ? FontWeight.w800 : FontWeight.w600,
                        color: color)),
                if (event != null)
                  Text(
                    event!.note.isEmpty
                        ? event!.createdAt
                        : '${event!.note}\n${event!.createdAt}',
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class OrderHistoryScreen extends StatelessWidget {
  const OrderHistoryScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Order history',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          ScreenStateBanner(state: state, screen: CustomerScreenKey.orders),
          if (state.orders.isEmpty)
            const Text('Your previous orders will appear here.')
          else
            ...state.orders.map((item) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Order ${shortId(item.id)}'),
                  subtitle: Text(
                      '${titleCase(item.status)} - ${formatCurrency(item.totalPaise)}'),
                  trailing: TextButton(
                      onPressed: () => state.reorder(item),
                      child: const Text('Reorder')),
                  onTap: () => state.loadOrder(item.id),
                )),
        ],
      ),
    );
  }
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({required this.state, super.key});

  final CustomerAppState state;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final supportSubject = TextEditingController();
  final supportMessage = TextEditingController();
  final reviewComment = TextEditingController();
  final refundReason = TextEditingController();
  int rating = 5;

  @override
  void dispose() {
    supportSubject.dispose();
    supportMessage.dispose();
    reviewComment.dispose();
    refundReason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reviewRestaurant = widget.state.selectedRestaurant;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        AppBanner(state: widget.state),
        ScreenStateBanner(
            state: widget.state, screen: CustomerScreenKey.profile),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Profile',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              FilledButton.icon(
                  onPressed: widget.state.enablePushNotifications,
                  icon: const Icon(Icons.notifications_active_outlined),
                  label: const Text('Enable push notifications')),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                  onPressed: widget.state.logout,
                  icon: const Icon(Icons.logout),
                  label: const Text('Sign out')),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SupportScreen(
          state: widget.state,
          subjectController: supportSubject,
          messageController: supportMessage,
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Refund and review',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              TextField(
                  controller: refundReason,
                  decoration:
                      const InputDecoration(labelText: 'Refund reason')),
              const SizedBox(height: 8),
              OutlinedButton(
                  onPressed: () =>
                      widget.state.requestRefund(refundReason.text),
                  child: const Text('Request refund for active order')),
              const Divider(height: 24),
              SummaryRow(
                  label: 'Review restaurant',
                  value: reviewRestaurant?.name ?? 'Select a restaurant'),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: rating,
                decoration: const InputDecoration(labelText: 'Rating'),
                items: List.generate(
                    5,
                    (index) => DropdownMenuItem(
                        value: index + 1, child: Text('${index + 1}'))),
                onChanged: (value) => setState(() => rating = value ?? 5),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: reviewComment,
                  decoration: const InputDecoration(labelText: 'Review')),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: reviewRestaurant == null
                    ? null
                    : () => widget.state.createReview(
                        reviewRestaurant.id, rating, reviewComment.text),
                child: const Text('Submit review'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class SupportScreen extends StatelessWidget {
  const SupportScreen({
    required this.state,
    required this.subjectController,
    required this.messageController,
    super.key,
  });

  final CustomerAppState state;
  final TextEditingController subjectController;
  final TextEditingController messageController;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Support',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          ScreenStateBanner(state: state, screen: CustomerScreenKey.support),
          TextField(
              controller: subjectController,
              decoration: const InputDecoration(labelText: 'Subject')),
          const SizedBox(height: 12),
          TextField(
              controller: messageController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Message')),
          const SizedBox(height: 12),
          FilledButton(
              onPressed: () => state.createSupportTicket(
                  subjectController.text, messageController.text),
              child: const Text('Send support request')),
        ],
      ),
    );
  }
}

class TrackingMap extends StatelessWidget {
  const TrackingMap({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final eta = state.activeEta;
    if (state.shouldUseTrackingFallback) {
      return TrackingMapFallback(state: state);
    }
    final fallback = LatLng(
      state.currentLat ?? serviceRegionCenter.lat,
      state.currentLng ?? serviceRegionCenter.lng,
    );
    final points = eta == null
        ? <LatLng>[]
        : [
            LatLng(eta.origin.lat, eta.origin.lng),
            LatLng(eta.pickup.lat, eta.pickup.lng),
            LatLng(eta.dropoff.lat, eta.dropoff.lng),
          ];
    final driver = state.liveDriverLocation;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            height: 280,
            child: GoogleMap(
              initialCameraPosition: CameraPosition(
                  target: points.isNotEmpty ? points.first : fallback,
                  zoom: 12),
              markers: {
                if (eta != null)
                  Marker(
                      markerId: const MarkerId('pickup'),
                      position: LatLng(eta.pickup.lat, eta.pickup.lng),
                      infoWindow: const InfoWindow(title: 'Pickup')),
                if (eta != null)
                  Marker(
                      markerId: const MarkerId('dropoff'),
                      position: LatLng(eta.dropoff.lat, eta.dropoff.lng),
                      infoWindow: const InfoWindow(title: 'Dropoff')),
                if (driver != null)
                  Marker(
                      markerId: const MarkerId('driver'),
                      position: LatLng(driver.lat, driver.lng),
                      infoWindow: InfoWindow(
                          title: 'Driver', snippet: state.driverMarkerStatus)),
              },
              polylines: {
                if (points.length > 1)
                  Polyline(
                      polylineId: const PolylineId('route'),
                      points: points,
                      color: const Color(0xff0f766e),
                      width: 5),
              },
              myLocationButtonEnabled: state.currentLat != null,
              myLocationEnabled: state.currentLat != null,
            ),
          ),
        ),
        TextButton.icon(
            onPressed: state.useTrackingMapFallback,
            icon: const Icon(Icons.map_outlined),
            label: const Text('Use route summary')),
      ],
    );
  }
}

class TrackingMapFallback extends StatelessWidget {
  const TrackingMapFallback({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final eta = state.activeEta;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Route summary',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (state.locationProblem != null) Text(state.locationProblem!),
          if (state.trackingMapProblem != null) Text(state.trackingMapProblem!),
          if (eta == null)
            const Text('ETA will appear after the route is available.')
          else ...[
            SummaryRow(
                label: 'Pickup distance',
                value: '${eta.distanceToPickupKm.toStringAsFixed(1)} km'),
            SummaryRow(
                label: 'Dropoff distance',
                value: '${eta.distanceToDropoffKm.toStringAsFixed(1)} km'),
            SummaryRow(
                label: 'Predicted ETA',
                value: '${eta.predictedEtaMinutes} min'),
            SummaryRow(label: 'Driver marker', value: state.driverMarkerStatus),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                  onPressed: state.openNavigation,
                  icon: const Icon(Icons.navigation_outlined),
                  label: const Text('Open route')),
              OutlinedButton.icon(
                  onPressed: state.retryTrackingMap,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry map')),
            ],
          ),
        ],
      ),
    );
  }
}

class AppBanner extends StatelessWidget {
  const AppBanner({required this.state, super.key});

  final CustomerAppState state;

  @override
  Widget build(BuildContext context) {
    final message =
        state.error ?? state.notice ?? (state.offline ? 'Offline' : null);
    if (message == null || message.isEmpty) {
      return const SizedBox.shrink();
    }
    final isError = state.error != null;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isError ? const Color(0xfffff1f2) : const Color(0xffecfdf5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: isError ? const Color(0xfffecdd3) : const Color(0xffa7f3d0)),
      ),
      child: Text(message,
          style: TextStyle(
              color:
                  isError ? const Color(0xff9f1239) : const Color(0xff065f46))),
    );
  }
}

class ScreenStateBanner extends StatelessWidget {
  const ScreenStateBanner({
    required this.state,
    required this.screen,
    super.key,
  });

  final CustomerAppState state;
  final CustomerScreenKey screen;

  @override
  Widget build(BuildContext context) {
    final loadState = state.screenState(screen);
    final message = loadState.loading
        ? 'Loading...'
        : loadState.error ??
            (loadState.offline
                ? 'Network is unavailable. Check your connection and retry.'
                : null);
    if (message == null) {
      return const SizedBox.shrink();
    }
    final isError = loadState.error != null || loadState.offline;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isError ? const Color(0xfffff1f2) : const Color(0xffeff6ff),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: isError ? const Color(0xfffecdd3) : const Color(0xffbfdbfe)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isError ? Icons.wifi_off_outlined : Icons.sync,
            color: isError ? const Color(0xff9f1239) : const Color(0xff1d4ed8),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: TextStyle(
                    color: isError
                        ? const Color(0xff9f1239)
                        : const Color(0xff1d4ed8))),
          ),
          if (isError)
            TextButton(
              onPressed: () => state.retryScreen(screen),
              child: const Text('Retry'),
            ),
        ],
      ),
    );
  }
}

class AppCard extends StatelessWidget {
  const AppCard({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0xffe5e7eb)),
      ),
      child: Padding(padding: const EdgeInsets.all(14), child: child),
    );
  }
}

class MenuItemTile extends StatelessWidget {
  const MenuItemTile({required this.item, required this.onAdd, super.key});

  final MenuSearchItem item;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ItemImage(url: item.photoUrl),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.menuItemName,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(item.restaurantName,
                    style: Theme.of(context).textTheme.bodySmall),
                if (item.description != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6, bottom: 4),
                    child: Text(item.description!,
                        maxLines: 2, overflow: TextOverflow.ellipsis),
                  ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    Chip(
                        label: Text(formatCurrency(item.pricePaise)),
                        backgroundColor: const Color(0xfff1f5f9)),
                    if (item.isVeg != null)
                      Chip(
                          label: Text(item.isVeg! ? 'Veg' : 'Non veg'),
                          backgroundColor: item.isVeg!
                              ? const Color(0xffecfdf5)
                              : const Color(0xfffff1f2)),
                    if (item.rating != null)
                      Chip(
                          label: Text(
                              '${item.rating!.toStringAsFixed(1)} rating')),
                    if (item.distanceKm != null)
                      Chip(
                          label: Text(
                              '${item.distanceKm!.toStringAsFixed(1)} km')),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
              onPressed: onAdd,
              icon: const Icon(Icons.add_shopping_cart),
              tooltip: 'Add to cart'),
        ],
      ),
    );
  }
}

class TrendingTile extends StatelessWidget {
  const TrendingTile({required this.restaurant, super.key});

  final TrendingRestaurant restaurant;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: ItemImage(url: restaurant.photoUrl, size: 52),
      title: Text(restaurant.name),
      subtitle: Text(
          '${restaurant.cuisineType ?? 'Cuisine'} - ${restaurant.predictedEtaMinutes} min ETA'),
      trailing: restaurant.distanceKm == null
          ? null
          : Text('${restaurant.distanceKm!.toStringAsFixed(1)} km'),
    );
  }
}

class OfferTile extends StatelessWidget {
  const OfferTile({required this.offer, super.key});

  final Offer offer;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xff12312d),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(offer.code,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(offer.title, style: const TextStyle(color: Colors.white70)),
        ],
      ),
    );
  }
}

class CartLineTile extends StatelessWidget {
  const CartLineTile(
      {required this.line,
      required this.onIncrement,
      required this.onDecrement,
      required this.onRemove,
      required this.onSpiceChanged,
      required this.onCutleryChanged,
      required this.onInstructionsChanged,
      super.key});

  final CartLine line;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;
  final ValueChanged<String> onSpiceChanged;
  final ValueChanged<bool> onCutleryChanged;
  final ValueChanged<String> onInstructionsChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(line.item.menuItemName),
            subtitle: Text(
                '${formatCurrency(line.item.pricePaise)} each - ${formatCurrency(line.lineTotalPaise)} line total'),
            trailing: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 4,
              children: [
                IconButton(
                    onPressed: onDecrement,
                    icon: const Icon(Icons.remove_circle_outline)),
                Text('${line.quantity}'),
                IconButton(
                    onPressed: onIncrement,
                    icon: const Icon(Icons.add_circle_outline)),
                IconButton(
                    onPressed: onRemove,
                    icon: const Icon(Icons.delete_outline)),
              ],
            ),
          ),
          DropdownButtonFormField<String>(
            initialValue: line.spiceLevel,
            decoration: const InputDecoration(labelText: 'Item modifier'),
            items: const [
              DropdownMenuItem(value: 'Regular', child: Text('Regular spice')),
              DropdownMenuItem(value: 'Mild', child: Text('Mild')),
              DropdownMenuItem(value: 'Spicy', child: Text('Spicy')),
              DropdownMenuItem(
                  value: 'Extra spicy', child: Text('Extra spicy')),
            ],
            onChanged: (value) => onSpiceChanged(value ?? 'Regular'),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: line.includeCutlery,
            onChanged: (value) => onCutleryChanged(value ?? false),
            title: const Text('Include cutlery'),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          TextFormField(
            initialValue: line.specialInstructions,
            decoration:
                const InputDecoration(labelText: 'Special instructions'),
            maxLines: 2,
            onChanged: onInstructionsChanged,
          ),
          if (line.modifiers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: line.modifiers
                    .map((modifier) => Chip(label: Text(modifier.name)))
                    .toList(),
              ),
            ),
          const Divider(height: 24),
        ],
      ),
    );
  }
}

class ItemImage extends StatelessWidget {
  const ItemImage({this.url, this.size = 76, super.key});

  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: size,
        height: size,
        color: const Color(0xffe2e8f0),
        child: url == null || url!.isEmpty
            ? const Icon(Icons.restaurant, size: 32, color: Color(0xff475569))
            : Image.network(
                url!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.restaurant,
                  size: 32,
                  color: Color(0xff475569),
                ),
              ),
      ),
    );
  }
}

class RestaurantSummaryCard extends StatelessWidget {
  const RestaurantSummaryCard({
    required this.restaurant,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final RestaurantSummary restaurant;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ItemImage(url: restaurant.photoUrl, size: 88),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: Text(restaurant.name,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w800)),
                          ),
                          if (selected)
                            const Icon(Icons.check_circle,
                                color: Color(0xff0f766e)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(restaurant.address,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          if (restaurant.isPremium)
                            const Chip(
                                label: Text('Premium'),
                                backgroundColor: Color(0xffd8f5e1)),
                          if (restaurant.cuisineType != null)
                            Chip(label: Text(restaurant.cuisineType!)),
                          if (restaurant.rating != null)
                            Chip(label: Text(
                                '${restaurant.rating!.toStringAsFixed(1)} rating')),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(label: Text(restaurant.etaBadge)),
                Chip(label: Text(restaurant.distanceBadge)),
                Chip(label: Text(restaurant.priceBadge)),
                if (restaurant.menuCount > 0)
                  Chip(label: Text('${restaurant.menuCount} dishes')),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                FilledButton(
                  onPressed: onTap,
                  child: const Text('View menu'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: onTap,
                  child: const Text('Choose restaurant'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class PremiumDiscoveryTile extends StatelessWidget {
  const PremiumDiscoveryTile({
    required this.restaurant,
    required this.onTap,
    super.key,
  });

  final RestaurantSummary restaurant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: 240,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xffe2e8f0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: ItemImage(url: restaurant.photoUrl, size: 148)),
            const SizedBox(height: 10),
            Text(restaurant.name,
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(restaurant.listingSubtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              if (restaurant.isPremium)
                const Chip(label: Text('Premium')),
              Chip(label: Text(restaurant.etaBadge)),
            ]),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState(
      {required this.icon, required this.title, required this.body, super.key});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        children: [
          Icon(icon, size: 40, color: const Color(0xff64748b)),
          const SizedBox(height: 8),
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(body, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class EmptyInlineState extends StatelessWidget {
  const EmptyInlineState(
      {required this.icon, required this.title, required this.body, super.key});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 32, color: const Color(0xff64748b)),
          const SizedBox(height: 8),
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(body),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({required this.title, super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
      child: Text(title,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w800)),
    );
  }
}

class SummaryRow extends StatelessWidget {
  const SummaryRow(
      {required this.label,
      required this.value,
      this.strong = false,
      super.key});

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Flexible(
              child: Text(value,
                  textAlign: TextAlign.end,
                  style: strong
                      ? const TextStyle(fontWeight: FontWeight.w800)
                      : null)),
        ],
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({required this.status, super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xffccfbf1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(titleCase(status),
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: Color(0xff115e59))),
      ),
    );
  }
}

String formatCurrency(int paise) {
  return 'INR ${(paise / 100).toStringAsFixed(0)}';
}

String shortId(String id) {
  if (id.length <= 8) {
    return id;
  }
  return id.substring(0, 8);
}

DateTime? parseDateTime(String? value) {
  if (value == null || value.isEmpty) {
    return null;
  }
  return DateTime.tryParse(value)?.toLocal();
}

String? normalizePhone(String value) {
  final trimmed = value.trim().replaceAll(RegExp(r'\s+'), '');
  final normalized = trimmed.startsWith('+') ? trimmed : '+91$trimmed';
  return RegExp(r'^\+[1-9]\d{9,14}$').hasMatch(normalized) ? normalized : null;
}

String titleCase(String value) {
  return value
      .replaceAll('_', ' ')
      .split(' ')
      .where((word) => word.isNotEmpty)
      .map((word) {
    return '${word[0].toUpperCase()}${word.substring(1)}';
  }).join(' ');
}

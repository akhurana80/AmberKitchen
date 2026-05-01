import 'api_client.dart';

class CustomerRepository {
  CustomerRepository({required this.api});

  final AmberApiClient api;

  String get baseUrl => api.baseUrl;
  String get token => api.token;
  set token(String value) => api.token = value;
  bool get signedIn => api.token.isNotEmpty;

  Future<AuthSession> requestOtp(String phone) => api.requestOtp(phone);

  Future<AuthSession> verifyOtp(String phone, String code) =>
      api.verifyOtp(phone, code);

  Future<AuthSession> googleLogin(String idToken) => api.googleLogin(idToken);

  Future<List<MenuSearchItem>> searchRestaurants(RestaurantFilters filters) =>
      api.searchRestaurants(filters);

  Future<List<TrendingRestaurant>> trendingRestaurants(
          {double? lat, double? lng}) =>
      api.trendingRestaurants(lat: lat, lng: lng);

  Future<List<Offer>> marketplaceOffers() => api.marketplaceOffers();

  Future<CreateOrderResponse> createOrder({
    required String restaurantId,
    required String deliveryAddress,
    required double deliveryLat,
    required double deliveryLng,
    required List<CartItemRequest> items,
    required String idempotencyKey,
    String? couponCode,
  }) {
    return api.createOrder(
      restaurantId: restaurantId,
      deliveryAddress: deliveryAddress,
      deliveryLat: deliveryLat,
      deliveryLng: deliveryLng,
      items: items,
      couponCode: couponCode,
      idempotencyKey: idempotencyKey,
    );
  }

  Future<List<OrderSummary>> orders() => api.orders();

  Future<OrderDetails> getOrder(String orderId) => api.getOrder(orderId);

  Future<void> editOrderBeforeConfirmation({
    required String orderId,
    required String deliveryAddress,
    required double deliveryLat,
    required double deliveryLng,
    required List<CartItemRequest> items,
    String? couponCode,
  }) {
    return api.editOrderBeforeConfirmation(
      orderId: orderId,
      deliveryAddress: deliveryAddress,
      deliveryLat: deliveryLat,
      deliveryLng: deliveryLng,
      items: items,
      couponCode: couponCode,
    );
  }

  Future<void> cancelOrder(String orderId, String reason) =>
      api.cancelOrder(orderId, reason);

  Future<CreateOrderResponse> reorder(String orderId) => api.reorder(orderId);

  Future<PaymentStart> createPayment({
    required String provider,
    required String orderId,
    required int amountPaise,
  }) {
    return api.createPayment(
      provider: provider,
      orderId: orderId,
      amountPaise: amountPaise,
    );
  }

  Future<PaymentStatusSnapshot> paymentStatus(String orderId) =>
      api.paymentStatus(orderId);

  Future<RefundRecord> requestRefund(String orderId, String reason,
          {int? amountPaise}) =>
      api.requestRefund(orderId, reason, amountPaise: amountPaise);

  Future<OrderEta> orderEta(String orderId) => api.orderEta(orderId);

  Future<List<EtaEvent>> orderEtaLoop(String orderId) =>
      api.orderEtaLoop(orderId);

  Future<void> registerDeviceToken(String pushToken) =>
      api.registerDeviceToken(pushToken);

  Future<void> createRestaurantReview(
          String restaurantId, int rating, String comment, {String? orderId}) =>
      api.createRestaurantReview(restaurantId, rating, comment,
          orderId: orderId);

  Future<void> createSupportTicket({
    required String category,
    required String subject,
    required String message,
    String? orderId,
  }) {
    return api.createSupportTicket(
      category: category,
      subject: subject,
      message: message,
      orderId: orderId,
    );
  }
}

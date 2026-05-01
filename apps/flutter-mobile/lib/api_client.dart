import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

class AmberApiClient {
  AmberApiClient({required this.baseUrl});

  final String baseUrl;
  String token = '';

  Map<String, String> _headers({String? idempotencyKey}) => {
        'content-type': 'application/json',
        if (token.isNotEmpty) 'authorization': 'Bearer $token',
        if (idempotencyKey != null) 'idempotency-key': idempotencyKey,
      };

  Future<dynamic> _get(String path) async {
    return _send(
        () => http.get(Uri.parse('$baseUrl$path'), headers: _headers()));
  }

  Future<dynamic> _post(String path, Map<String, dynamic> body,
      {String? idempotencyKey}) async {
    return _send(
      () => http.post(
        Uri.parse('$baseUrl$path'),
        headers: _headers(idempotencyKey: idempotencyKey),
        body: jsonEncode(body),
      ),
    );
  }

  Future<dynamic> _patch(String path, Map<String, dynamic> body) async {
    return _send(() => http.patch(Uri.parse('$baseUrl$path'),
        headers: _headers(), body: jsonEncode(body)));
  }

  Future<dynamic> _send(Future<http.Response> Function() request) async {
    try {
      final response = await request().timeout(const Duration(seconds: 20));
      final body = response.body.isEmpty ? null : jsonDecode(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = body is Map<String, dynamic>
            ? body['error'] ?? body['message']
            : response.reasonPhrase;
        throw ApiException(
            message?.toString() ?? 'Request failed with ${response.statusCode}',
            statusCode: response.statusCode);
      }
      return body;
    } on SocketException {
      throw const ApiException(
          'You appear to be offline. Check your connection and try again.',
          offline: true);
    } on TimeoutException {
      throw const ApiException('The request timed out. Please try again.',
          offline: true);
    } on FormatException {
      throw const ApiException('The server returned an invalid response.');
    }
  }

  Future<AuthSession> requestOtp(String phone) async {
    final response = await _post('/api/v1/auth/otp/request', {'phone': phone});
    return AuthSession.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<AuthSession> verifyOtp(String phone, String code) async {
    final response = await _post('/api/v1/auth/otp/verify',
        {'phone': phone, 'code': code, 'role': 'customer'});
    final session =
        AuthSession.fromJson(Map<String, dynamic>.from(response as Map));
    token = session.token ?? token;
    return session;
  }

  Future<AuthSession> googleLogin(String idToken) async {
    final response = await _post(
        '/api/v1/auth/google', {'idToken': idToken, 'role': 'customer'});
    final session =
        AuthSession.fromJson(Map<String, dynamic>.from(response as Map));
    token = session.token ?? token;
    return session;
  }

  Future<List<MenuSearchItem>> searchRestaurants(
      RestaurantFilters filters) async {
    final params = <String, String>{
      if (filters.query.trim().isNotEmpty) 'q': filters.query.trim(),
      if (filters.cuisine.trim().isNotEmpty) 'cuisine': filters.cuisine.trim(),
      'diet': filters.diet,
      'minRating': filters.minRating.toStringAsFixed(1),
      if (filters.maxPricePaise > 0)
        'maxPricePaise': filters.maxPricePaise.toString(),
      'sort': filters.sort,
      if (filters.lat != null) 'lat': filters.lat.toString(),
      if (filters.lng != null) 'lng': filters.lng.toString(),
    };
    final response = await _get(
        '/api/v1/restaurants/search?${Uri(queryParameters: params).query}');
    return (response as List)
        .map((item) =>
            MenuSearchItem.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<TrendingRestaurant>> trendingRestaurants(
      {double? lat, double? lng}) async {
    final params = <String, String>{
      if (lat != null) 'lat': lat.toString(),
      if (lng != null) 'lng': lng.toString(),
    };
    final suffix =
        params.isEmpty ? '' : '?${Uri(queryParameters: params).query}';
    final response = await _get('/api/v1/restaurants/trending$suffix');
    return (response as List)
        .map((item) =>
            TrendingRestaurant.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<Offer>> marketplaceOffers() async {
    final response = await _get('/api/v1/marketplace/offers');
    return (response as List)
        .map((item) => Offer.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<CreateOrderResponse> createOrder({
    required String restaurantId,
    required String deliveryAddress,
    required double deliveryLat,
    required double deliveryLng,
    required List<CartItemRequest> items,
    required String idempotencyKey,
    String? couponCode,
  }) async {
    final response = await _post(
      '/api/v1/orders',
      {
        'restaurantId': restaurantId,
        'deliveryAddress': deliveryAddress,
        'deliveryLat': deliveryLat,
        'deliveryLng': deliveryLng,
        if (couponCode != null && couponCode.trim().isNotEmpty)
          'couponCode': couponCode.trim().toUpperCase(),
        'items': items.map((item) => item.toJson()).toList(),
      },
      idempotencyKey: idempotencyKey,
    );
    return CreateOrderResponse.fromJson(
        Map<String, dynamic>.from(response as Map));
  }

  Future<List<OrderSummary>> orders() async {
    final response = await _get('/api/v1/orders');
    return (response as List)
        .map((item) =>
            OrderSummary.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<OrderDetails> getOrder(String orderId) async {
    final response = await _get('/api/v1/orders/$orderId');
    return OrderDetails.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<void> editOrderBeforeConfirmation({
    required String orderId,
    required String deliveryAddress,
    required double deliveryLat,
    required double deliveryLng,
    required List<CartItemRequest> items,
    String? couponCode,
  }) async {
    await _patch('/api/v1/orders/$orderId', {
      'deliveryAddress': deliveryAddress,
      'deliveryLat': deliveryLat,
      'deliveryLng': deliveryLng,
      if (couponCode != null && couponCode.trim().isNotEmpty)
        'couponCode': couponCode.trim().toUpperCase(),
      'items': items.map((item) => item.toJson()).toList(),
    });
  }

  Future<void> cancelOrder(String orderId, String reason) async {
    await _post('/api/v1/orders/$orderId/cancel', {'reason': reason});
  }

  Future<CreateOrderResponse> reorder(String orderId) async {
    final response = await _post('/api/v1/orders/$orderId/reorder', {});
    return CreateOrderResponse.fromJson(
        Map<String, dynamic>.from(response as Map));
  }

  Future<PaymentStart> createPayment({
    required String provider,
    required String orderId,
    required int amountPaise,
  }) async {
    final response = await _post('/api/v1/payments/create', {
      'provider': provider,
      'orderId': orderId,
      'amountPaise': amountPaise,
    });
    return PaymentStart.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<PaymentStatusSnapshot> paymentStatus(String orderId) async {
    final response = await _get('/api/v1/payments/orders/$orderId/status');
    return PaymentStatusSnapshot.fromJson(
        Map<String, dynamic>.from(response as Map));
  }

  Future<RefundRecord> requestRefund(String orderId, String reason,
      {int? amountPaise}) async {
    final response = await _post('/api/v1/payments/refunds', {
      'orderId': orderId,
      'reason': reason,
      if (amountPaise != null) 'amountPaise': amountPaise,
    });
    return RefundRecord.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<OrderEta> orderEta(String orderId) async {
    final response = await _get('/api/v1/tracking/orders/$orderId/eta');
    return OrderEta.fromJson(Map<String, dynamic>.from(response as Map));
  }

  Future<List<EtaEvent>> orderEtaLoop(String orderId) async {
    final response = await _get('/api/v1/tracking/orders/$orderId/eta-loop');
    return (response as List)
        .map(
            (item) => EtaEvent.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<void> registerDeviceToken(String pushToken) async {
    await _post('/api/v1/notifications/device-token',
        {'token': pushToken, 'platform': 'flutter'});
  }

  Future<void> createRestaurantReview(
      String restaurantId, int rating, String comment,
      {String? orderId}) async {
    await _post('/api/v1/marketplace/restaurants/$restaurantId/reviews', {
      'rating': rating,
      'comment': comment,
      if (orderId != null) 'orderId': orderId,
    });
  }

  Future<void> createSupportTicket({
    required String category,
    required String subject,
    required String message,
    String? orderId,
  }) async {
    await _post('/api/v1/marketplace/support/tickets', {
      'category': category,
      'subject': subject,
      'message': message,
      if (orderId != null) 'orderId': orderId,
    });
  }
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.offline = false});

  final String message;
  final int? statusCode;
  final bool offline;

  @override
  String toString() => message;
}

class AuthSession {
  AuthSession({this.sent = false, this.devCode, this.token, this.user});

  final bool sent;
  final String? devCode;
  final String? token;
  final Map<String, dynamic>? user;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        sent: json['sent'] == true,
        devCode: json['devCode']?.toString(),
        token: json['token']?.toString(),
        user: json['user'] is Map
            ? Map<String, dynamic>.from(json['user'] as Map)
            : null,
      );
}

class RestaurantFilters {
  RestaurantFilters({
    this.query = '',
    this.cuisine = '',
    this.diet = 'all',
    this.minRating = 3,
    this.maxPricePaise = 0,
    this.sort = 'distance',
    this.lat,
    this.lng,
  });

  String query;
  String cuisine;
  String diet;
  double minRating;
  int maxPricePaise;
  String sort;
  double? lat;
  double? lng;

  RestaurantFilters copyWith({double? lat, double? lng}) => RestaurantFilters(
        query: query,
        cuisine: cuisine,
        diet: diet,
        minRating: minRating,
        maxPricePaise: maxPricePaise,
        sort: sort,
        lat: lat ?? this.lat,
        lng: lng ?? this.lng,
      );
}

class MenuSearchItem {
  MenuSearchItem({
    required this.menuItemId,
    required this.menuItemName,
    required this.pricePaise,
    required this.restaurantId,
    required this.restaurantName,
    required this.restaurantAddress,
    this.description,
    this.photoUrl,
    this.isVeg,
    this.cuisineType,
    this.rating,
    this.distanceKm,
  });

  final String menuItemId;
  final String menuItemName;
  final String? description;
  final int pricePaise;
  final String? photoUrl;
  final bool? isVeg;
  final String? cuisineType;
  final double? rating;
  final String restaurantId;
  final String restaurantName;
  final String restaurantAddress;
  final double? distanceKm;

  factory MenuSearchItem.fromJson(Map<String, dynamic> json) => MenuSearchItem(
        menuItemId: valueAsString(json['menu_item_id']),
        menuItemName: valueAsString(json['menu_item_name']),
        description: json['description']?.toString(),
        pricePaise: valueAsInt(json['price_paise']),
        photoUrl: json['photo_url']?.toString(),
        isVeg: json['is_veg'] is bool ? json['is_veg'] as bool : null,
        cuisineType: json['cuisine_type']?.toString(),
        rating: valueAsDouble(json['rating']),
        restaurantId: valueAsString(json['restaurant_id']),
        restaurantName: valueAsString(json['restaurant_name']),
        restaurantAddress: valueAsString(json['restaurant_address']),
        distanceKm: valueAsDouble(json['distance_km']),
      );
}

class TrendingRestaurant {
  TrendingRestaurant({
    required this.id,
    required this.name,
    required this.address,
    required this.predictedEtaMinutes,
    this.cuisineType,
    this.rating,
    this.startingPricePaise,
    this.photoUrl,
    this.distanceKm,
  });

  final String id;
  final String name;
  final String address;
  final String? cuisineType;
  final double? rating;
  final int? startingPricePaise;
  final String? photoUrl;
  final double? distanceKm;
  final int predictedEtaMinutes;

  factory TrendingRestaurant.fromJson(Map<String, dynamic> json) =>
      TrendingRestaurant(
        id: valueAsString(json['id']),
        name: valueAsString(json['name']),
        address: valueAsString(json['address']),
        cuisineType: json['cuisine_type']?.toString(),
        rating: valueAsDouble(json['rating']),
        startingPricePaise: json['starting_price_paise'] == null
            ? null
            : valueAsInt(json['starting_price_paise']),
        photoUrl: json['photo_url']?.toString(),
        distanceKm: valueAsDouble(json['distance_km']),
        predictedEtaMinutes: valueAsInt(json['predicted_eta_minutes']),
      );
}

class Offer {
  Offer(
      {required this.id,
      required this.code,
      required this.title,
      required this.discountType,
      required this.discountValue,
      required this.minOrderPaise});

  final String id;
  final String code;
  final String title;
  final String discountType;
  final int discountValue;
  final int minOrderPaise;

  factory Offer.fromJson(Map<String, dynamic> json) => Offer(
        id: valueAsString(json['id']),
        code: valueAsString(json['code']),
        title: valueAsString(json['title']),
        discountType: valueAsString(json['discount_type']),
        discountValue: valueAsInt(json['discount_value']),
        minOrderPaise: valueAsInt(json['min_order_paise']),
      );
}

class CartItemRequest {
  CartItemRequest({
    required this.name,
    required this.quantity,
    required this.pricePaise,
    this.modifiers = const [],
  });

  final String name;
  final int quantity;
  final int pricePaise;
  final List<CartItemModifierRequest> modifiers;

  Map<String, dynamic> toJson() => {
        'name': name,
        'quantity': quantity,
        'pricePaise': pricePaise,
        if (modifiers.isNotEmpty)
          'modifiers': modifiers.map((modifier) => modifier.toJson()).toList(),
      };
}

class CartItemModifierRequest {
  const CartItemModifierRequest({required this.name, required this.pricePaise});

  final String name;
  final int pricePaise;

  Map<String, dynamic> toJson() => {
        'name': name,
        'pricePaise': pricePaise,
      };
}

class CreateOrderResponse {
  CreateOrderResponse(
      {required this.id,
      required this.totalPaise,
      required this.status,
      this.subtotalPaise = 0,
      this.taxPaise = 0,
      this.platformFeePaise = 0,
      this.deliveryFeePaise = 0,
      this.discountPaise = 0,
      this.couponCode,
      this.estimatedDeliveryAt});

  final String id;
  final int totalPaise;
  final String status;
  final int subtotalPaise;
  final int taxPaise;
  final int platformFeePaise;
  final int deliveryFeePaise;
  final int discountPaise;
  final String? couponCode;
  final String? estimatedDeliveryAt;

  factory CreateOrderResponse.fromJson(Map<String, dynamic> json) =>
      CreateOrderResponse(
        id: valueAsString(json['id']),
        totalPaise: valueAsInt(json['totalPaise'] ?? json['total_paise']),
        status: valueAsString(json['status']),
        subtotalPaise:
            valueAsInt(json['subtotalPaise'] ?? json['subtotal_paise']),
        taxPaise: valueAsInt(json['taxPaise'] ?? json['tax_paise']),
        platformFeePaise:
            valueAsInt(json['platformFeePaise'] ?? json['platform_fee_paise']),
        deliveryFeePaise:
            valueAsInt(json['deliveryFeePaise'] ?? json['delivery_fee_paise']),
        discountPaise:
            valueAsInt(json['discountPaise'] ?? json['discount_paise']),
        couponCode:
            json['couponCode']?.toString() ?? json['coupon_code']?.toString(),
        estimatedDeliveryAt: json['estimatedDeliveryAt']?.toString() ??
            json['estimated_delivery_at']?.toString(),
      );
}

class OrderSummary {
  OrderSummary({
    required this.id,
    required this.status,
    required this.totalPaise,
    this.estimatedDeliveryAt,
    this.createdAt,
  });

  final String id;
  final String status;
  final int totalPaise;
  final String? estimatedDeliveryAt;
  final String? createdAt;

  factory OrderSummary.fromJson(Map<String, dynamic> json) => OrderSummary(
        id: valueAsString(json['id']),
        status: valueAsString(json['status']),
        totalPaise: valueAsInt(json['total_paise'] ?? json['totalPaise']),
        estimatedDeliveryAt: json['estimated_delivery_at']?.toString() ??
            json['estimatedDeliveryAt']?.toString(),
        createdAt: json['created_at']?.toString(),
      );
}

class OrderDetails extends OrderSummary {
  OrderDetails({
    required super.id,
    required super.status,
    required super.totalPaise,
    super.estimatedDeliveryAt,
    super.createdAt,
    required this.deliveryAddress,
    this.deliveryLat,
    this.deliveryLng,
    this.driverPhone,
    this.driverName,
    this.subtotalPaise = 0,
    this.taxPaise = 0,
    this.platformFeePaise = 0,
    this.deliveryFeePaise = 0,
    this.discountPaise = 0,
    this.couponCode,
    required this.items,
    required this.history,
  });

  final String deliveryAddress;
  final double? deliveryLat;
  final double? deliveryLng;
  final String? driverPhone;
  final String? driverName;
  final int subtotalPaise;
  final int taxPaise;
  final int platformFeePaise;
  final int deliveryFeePaise;
  final int discountPaise;
  final String? couponCode;
  final List<OrderItem> items;
  final List<OrderHistoryEvent> history;

  factory OrderDetails.fromJson(Map<String, dynamic> json) => OrderDetails(
        id: valueAsString(json['id']),
        status: valueAsString(json['status']),
        totalPaise: valueAsInt(json['total_paise'] ?? json['totalPaise']),
        estimatedDeliveryAt: json['estimated_delivery_at']?.toString() ??
            json['estimatedDeliveryAt']?.toString(),
        createdAt: json['created_at']?.toString(),
        deliveryAddress: valueAsString(json['delivery_address']),
        deliveryLat: valueAsDouble(json['delivery_lat']),
        deliveryLng: valueAsDouble(json['delivery_lng']),
        driverPhone: json['driver_phone']?.toString(),
        driverName: json['driver_name']?.toString(),
        subtotalPaise:
            valueAsInt(json['subtotalPaise'] ?? json['subtotal_paise']),
        taxPaise: valueAsInt(json['taxPaise'] ?? json['tax_paise']),
        platformFeePaise:
            valueAsInt(json['platformFeePaise'] ?? json['platform_fee_paise']),
        deliveryFeePaise:
            valueAsInt(json['deliveryFeePaise'] ?? json['delivery_fee_paise']),
        discountPaise:
            valueAsInt(json['discountPaise'] ?? json['discount_paise']),
        couponCode:
            json['couponCode']?.toString() ?? json['coupon_code']?.toString(),
        items: ((json['items'] as List?) ?? const [])
            .map((item) =>
                OrderItem.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList(),
        history: ((json['history'] as List?) ?? const [])
            .map((item) => OrderHistoryEvent.fromJson(
                Map<String, dynamic>.from(item as Map)))
            .toList(),
      );
}

class OrderItem {
  OrderItem({
    required this.name,
    required this.quantity,
    required this.pricePaise,
    this.modifiers = const [],
  });

  final String name;
  final int quantity;
  final int pricePaise;
  final List<OrderItemModifier> modifiers;

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        name: valueAsString(json['name']),
        quantity: valueAsInt(json['quantity']),
        pricePaise: valueAsInt(json['price_paise'] ?? json['pricePaise']),
        modifiers: ((json['modifiers'] as List?) ?? const [])
            .map((item) => OrderItemModifier.fromJson(
                Map<String, dynamic>.from(item as Map)))
            .toList(),
      );
}

class OrderItemModifier {
  const OrderItemModifier({required this.name, required this.pricePaise});

  final String name;
  final int pricePaise;

  factory OrderItemModifier.fromJson(Map<String, dynamic> json) =>
      OrderItemModifier(
        name: valueAsString(json['name']),
        pricePaise: valueAsInt(json['pricePaise'] ?? json['price_paise']),
      );
}

class OrderHistoryEvent {
  OrderHistoryEvent(
      {required this.status, required this.note, required this.createdAt});

  final String status;
  final String note;
  final String createdAt;

  factory OrderHistoryEvent.fromJson(Map<String, dynamic> json) =>
      OrderHistoryEvent(
        status: valueAsString(json['status']),
        note: json['note']?.toString() ?? '',
        createdAt: json['created_at']?.toString() ?? '',
      );
}

class PaymentStart {
  PaymentStart({
    required this.provider,
    this.status,
    this.orderId,
    this.amountPaise,
    this.redirectUrl,
    this.paymentUrl,
    this.deepLinkUrl,
    this.intentUrl,
    this.callbackUrl,
    this.returnUrl,
    this.transactionId,
    this.note,
  });

  final String provider;
  final String? status;
  final String? orderId;
  final int? amountPaise;
  final String? redirectUrl;
  final String? paymentUrl;
  final String? deepLinkUrl;
  final String? intentUrl;
  final String? callbackUrl;
  final String? returnUrl;
  final String? transactionId;
  final String? note;

  String? get launchUrl =>
      deepLinkUrl ?? intentUrl ?? redirectUrl ?? paymentUrl;

  factory PaymentStart.fromJson(Map<String, dynamic> json) => PaymentStart(
        provider: valueAsString(json['provider']),
        status: json['status']?.toString(),
        orderId: json['orderId']?.toString() ?? json['order_id']?.toString(),
        amountPaise: json['amountPaise'] == null && json['amount_paise'] == null
            ? null
            : valueAsInt(json['amountPaise'] ?? json['amount_paise']),
        redirectUrl:
            json['redirectUrl']?.toString() ?? json['redirect_url']?.toString(),
        paymentUrl:
            json['paymentUrl']?.toString() ?? json['payment_url']?.toString(),
        deepLinkUrl: json['deepLinkUrl']?.toString() ??
            json['deep_link_url']?.toString(),
        intentUrl:
            json['intentUrl']?.toString() ?? json['intent_url']?.toString(),
        callbackUrl:
            json['callbackUrl']?.toString() ?? json['callback_url']?.toString(),
        returnUrl:
            json['returnUrl']?.toString() ?? json['return_url']?.toString(),
        transactionId: json['transactionId']?.toString() ??
            json['transaction_id']?.toString(),
        note: json['note']?.toString(),
      );
}

class PaymentStatusSnapshot {
  const PaymentStatusSnapshot({
    required this.orderId,
    required this.state,
    this.payment,
    this.refunds = const [],
  });

  final String orderId;
  final String state;
  final PaymentRecord? payment;
  final List<RefundRecord> refunds;

  bool get isPending => state == 'pending';
  bool get isSuccess => state == 'success';
  bool get isFailure => state == 'failure';
  bool get isNotStarted => state == 'not_started';

  factory PaymentStatusSnapshot.fromJson(Map<String, dynamic> json) =>
      PaymentStatusSnapshot(
        orderId: valueAsString(json['orderId'] ?? json['order_id']),
        state: valueAsString(json['state']).isEmpty
            ? 'not_started'
            : valueAsString(json['state']),
        payment: json['payment'] == null
            ? null
            : PaymentRecord.fromJson(
                Map<String, dynamic>.from(json['payment'] as Map)),
        refunds: ((json['refunds'] as List?) ?? const [])
            .map((item) =>
                RefundRecord.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList(),
      );
}

class PaymentRecord {
  const PaymentRecord({
    required this.id,
    required this.provider,
    required this.amountPaise,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String provider;
  final int amountPaise;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  factory PaymentRecord.fromJson(Map<String, dynamic> json) => PaymentRecord(
        id: valueAsString(json['id']),
        provider: valueAsString(json['provider']),
        amountPaise: valueAsInt(json['amount_paise'] ?? json['amountPaise']),
        status: valueAsString(json['status']),
        createdAt:
            json['created_at']?.toString() ?? json['createdAt']?.toString(),
        updatedAt:
            json['updated_at']?.toString() ?? json['updatedAt']?.toString(),
      );
}

class RefundRecord {
  const RefundRecord({
    required this.id,
    required this.provider,
    required this.amountPaise,
    required this.status,
    this.reason,
    this.note,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String provider;
  final int amountPaise;
  final String status;
  final String? reason;
  final String? note;
  final String? createdAt;
  final String? updatedAt;

  factory RefundRecord.fromJson(Map<String, dynamic> json) => RefundRecord(
        id: valueAsString(json['id']),
        provider: valueAsString(json['provider']),
        amountPaise: valueAsInt(json['amount_paise'] ?? json['amountPaise']),
        status: valueAsString(json['status']),
        reason: json['reason']?.toString(),
        note: json['note']?.toString(),
        createdAt:
            json['created_at']?.toString() ?? json['createdAt']?.toString(),
        updatedAt:
            json['updated_at']?.toString() ?? json['updatedAt']?.toString(),
      );
}

class OrderEta {
  OrderEta({
    required this.predictedEtaMinutes,
    required this.predictedDeliveryAt,
    required this.origin,
    required this.pickup,
    required this.dropoff,
    required this.distanceToPickupKm,
    required this.distanceToDropoffKm,
    this.status,
    this.currentEstimatedDeliveryAt,
    this.driverLocationAt,
  });

  final int predictedEtaMinutes;
  final String predictedDeliveryAt;
  final GeoPoint origin;
  final GeoPoint pickup;
  final GeoPoint dropoff;
  final double distanceToPickupKm;
  final double distanceToDropoffKm;
  final String? status;
  final String? currentEstimatedDeliveryAt;
  final String? driverLocationAt;

  factory OrderEta.fromJson(Map<String, dynamic> json) {
    final route =
        Map<String, dynamic>.from((json['route'] as Map?) ?? const {});
    return OrderEta(
      predictedEtaMinutes: valueAsInt(json['predictedEtaMinutes']),
      predictedDeliveryAt: valueAsString(json['predictedDeliveryAt']),
      origin: GeoPoint.fromJson(
          Map<String, dynamic>.from((route['origin'] as Map?) ?? const {})),
      pickup: GeoPoint.fromJson(
          Map<String, dynamic>.from((route['pickup'] as Map?) ?? const {})),
      dropoff: GeoPoint.fromJson(
          Map<String, dynamic>.from((route['dropoff'] as Map?) ?? const {})),
      distanceToPickupKm: valueAsDouble(route['distanceToPickupKm']) ?? 0,
      distanceToDropoffKm: valueAsDouble(route['distanceToDropoffKm']) ?? 0,
      status: json['status']?.toString(),
      currentEstimatedDeliveryAt:
          json['currentEstimatedDeliveryAt']?.toString() ??
              json['current_estimated_delivery_at']?.toString(),
      driverLocationAt: json['driverLocationAt']?.toString() ??
          json['driver_location_at']?.toString(),
    );
  }
}

class EtaEvent {
  EtaEvent(
      {required this.id,
      required this.predictedEtaMinutes,
      required this.createdAt});

  final String id;
  final int predictedEtaMinutes;
  final String createdAt;

  factory EtaEvent.fromJson(Map<String, dynamic> json) => EtaEvent(
        id: valueAsString(json['id']),
        predictedEtaMinutes: valueAsInt(json['predicted_eta_minutes']),
        createdAt: valueAsString(json['created_at']),
      );
}

class GeoPoint {
  const GeoPoint({required this.lat, required this.lng});

  final double lat;
  final double lng;

  factory GeoPoint.fromJson(Map<String, dynamic> json) => GeoPoint(
        lat: valueAsDouble(json['lat']) ?? 0,
        lng: valueAsDouble(json['lng']) ?? 0,
      );
}

String valueAsString(dynamic value) => value?.toString() ?? '';

int valueAsInt(dynamic value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double? valueAsDouble(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString());
}

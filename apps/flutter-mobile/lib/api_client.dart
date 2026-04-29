import 'dart:convert';

import 'package:http/http.dart' as http;

class AmberApiClient {
  AmberApiClient({this.baseUrl = 'http://localhost:4000'});

  final String baseUrl;
  String token = '';

  Map<String, String> _headers({String? idempotencyKey}) => {
        'content-type': 'application/json',
        if (token.isNotEmpty) 'authorization': 'Bearer $token',
        if (idempotencyKey != null) 'idempotency-key': idempotencyKey,
      };

  Future<dynamic> _get(String path) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: _headers());
    return _decode(response);
  }

  Future<dynamic> _post(String path, Map<String, dynamic> body, {String? idempotencyKey}) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers(idempotencyKey: idempotencyKey),
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> _patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(Uri.parse('$baseUrl$path'), headers: _headers(), body: jsonEncode(body));
    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    final body = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = body is Map<String, dynamic> ? body['error'] ?? body['message'] : response.reasonPhrase;
      throw Exception(message ?? 'Request failed with ${response.statusCode}');
    }
    return body;
  }

  Future<dynamic> requestOtp(String phone) => _post('/api/v1/auth/otp/request', {'phone': phone});

  Future<dynamic> verifyOtp(String phone, String code, String role) async {
    final session = await _post('/api/v1/auth/otp/verify', {'phone': phone, 'code': code, 'role': role});
    if (session is Map<String, dynamic> && session['token'] is String) {
      token = session['token'] as String;
    }
    return session;
  }

  Future<dynamic> googleLogin(String idToken, String role) async {
    final session = await _post('/api/v1/auth/google', {'idToken': idToken, 'role': role});
    if (session is Map<String, dynamic> && session['token'] is String) {
      token = session['token'] as String;
    }
    return session;
  }

  Future<dynamic> createOrder({String restaurantId = '00000000-0000-0000-0000-000000000001'}) => _post(
        '/api/v1/orders',
        {
          'restaurantId': restaurantId,
          'deliveryAddress': 'Flutter demo delivery address',
          'deliveryLat': 28.6139,
          'deliveryLng': 77.209,
          'items': [
            {'name': 'Flutter Demo Thali', 'quantity': 1, 'pricePaise': 24900}
          ],
        },
        idempotencyKey: 'flutter-${DateTime.now().millisecondsSinceEpoch}',
      );

  Future<dynamic> getOrder(String orderId) => _get('/api/v1/orders/$orderId');
  Future<dynamic> editOrderBeforeConfirmation(String orderId, String deliveryAddress) => _patch('/api/v1/orders/$orderId', {
        'deliveryAddress': deliveryAddress,
        'deliveryLat': 28.6139,
        'deliveryLng': 77.209,
      });
  Future<dynamic> cancelOrder(String orderId, String reason) => _post('/api/v1/orders/$orderId/cancel', {'reason': reason});
  Future<dynamic> reorder(String orderId) => _post('/api/v1/orders/$orderId/reorder', {});
  Future<dynamic> createPayment(String provider, String orderId) => _post('/api/v1/payments/create', {
        'provider': provider,
        'orderId': orderId,
        'amountPaise': 24900,
      });
  Future<dynamic> requestRefund(String orderId, String reason, {int? amountPaise}) => _post('/api/v1/payments/refunds', {
        'orderId': orderId,
        'reason': reason,
        if (amountPaise != null) 'amountPaise': amountPaise,
      });

  Future<dynamic> registerDeviceToken(String pushToken) => _post('/api/v1/notifications/device-token', {'token': pushToken, 'platform': 'flutter'});
  Future<dynamic> sendTestNotification() => _post('/api/v1/notifications/test', {});

  Future<dynamic> availableDeliveryOrders() => _get('/api/v1/orders/available');
  Future<dynamic> acceptDeliveryOrder(String orderId) => _patch('/api/v1/orders/$orderId/assign', {});
  Future<dynamic> updateOrderStatus(String orderId, String status) => _patch('/api/v1/orders/$orderId/status', {'status': status});
  Future<dynamic> sendDriverLocation(String orderId, double lat, double lng) => _post('/api/v1/tracking/orders/$orderId/location', {'lat': lat, 'lng': lng});

  Future<dynamic> submitDriverOnboarding() => _post('/api/v1/driver-onboarding/signup', {
        'fullName': 'Flutter Driver',
        'aadhaarLast4': '1234',
        'aadhaarFrontUrl': 'https://example.com/aadhaar-front.jpg',
        'aadhaarBackUrl': 'https://example.com/aadhaar-back.jpg',
        'selfieUrl': 'https://example.com/selfie.jpg',
        'bankAccountLast4': '6789',
        'upiId': 'driver@upi',
      });
  Future<dynamic> myDriverOnboarding() => _get('/api/v1/driver-onboarding/mine');
  Future<dynamic> runDriverBackgroundCheck() => _post('/api/v1/driver-onboarding/background-check', {'consent': true});
  Future<dynamic> driverOnboardingApplications() => _get('/api/v1/driver-onboarding/admin/applications');
  Future<dynamic> updateDriverApplicationApproval(String id, String status, {String? note}) =>
      _patch('/api/v1/driver-onboarding/admin/applications/$id/approval', {'status': status, if (note != null) 'note': note});
  Future<dynamic> driverReferrals() => _get('/api/v1/driver-onboarding/admin/referrals');

  Future<dynamic> orderEta(String orderId) => _get('/api/v1/tracking/orders/$orderId/eta');
  Future<dynamic> orderEtaLoop(String orderId) => _get('/api/v1/tracking/orders/$orderId/eta-loop');

  Future<dynamic> adminDashboard() => _get('/api/v1/admin/dashboard');
  Future<dynamic> adminRestaurants() => _get('/api/v1/admin/restaurants');
  Future<dynamic> updateRestaurantApproval(String id, String status) => _patch('/api/v1/admin/restaurants/$id/approval', {'status': status});
  Future<dynamic> adminUsers() => _get('/api/v1/admin/users');
  Future<dynamic> adminAllOrders() => _get('/api/v1/admin/orders');
  Future<dynamic> paymentReports() => _get('/api/v1/admin/payment-reports');
  Future<dynamic> platformAnalytics() => _get('/api/v1/admin/analytics');
  Future<dynamic> runDemandPredictionJob() => _post('/api/v1/operations/analytics/jobs/demand-prediction', {});
  Future<dynamic> analyticsJobs() => _get('/api/v1/operations/analytics/jobs');
  Future<dynamic> demandPredictions() => _get('/api/v1/operations/demand-predictions');

  Future<dynamic> onboardRestaurant() => _post('/api/v1/restaurants/onboarding', {
        'name': 'Amber Flutter Kitchen',
        'address': 'Delhi NCR',
        'contactName': 'Flutter Owner',
        'contactPhone': '+919999000005',
        'cuisineType': 'North Indian',
        'fssaiLicense': 'FSSAI-FLUTTER',
        'gstNumber': 'GST-FLUTTER',
        'bankAccountLast4': '4321',
      });
  Future<dynamic> myRestaurants() => _get('/api/v1/restaurants/mine');
  Future<dynamic> googlePlacesDelhiNcrRestaurants({double minRating = 3}) => _get('/api/v1/restaurants/google-places/delhi-ncr?minRating=$minRating');
  Future<dynamic> trendingRestaurants({double lat = 28.6139, double lng = 77.209}) => _get('/api/v1/restaurants/trending?lat=$lat&lng=$lng');
  Future<dynamic> searchRestaurants({
    String q = '',
    String cuisine = '',
    String diet = 'all',
    double minRating = 3,
    int maxPricePaise = 0,
    String sort = 'distance',
    double lat = 28.6139,
    double lng = 77.209,
  }) =>
      _get('/api/v1/restaurants/search?q=$q&cuisine=$cuisine&diet=$diet&minRating=$minRating&maxPricePaise=$maxPricePaise&sort=$sort&lat=$lat&lng=$lng');

  Future<dynamic> createMenuItem(String restaurantId) => _post('/api/v1/restaurants/$restaurantId/menu', {
        'name': 'Flutter Paneer Bowl',
        'pricePaise': 24900,
        'description': 'Paneer, rice, salad, and chutney',
        'photoUrl': 'https://placehold.co/640x480?text=Flutter+Paneer+Bowl',
        'isVeg': true,
        'cuisineType': 'North Indian',
        'rating': 4.3,
        'isAvailable': true,
      });
  Future<dynamic> importMenuItems(String restaurantId) => _post('/api/v1/restaurants/$restaurantId/menu/import', {
        'items': [
          {
            'name': 'Flutter Imported Thali',
            'pricePaise': 27900,
            'description': 'Imported menu item with cuisine, photo, veg flag, and rating',
            'photoUrl': 'https://placehold.co/640x480?text=Flutter+Imported+Thali',
            'isVeg': true,
            'cuisineType': 'North Indian',
            'rating': 4.2,
          }
        ]
      });
  Future<dynamic> restaurantOrders(String restaurantId) => _get('/api/v1/restaurants/$restaurantId/orders');
  Future<dynamic> decideRestaurantOrder(String orderId, String decision) => _patch('/api/v1/restaurants/orders/$orderId/decision', {'decision': decision});
  Future<dynamic> restaurantEarnings(String restaurantId) => _get('/api/v1/restaurants/$restaurantId/earnings');

  Future<dynamic> deliveryAdminOrders() => _get('/api/v1/delivery-admin/orders');
  Future<dynamic> deliveryDrivers() => _get('/api/v1/delivery-admin/drivers');
  Future<dynamic> assignDriver(String orderId, String driverId) => _patch('/api/v1/delivery-admin/orders/$orderId/assign-driver', {'driverId': driverId});
  Future<dynamic> driverLoadBalancing() => _get('/api/v1/operations/driver-load');
  Future<dynamic> assignBestDriver(String orderId) => _post('/api/v1/operations/orders/$orderId/assign-best-driver', {});

  Future<dynamic> walletSummary() => _get('/api/v1/wallet/summary');
  Future<dynamic> walletTransactions() => _get('/api/v1/wallet/transactions');
  Future<dynamic> driverEarnings() => _get('/api/v1/wallet/earnings');
  Future<dynamic> requestPayout(int amountPaise, String method, {String? upiId, String? bankAccountLast4}) =>
      _post('/api/v1/wallet/payouts/request', {'amountPaise': amountPaise, 'method': method, if (upiId != null) 'upiId': upiId, if (bankAccountLast4 != null) 'bankAccountLast4': bankAccountLast4});
  Future<dynamic> adminPayouts() => _get('/api/v1/wallet/payouts');
  Future<dynamic> updatePayoutApproval(String id, String status, {String? note}) => _patch('/api/v1/wallet/payouts/$id/approval', {'status': status, if (note != null) 'note': note});

  Future<dynamic> marketplaceZones() => _get('/api/v1/marketplace/zones');
  Future<dynamic> createZone() => _post('/api/v1/marketplace/zones', {'name': 'Flutter Zone', 'city': 'Delhi NCR', 'centerLat': 28.6139, 'centerLng': 77.209, 'radiusKm': 3, 'slaMinutes': 20});
  Future<dynamic> marketplaceOffers() => _get('/api/v1/marketplace/offers');
  Future<dynamic> createOffer() => _post('/api/v1/marketplace/offers', {'code': 'FLUTTER50', 'title': 'Flutter Offer', 'discountType': 'flat', 'discountValue': 5000, 'minOrderPaise': 19900});
  Future<dynamic> createRestaurantReview(String restaurantId, {String? orderId}) =>
      _post('/api/v1/marketplace/restaurants/$restaurantId/reviews', {'rating': 5, 'comment': 'Flutter review', if (orderId != null) 'orderId': orderId});
  Future<dynamic> createSupportTicket({String? orderId}) => _post('/api/v1/marketplace/support/tickets', {
        'category': 'order',
        'subject': 'Flutter support',
        'message': 'Need help from Flutter app',
        if (orderId != null) 'orderId': orderId,
      });
  Future<dynamic> campaigns() => _get('/api/v1/marketplace/campaigns');
  Future<dynamic> createCampaign() => _post('/api/v1/marketplace/campaigns', {'name': 'Flutter Push Campaign', 'channel': 'push', 'budgetPaise': 100000, 'aiCreative': 'AI mobile lunch creative'});
  Future<dynamic> createDriverIncentive() => _post('/api/v1/marketplace/driver-incentives', {'title': 'Flutter delivery bonus', 'targetDeliveries': 5, 'rewardPaise': 7500});
  Future<dynamic> driverIncentives() => _get('/api/v1/marketplace/driver-incentives');

  Future<dynamic> createAzureBlobAsset() => _post('/api/v1/integrations/azure/blob/assets', {'fileName': 'flutter-aadhaar.jpg', 'contentType': 'image/jpeg', 'sizeBytes': 250000});
  Future<dynamic> verifyAzureOcr() => _post('/api/v1/integrations/azure/ocr/verify', {'imageUrl': 'https://example.com/aadhaar-front.jpg'});
  Future<dynamic> verifyAzureFace() => _post('/api/v1/integrations/azure/face/verify', {'selfieUrl': 'https://example.com/selfie.jpg', 'documentUrl': 'https://example.com/aadhaar-front.jpg'});
  Future<dynamic> auditLogs() => _get('/api/v1/integrations/audit-logs');
  Future<dynamic> verificationChecks() => _get('/api/v1/integrations/verification-checks');
}

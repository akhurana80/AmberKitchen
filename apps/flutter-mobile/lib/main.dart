import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';

void main() {
  runApp(const AmberKitchenFlutterApp());
}

class AmberKitchenFlutterApp extends StatelessWidget {
  const AmberKitchenFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AmberKitchen Flutter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff0f766e)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xfff7f4ef),
      ),
      home: const AmberKitchenHome(),
    );
  }
}

class AmberKitchenHome extends StatefulWidget {
  const AmberKitchenHome({super.key});

  @override
  State<AmberKitchenHome> createState() => _AmberKitchenHomeState();
}

class _AmberKitchenHomeState extends State<AmberKitchenHome> {
  final api = AmberApiClient(baseUrl: const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:4000'));
  final phone = TextEditingController(text: '+919999000001');
  final otp = TextEditingController();
  final googleToken = TextEditingController();
  String role = 'customer';
  int tab = 0;
  String notice = 'Flutter iOS/Android app ready. Use Demo to preview all features.';
  String orderId = '';
  String restaurantId = '00000000-0000-0000-0000-000000000001';
  final demoEvents = <String>[];

  static const delhi = LatLng(28.6139, 77.2090);
  static const pickup = LatLng(28.6315, 77.2167);
  static const dropoff = LatLng(28.5890, 77.2210);

  Future<void> runApi(String label, Future<dynamic> Function() work) async {
    setState(() => notice = '$label...');
    try {
      final result = await work();
      if (result is Map<String, dynamic>) {
        if (result['token'] is String) {
          api.token = result['token'] as String;
        }
        if (result['id'] is String) {
          orderId = result['id'] as String;
        }
      }
      setState(() => notice = '$label complete.');
    } catch (error) {
      setState(() => notice = '$label failed: $error');
    }
  }

  void runFullDemo() {
    const events = [
      'OTP login and Google login',
      'Restaurant search with cuisine, veg/non-veg, rating, distance, price sorting',
      'Google Places Delhi NCR restaurant import',
      'Trending restaurants and ETA prediction',
      'Place order, edit before confirmation, cancel, refund, reorder',
      'PhonePe, Paytm, and Razorpay payment start flows',
      'Push notification registration and test push',
      'Live tracking map, ETA loop, route navigation',
      'Driver signup, Aadhaar URL upload, OCR, selfie face check, background check',
      'Driver order acceptance, status updates, live location, wallet, earnings, payout request',
      'Restaurant onboarding, separate panel, menu add/import with photos, accept/reject orders, earnings',
      'Super admin dashboard, users, restaurant approvals, all orders, payment reports',
      'Delivery admin live tracking, driver assignment, load balancing, best-driver assignment',
      'AI demand prediction, analytics jobs, demand prediction history',
      'Zones, offers, campaigns, driver incentives, reviews, support tickets',
      'Azure Blob, Azure OCR, Azure Face checks, audit logs, verification monitoring',
      'Admin payout approval',
    ];
    setState(() {
      demoEvents
        ..clear()
        ..addAll(events);
      notice = 'Demo loaded with every web feature represented on Flutter mobile.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      customerPage(),
      driverPage(),
      restaurantPage(),
      adminPage(),
      demoPage(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('AmberKitchen Flutter'),
        actions: [
          TextButton(
            onPressed: runFullDemo,
            child: const Text('Run Demo'),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(notice, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 12),
            loginCard(),
            const SizedBox(height: 12),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('Customer')),
                ButtonSegment(value: 1, label: Text('Driver')),
                ButtonSegment(value: 2, label: Text('Restaurant')),
                ButtonSegment(value: 3, label: Text('Admin')),
                ButtonSegment(value: 4, label: Text('Demo')),
              ],
              selected: {tab},
              onSelectionChanged: (value) => setState(() => tab = value.first),
            ),
            const SizedBox(height: 12),
            pages[tab],
          ],
        ),
      ),
    );
  }

  Widget loginCard() {
    return FeatureCard(
      title: 'Authentication + Push',
      children: [
        TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone')),
        TextField(controller: otp, decoration: const InputDecoration(labelText: 'OTP')),
        DropdownButtonFormField<String>(
          initialValue: role,
          decoration: const InputDecoration(labelText: 'Role'),
          items: const ['customer', 'driver', 'restaurant', 'admin', 'super_admin', 'delivery_admin']
              .map((value) => DropdownMenuItem(value: value, child: Text(value)))
              .toList(),
          onChanged: (value) => setState(() => role = value ?? role),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ActionChip(label: const Text('Send OTP'), onPressed: () => runApi('Send OTP', () => api.requestOtp(phone.text))),
            ActionChip(label: const Text('Verify OTP'), onPressed: () => runApi('Verify OTP', () => api.verifyOtp(phone.text, otp.text, role))),
            ActionChip(label: const Text('Register Push'), onPressed: () => runApi('Register Push', () => api.registerDeviceToken('flutter-demo-token'))),
            ActionChip(label: const Text('Test Push'), onPressed: () => runApi('Test Push', api.sendTestNotification)),
          ],
        ),
        TextField(controller: googleToken, decoration: const InputDecoration(labelText: 'Google ID token')),
        Align(
          alignment: Alignment.centerLeft,
          child: ActionChip(label: const Text('Google Login'), onPressed: () => runApi('Google Login', () => api.googleLogin(googleToken.text, role))),
        ),
      ],
    );
  }

  Widget customerPage() {
    return FeatureCard(
      title: 'Customer App',
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ActionChip(label: const Text('Search Restaurants'), onPressed: () => runApi('Search Restaurants', () => api.searchRestaurants())),
            ActionChip(label: const Text('Google Places'), onPressed: () => runApi('Google Places', () => api.googlePlacesDelhiNcrRestaurants())),
            ActionChip(label: const Text('Trending + ETA'), onPressed: () => runApi('Trending Restaurants', () => api.trendingRestaurants())),
            ActionChip(label: const Text('Place Order'), onPressed: () => runApi('Place Order', () => api.createOrder())),
            ActionChip(label: const Text('Load Order'), onPressed: orderId.isEmpty ? null : () => runApi('Load Order', () => api.getOrder(orderId))),
            ActionChip(label: const Text('Edit Order'), onPressed: orderId.isEmpty ? null : () => runApi('Edit Order', () => api.editOrderBeforeConfirmation(orderId, 'Flutter updated address'))),
            ActionChip(label: const Text('Cancel'), onPressed: orderId.isEmpty ? null : () => runApi('Cancel Order', () => api.cancelOrder(orderId, 'Flutter cancellation'))),
            ActionChip(label: const Text('Refund'), onPressed: orderId.isEmpty ? null : () => runApi('Refund', () => api.requestRefund(orderId, 'Flutter refund', amountPaise: 1000))),
            ActionChip(label: const Text('Reorder'), onPressed: orderId.isEmpty ? null : () => runApi('Reorder', () => api.reorder(orderId))),
            ActionChip(label: const Text('PhonePe'), onPressed: orderId.isEmpty ? null : () => runApi('PhonePe', () => api.createPayment('phonepe', orderId))),
            ActionChip(label: const Text('Paytm'), onPressed: orderId.isEmpty ? null : () => runApi('Paytm', () => api.createPayment('paytm', orderId))),
            ActionChip(label: const Text('Razorpay'), onPressed: orderId.isEmpty ? null : () => runApi('Razorpay', () => api.createPayment('razorpay', orderId))),
            ActionChip(label: const Text('ETA Loop'), onPressed: orderId.isEmpty ? null : () => runApi('ETA Loop', () async => [await api.orderEta(orderId), await api.orderEtaLoop(orderId)])),
            ActionChip(label: const Text('Review'), onPressed: () => runApi('Review', () => api.createRestaurantReview(restaurantId, orderId: orderId.isEmpty ? null : orderId))),
            ActionChip(label: const Text('Support'), onPressed: () => runApi('Support', () => api.createSupportTicket(orderId: orderId.isEmpty ? null : orderId))),
            ActionChip(label: const Text('Navigation'), onPressed: () => launchUrl(Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${dropoff.latitude},${dropoff.longitude}'))),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 260,
          child: GoogleMap(
            initialCameraPosition: const CameraPosition(target: delhi, zoom: 11),
            markers: {
              const Marker(markerId: MarkerId('driver'), position: delhi),
              const Marker(markerId: MarkerId('pickup'), position: pickup),
              const Marker(markerId: MarkerId('dropoff'), position: dropoff),
            },
            polylines: {
              const Polyline(polylineId: PolylineId('route'), points: [delhi, pickup, dropoff], width: 4, color: Color(0xff0f766e)),
            },
          ),
        ),
      ],
    );
  }

  Widget driverPage() {
    return FeatureCard(
      title: 'Delivery Partner App',
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ActionChip(label: const Text('Driver Signup'), onPressed: () => runApi('Driver Signup', api.submitDriverOnboarding)),
            ActionChip(label: const Text('My Onboarding'), onPressed: () => runApi('My Onboarding', api.myDriverOnboarding)),
            ActionChip(label: const Text('Background Check'), onPressed: () => runApi('Background Check', api.runDriverBackgroundCheck)),
            ActionChip(label: const Text('Available Orders'), onPressed: () => runApi('Available Orders', api.availableDeliveryOrders)),
            ActionChip(label: const Text('Accept Order'), onPressed: orderId.isEmpty ? null : () => runApi('Accept Order', () => api.acceptDeliveryOrder(orderId))),
            ActionChip(label: const Text('Picked Up'), onPressed: orderId.isEmpty ? null : () => runApi('Picked Up', () => api.updateOrderStatus(orderId, 'picked_up'))),
            ActionChip(label: const Text('Delivered'), onPressed: orderId.isEmpty ? null : () => runApi('Delivered', () => api.updateOrderStatus(orderId, 'delivered'))),
            ActionChip(label: const Text('Live Location'), onPressed: orderId.isEmpty ? null : () => runApi('Live Location', () => api.sendDriverLocation(orderId, delhi.latitude, delhi.longitude))),
            ActionChip(label: const Text('Wallet'), onPressed: () => runApi('Wallet', api.walletSummary)),
            ActionChip(label: const Text('Transactions'), onPressed: () => runApi('Transactions', api.walletTransactions)),
            ActionChip(label: const Text('Earnings'), onPressed: () => runApi('Earnings', api.driverEarnings)),
            ActionChip(label: const Text('Request Payout'), onPressed: () => runApi('Request Payout', () => api.requestPayout(50000, 'upi', upiId: 'driver@upi'))),
            ActionChip(label: const Text('Incentives'), onPressed: () => runApi('Incentives', api.driverIncentives)),
          ],
        ),
      ],
    );
  }

  Widget restaurantPage() {
    return FeatureCard(
      title: 'Restaurant Panel',
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ActionChip(label: const Text('Onboard Restaurant'), onPressed: () => runApi('Onboard Restaurant', api.onboardRestaurant)),
            ActionChip(label: const Text('My Restaurants'), onPressed: () => runApi('My Restaurants', api.myRestaurants)),
            ActionChip(label: const Text('Add Menu Photo'), onPressed: () => runApi('Add Menu', () => api.createMenuItem(restaurantId))),
            ActionChip(label: const Text('Import Menu Photos'), onPressed: () => runApi('Import Menu', () => api.importMenuItems(restaurantId))),
            ActionChip(label: const Text('Orders'), onPressed: () => runApi('Restaurant Orders', () => api.restaurantOrders(restaurantId))),
            ActionChip(label: const Text('Accept Order'), onPressed: orderId.isEmpty ? null : () => runApi('Accept Order', () => api.decideRestaurantOrder(orderId, 'accepted'))),
            ActionChip(label: const Text('Reject Order'), onPressed: orderId.isEmpty ? null : () => runApi('Reject Order', () => api.decideRestaurantOrder(orderId, 'cancelled'))),
            ActionChip(label: const Text('Earnings'), onPressed: () => runApi('Restaurant Earnings', () => api.restaurantEarnings(restaurantId))),
          ],
        ),
      ],
    );
  }

  Widget adminPage() {
    return FeatureCard(
      title: 'Admin + Operations',
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ActionChip(label: const Text('Dashboard'), onPressed: () => runApi('Dashboard', api.adminDashboard)),
            ActionChip(label: const Text('Users'), onPressed: () => runApi('Users', api.adminUsers)),
            ActionChip(label: const Text('Restaurants'), onPressed: () => runApi('Restaurants', api.adminRestaurants)),
            ActionChip(label: const Text('All Orders'), onPressed: () => runApi('All Orders', api.adminAllOrders)),
            ActionChip(label: const Text('Payments'), onPressed: () => runApi('Payments', api.paymentReports)),
            ActionChip(label: const Text('Analytics'), onPressed: () => runApi('Analytics', api.platformAnalytics)),
            ActionChip(label: const Text('AI Demand'), onPressed: () => runApi('AI Demand', api.runDemandPredictionJob)),
            ActionChip(label: const Text('Jobs'), onPressed: () => runApi('Jobs', api.analyticsJobs)),
            ActionChip(label: const Text('Predictions'), onPressed: () => runApi('Predictions', api.demandPredictions)),
            ActionChip(label: const Text('Driver Load'), onPressed: () => runApi('Driver Load', api.driverLoadBalancing)),
            ActionChip(label: const Text('Best Driver'), onPressed: orderId.isEmpty ? null : () => runApi('Best Driver', () => api.assignBestDriver(orderId))),
            ActionChip(label: const Text('Delivery Orders'), onPressed: () => runApi('Delivery Orders', api.deliveryAdminOrders)),
            ActionChip(label: const Text('Drivers'), onPressed: () => runApi('Drivers', api.deliveryDrivers)),
            ActionChip(label: const Text('Zones'), onPressed: () => runApi('Zones', api.marketplaceZones)),
            ActionChip(label: const Text('Create Zone'), onPressed: () => runApi('Create Zone', api.createZone)),
            ActionChip(label: const Text('Offers'), onPressed: () => runApi('Offers', api.marketplaceOffers)),
            ActionChip(label: const Text('Create Offer'), onPressed: () => runApi('Create Offer', api.createOffer)),
            ActionChip(label: const Text('Campaigns'), onPressed: () => runApi('Campaigns', api.campaigns)),
            ActionChip(label: const Text('Create Campaign'), onPressed: () => runApi('Create Campaign', api.createCampaign)),
            ActionChip(label: const Text('Create Incentive'), onPressed: () => runApi('Create Incentive', api.createDriverIncentive)),
            ActionChip(label: const Text('Driver Applications'), onPressed: () => runApi('Driver Applications', api.driverOnboardingApplications)),
            ActionChip(label: const Text('Driver Referrals'), onPressed: () => runApi('Driver Referrals', api.driverReferrals)),
            ActionChip(label: const Text('Payouts'), onPressed: () => runApi('Payouts', api.adminPayouts)),
            ActionChip(label: const Text('Azure Blob'), onPressed: () => runApi('Azure Blob', api.createAzureBlobAsset)),
            ActionChip(label: const Text('Azure OCR'), onPressed: () => runApi('Azure OCR', api.verifyAzureOcr)),
            ActionChip(label: const Text('Azure Face'), onPressed: () => runApi('Azure Face', api.verifyAzureFace)),
            ActionChip(label: const Text('Audit Logs'), onPressed: () => runApi('Audit Logs', api.auditLogs)),
            ActionChip(label: const Text('Verification Logs'), onPressed: () => runApi('Verification Logs', api.verificationChecks)),
          ],
        ),
      ],
    );
  }

  Widget demoPage() {
    return FeatureCard(
      title: 'Full Feature Demo',
      children: [
        FilledButton(onPressed: runFullDemo, child: const Text('Run complete mobile demo')),
        ...demoEvents.map((event) => ListTile(
              dense: true,
              leading: const Icon(Icons.check_circle, color: Color(0xff0f766e)),
              title: Text(event),
            )),
      ],
    );
  }
}

class FeatureCard extends StatelessWidget {
  const FeatureCard({required this.title, required this.children, super.key});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0xffe5e7eb)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }
}

import 'package:flutter_test/flutter_test.dart';

import 'package:amberkitchen_flutter/main.dart';

void main() {
  testWidgets('AmberKitchen Flutter requires production API configuration',
      (tester) async {
    await tester.pumpWidget(const AmberKitchenFlutterApp());
    await tester.pumpAndSettle();

    expect(find.text('Production setup required'), findsOneWidget);
    expect(find.textContaining('API_BASE_URL'), findsOneWidget);
  });
}

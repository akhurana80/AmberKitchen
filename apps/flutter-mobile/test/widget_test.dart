import 'package:flutter_test/flutter_test.dart';

import 'package:amberkitchen_flutter/main.dart';

void main() {
  testWidgets('AmberKitchen Flutter loads the full mobile shell', (tester) async {
    await tester.pumpWidget(const AmberKitchenFlutterApp());

    expect(find.text('AmberKitchen Flutter'), findsOneWidget);
    expect(find.text('Authentication + Push'), findsOneWidget);
    expect(find.text('Customer'), findsOneWidget);

    await tester.tap(find.text('Run Demo').first);
    await tester.pumpAndSettle();

    expect(find.text('Demo loaded with every web feature represented on Flutter mobile.'), findsOneWidget);
  });
}

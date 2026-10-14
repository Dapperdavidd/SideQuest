import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sidequest_mobile/main.dart';

void main() {
  testWidgets('renders SideQuest discovery', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: SideQuestApp()));
    await tester.pump();
    expect(find.text('sidequest'), findsOneWidget);
    expect(find.text('City sunset challenge'), findsOneWidget);
    expect(find.text('Discover'), findsOneWidget);
  });
}

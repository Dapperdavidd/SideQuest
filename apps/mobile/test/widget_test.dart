import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sidequest_mobile/main.dart';

void main() {
  testWidgets('renders SideQuest discovery', (tester) async {
    final quest = Quest(
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Live Lagos photo walk',
      creator: 'SideQuest Test',
      description: 'Photograph a landmark in the evening light.',
      questType: 'EXPLORE',
      status: 'OPEN',
      maxEntries: 5,
      entriesReceived: 1,
      winnerCount: 1,
      participantsJoined: 2,
      deadline: DateTime.now().add(const Duration(days: 5)),
      rewardEnabled: false,
      rewardAmountMinor: null,
      rewardCurrency: null,
      proofRequirements: const ['PHOTO'],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          questsProvider.overrideWith((ref) async => [quest]),
        ],
        child: const SideQuestApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('sidequest'), findsOneWidget);
    expect(find.text('Live Lagos photo walk'), findsWidgets);
    expect(find.text('Discover'), findsOneWidget);
  });
}

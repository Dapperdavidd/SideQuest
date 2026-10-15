import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

const background = Color(0xFFF8F8F5);
const ink = Color(0xFF171917);
const muted = Color(0xFF6F756F);
const accent = Color(0xFFC7FF00);
const line = Color(0xFFE6E8E2);
const apiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://127.0.0.1:8080/api/v1',
);

void main() => runApp(const ProviderScope(child: SideQuestApp()));

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/discover',
    routes: [
      GoRoute(
        path: '/discover',
        builder: (context, state) => const DiscoverScreen(),
      ),
      GoRoute(
        path: '/quests/:id',
        builder: (context, state) => QuestDetailScreen(
          questId: state.pathParameters['id']!,
          initialQuest: state.extra as Quest?,
        ),
      ),
    ],
  );
});

class SideQuestApp extends ConsumerWidget {
  const SideQuestApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'SideQuest',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      theme: ThemeData(
        scaffoldBackgroundColor: background,
        colorScheme: ColorScheme.fromSeed(
          seedColor: accent,
          brightness: Brightness.light,
        ),
        fontFamily: 'Geist',
        textTheme: const TextTheme(
          headlineLarge: TextStyle(fontWeight: FontWeight.w700, color: ink),
          headlineMedium: TextStyle(fontWeight: FontWeight.w700, color: ink),
          titleLarge: TextStyle(fontWeight: FontWeight.w700, color: ink),
        ),
        useMaterial3: true,
      ),
    );
  }
}

class Quest {
  const Quest({
    required this.id,
    required this.title,
    required this.creator,
    required this.description,
    required this.questType,
    required this.status,
    required this.maxEntries,
    required this.entriesReceived,
    required this.winnerCount,
    required this.participantsJoined,
    required this.deadline,
    required this.rewardEnabled,
    required this.rewardAmountMinor,
    required this.rewardCurrency,
    required this.proofRequirements,
    this.coverMediaUrl,
  });

  factory Quest.fromJson(Map<String, dynamic> json) => Quest(
    id: json['id'] as String,
    title: json['title'] as String,
    creator: json['creator_display_name'] as String,
    description: json['description'] as String,
    questType: json['quest_type'] as String,
    status: json['status'] as String,
    maxEntries: json['max_entries'] as int,
    entriesReceived: (json['entries_received'] as num).toInt(),
    winnerCount: json['winner_count'] as int,
    participantsJoined: (json['participants_joined'] as num).toInt(),
    deadline: DateTime.parse(json['deadline'] as String).toLocal(),
    rewardEnabled: json['reward_enabled'] as bool,
    rewardAmountMinor: (json['reward_amount_minor'] as num?)?.toInt(),
    rewardCurrency: json['reward_currency'] as String?,
    proofRequirements: (json['proof_requirements'] as List<dynamic>)
        .cast<String>(),
    coverMediaUrl: json['cover_media_url'] as String?,
  );

  final String id;
  final String title;
  final String creator;
  final String description;
  final String questType;
  final String status;
  final int maxEntries;
  final int entriesReceived;
  final int winnerCount;
  final int participantsJoined;
  final DateTime deadline;
  final bool rewardEnabled;
  final int? rewardAmountMinor;
  final String? rewardCurrency;
  final List<String> proofRequirements;
  final String? coverMediaUrl;

  String get image =>
      coverMediaUrl ??
      switch (questType) {
        'BOUNTY' => 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85',
        'FRIENDS' => 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=85',
        _ => 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85',
      };

  String get rewardLabel {
    if (!rewardEnabled || rewardAmountMinor == null) return 'Just for fun';
    final amount = rewardAmountMinor! / 100;
    final formatted = amount == amount.roundToDouble()
        ? amount.toStringAsFixed(0)
        : amount.toStringAsFixed(2);
    return '${rewardCurrency ?? 'USD'} $formatted';
  }

  String get timeLeft {
    final days = deadline.difference(DateTime.now()).inDays + 1;
    if (days <= 0) return 'Closed';
    return days == 1 ? '1 day left' : '$days days left';
  }
}

class QuestRepository {
  QuestRepository([Dio? dio])
    : _dio = dio ?? Dio(BaseOptions(baseUrl: apiBaseUrl));

  final Dio _dio;

  Future<List<Quest>> listQuests() async {
    final response = await _dio.get<List<dynamic>>('/quests');
    return response.data!
        .map((json) => Quest.fromJson(json as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<Quest> getQuest(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/quests/$id');
    return Quest.fromJson(response.data!);
  }
}

final questRepositoryProvider = Provider<QuestRepository>(
  (ref) => QuestRepository(),
);
final questsProvider = FutureProvider.autoDispose<List<Quest>>(
  (ref) => ref.watch(questRepositoryProvider).listQuests(),
);
final questProvider = FutureProvider.autoDispose.family<Quest, String>(
  (ref, id) => ref.watch(questRepositoryProvider).getQuest(id),
);

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  int selectedFilter = 0;

  @override
  Widget build(BuildContext context) {
    final asyncQuests = ref.watch(questsProvider);
    final filterTypes = [null, 'FRIENDS', 'BOUNTY', 'EXPLORE'];

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
              sliver: SliverToBoxAdapter(
                child: Row(
                  children: [
                    const Text(
                      'sidequest',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1.5,
                      ),
                    ),
                    const Text(
                      '.',
                      style: TextStyle(
                        color: Color(0xFF98C900),
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () {},
                      icon: const Icon(Icons.notifications_none_rounded),
                    ),
                    const CircleAvatar(
                      backgroundColor: ink,
                      foregroundColor: accent,
                      child: Text(
                        'H',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Good morning, Hannah ✌️',
                      style: TextStyle(color: muted, fontSize: 13),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Find your next\nsmall adventure.',
                      style: TextStyle(
                        fontSize: 31,
                        height: 1.08,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 48,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  scrollDirection: Axis.horizontal,
                  itemCount: 4,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final labels = ['All', 'Friends', 'Bounties', 'Explore'];
                    final selected = selectedFilter == index;
                    return ChoiceChip(
                      selected: selected,
                      onSelected: (_) => setState(() => selectedFilter = index),
                      showCheckmark: false,
                      label: Text(labels[index]),
                      selectedColor: ink,
                      backgroundColor: Colors.white,
                      side: const BorderSide(color: line),
                      labelStyle: TextStyle(
                        color: selected ? Colors.white : ink,
                        fontWeight: FontWeight.w600,
                      ),
                    );
                  },
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 110),
              sliver: SliverToBoxAdapter(
                child: asyncQuests.when(
                  data: (quests) {
                    final type = filterTypes[selectedFilter];
                    final filtered = type == null
                        ? quests
                        : quests
                              .where((quest) => quest.questType == type)
                              .toList(growable: false);
                    return _QuestFeed(quests: filtered);
                  },
                  loading: () => const _QuestFeedLoading(),
                  error: (_, _) => _QuestFeedError(
                    onRetry: () => ref.invalidate(questsProvider),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        indicatorColor: accent,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Discover',
          ),
          NavigationDestination(
            icon: Icon(Icons.emoji_events_outlined),
            label: 'Quests',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
            selectedIcon: Icon(Icons.add_circle),
            label: 'Create',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _QuestFeed extends StatelessWidget {
  const _QuestFeed({required this.quests});
  final List<Quest> quests;

  @override
  Widget build(BuildContext context) {
    if (quests.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 42),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: line),
        ),
        child: const Column(
          children: [
            CircleAvatar(
              radius: 25,
              backgroundColor: Color(0xFFE9FFB0),
              foregroundColor: ink,
              child: Icon(Icons.add_rounded),
            ),
            SizedBox(height: 16),
            Text(
              'No open quests yet',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
            ),
            SizedBox(height: 7),
            Text(
              'Try another category or create the first challenge.',
              textAlign: TextAlign.center,
              style: TextStyle(color: muted, height: 1.45),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        _FeaturedQuest(quest: quests.first),
        const SizedBox(height: 24),
        Row(
          children: [
            Text(
              'Open quests',
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontSize: 19),
            ),
            const Spacer(),
            Text(
              '${quests.length} live',
              style: const TextStyle(
                color: muted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (var index = 0; index < quests.length; index++) ...[
          if (index > 0) const SizedBox(height: 12),
          _QuestRow(quest: quests[index]),
        ],
      ],
    );
  }
}

class _QuestFeedLoading extends StatelessWidget {
  const _QuestFeedLoading();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        height: 290,
        decoration: BoxDecoration(
          color: const Color(0xFFECEEE8),
          borderRadius: BorderRadius.circular(24),
        ),
      ),
      const SizedBox(height: 20),
      const LinearProgressIndicator(
        color: ink,
        backgroundColor: Color(0xFFECEEE8),
      ),
    ],
  );
}

class _QuestFeedError extends StatelessWidget {
  const _QuestFeedError({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(28),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: line),
    ),
    child: Column(
      children: [
        const Icon(Icons.cloud_off_rounded, size: 34, color: muted),
        const SizedBox(height: 14),
        const Text(
          'Could not reach the quest service',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 7),
        const Text(
          'Check your connection, then try again.',
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 18),
        FilledButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    ),
  );
}

class _FeaturedQuest extends StatelessWidget {
  const _FeaturedQuest({required this.quest});
  final Quest quest;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 290,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: ink,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFF9E6D), Color(0xFF6D4977), Color(0xFF171917)],
        ),
      ),
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.transparent, Color(0xE8171917)],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  'FEATURED ${quest.questType}',
                  style: TextStyle(
                    color: ink,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .6,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                quest.title,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 23,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                quest.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 14),
              Text(
                '${quest.rewardLabel}  ·  ${quest.entriesReceived}/${quest.maxEntries} entries  ·  ${quest.winnerCount} winner${quest.winnerCount == 1 ? '' : 's'}',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuestRow extends StatelessWidget {
  const _QuestRow({required this.quest});
  final Quest quest;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/quests/${quest.id}', extra: quest),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: line),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(13),
              child: Image.network(
                quest.image,
                width: 94,
                height: 94,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  width: 94,
                  height: 94,
                  color: const Color(0xFFE9FFB0),
                ),
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    quest.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'by ${quest.creator}',
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    '${quest.rewardLabel} · ${quest.entriesReceived}/${quest.maxEntries} entries · ${quest.timeLeft}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: muted),
          ],
        ),
      ),
    );
  }
}

class QuestDetailScreen extends ConsumerWidget {
  const QuestDetailScreen({
    required this.questId,
    this.initialQuest,
    super.key,
  });

  final String questId;
  final Quest? initialQuest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (initialQuest != null) return _QuestDetail(quest: initialQuest!);
    return ref
        .watch(questProvider(questId))
        .when(
          data: (quest) => _QuestDetail(quest: quest),
          loading: () => const Scaffold(
            body: Center(child: CircularProgressIndicator(color: ink)),
          ),
          error: (_, _) => Scaffold(
            appBar: AppBar(backgroundColor: background),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_off_rounded, size: 40, color: muted),
                    const SizedBox(height: 14),
                    const Text(
                      'This quest could not be loaded.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => ref.invalidate(questProvider(questId)),
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
  }
}

class _QuestDetail extends StatelessWidget {
  const _QuestDetail({required this.quest});
  final Quest quest;

  @override
  Widget build(BuildContext context) {
    final remaining = math.max(0, quest.maxEntries - quest.entriesReceived);
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(
            expandedHeight: 310,
            pinned: true,
            backgroundColor: ink,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    quest.image,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const ColoredBox(color: ink),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0xE8171917)],
                      ),
                    ),
                  ),
                ],
              ),
              titlePadding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
              title: Text(
                quest.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 120),
            sliver: SliverList.list(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE9FFB0),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Text(
                        quest.questType,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      quest.rewardLabel,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  'by ${quest.creator}',
                  style: const TextStyle(color: muted, fontSize: 13),
                ),
                const SizedBox(height: 18),
                Text(
                  quest.description,
                  style: const TextStyle(color: muted, height: 1.55),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    _QuestStat(value: '$remaining', label: 'slots left'),
                    const SizedBox(width: 8),
                    _QuestStat(
                      value: '${quest.winnerCount}',
                      label: 'winner${quest.winnerCount == 1 ? '' : 's'}',
                    ),
                    const SizedBox(width: 8),
                    _QuestStat(
                      value: '${quest.participantsJoined}',
                      label: 'joined',
                    ),
                  ],
                ),
                const SizedBox(height: 26),
                const Text(
                  'Required proof',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: quest.proofRequirements
                      .map(
                        (proof) => Chip(
                          avatar: const Icon(
                            Icons.check_circle_outline,
                            size: 17,
                          ),
                          label: Text(proof.replaceAll('_', ' ').toLowerCase()),
                          backgroundColor: const Color(0xFFE9FFB0),
                          side: BorderSide.none,
                        ),
                      )
                      .toList(growable: false),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 10, 20, 14),
        child: FilledButton(
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Sign in on mobile to join this quest.'),
            ),
          ),
          style: FilledButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: ink,
            minimumSize: const Size.fromHeight(54),
          ),
          child: const Text(
            'Join this quest',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ),
    );
  }
}

class _QuestStat extends StatelessWidget {
  const _QuestStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: line),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 3),
          Text(label, style: const TextStyle(color: muted, fontSize: 11)),
        ],
      ),
    ),
  );
}

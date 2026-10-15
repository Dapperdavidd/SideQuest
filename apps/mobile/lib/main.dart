import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const background = Color(0xFFF8F8F5);
const ink = Color(0xFF171917);
const muted = Color(0xFF6F756F);
const accent = Color(0xFFC7FF00);
const line = Color(0xFFE6E8E2);
const apiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://127.0.0.1:8080/api/v1',
);
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabasePublishableKey = String.fromEnvironment(
  'SUPABASE_PUBLISHABLE_KEY',
);
const mobileAuthRedirect = 'app.sidequest://login-callback/';
final supabaseConfigured =
    supabaseUrl.isNotEmpty && supabasePublishableKey.isNotEmpty;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (supabaseConfigured) {
    await Supabase.initialize(
      url: supabaseUrl,
      publishableKey: supabasePublishableKey,
    );
  }
  runApp(const ProviderScope(child: SideQuestApp()));
}

Session? get currentSession =>
    supabaseConfigured ? Supabase.instance.client.auth.currentSession : null;

final authStateProvider = StreamProvider<AuthState>((ref) {
  if (!supabaseConfigured) return const Stream.empty();
  return Supabase.instance.client.auth.onAuthStateChange;
});

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
      GoRoute(
        path: '/auth',
        builder: (context, state) =>
            AuthScreen(next: state.uri.queryParameters['next'] ?? '/discover'),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/my-quests',
        builder: (context, state) => const MyQuestsScreen(),
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

  Future<void> joinQuest(String id, String accessToken) async {
    await _dio.post<void>(
      '/quests/$id/join',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
  }

  Future<List<MyQuest>> listMyQuests(String accessToken) async {
    final response = await _dio.get<List<dynamic>>(
      '/users/me/quests',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return response.data!
        .map((json) => MyQuest.fromJson(json as Map<String, dynamic>))
        .toList(growable: false);
  }
}

class MyQuest {
  const MyQuest({
    required this.id,
    required this.title,
    required this.questType,
    required this.status,
    required this.relationship,
    required this.deadline,
    required this.entriesReceived,
    required this.maxEntries,
    required this.participantsJoined,
    required this.rewardEnabled,
    required this.rewardAmountMinor,
    required this.rewardCurrency,
  });

  factory MyQuest.fromJson(Map<String, dynamic> json) => MyQuest(
    id: json['id'] as String,
    title: json['title'] as String,
    questType: json['quest_type'] as String,
    status: json['status'] as String,
    relationship: json['relationship'] as String,
    deadline: DateTime.parse(json['deadline'] as String).toLocal(),
    entriesReceived: (json['entries_received'] as num).toInt(),
    maxEntries: (json['max_entries'] as num).toInt(),
    participantsJoined: (json['participants_joined'] as num).toInt(),
    rewardEnabled: json['reward_enabled'] as bool,
    rewardAmountMinor: (json['reward_amount_minor'] as num?)?.toInt(),
    rewardCurrency: json['reward_currency'] as String?,
  );

  final String id;
  final String title;
  final String questType;
  final String status;
  final String relationship;
  final DateTime deadline;
  final int entriesReceived;
  final int maxEntries;
  final int participantsJoined;
  final bool rewardEnabled;
  final int? rewardAmountMinor;
  final String? rewardCurrency;

  bool get isCreator => relationship == 'CREATOR';
  bool get isCompleted =>
      const {'COMPLETED', 'CANCELLED', 'EXPIRED'}.contains(status);
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
final myQuestsProvider = FutureProvider.autoDispose<List<MyQuest>>((ref) {
  final session = currentSession;
  if (session == null) return const [];
  return ref.watch(questRepositoryProvider).listMyQuests(session.accessToken);
});

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
    ref.watch(authStateProvider);
    final session = currentSession;
    final metadata = session?.user.userMetadata ?? const <String, dynamic>{};
    final displayName =
        (metadata['full_name'] as String?) ??
        (metadata['name'] as String?) ??
        session?.user.email?.split('@').first ??
        'Explorer';
    final firstName = displayName.trim().split(RegExp(r'\s+')).first;
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
                    InkWell(
                      onTap: () => context.push(
                        session == null ? '/auth?next=/profile' : '/profile',
                      ),
                      customBorder: const CircleBorder(),
                      child: CircleAvatar(
                        backgroundColor: ink,
                        foregroundColor: accent,
                        child: Text(
                          firstName.characters.first.toUpperCase(),
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
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
                    Text(
                      session == null
                          ? 'Browse freely as a guest'
                          : 'Good morning, $firstName ✌️',
                      style: const TextStyle(color: muted, fontSize: 13),
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
        onDestinationSelected: (index) {
          if (index == 0) return;
          if (index == 3) {
            context.push(session == null ? '/auth?next=/profile' : '/profile');
            return;
          }
          if (index == 1) {
            context.push(
              session == null ? '/auth?next=/my-quests' : '/my-quests',
            );
            return;
          }
          context.push('/auth?next=/discover');
        },
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
        child: JoinQuestButton(questId: quest.id),
      ),
    );
  }
}

class JoinQuestButton extends ConsumerStatefulWidget {
  const JoinQuestButton({required this.questId, super.key});
  final String questId;

  @override
  ConsumerState<JoinQuestButton> createState() => _JoinQuestButtonState();
}

class _JoinQuestButtonState extends ConsumerState<JoinQuestButton> {
  bool loading = false;
  bool joined = false;

  Future<void> join() async {
    final session = currentSession;
    if (session == null) {
      context.push(
        '/auth?next=${Uri.encodeComponent('/quests/${widget.questId}')}',
      );
      return;
    }
    setState(() => loading = true);
    try {
      await ref
          .read(questRepositoryProvider)
          .joinQuest(widget.questId, session.accessToken);
      setState(() => joined = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Quest joined successfully.')),
        );
      }
    } on DioException catch (error) {
      final body = error.response?.data;
      final message = body is Map<String, dynamic>
          ? body['message'] as String? ?? 'Unable to join this quest.'
          : 'Unable to join this quest.';
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authStateProvider);
    return FilledButton.icon(
      onPressed: loading || joined ? null : join,
      style: FilledButton.styleFrom(
        backgroundColor: accent,
        foregroundColor: ink,
        minimumSize: const Size.fromHeight(54),
      ),
      icon: loading
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: ink),
            )
          : Icon(joined ? Icons.check_rounded : Icons.flag_outlined),
      label: Text(
        joined
            ? 'Quest joined'
            : currentSession == null
            ? 'Sign in to join'
            : 'Join this quest',
        style: const TextStyle(fontWeight: FontWeight.w800),
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

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({required this.next, super.key});
  final String next;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final emailController = TextEditingController();
  bool emailOpen = false;
  bool loading = false;
  String? message;

  @override
  void dispose() {
    emailController.dispose();
    super.dispose();
  }

  String get destination =>
      widget.next.startsWith('/') && !widget.next.startsWith('//')
      ? widget.next
      : '/discover';

  Future<void> signInWithGoogle() async {
    if (!supabaseConfigured) {
      setState(() => message = 'Add the public Supabase build values first.');
      return;
    }
    setState(() {
      loading = true;
      message = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: mobileAuthRedirect,
      );
    } on AuthException catch (error) {
      setState(() => message = error.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> sendEmailLink() async {
    if (!supabaseConfigured) {
      setState(() => message = 'Add the public Supabase build values first.');
      return;
    }
    final email = emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => message = 'Enter a valid email address.');
      return;
    }
    setState(() {
      loading = true;
      message = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithOtp(
        email: email,
        emailRedirectTo: mobileAuthRedirect,
      );
      setState(
        () => message = 'Check your inbox for your secure sign-in link.',
      );
    } on AuthException catch (error) {
      setState(() => message = error.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authStateProvider);
    if (currentSession != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go(destination);
      });
    }

    return Scaffold(
      appBar: AppBar(backgroundColor: background),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 40),
          children: [
            const Center(
              child: Text(
                'sidequest.',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.5,
                ),
              ),
            ),
            const SizedBox(height: 45),
            const Text(
              'Welcome to SideQuest',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 30,
                height: 1.05,
                fontWeight: FontWeight.w700,
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Sign in to create quests, join challenges, and submit official entries.',
              textAlign: TextAlign.center,
              style: TextStyle(color: muted, height: 1.5),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              onPressed: loading ? null : signInWithGoogle,
              icon: const Text(
                'G',
                style: TextStyle(
                  color: Color(0xFF4285F4),
                  fontWeight: FontWeight.w800,
                ),
              ),
              label: const Text('Continue with Google'),
              style: OutlinedButton.styleFrom(
                foregroundColor: ink,
                minimumSize: const Size.fromHeight(54),
                side: const BorderSide(color: line),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: null,
              icon: const Icon(Icons.apple),
              label: const Text('Apple sign-in requires setup'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: loading
                  ? null
                  : () => setState(() => emailOpen = !emailOpen),
              icon: const Icon(Icons.mail_outline_rounded),
              label: const Text('Continue with email'),
              style: OutlinedButton.styleFrom(
                foregroundColor: ink,
                minimumSize: const Size.fromHeight(54),
                side: const BorderSide(color: line),
              ),
            ),
            if (emailOpen) ...[
              const SizedBox(height: 14),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Email address',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: loading ? null : sendEmailLink,
                style: FilledButton.styleFrom(
                  backgroundColor: ink,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(52),
                ),
                child: const Text('Email me a sign-in link'),
              ),
            ],
            if (loading) ...[
              const SizedBox(height: 18),
              const Center(child: CircularProgressIndicator(color: ink)),
            ],
            if (message != null) ...[
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9FFB0),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(message!, style: const TextStyle(height: 1.4)),
              ),
            ],
            const SizedBox(height: 26),
            TextButton(
              onPressed: () => context.go('/discover'),
              child: const Text('Browse quests as a guest'),
            ),
          ],
        ),
      ),
    );
  }
}

class MyQuestsScreen extends ConsumerStatefulWidget {
  const MyQuestsScreen({super.key});

  @override
  ConsumerState<MyQuestsScreen> createState() => _MyQuestsScreenState();
}

class _MyQuestsScreenState extends ConsumerState<MyQuestsScreen> {
  int selectedTab = 0;

  @override
  Widget build(BuildContext context) {
    ref.watch(authStateProvider);
    if (currentSession == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/auth?next=/my-quests');
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      );
    }

    final asyncQuests = ref.watch(myQuestsProvider);
    const labels = ['Active', 'Created', 'Joined', 'Completed'];

    return Scaffold(
      appBar: AppBar(
        title: const Text('My quests'),
        backgroundColor: background,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(myQuestsProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: ink,
          onRefresh: () => ref.refresh(myQuestsProvider.future),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Keep every commitment in view.',
                        style: TextStyle(color: muted),
                      ),
                      const SizedBox(height: 18),
                      SizedBox(
                        height: 40,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: labels.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 8),
                          itemBuilder: (context, index) => ChoiceChip(
                            selected: selectedTab == index,
                            onSelected: (_) =>
                                setState(() => selectedTab = index),
                            showCheckmark: false,
                            selectedColor: accent,
                            side: const BorderSide(color: line),
                            label: Text(labels[index]),
                            labelStyle: const TextStyle(
                              color: ink,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              asyncQuests.when(
                loading: () => const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: CircularProgressIndicator(color: ink)),
                ),
                error: (_, _) => SliverFillRemaining(
                  hasScrollBody: false,
                  child: _QuestFeedError(
                    onRetry: () => ref.invalidate(myQuestsProvider),
                  ),
                ),
                data: (quests) {
                  final filtered = quests
                      .where((quest) {
                        return switch (selectedTab) {
                          1 => quest.isCreator,
                          2 => !quest.isCreator,
                          3 => quest.isCompleted,
                          _ => !quest.isCompleted,
                        };
                      })
                      .toList(growable: false);
                  if (filtered.isEmpty) {
                    return SliverFillRemaining(
                      hasScrollBody: false,
                      child: _MyQuestsEmpty(label: labels[selectedTab]),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 110),
                    sliver: SliverList.separated(
                      itemCount: filtered.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, index) =>
                          _MyQuestCard(quest: filtered[index]),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/auth?next=/discover'),
        backgroundColor: accent,
        foregroundColor: ink,
        icon: const Icon(Icons.add_rounded),
        label: const Text(
          'Create quest',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 1,
        indicatorColor: accent,
        onDestinationSelected: (index) {
          if (index == 0) context.go('/discover');
          if (index == 2) context.push('/auth?next=/discover');
          if (index == 3) context.push('/profile');
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            label: 'Discover',
          ),
          NavigationDestination(
            icon: Icon(Icons.emoji_events_outlined),
            selectedIcon: Icon(Icons.emoji_events),
            label: 'Quests',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline),
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

class _MyQuestsEmpty extends StatelessWidget {
  const _MyQuestsEmpty({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircleAvatar(
            radius: 28,
            backgroundColor: Color(0xFFE9FFB0),
            foregroundColor: ink,
            child: Icon(Icons.flag_outlined),
          ),
          const SizedBox(height: 16),
          Text(
            'No ${label.toLowerCase()} quests',
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 7),
          const Text(
            'Join a challenge or create one for the community.',
            textAlign: TextAlign.center,
            style: TextStyle(color: muted, height: 1.45),
          ),
        ],
      ),
    ),
  );
}

class _MyQuestCard extends StatelessWidget {
  const _MyQuestCard({required this.quest});
  final MyQuest quest;

  @override
  Widget build(BuildContext context) {
    final open = quest.status == 'OPEN';
    return InkWell(
      onTap: open ? () => context.push('/quests/${quest.id}') : null,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        quest.isCreator ? 'CREATED BY YOU' : 'JOINED',
                        style: const TextStyle(
                          color: muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        quest.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: open
                        ? const Color(0xFFE9FFB0)
                        : const Color(0xFFF0F1ED),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(
                    quest.status.replaceAll('_', ' '),
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _MiniStat(
                  value: '${quest.entriesReceived}/${quest.maxEntries}',
                  label: 'entries',
                ),
                const SizedBox(width: 8),
                _MiniStat(
                  value: '${quest.participantsJoined}',
                  label: 'joined',
                ),
                const SizedBox(width: 8),
                _MiniStat(
                  value: quest.questType.characters.first,
                  label: 'type',
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Icon(Icons.schedule_rounded, size: 15, color: muted),
                const SizedBox(width: 5),
                Text(
                  _shortDate(quest.deadline),
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
                const Spacer(),
                if (open) const Icon(Icons.chevron_right_rounded, color: muted),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: muted, fontSize: 10)),
        ],
      ),
    ),
  );
}

String _shortDate(DateTime value) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[value.month - 1]} ${value.day}, ${value.year}';
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(authStateProvider);
    final session = currentSession;
    if (session == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/auth?next=/profile');
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      );
    }
    final metadata = session.user.userMetadata ?? const <String, dynamic>{};
    final name =
        (metadata['full_name'] as String?) ??
        (metadata['name'] as String?) ??
        session.user.email?.split('@').first ??
        'Explorer';

    return Scaffold(
      appBar: AppBar(title: const Text('Profile'), backgroundColor: background),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            CircleAvatar(
              radius: 46,
              backgroundColor: ink,
              foregroundColor: accent,
              child: Text(
                name.characters.first.toUpperCase(),
                style: const TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              name,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              session.user.email ?? '',
              textAlign: TextAlign.center,
              style: const TextStyle(color: muted),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              onPressed: () async {
                await Supabase.instance.client.auth.signOut();
                if (context.mounted) context.go('/discover');
              },
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Sign out'),
              style: OutlinedButton.styleFrom(
                foregroundColor: ink,
                minimumSize: const Size.fromHeight(52),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

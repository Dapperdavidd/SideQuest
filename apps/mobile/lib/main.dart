import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

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
String initialAppLocation = '/discover';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  if (!(preferences.getBool('onboarding_complete') ?? false)) {
    initialAppLocation = '/onboarding';
  }
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
    initialLocation: initialAppLocation,
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
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
        path: '/quests/:id/submit',
        builder: (context, state) => SubmissionScreen(
          questId: state.pathParameters['id']!,
          initialQuest: state.extra as Quest?,
        ),
      ),
      GoRoute(
        path: '/quests/:id/review',
        builder: (context, state) => ReviewQuestScreen(
          questId: state.pathParameters['id']!,
          initialQuest: state.extra as Quest?,
        ),
      ),
      GoRoute(
        path: '/quests/:id/settlement',
        builder: (context, state) =>
            QuestSettlementScreen(questId: state.pathParameters['id']!),
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
        path: '/wallet',
        builder: (context, state) => const WalletScreen(),
      ),
      GoRoute(
        path: '/my-quests',
        builder: (context, state) => const MyQuestsScreen(),
      ),
      GoRoute(
        path: '/create',
        builder: (context, state) => const CreateQuestScreen(),
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
    this.winnerSelectionMethod = 'FIRST_VALID',
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
    winnerSelectionMethod:
        json['winner_selection_method'] as String? ?? 'FIRST_VALID',
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
  final String winnerSelectionMethod;
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
    final amount = rewardAmountMinor! / 100000;
    final formatted = amount == amount.roundToDouble()
        ? amount.toStringAsFixed(0)
        : amount.toStringAsFixed(2);
    return '$formatted NIM';
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

  Future<List<PublicWinner>> listQuestWinners(String id) async {
    final response = await _dio.get<List<dynamic>>('/quests/$id/winners');
    return response.data!
        .map((json) => PublicWinner.fromJson(json as Map<String, dynamic>))
        .toList(growable: false);
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

  Future<List<MyQuest>> listSavedQuests(String accessToken) async {
    final response = await _dio.get<List<dynamic>>(
      '/users/me/saved-quests',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return response.data!
        .map((json) => MyQuest.fromJson(json as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<bool> getQuestSaved(String questId, String accessToken) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/quests/$questId/saved',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return response.data!['saved'] as bool;
  }

  Future<void> saveQuest(String questId, String accessToken) async {
    await _dio.put<void>(
      '/quests/$questId/saved',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
  }

  Future<void> removeSavedQuest(String questId, String accessToken) async {
    await _dio.delete<void>(
      '/quests/$questId/saved',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
  }

  Future<Quest> createQuest(
    Map<String, dynamic> payload,
    String accessToken,
  ) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/quests',
      data: payload,
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return Quest.fromJson(response.data!);
  }

  Future<Quest> publishQuest(String id, String accessToken) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/quests/$id/publish',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return Quest.fromJson(response.data!);
  }

  Future<Map<String, dynamic>> submitEntry(
    String questId,
    Map<String, dynamic> payload,
    String accessToken,
  ) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/quests/$questId/entries',
      data: payload,
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return response.data!;
  }

  Future<List<CreatorEntry>> listCreatorEntries(
    String questId,
    String accessToken,
  ) async {
    final response = await _dio.get<List<dynamic>>(
      '/quests/$questId/entries',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return response.data!
        .map((json) => CreatorEntry.fromJson(json as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<void> reviewEntry(
    String questId,
    String entryId,
    bool isValid,
    String? reason,
    String accessToken,
  ) async {
    await _dio.post<void>(
      '/quests/$questId/entries/$entryId/review',
      data: {'is_valid': isValid, 'reason': reason},
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
  }

  Future<Map<String, dynamic>> finalizeQuest(
    String questId,
    List<String> winnerEntryIds,
    String accessToken,
  ) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/quests/$questId/finalize',
      data: {'winner_entry_ids': winnerEntryIds},
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return response.data!;
  }

  Future<UserProfile> getMyProfile(String accessToken) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/users/me',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return UserProfile.fromJson(response.data!);
  }

  Future<UserProfile> updateMyProfile(
    Map<String, dynamic> changes,
    String accessToken,
  ) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/users/me',
      data: changes,
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return UserProfile.fromJson(response.data!);
  }

  Future<PayoutDestination?> getPayoutDestination(String accessToken) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/users/me/payout-destination',
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
      return PayoutDestination.fromJson(response.data!);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<PayoutDestination> setPayoutDestination(
    String address,
    String accessToken,
  ) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/users/me/payout-destination',
      data: {'address': address},
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return PayoutDestination.fromJson(response.data!);
  }

  Future<List<PayoutSummary>> listMyPayouts(String accessToken) async {
    final response = await _dio.get<List<dynamic>>(
      '/users/me/payouts',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return response.data!
        .map((json) => PayoutSummary.fromJson(json as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<QuestSettlement> getQuestSettlement(
    String questId,
    String accessToken,
  ) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/quests/$questId/settlement',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return QuestSettlement.fromJson(response.data!);
  }
}

class PayoutDestination {
  const PayoutDestination({required this.network, required this.address});

  factory PayoutDestination.fromJson(Map<String, dynamic> json) =>
      PayoutDestination(
        network: json['network'] as String,
        address: json['address'] as String,
      );

  final String network;
  final String address;
}

class PayoutSummary {
  const PayoutSummary({
    required this.id,
    required this.questId,
    required this.questTitle,
    required this.amountLuna,
    required this.amountNim,
    required this.status,
    required this.network,
    required this.destinationAddress,
    required this.transactionHash,
    required this.failureReason,
    required this.createdAt,
  });

  factory PayoutSummary.fromJson(Map<String, dynamic> json) => PayoutSummary(
    id: json['id'] as String,
    questId: json['quest_id'] as String,
    questTitle: json['quest_title'] as String,
    amountLuna: (json['amount_luna'] as num).toInt(),
    amountNim: json['amount_nim'] as String,
    status: json['status'] as String,
    network: json['network'] as String,
    destinationAddress: json['destination_address'] as String,
    transactionHash: json['transaction_hash'] as String?,
    failureReason: json['failure_reason'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
  );

  final String id;
  final String questId;
  final String questTitle;
  final int amountLuna;
  final String amountNim;
  final String status;
  final String network;
  final String destinationAddress;
  final String? transactionHash;
  final String? failureReason;
  final DateTime createdAt;
}

class QuestSettlement {
  const QuestSettlement({
    required this.questId,
    required this.status,
    required this.rewardEnabled,
    required this.totalAllocatedNim,
    required this.payouts,
  });

  factory QuestSettlement.fromJson(Map<String, dynamic> json) =>
      QuestSettlement(
        questId: json['quest_id'] as String,
        status: json['status'] as String,
        rewardEnabled: json['reward_enabled'] as bool,
        totalAllocatedNim: json['total_allocated_nim'] as String,
        payouts: (json['payouts'] as List<dynamic>)
            .map((item) => CreatorPayout.fromJson(item as Map<String, dynamic>))
            .toList(growable: false),
      );

  final String questId;
  final String status;
  final bool rewardEnabled;
  final String totalAllocatedNim;
  final List<CreatorPayout> payouts;
}

class CreatorPayout {
  const CreatorPayout({
    required this.id,
    required this.winnerPosition,
    required this.recipientUsername,
    required this.recipientDisplayName,
    required this.amountNim,
    required this.destinationAddress,
    required this.status,
    required this.transactionHash,
    required this.failureReason,
  });

  factory CreatorPayout.fromJson(Map<String, dynamic> json) => CreatorPayout(
    id: json['id'] as String,
    winnerPosition: (json['winner_position'] as num).toInt(),
    recipientUsername: json['recipient_username'] as String,
    recipientDisplayName: json['recipient_display_name'] as String,
    amountNim: json['amount_nim'] as String,
    destinationAddress: json['destination_address'] as String,
    status: json['status'] as String,
    transactionHash: json['transaction_hash'] as String?,
    failureReason: json['failure_reason'] as String?,
  );

  final String id;
  final int winnerPosition;
  final String recipientUsername;
  final String recipientDisplayName;
  final String amountNim;
  final String destinationAddress;
  final String status;
  final String? transactionHash;
  final String? failureReason;
}

class PublicWinner {
  const PublicWinner({
    required this.position,
    required this.username,
    required this.displayName,
    required this.entryId,
  });

  factory PublicWinner.fromJson(Map<String, dynamic> json) => PublicWinner(
    position: (json['winner_position'] as num).toInt(),
    username: json['participant_username'] as String,
    displayName: json['participant_display_name'] as String,
    entryId: json['entry_id'] as String,
  );

  final int position;
  final String username;
  final String displayName;
  final String entryId;
}

class UserProfile {
  const UserProfile({
    required this.id,
    required this.username,
    required this.displayName,
    required this.bio,
    required this.avatarUrl,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    id: json['id'] as String,
    username: json['username'] as String,
    displayName: json['display_name'] as String,
    bio: json['bio'] as String?,
    avatarUrl: json['avatar_url'] as String?,
  );

  final String id;
  final String username;
  final String displayName;
  final String? bio;
  final String? avatarUrl;
}

class EntryEvidence {
  const EntryEvidence({required this.proofType, required this.value});

  factory EntryEvidence.fromJson(Map<String, dynamic> json) => EntryEvidence(
    proofType: json['proof_type'] as String,
    value: json['value'] as String,
  );

  final String proofType;
  final String value;
}

class CreatorEntry {
  const CreatorEntry({
    required this.id,
    required this.participantName,
    required this.participantUsername,
    required this.caption,
    required this.submittedAt,
    required this.reviewIsValid,
    required this.reviewReason,
    required this.evidence,
  });

  factory CreatorEntry.fromJson(Map<String, dynamic> json) => CreatorEntry(
    id: json['id'] as String,
    participantName: json['participant_display_name'] as String,
    participantUsername: json['participant_username'] as String,
    caption: json['caption'] as String?,
    submittedAt: DateTime.parse(json['submitted_at'] as String).toLocal(),
    reviewIsValid: json['review_is_valid'] as bool?,
    reviewReason: json['review_reason'] as String?,
    evidence: (json['evidence'] as List<dynamic>)
        .map((item) => EntryEvidence.fromJson(item as Map<String, dynamic>))
        .toList(growable: false),
  );

  final String id;
  final String participantName;
  final String participantUsername;
  final String? caption;
  final DateTime submittedAt;
  final bool? reviewIsValid;
  final String? reviewReason;
  final List<EntryEvidence> evidence;
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
  bool get isSaved => relationship == 'SAVED';
  bool get isCompleted =>
      const {'FINALIZED', 'CANCELLED', 'SUSPENDED'}.contains(status);
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
final questWinnersProvider = FutureProvider.autoDispose
    .family<List<PublicWinner>, String>(
      (ref, id) => ref.watch(questRepositoryProvider).listQuestWinners(id),
    );
final myQuestsProvider = FutureProvider.autoDispose<List<MyQuest>>((ref) {
  final session = currentSession;
  if (session == null) return const [];
  return ref.watch(questRepositoryProvider).listMyQuests(session.accessToken);
});
final savedQuestsProvider = FutureProvider.autoDispose<List<MyQuest>>((ref) {
  final session = currentSession;
  if (session == null) return const [];
  return ref
      .watch(questRepositoryProvider)
      .listSavedQuests(session.accessToken);
});
final questSavedProvider = FutureProvider.autoDispose.family<bool, String>((
  ref,
  questId,
) {
  final session = currentSession;
  if (session == null) return false;
  return ref
      .watch(questRepositoryProvider)
      .getQuestSaved(questId, session.accessToken);
});
final creatorEntriesProvider = FutureProvider.autoDispose
    .family<List<CreatorEntry>, String>((ref, questId) {
      final session = currentSession;
      if (session == null) return const [];
      return ref
          .watch(questRepositoryProvider)
          .listCreatorEntries(questId, session.accessToken);
    });
final myProfileProvider = FutureProvider.autoDispose<UserProfile>((ref) {
  final session = currentSession;
  if (session == null) throw StateError('Authentication required');
  return ref.watch(questRepositoryProvider).getMyProfile(session.accessToken);
});
final payoutDestinationProvider =
    FutureProvider.autoDispose<PayoutDestination?>((ref) {
      final session = currentSession;
      if (session == null) return null;
      return ref
          .watch(questRepositoryProvider)
          .getPayoutDestination(session.accessToken);
    });
final myPayoutsProvider = FutureProvider.autoDispose<List<PayoutSummary>>((
  ref,
) {
  final session = currentSession;
  if (session == null) return const [];
  return ref.watch(questRepositoryProvider).listMyPayouts(session.accessToken);
});
final questSettlementProvider = FutureProvider.autoDispose
    .family<QuestSettlement, String>((ref, questId) {
      final session = currentSession;
      if (session == null) throw StateError('Authentication required');
      return ref
          .watch(questRepositoryProvider)
          .getQuestSettlement(questId, session.accessToken);
    });

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final pageController = PageController();
  int page = 0;

  static const pages = [
    _OnboardingPageData(
      eyebrow: 'DISCOVER',
      title: 'Life comes with\nside quests.',
      body: 'Turn ordinary moments into small adventures, shared challenges, and stories worth keeping.',
      icon: Icons.explore_rounded,
      colors: [Color(0xFF1E251C), Color(0xFF596247)],
    ),
    _OnboardingPageData(
      eyebrow: 'TAKE PART',
      title: 'Choose something\nworth trying.',
      body: 'Join a handful of people, follow clear rules, and submit one official entry before the slots are gone.',
      icon: Icons.flag_rounded,
      colors: [Color(0xFF5B395F), Color(0xFFDF805F)],
    ),
    _OnboardingPageData(
      eyebrow: 'CREATE',
      title: 'Challenge your\nfriends or city.',
      body: 'Create playful quests for friends, communities, or local explorers—with rewards only when you want them.',
      icon: Icons.add_reaction_rounded,
      colors: [Color(0xFF214D55), Color(0xFF62A897)],
    ),
    _OnboardingPageData(
      eyebrow: 'GET RECOGNIZED',
      title: 'Proof in.\nWinners out.',
      body: 'Every entry has a trusted timestamp. Creators review the proof, and published winner rules stay fair.',
      icon: Icons.emoji_events_rounded,
      colors: [Color(0xFF564B1F), Color(0xFFC99B35)],
    ),
  ];

  @override
  void dispose() {
    pageController.dispose();
    super.dispose();
  }

  Future<void> finish({required bool authenticate}) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('onboarding_complete', true);
    if (!mounted) return;
    context.go(authenticate ? '/auth?next=/discover' : '/discover');
  }

  void next() {
    if (page == pages.length - 1) {
      finish(authenticate: true);
    } else {
      pageController.nextPage(
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = pages[page];
    return Scaffold(
      backgroundColor: ink,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 12, 14, 8),
              child: Row(
                children: [
                  const Text(
                    'sidequest',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1.3,
                    ),
                  ),
                  const Text(
                    '.',
                    style: TextStyle(
                      color: accent,
                      fontSize: 23,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => finish(authenticate: false),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white70,
                    ),
                    child: const Text('Skip'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: pageController,
                itemCount: pages.length,
                onPageChanged: (value) => setState(() => page = value),
                itemBuilder: (context, index) =>
                    _OnboardingArtwork(data: pages[index], index: index),
              ),
            ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              child: Padding(
                key: ValueKey(page),
                padding: const EdgeInsets.fromLTRB(28, 20, 28, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      data.eyebrow,
                      style: const TextStyle(
                        color: accent,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.8,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      data.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 37,
                        height: .98,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -1.8,
                      ),
                    ),
                    const SizedBox(height: 13),
                    Text(
                      data.body,
                      style: const TextStyle(
                        color: Colors.white60,
                        fontSize: 15,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 23, 28, 18),
              child: Row(
                children: [
                  for (var index = 0; index < pages.length; index++) ...[
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: index == page ? 22 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: index == page ? accent : Colors.white24,
                        borderRadius: BorderRadius.circular(100),
                      ),
                    ),
                    if (index < pages.length - 1) const SizedBox(width: 6),
                  ],
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: next,
                    style: FilledButton.styleFrom(
                      backgroundColor: accent,
                      foregroundColor: ink,
                      minimumSize: const Size(145, 54),
                    ),
                    label: Text(
                      page == pages.length - 1 ? 'Get started' : 'Next',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    iconAlignment: IconAlignment.end,
                    icon: const Icon(Icons.arrow_forward_rounded),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingArtwork extends StatelessWidget {
  const _OnboardingArtwork({required this.data, required this.index});
  final _OnboardingPageData data;
  final int index;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20),
    child: Stack(
      alignment: Alignment.center,
      children: [
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: data.colors,
            ),
            borderRadius: BorderRadius.circular(32),
          ),
        ),
        Positioned(
          left: 24,
          top: 24,
          child: Transform.rotate(
            angle: -.12,
            child: _FloatingLabel(
              icon: Icons.location_on_outlined,
              text: index.isEven ? 'Nearby quest' : '3 slots left',
            ),
          ),
        ),
        Positioned(
          right: 20,
          bottom: 25,
          child: Transform.rotate(
            angle: .1,
            child: _FloatingLabel(
              icon: Icons.bolt_rounded,
              text: index < 2 ? 'Try something new' : 'Rules locked',
            ),
          ),
        ),
        Container(
          width: 160,
          height: 160,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .1),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 38,
                offset: Offset(0, 20),
              ),
            ],
          ),
          child: Icon(data.icon, color: accent, size: 82),
        ),
        Positioned(
          top: 32,
          right: 34,
          child: Icon(
            Icons.auto_awesome_rounded,
            color: accent.withValues(alpha: .9),
            size: 30,
          ),
        ),
        Positioned(
          bottom: 42,
          left: 38,
          child: Icon(
            Icons.draw_outlined,
            color: Colors.white.withValues(alpha: .6),
            size: 34,
          ),
        ),
      ],
    ),
  );
}

class _FloatingLabel extends StatelessWidget {
  const _FloatingLabel({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
    decoration: BoxDecoration(
      color: const Color(0xF2FFFFFF),
      borderRadius: BorderRadius.circular(13),
      boxShadow: const [
        BoxShadow(
          color: Color(0x33000000),
          blurRadius: 18,
          offset: Offset(0, 8),
        ),
      ],
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: ink),
        const SizedBox(width: 6),
        Text(
          text,
          style: const TextStyle(
            color: ink,
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _OnboardingPageData {
  const _OnboardingPageData({
    required this.eyebrow,
    required this.title,
    required this.body,
    required this.icon,
    required this.colors,
  });

  final String eyebrow;
  final String title;
  final String body;
  final IconData icon;
  final List<Color> colors;
}

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
          context.push(session == null ? '/auth?next=/create' : '/create');
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

class _QuestDetail extends ConsumerWidget {
  const _QuestDetail({required this.quest});
  final Quest quest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remaining = math.max(0, quest.maxEntries - quest.entriesReceived);
    final winners = quest.status == 'FINALIZED'
        ? ref.watch(questWinnersProvider(quest.id))
        : const AsyncValue<List<PublicWinner>>.data([]);
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(
            expandedHeight: 310,
            pinned: true,
            backgroundColor: ink,
            foregroundColor: Colors.white,
            actions: [_SaveQuestAction(questId: quest.id)],
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
                if (quest.status == 'FINALIZED') ...[
                  const SizedBox(height: 26),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: ink,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'FINAL RESULTS',
                          style: TextStyle(
                            color: accent,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Quest winners',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 14),
                        winners.when(
                          loading: () => const LinearProgressIndicator(
                            color: accent,
                            backgroundColor: Colors.white12,
                          ),
                          error: (_, _) => TextButton(
                            onPressed: () =>
                                ref.invalidate(questWinnersProvider(quest.id)),
                            child: const Text('Retry winner results'),
                          ),
                          data: (items) => items.isEmpty
                              ? const Text(
                                  'No valid winner was available when this quest was finalized.',
                                  style: TextStyle(
                                    color: Colors.white60,
                                    height: 1.4,
                                  ),
                                )
                              : Column(
                                  children: items
                                      .map(
                                        (winner) => Container(
                                          margin: const EdgeInsets.only(
                                            bottom: 8,
                                          ),
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: Colors.white10,
                                            borderRadius: BorderRadius.circular(
                                              14,
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              CircleAvatar(
                                                backgroundColor: accent,
                                                foregroundColor: ink,
                                                child: Text(
                                                  '${winner.position}',
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    winner.displayName,
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                  Text(
                                                    '@${winner.username}',
                                                    style: const TextStyle(
                                                      color: Colors.white54,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      )
                                      .toList(growable: false),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
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
      bottomNavigationBar: quest.status == 'OPEN'
          ? SafeArea(
              minimum: const EdgeInsets.fromLTRB(20, 10, 20, 14),
              child: JoinQuestButton(questId: quest.id),
            )
          : null,
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
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        FilledButton.icon(
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
        ),
        if (currentSession != null) ...[
          const SizedBox(height: 3),
          TextButton(
            onPressed: () => context.push('/quests/${widget.questId}/submit'),
            child: const Text('Already joined? Submit your entry'),
          ),
        ],
      ],
    );
  }
}

class _SaveQuestAction extends ConsumerStatefulWidget {
  const _SaveQuestAction({required this.questId});

  final String questId;

  @override
  ConsumerState<_SaveQuestAction> createState() => _SaveQuestActionState();
}

class _SaveQuestActionState extends ConsumerState<_SaveQuestAction> {
  bool working = false;

  Future<void> toggle(bool saved) async {
    final session = currentSession;
    if (session == null) {
      context.push('/auth?next=/quests/${widget.questId}');
      return;
    }
    setState(() => working = true);
    try {
      final repository = ref.read(questRepositoryProvider);
      if (saved) {
        await repository.removeSavedQuest(widget.questId, session.accessToken);
      } else {
        await repository.saveQuest(widget.questId, session.accessToken);
      }
      ref.invalidate(questSavedProvider(widget.questId));
      ref.invalidate(savedQuestsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              saved ? 'Removed from saved quests.' : 'Quest saved.',
            ),
          ),
        );
      }
    } on DioException catch (error) {
      if (!mounted) return;
      final data = error.response?.data;
      final message = data is Map<String, dynamic>
          ? data['message'] as String? ?? 'Unable to update this saved quest.'
          : 'Unable to update this saved quest.';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authStateProvider);
    final savedState = ref.watch(questSavedProvider(widget.questId));
    final saved = savedState.asData?.value ?? false;
    return IconButton(
      tooltip: saved ? 'Remove from saved quests' : 'Save quest',
      onPressed: working ? null : () => toggle(saved),
      icon: working
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Icon(saved ? Icons.bookmark_rounded : Icons.bookmark_outline),
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

class SubmissionScreen extends ConsumerStatefulWidget {
  const SubmissionScreen({required this.questId, this.initialQuest, super.key});

  final String questId;
  final Quest? initialQuest;

  @override
  ConsumerState<SubmissionScreen> createState() => _SubmissionScreenState();
}

class _SubmissionScreenState extends ConsumerState<SubmissionScreen> {
  final captionController = TextEditingController();
  final valueControllers = <String, TextEditingController>{};
  final mediaFiles = <String, XFile>{};
  final picker = ImagePicker();
  bool submitting = false;
  bool submitted = false;
  bool closedForReview = false;
  String? errorMessage;

  @override
  void dispose() {
    captionController.dispose();
    for (final controller in valueControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController controllerFor(String proof) =>
      valueControllers.putIfAbsent(proof, () => TextEditingController());

  Future<void> pickMedia(String proof, ImageSource source) async {
    final file = proof == 'PHOTO'
        ? await picker.pickImage(
            source: source,
            imageQuality: 88,
            maxWidth: 2400,
          )
        : await picker.pickVideo(
            source: source,
            maxDuration: const Duration(seconds: 60),
          );
    if (file != null && mounted) {
      setState(() {
        mediaFiles[proof] = file;
        errorMessage = null;
      });
    }
  }

  Future<void> chooseMedia(String proof) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose from library'),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined),
                title: Text(proof == 'PHOTO' ? 'Take a photo' : 'Record video'),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
            ],
          ),
        ),
      ),
    );
    if (source != null) await pickMedia(proof, source);
  }

  bool readyToSubmit(Quest quest) => quest.proofRequirements.every((proof) {
    if (proof == 'PHOTO' || proof == 'VIDEO') {
      return mediaFiles.containsKey(proof);
    }
    return controllerFor(proof).text.trim().isNotEmpty;
  });

  Future<void> submit(Quest quest) async {
    final session = currentSession;
    if (session == null) {
      context.go(
        '/auth?next=${Uri.encodeComponent('/quests/${quest.id}/submit')}',
      );
      return;
    }
    if (!readyToSubmit(quest)) {
      setState(
        () => errorMessage = 'Add every required proof before submitting.',
      );
      return;
    }

    setState(() {
      submitting = true;
      errorMessage = null;
    });
    final uploadedPaths = <String>[];
    try {
      final evidence = <Map<String, String>>[];
      for (final proof in quest.proofRequirements) {
        if (proof == 'PHOTO' || proof == 'VIDEO') {
          final file = mediaFiles[proof]!;
          final extension = file.name.contains('.')
              ? file.name.split('.').last.toLowerCase()
              : proof == 'PHOTO'
              ? 'jpg'
              : 'mp4';
          final nonce = math.Random.secure()
              .nextInt(0x7fffffff)
              .toRadixString(16);
          final path =
              '${session.user.id}/${quest.id}/${DateTime.now().microsecondsSinceEpoch}_$nonce.$extension';
          final bytes = await file.readAsBytes();
          await Supabase.instance.client.storage
              .from('entry-media')
              .uploadBinary(
                path,
                bytes,
                fileOptions: FileOptions(
                  contentType:
                      file.mimeType ??
                      (proof == 'PHOTO' ? 'image/jpeg' : 'video/mp4'),
                  upsert: false,
                ),
              );
          uploadedPaths.add(path);
          evidence.add({'proof_type': proof, 'value': path});
        } else {
          evidence.add({
            'proof_type': proof,
            'value': controllerFor(proof).text.trim(),
          });
        }
      }

      final result = await ref.read(questRepositoryProvider).submitEntry(
        quest.id,
        {
          'caption': captionController.text.trim().isEmpty
              ? null
              : captionController.text.trim(),
          'evidence': evidence,
        },
        session.accessToken,
      );
      ref.invalidate(questProvider(quest.id));
      ref.invalidate(questsProvider);
      ref.invalidate(myQuestsProvider);
      if (mounted) {
        setState(() {
          submitted = true;
          closedForReview = result['quest_closed_for_review'] as bool? ?? false;
        });
      }
    } on Object catch (error) {
      if (uploadedPaths.isNotEmpty) {
        await Supabase.instance.client.storage
            .from('entry-media')
            .remove(uploadedPaths)
            .catchError((_) => const <FileObject>[]);
      }
      if (!mounted) return;
      var message = 'Your entry could not be submitted.';
      if (error is DioException) {
        final data = error.response?.data;
        if (data is Map<String, dynamic>) {
          message = data['message'] as String? ?? message;
        }
      } else if (error is StorageException) {
        message = error.message;
      }
      setState(() => errorMessage = message);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authStateProvider);
    if (currentSession == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          context.go(
            '/auth?next=${Uri.encodeComponent('/quests/${widget.questId}/submit')}',
          );
        }
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      );
    }

    if (submitted) {
      return Scaffold(
        appBar: AppBar(backgroundColor: background),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircleAvatar(
                    radius: 42,
                    backgroundColor: Color(0xFFE9FFB0),
                    foregroundColor: ink,
                    child: Icon(Icons.check_rounded, size: 42),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Entry submitted!',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 29,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    closedForReview
                        ? 'Your official timestamp is locked in. This filled the final slot, so the quest is now ready for creator review.'
                        : 'Your official timestamp is locked in. We’ll notify you after the creator reviews your entry.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: muted, height: 1.5),
                  ),
                  const SizedBox(height: 26),
                  FilledButton(
                    onPressed: () => context.go('/my-quests'),
                    style: FilledButton.styleFrom(
                      backgroundColor: accent,
                      foregroundColor: ink,
                      minimumSize: const Size.fromHeight(52),
                    ),
                    child: const Text('View my quests'),
                  ),
                  TextButton(
                    onPressed: () => context.go('/discover'),
                    child: const Text('Explore more quests'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final asyncQuest = widget.initialQuest == null
        ? ref.watch(questProvider(widget.questId))
        : AsyncData(widget.initialQuest!);
    return asyncQuest.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      ),
      error: (_, _) => Scaffold(
        appBar: AppBar(backgroundColor: background),
        body: Center(
          child: _QuestFeedError(
            onRetry: () => ref.invalidate(questProvider(widget.questId)),
          ),
        ),
      ),
      data: (quest) => Scaffold(
        appBar: AppBar(
          title: const Text('Submit your entry'),
          backgroundColor: background,
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 120),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: ink,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SUBMITTING TO',
                      style: TextStyle(
                        color: accent,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      quest.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${quest.entriesReceived}/${quest.maxEntries} official entries',
                      style: const TextStyle(color: Colors.white54),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Required proof',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              const Text(
                'Every requirement must be included. Official entries cannot be edited or deleted.',
                style: TextStyle(color: muted, height: 1.45),
              ),
              const SizedBox(height: 18),
              for (final proof in quest.proofRequirements) ...[
                _EvidenceInput(
                  proof: proof,
                  controller: proof == 'PHOTO' || proof == 'VIDEO'
                      ? null
                      : controllerFor(proof),
                  selectedFile: mediaFiles[proof],
                  onPick: proof == 'PHOTO' || proof == 'VIDEO'
                      ? () => chooseMedia(proof)
                      : null,
                  onChanged: () => setState(() => errorMessage = null),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: captionController,
                maxLength: 280,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Caption (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              if (errorMessage != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEAE5),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    errorMessage!,
                    style: const TextStyle(color: Color(0xFF8F2E1E)),
                  ),
                ),
              ],
            ],
          ),
        ),
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.fromLTRB(20, 10, 20, 14),
          child: FilledButton.icon(
            onPressed: submitting ? null : () => submit(quest),
            style: FilledButton.styleFrom(
              backgroundColor: accent,
              foregroundColor: ink,
              minimumSize: const Size.fromHeight(54),
            ),
            icon: submitting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(
                      color: ink,
                      strokeWidth: 2,
                    ),
                  )
                : const Icon(Icons.upload_file_outlined),
            label: Text(
              submitting ? 'Securing your entry…' : 'Submit official entry',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ),
    );
  }
}

class _EvidenceInput extends StatelessWidget {
  const _EvidenceInput({
    required this.proof,
    required this.controller,
    required this.selectedFile,
    required this.onPick,
    required this.onChanged,
  });

  final String proof;
  final TextEditingController? controller;
  final XFile? selectedFile;
  final VoidCallback? onPick;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final label = proof.replaceAll('_', ' ').toLowerCase();
    if (onPick != null) {
      return InkWell(
        onTap: onPick,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: selectedFile == null
                ? Colors.white
                : const Color(0xFFE9FFB0),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selectedFile == null ? line : const Color(0xFF9BC800),
            ),
          ),
          child: Row(
            children: [
              Icon(
                proof == 'PHOTO'
                    ? Icons.add_photo_alternate_outlined
                    : Icons.video_call_outlined,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      selectedFile?.name ?? 'Tap to choose or capture',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Icon(
                selectedFile == null ? Icons.chevron_right : Icons.check_circle,
              ),
            ],
          ),
        ),
      );
    }

    final hint = switch (proof) {
      'LINK' => 'https://example.com/proof',
      'LOCATION' => 'Venue, address, or coordinates',
      'QR_CHECKPOINT' => 'Checkpoint code',
      _ => 'Describe your proof',
    };
    return TextField(
      controller: controller,
      keyboardType: proof == 'LINK' ? TextInputType.url : TextInputType.text,
      minLines: proof == 'TEXT' ? 3 : 1,
      maxLines: proof == 'TEXT' ? 5 : 2,
      onChanged: (_) => onChanged(),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: const OutlineInputBorder(),
      ),
    );
  }
}

class ReviewQuestScreen extends ConsumerStatefulWidget {
  const ReviewQuestScreen({
    required this.questId,
    this.initialQuest,
    super.key,
  });

  final String questId;
  final Quest? initialQuest;

  @override
  ConsumerState<ReviewQuestScreen> createState() => _ReviewQuestScreenState();
}

class _ReviewQuestScreenState extends ConsumerState<ReviewQuestScreen> {
  final reasons = <String, TextEditingController>{};
  final selectedWinners = <String>{};
  String? working;
  String? errorMessage;

  @override
  void dispose() {
    for (final controller in reasons.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController reasonFor(CreatorEntry entry) => reasons.putIfAbsent(
    entry.id,
    () => TextEditingController(text: entry.reviewReason ?? ''),
  );

  Future<void> review(CreatorEntry entry, bool isValid) async {
    final session = currentSession;
    if (session == null) return;
    setState(() {
      working = entry.id;
      errorMessage = null;
    });
    try {
      final reason = reasonFor(entry).text.trim();
      await ref
          .read(questRepositoryProvider)
          .reviewEntry(
            widget.questId,
            entry.id,
            isValid,
            reason.isEmpty ? null : reason,
            session.accessToken,
          );
      if (!isValid) selectedWinners.remove(entry.id);
      ref.invalidate(creatorEntriesProvider(widget.questId));
      ref.invalidate(myQuestsProvider);
    } on DioException catch (error) {
      final data = error.response?.data;
      setState(() {
        errorMessage = data is Map<String, dynamic>
            ? data['message'] as String? ?? 'The review could not be saved.'
            : 'The review could not be saved.';
      });
    } finally {
      if (mounted) setState(() => working = null);
    }
  }

  Future<void> finalize(Quest quest, List<CreatorEntry> entries) async {
    final session = currentSession;
    if (session == null) return;
    final validCount = entries
        .where((entry) => entry.reviewIsValid == true)
        .length;
    final expectedWinners = math.min(quest.winnerCount, validCount);
    if (quest.winnerSelectionMethod == 'BEST_SUBMISSION' &&
        selectedWinners.length != expectedWinners) {
      setState(() {
        errorMessage =
            'Select exactly $expectedWinners valid '
            'winner${expectedWinners == 1 ? '' : 's'}.';
      });
      return;
    }
    setState(() {
      working = 'finalize';
      errorMessage = null;
    });
    try {
      await ref
          .read(questRepositoryProvider)
          .finalizeQuest(
            quest.id,
            quest.winnerSelectionMethod == 'BEST_SUBMISSION'
                ? selectedWinners.toList(growable: false)
                : const [],
            session.accessToken,
          );
      ref.invalidate(myQuestsProvider);
      ref.invalidate(questsProvider);
      ref.invalidate(questProvider(quest.id));
      if (!mounted) return;
      final openSettlement = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.emoji_events_outlined),
          title: const Text('Quest finalized'),
          content: Text(
            expectedWinners == 0
                ? 'Every entry has been reviewed. No valid winner was available.'
                : '$expectedWinners winner${expectedWinners == 1 ? '' : 's'} locked in. Reward settlement can now continue.',
          ),
          actions: [
            if (quest.rewardEnabled)
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Track payouts'),
              ),
            FilledButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Done'),
            ),
          ],
        ),
      );
      if (mounted) {
        context.go(
          openSettlement == true
              ? '/quests/${quest.id}/settlement'
              : '/my-quests',
        );
      }
    } on DioException catch (error) {
      final data = error.response?.data;
      setState(() {
        errorMessage = data is Map<String, dynamic>
            ? data['message'] as String? ?? 'The quest could not be finalized.'
            : 'The quest could not be finalized.';
      });
    } finally {
      if (mounted) setState(() => working = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authStateProvider);
    if (currentSession == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          context.go(
            '/auth?next=${Uri.encodeComponent('/quests/${widget.questId}/review')}',
          );
        }
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      );
    }

    final asyncQuest = widget.initialQuest == null
        ? ref.watch(questProvider(widget.questId))
        : AsyncData(widget.initialQuest!);
    final asyncEntries = ref.watch(creatorEntriesProvider(widget.questId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Review entries'),
        backgroundColor: background,
        actions: [
          IconButton(
            onPressed: () =>
                ref.invalidate(creatorEntriesProvider(widget.questId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: asyncQuest.when(
          loading: () =>
              const Center(child: CircularProgressIndicator(color: ink)),
          error: (_, _) => Center(
            child: _QuestFeedError(
              onRetry: () => ref.invalidate(questProvider(widget.questId)),
            ),
          ),
          data: (quest) => asyncEntries.when(
            loading: () =>
                const Center(child: CircularProgressIndicator(color: ink)),
            error: (_, _) => Center(
              child: _QuestFeedError(
                onRetry: () =>
                    ref.invalidate(creatorEntriesProvider(widget.questId)),
              ),
            ),
            data: (entries) => _buildWorkspace(quest, entries),
          ),
        ),
      ),
    );
  }

  Widget _buildWorkspace(Quest quest, List<CreatorEntry> entries) {
    final allReviewed =
        entries.isNotEmpty &&
        entries.every((entry) => entry.reviewIsValid != null);
    final validEntries = entries
        .where((entry) => entry.reviewIsValid == true)
        .toList(growable: false);
    final expectedWinners = math.min(quest.winnerCount, validEntries.length);
    final selectionComplete =
        quest.winnerSelectionMethod == 'FIRST_VALID' ||
        selectedWinners.length == expectedWinners;

    return RefreshIndicator(
      color: ink,
      onRefresh: () =>
          ref.refresh(creatorEntriesProvider(widget.questId).future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CREATOR REVIEW',
                      style: TextStyle(
                        color: muted,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      quest.title,
                      style: const TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -.8,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9FFB0),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  '${entries.length}/${quest.maxEntries}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            quest.winnerSelectionMethod == 'FIRST_VALID'
                ? 'Review every entry. Valid winners are calculated from the trusted submission order.'
                : 'Review every entry, then select $expectedWinners valid winner${expectedWinners == 1 ? '' : 's'}.',
            style: const TextStyle(color: muted, height: 1.45),
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFFEAE5),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                errorMessage!,
                style: const TextStyle(color: Color(0xFF8F2E1E)),
              ),
            ),
          ],
          const SizedBox(height: 20),
          if (entries.isEmpty)
            Container(
              padding: const EdgeInsets.all(34),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: line),
              ),
              child: const Column(
                children: [
                  Icon(Icons.inbox_outlined, size: 38, color: muted),
                  SizedBox(height: 12),
                  Text(
                    'No entries yet',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            )
          else
            for (var index = 0; index < entries.length; index++) ...[
              _CreatorEntryCard(
                entry: entries[index],
                number: index + 1,
                reasonController: reasonFor(entries[index]),
                working: working == entries[index].id,
                bestSubmission:
                    quest.winnerSelectionMethod == 'BEST_SUBMISSION',
                selected: selectedWinners.contains(entries[index].id),
                onReview: (valid) => review(entries[index], valid),
                onWinner: () => setState(() {
                  if (selectedWinners.contains(entries[index].id)) {
                    selectedWinners.remove(entries[index].id);
                  } else if (selectedWinners.length < expectedWinners) {
                    selectedWinners.add(entries[index].id);
                  }
                  errorMessage = null;
                }),
              ),
              const SizedBox(height: 12),
            ],
          if (entries.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Finalize results',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    allReviewed
                        ? selectionComplete
                              ? 'All decisions are ready to lock permanently.'
                              : 'Select the published number of valid winners.'
                        : 'Review every entry before finalizing.',
                    style: const TextStyle(color: muted),
                  ),
                  const SizedBox(height: 15),
                  FilledButton.icon(
                    onPressed:
                        allReviewed && selectionComplete && working == null
                        ? () => finalize(quest, entries)
                        : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: ink,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(52),
                    ),
                    icon: working == 'finalize'
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.emoji_events_outlined),
                    label: const Text('Finalize quest'),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CreatorEntryCard extends StatelessWidget {
  const _CreatorEntryCard({
    required this.entry,
    required this.number,
    required this.reasonController,
    required this.working,
    required this.bestSubmission,
    required this.selected,
    required this.onReview,
    required this.onWinner,
  });

  final CreatorEntry entry;
  final int number;
  final TextEditingController reasonController;
  final bool working;
  final bool bestSubmission;
  final bool selected;
  final ValueChanged<bool> onReview;
  final VoidCallback onWinner;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(17),
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
                    'ENTRY $number',
                    style: const TextStyle(
                      color: muted,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    entry.participantName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '@${entry.participantUsername} · ${_shortDate(entry.submittedAt)}',
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            _ReviewStatus(value: entry.reviewIsValid),
          ],
        ),
        if (entry.caption != null) ...[
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(entry.caption!, style: const TextStyle(height: 1.4)),
          ),
        ],
        const SizedBox(height: 14),
        for (final evidence in entry.evidence) ...[
          _ReviewEvidence(evidence: evidence),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: reasonController,
          maxLength: 500,
          decoration: const InputDecoration(
            labelText: 'Review note (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: working ? null : () => onReview(true),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFE9FFB0),
                  foregroundColor: ink,
                ),
                icon: const Icon(Icons.check_rounded),
                label: const Text('Valid'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                onPressed: working ? null : () => onReview(false),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFFEAE5),
                  foregroundColor: const Color(0xFF8F2E1E),
                ),
                icon: const Icon(Icons.close_rounded),
                label: const Text('Invalid'),
              ),
            ),
          ],
        ),
        if (bestSubmission && entry.reviewIsValid == true) ...[
          const SizedBox(height: 9),
          OutlinedButton.icon(
            onPressed: onWinner,
            style: OutlinedButton.styleFrom(
              backgroundColor: selected ? ink : Colors.white,
              foregroundColor: selected ? Colors.white : ink,
              minimumSize: const Size.fromHeight(48),
            ),
            icon: const Icon(Icons.emoji_events_outlined),
            label: Text(selected ? 'Selected as winner' : 'Select as winner'),
          ),
        ],
      ],
    ),
  );
}

class _ReviewStatus extends StatelessWidget {
  const _ReviewStatus({required this.value});
  final bool? value;

  @override
  Widget build(BuildContext context) {
    final label = value == null
        ? 'Pending'
        : value!
        ? 'Valid'
        : 'Invalid';
    final color = value == null
        ? const Color(0xFFF0F1ED)
        : value!
        ? const Color(0xFFE9FFB0)
        : const Color(0xFFFFEAE5);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class _ReviewEvidence extends StatefulWidget {
  const _ReviewEvidence({required this.evidence});
  final EntryEvidence evidence;

  @override
  State<_ReviewEvidence> createState() => _ReviewEvidenceState();
}

class _ReviewEvidenceState extends State<_ReviewEvidence> {
  Future<String>? signedUrl;

  @override
  void initState() {
    super.initState();
    if (widget.evidence.proofType == 'PHOTO' ||
        widget.evidence.proofType == 'VIDEO') {
      signedUrl = Supabase.instance.client.storage
          .from('entry-media')
          .createSignedUrl(widget.evidence.value, 600);
    }
  }

  @override
  Widget build(BuildContext context) {
    final proof = widget.evidence.proofType;
    if (signedUrl != null) {
      return FutureBuilder<String>(
        future: signedUrl,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LinearProgressIndicator(color: ink);
          }
          if (!snapshot.hasData) {
            return const Text(
              'Private proof could not be opened.',
              style: TextStyle(color: muted),
            );
          }
          if (proof == 'PHOTO') {
            return ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                snapshot.data!,
                width: double.infinity,
                height: 190,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const SizedBox(
                  height: 100,
                  child: Center(child: Icon(Icons.broken_image_outlined)),
                ),
              ),
            );
          }
          return OutlinedButton.icon(
            onPressed: () => launchUrl(
              Uri.parse(snapshot.data!),
              mode: LaunchMode.externalApplication,
            ),
            icon: const Icon(Icons.play_circle_outline),
            label: const Text('Open private video proof'),
          );
        },
      );
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            proof.replaceAll('_', ' '),
            style: const TextStyle(
              color: muted,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          Text(widget.evidence.value),
        ],
      ),
    );
  }
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

class CreateQuestScreen extends ConsumerStatefulWidget {
  const CreateQuestScreen({super.key});

  @override
  ConsumerState<CreateQuestScreen> createState() => _CreateQuestScreenState();
}

class _CreateQuestScreenState extends ConsumerState<CreateQuestScreen> {
  final titleController = TextEditingController();
  final descriptionController = TextEditingController();
  final criteriaController = TextEditingController();
  final rewardController = TextEditingController(text: '10');
  int step = 0;
  String questType = 'FRIENDS';
  DateTime deadline = DateTime.now().add(const Duration(days: 7));
  bool isGroup = false;
  int groupSize = 2;
  int maxEntries = 5;
  final proofRequirements = <String>{'PHOTO'};
  String selectionMethod = 'FIRST_VALID';
  int winnerCount = 1;
  bool rewardEnabled = false;
  bool publishing = false;
  String? errorMessage;

  @override
  void dispose() {
    titleController.dispose();
    descriptionController.dispose();
    criteriaController.dispose();
    rewardController.dispose();
    super.dispose();
  }

  bool get currentStepValid => switch (step) {
    0 =>
      titleController.text.trim().length >= 3 &&
          descriptionController.text.trim().isNotEmpty &&
          deadline.isAfter(DateTime.now()),
    1 => proofRequirements.isNotEmpty,
    2 =>
      selectionMethod == 'FIRST_VALID' ||
          criteriaController.text.trim().length >= 3,
    _ => true,
  };

  Future<void> chooseDeadline() async {
    final date = await showDatePicker(
      context: context,
      initialDate: deadline,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(deadline),
    );
    if (time == null) return;
    setState(() {
      deadline = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      );
    });
  }

  Future<void> publish() async {
    final session = currentSession;
    if (session == null) {
      context.go('/auth?next=/create');
      return;
    }
    final rewardAmount = double.tryParse(rewardController.text.trim());
    if (rewardEnabled && (rewardAmount == null || rewardAmount <= 0)) {
      setState(() => errorMessage = 'Enter a reward greater than zero.');
      return;
    }
    setState(() {
      publishing = true;
      errorMessage = null;
    });
    try {
      final repository = ref.read(questRepositoryProvider);
      final created = await repository.createQuest({
        'title': titleController.text.trim(),
        'description': descriptionController.text.trim(),
        'cover_media_url': null,
        'quest_type': questType,
        'visibility': 'PUBLIC',
        'is_group_challenge': isGroup,
        'required_group_size': isGroup ? groupSize : null,
        'max_entries': maxEntries,
        'winner_count': winnerCount,
        'winner_selection_method': selectionMethod,
        'proof_requirements': proofRequirements.toList(growable: false),
        'judging_criteria': selectionMethod == 'BEST_SUBMISSION'
            ? criteriaController.text.trim()
            : null,
        'reward_enabled': rewardEnabled,
        'reward_amount_minor': rewardEnabled
            ? (rewardAmount! * 100000).round()
            : null,
        'reward_currency': rewardEnabled ? 'NIM' : null,
        'settlement_asset': rewardEnabled ? 'NIM' : null,
        'deadline': deadline.toUtc().toIso8601String(),
      }, session.accessToken);
      final published = await repository.publishQuest(
        created.id,
        session.accessToken,
      );
      ref.invalidate(myQuestsProvider);
      ref.invalidate(questsProvider);
      if (!mounted) return;
      if (published.status == 'OPEN') {
        context.go('/quests/${published.id}', extra: published);
      } else {
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            title: const Text('Quest saved'),
            content: const Text(
              'Your reward quest is awaiting funding verification. It will stay private until the reward pool is confirmed.',
            ),
            actions: [
              FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('View my quests'),
              ),
            ],
          ),
        );
        if (mounted) context.go('/my-quests');
      }
    } on DioException catch (error) {
      final data = error.response?.data;
      setState(() {
        errorMessage = data is Map<String, dynamic>
            ? data['message'] as String? ?? 'The quest could not be published.'
            : 'The quest could not be published.';
      });
    } finally {
      if (mounted) setState(() => publishing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(authStateProvider);
    if (currentSession == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/auth?next=/create');
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      );
    }

    const stepNames = ['Quest', 'Proof', 'Winners', 'Review'];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create a quest'),
        backgroundColor: background,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
          children: [
            Row(
              children: List.generate(stepNames.length, (index) {
                return Expanded(
                  child: Column(
                    children: [
                      Row(
                        children: [
                          if (index > 0)
                            Expanded(
                              child: Divider(color: index <= step ? ink : line),
                            ),
                          CircleAvatar(
                            radius: 15,
                            backgroundColor: index <= step ? accent : line,
                            foregroundColor: ink,
                            child: Text(
                              '${index + 1}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (index < stepNames.length - 1)
                            Expanded(
                              child: Divider(color: index < step ? ink : line),
                            ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        stepNames[index],
                        style: TextStyle(
                          color: index == step ? ink : muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
            const SizedBox(height: 28),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: switch (step) {
                0 => _buildQuestStep(),
                1 => _buildProofStep(),
                2 => _buildWinnerStep(),
                _ => _buildReviewStep(),
              },
            ),
            if (errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEAE5),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  errorMessage!,
                  style: const TextStyle(color: Color(0xFF8F2E1E)),
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 10, 20, 14),
        child: Row(
          children: [
            if (step > 0) ...[
              OutlinedButton(
                onPressed: publishing
                    ? null
                    : () => setState(() {
                        step -= 1;
                        errorMessage = null;
                      }),
                child: const Text('Back'),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: FilledButton.icon(
                onPressed: publishing || !currentStepValid
                    ? null
                    : () {
                        if (step < 3) {
                          setState(() {
                            step += 1;
                            errorMessage = null;
                          });
                        } else {
                          publish();
                        }
                      },
                style: FilledButton.styleFrom(
                  backgroundColor: accent,
                  foregroundColor: ink,
                  minimumSize: const Size.fromHeight(54),
                ),
                icon: publishing
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          color: ink,
                          strokeWidth: 2,
                        ),
                      )
                    : Icon(
                        step == 3
                            ? Icons.rocket_launch_outlined
                            : Icons.arrow_forward_rounded,
                      ),
                label: Text(
                  publishing
                      ? 'Publishing…'
                      : step == 3
                      ? rewardEnabled
                            ? 'Save for funding'
                            : 'Publish quest'
                      : 'Continue',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestStep() => Column(
    key: const ValueKey(0),
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _StepHeading(
        title: "What's the side quest?",
        subtitle: 'Make it sound like something people would want to try.',
      ),
      const SizedBox(height: 22),
      TextField(
        controller: titleController,
        maxLength: 100,
        onChanged: (_) => setState(() {}),
        decoration: const InputDecoration(
          labelText: 'Quest title',
          border: OutlineInputBorder(),
          hintText: 'Take the best sunset photo before 6 PM',
        ),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: descriptionController,
        maxLength: 2000,
        minLines: 4,
        maxLines: 6,
        onChanged: (_) => setState(() {}),
        decoration: const InputDecoration(
          labelText: 'What should people do?',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 12),
      _PickerTile(
        icon: Icons.calendar_today_outlined,
        title: 'Submission deadline',
        value:
            '${_shortDate(deadline)} · ${TimeOfDay.fromDateTime(deadline).format(context)}',
        onTap: chooseDeadline,
      ),
      const SizedBox(height: 20),
      const Text('Quest type', style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 10),
      SegmentedButton<String>(
        segments: const [
          ButtonSegment(value: 'FRIENDS', label: Text('Friends')),
          ButtonSegment(value: 'BOUNTY', label: Text('Bounty')),
          ButtonSegment(value: 'EXPLORE', label: Text('Explore')),
        ],
        selected: {questType},
        onSelectionChanged: (value) => setState(() => questType = value.first),
      ),
    ],
  );

  Widget _buildProofStep() {
    const proofs = {
      'PHOTO': 'Photo',
      'VIDEO': 'Video',
      'LINK': 'Link',
      'TEXT': 'Text',
      'QR_CHECKPOINT': 'QR checkpoint',
      'LOCATION': 'Location',
    };
    return Column(
      key: const ValueKey(1),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _StepHeading(
          title: 'Who can take part?',
          subtitle: 'Set the capacity and evidence required for a valid entry.',
        ),
        const SizedBox(height: 22),
        SwitchListTile.adaptive(
          value: isGroup,
          onChanged: (value) => setState(() => isGroup = value),
          contentPadding: EdgeInsets.zero,
          title: const Text(
            'Group challenge',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          subtitle: const Text('One representative submits for the group.'),
        ),
        if (isGroup) ...[
          const SizedBox(height: 10),
          const Text('Required group size'),
          Slider(
            value: groupSize.toDouble(),
            min: 2,
            max: 10,
            divisions: 8,
            label: '$groupSize people',
            onChanged: (value) => setState(() => groupSize = value.round()),
          ),
        ],
        const SizedBox(height: 16),
        const Text(
          'Maximum official entries',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        SegmentedButton<int>(
          segments: const [
            ButtonSegment(value: 3, label: Text('3')),
            ButtonSegment(value: 5, label: Text('5')),
            ButtonSegment(value: 10, label: Text('10')),
          ],
          selected: {maxEntries},
          onSelectionChanged: (value) => setState(() {
            maxEntries = value.first;
            winnerCount = math.min(winnerCount, maxEntries);
          }),
        ),
        const SizedBox(height: 24),
        const Text(
          'Required proof',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: proofs.entries
              .map((entry) {
                final selected = proofRequirements.contains(entry.key);
                return FilterChip(
                  selected: selected,
                  showCheckmark: true,
                  selectedColor: const Color(0xFFE9FFB0),
                  label: Text(entry.value),
                  onSelected: (_) => setState(() {
                    if (selected) {
                      proofRequirements.remove(entry.key);
                    } else {
                      proofRequirements.add(entry.key);
                    }
                  }),
                );
              })
              .toList(growable: false),
        ),
      ],
    );
  }

  Widget _buildWinnerStep() => Column(
    key: const ValueKey(2),
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _StepHeading(
        title: 'How are winners picked?',
        subtitle:
            'Publish the method now so every participant knows the rules.',
      ),
      const SizedBox(height: 22),
      _SelectionCard(
        selected: selectionMethod == 'FIRST_VALID',
        title: 'First valid',
        subtitle: 'The earliest qualifying entries win.',
        onTap: () => setState(() => selectionMethod = 'FIRST_VALID'),
      ),
      const SizedBox(height: 10),
      _SelectionCard(
        selected: selectionMethod == 'BEST_SUBMISSION',
        title: 'Best submission',
        subtitle: 'Review valid entries against published criteria.',
        onTap: () => setState(() => selectionMethod = 'BEST_SUBMISSION'),
      ),
      if (selectionMethod == 'BEST_SUBMISSION') ...[
        const SizedBox(height: 14),
        TextField(
          controller: criteriaController,
          maxLength: 500,
          minLines: 3,
          maxLines: 5,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(
            labelText: 'Judging criteria',
            border: OutlineInputBorder(),
          ),
        ),
      ],
      const SizedBox(height: 18),
      const Text(
        'Number of winners',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      const SizedBox(height: 10),
      SegmentedButton<int>(
        segments: [
          for (final count in [1, 2, 3].where((value) => value <= maxEntries))
            ButtonSegment(value: count, label: Text('$count')),
        ],
        selected: {winnerCount},
        onSelectionChanged: (value) =>
            setState(() => winnerCount = value.first),
      ),
      const SizedBox(height: 24),
      SwitchListTile.adaptive(
        value: rewardEnabled,
        onChanged: (value) => setState(() => rewardEnabled = value),
        contentPadding: EdgeInsets.zero,
        title: const Text(
          'Monetary reward',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: const Text(
          'Reward quests remain private until funding is verified.',
        ),
      ),
      if (rewardEnabled) ...[
        const SizedBox(height: 12),
        TextField(
          controller: rewardController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            labelText: 'NIM per winner',
            suffixText: ' NIM',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        const Text('Funded and independently verified on Nimiq testnet.'),
      ],
    ],
  );

  Widget _buildReviewStep() {
    final reward = double.tryParse(rewardController.text.trim()) ?? 0;
    final rows = <(String, String)>[
      ('Quest', titleController.text.trim()),
      ('Type', questType.toLowerCase()),
      ('Deadline', _shortDate(deadline)),
      ('Participation', isGroup ? 'Group of $groupSize' : 'Individual'),
      ('Entries', '$maxEntries maximum'),
      (
        'Winners',
        '$winnerCount · ${selectionMethod == 'FIRST_VALID' ? 'first valid' : 'best submission'}',
      ),
      (
        'Proof',
        proofRequirements
            .map((value) => value.replaceAll('_', ' ').toLowerCase())
            .join(', '),
      ),
      (
        'Reward',
        rewardEnabled
            ? '${reward.toStringAsFixed(5)} NIM each'
            : 'Just for fun',
      ),
    ];
    return Column(
      key: const ValueKey(3),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _StepHeading(
          title: 'Ready to publish?',
          subtitle: 'Review the permanent rules before the quest goes live.',
        ),
        const SizedBox(height: 22),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: line),
          ),
          child: Column(
            children: [
              for (var index = 0; index < rows.length; index++) ...[
                Padding(
                  padding: const EdgeInsets.all(15),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 92,
                        child: Text(
                          rows[index].$1,
                          style: const TextStyle(color: muted, fontSize: 13),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          rows[index].$2,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (index < rows.length - 1) const Divider(height: 1),
              ],
            ],
          ),
        ),
        if (rewardEnabled) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF5D9),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Text(
              'Publishing saves this quest as Awaiting Funding. It will not appear as open until settlement is verified.',
              style: TextStyle(color: Color(0xFF72500A), height: 1.45),
            ),
          ),
        ],
      ],
    );
  }
}

class _StepHeading extends StatelessWidget {
  const _StepHeading({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(
          fontSize: 28,
          height: 1.08,
          fontWeight: FontWeight.w700,
          letterSpacing: -1,
        ),
      ),
      const SizedBox(height: 8),
      Text(subtitle, style: const TextStyle(color: muted, height: 1.45)),
    ],
  );
}

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.icon,
    required this.title,
    required this.value,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(14),
    child: Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(icon, color: muted),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: muted, fontSize: 12)),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: const TextStyle(fontWeight: FontWeight.w700),
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

class _SelectionCard extends StatelessWidget {
  const _SelectionCard({
    required this.selected,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final bool selected;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(16),
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: selected ? const Color(0xFFE9FFB0) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: selected ? const Color(0xFF9BC800) : line),
      ),
      child: Row(
        children: [
          Icon(
            selected ? Icons.radio_button_checked : Icons.radio_button_off,
            color: selected ? ink : muted,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
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

    final asyncQuests = selectedTab == 4
        ? ref.watch(savedQuestsProvider)
        : ref.watch(myQuestsProvider);
    const labels = ['Active', 'Created', 'Joined', 'Completed', 'Saved'];

    return Scaffold(
      appBar: AppBar(
        title: const Text('My quests'),
        backgroundColor: background,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(
              selectedTab == 4 ? savedQuestsProvider : myQuestsProvider,
            ),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: ink,
          onRefresh: () => ref.refresh(
            selectedTab == 4
                ? savedQuestsProvider.future
                : myQuestsProvider.future,
          ),
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
                    onRetry: () => ref.invalidate(
                      selectedTab == 4 ? savedQuestsProvider : myQuestsProvider,
                    ),
                  ),
                ),
                data: (quests) {
                  final filtered = quests
                      .where((quest) {
                        return switch (selectedTab) {
                          1 => quest.isCreator,
                          2 => !quest.isCreator,
                          3 => quest.isCompleted,
                          4 => true,
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
        onPressed: () => context.push('/create'),
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
          if (index == 2) context.push('/create');
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
    final reviewable =
        quest.isCreator &&
        (quest.status == 'CLOSED_FOR_REVIEW' ||
            quest.status == 'REVIEWING' ||
            (open && quest.deadline.isBefore(DateTime.now())));
    return InkWell(
      onTap: reviewable
          ? () => context.push('/quests/${quest.id}/review')
          : open
          ? () => context.push('/quests/${quest.id}')
          : null,
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
                        quest.isCreator
                            ? 'CREATED BY YOU'
                            : quest.isSaved
                            ? 'SAVED QUEST'
                            : 'JOINED',
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
                if (reviewable)
                  const Text(
                    'Review entries',
                    style: TextStyle(
                      color: Color(0xFF698A00),
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                if (open || reviewable)
                  const Icon(Icons.chevron_right_rounded, color: muted),
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

class QuestSettlementScreen extends ConsumerWidget {
  const QuestSettlementScreen({required this.questId, super.key});

  final String questId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(authStateProvider);
    if (currentSession == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/auth?next=/quests/$questId/settlement');
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      );
    }

    final settlement = ref.watch(questSettlementProvider(questId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reward settlement'),
        backgroundColor: background,
      ),
      body: SafeArea(
        child: settlement.when(
          loading: () =>
              const Center(child: CircularProgressIndicator(color: ink)),
          error: (_, _) => Center(
            child: _QuestFeedError(
              onRetry: () => ref.invalidate(questSettlementProvider(questId)),
            ),
          ),
          data: (value) {
            final confirmed = value.payouts
                .where((payout) => payout.status == 'CONFIRMED')
                .length;
            return RefreshIndicator(
              color: ink,
              onRefresh: () =>
                  ref.refresh(questSettlementProvider(questId).future),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
                children: [
                  const Text(
                    'CREATOR SETTLEMENT · NIMIQ TESTNET',
                    style: TextStyle(
                      color: muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: ink,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Allocated to winners',
                              style: TextStyle(color: Colors.white60),
                            ),
                            CircleAvatar(
                              backgroundColor: accent,
                              foregroundColor: ink,
                              child: Icon(Icons.shield_outlined),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        Text(
                          '${value.totalAllocatedNim} NIM',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '$confirmed/${value.payouts.length} payouts confirmed',
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  const Text(
                    'Winner payouts',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 12),
                  if (value.payouts.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: line),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'Payouts appear after a funded quest is finalized with valid winners.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: muted, height: 1.45),
                      ),
                    )
                  else
                    ...value.payouts.map(_CreatorPayoutCard.new),
                  const SizedBox(height: 14),
                  const Text(
                    'This screen is read-only. A payout is confirmed only after independent TestAlbatross verification.',
                    style: TextStyle(color: muted, fontSize: 11, height: 1.45),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CreatorPayoutCard extends StatelessWidget {
  const _CreatorPayoutCard(this.payout);

  final CreatorPayout payout;

  @override
  Widget build(BuildContext context) {
    final address = payout.destinationAddress;
    final shortAddress = address.length > 20
        ? '${address.substring(0, 9)}…${address.substring(address.length - 9)}'
        : address;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: payout.status == 'CONFIRMED'
                    ? accent
                    : const Color(0xFFF0F1EC),
                foregroundColor: ink,
                child: Text(
                  '${payout.winnerPosition}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payout.recipientDisplayName,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      '@${payout.recipientUsername}',
                      style: const TextStyle(color: muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Text(
                '${payout.amountNim} NIM',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _PayoutStatus(status: payout.status),
              Text(
                shortAddress,
                style: const TextStyle(color: muted, fontSize: 11),
              ),
              if (payout.transactionHash != null)
                Text(
                  'Tx ${payout.transactionHash!.substring(0, math.min(10, payout.transactionHash!.length))}…',
                  style: const TextStyle(color: muted, fontSize: 11),
                ),
            ],
          ),
          if (payout.failureReason != null) ...[
            const SizedBox(height: 10),
            Text(
              payout.failureReason!,
              style: const TextStyle(color: Color(0xFF8F2E1E), fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }
}

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(authStateProvider);
    if (currentSession == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/auth?next=/wallet');
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: ink)),
      );
    }

    final payouts = ref.watch(myPayoutsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reward wallet'),
        backgroundColor: background,
        actions: [
          IconButton(
            tooltip: 'Payout settings',
            onPressed: () => context.push('/profile'),
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: payouts.when(
          loading: () =>
              const Center(child: CircularProgressIndicator(color: ink)),
          error: (_, _) => Center(
            child: _QuestFeedError(
              onRetry: () => ref.invalidate(myPayoutsProvider),
            ),
          ),
          data: (items) {
            final confirmedLuna = items
                .where((payout) => payout.status == 'CONFIRMED')
                .fold<int>(0, (total, payout) => total + payout.amountLuna);
            return RefreshIndicator(
              color: ink,
              onRefresh: () => ref.refresh(myPayoutsProvider.future),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
                children: [
                  const Text(
                    'NIMIQ TESTNET',
                    style: TextStyle(
                      color: muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: ink,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Confirmed rewards',
                              style: TextStyle(color: Colors.white60),
                            ),
                            CircleAvatar(
                              backgroundColor: accent,
                              foregroundColor: ink,
                              child: Icon(
                                Icons.account_balance_wallet_outlined,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 22),
                        Text(
                          '${_formatLuna(confirmedLuna)} NIM',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 34,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1.2,
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Testnet NIM has no monetary value. Mainnet payouts are not enabled.',
                          style: TextStyle(color: Colors.white38, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Payout activity',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '${items.length} total',
                        style: const TextStyle(color: muted, fontSize: 12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (items.isEmpty)
                    const _EmptyPayouts()
                  else
                    ...items.map(_PayoutCard.new),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  static String _formatLuna(int luna) {
    final whole = luna ~/ 100000;
    final fraction = (luna % 100000).toString().padLeft(5, '0');
    final trimmed = fraction.replaceFirst(RegExp(r'0+$'), '');
    return trimmed.isEmpty ? '$whole' : '$whole.$trimmed';
  }
}

class _EmptyPayouts extends StatelessWidget {
  const _EmptyPayouts();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 42),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: line),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      children: [
        const CircleAvatar(
          radius: 24,
          backgroundColor: Color(0xFFF0F1EC),
          foregroundColor: muted,
          child: Icon(Icons.schedule_rounded),
        ),
        const SizedBox(height: 16),
        const Text(
          'No payouts yet',
          style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 7),
        const Text(
          'When you win a funded quest, its reward and payout status will appear here.',
          textAlign: TextAlign.center,
          style: TextStyle(color: muted, height: 1.45),
        ),
        const SizedBox(height: 18),
        FilledButton(
          onPressed: () => context.go('/discover'),
          style: FilledButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: ink,
          ),
          child: const Text('Explore quests'),
        ),
      ],
    ),
  );
}

class _PayoutCard extends StatelessWidget {
  const _PayoutCard(this.payout);

  final PayoutSummary payout;

  @override
  Widget build(BuildContext context) {
    final confirmed = payout.status == 'CONFIRMED';
    final address = payout.destinationAddress;
    final shortAddress = address.length > 20
        ? '${address.substring(0, 9)}…${address.substring(address.length - 9)}'
        : address;
    final date = payout.createdAt;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: confirmed ? accent : const Color(0xFFF0F1EC),
            foregroundColor: ink,
            child: Icon(
              confirmed
                  ? Icons.check_circle_outline_rounded
                  : Icons.schedule_rounded,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        payout.questTitle,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    Text(
                      '+${payout.amountNim} NIM',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  '${_month(date.month)} ${date.day}, ${date.year}',
                  style: const TextStyle(color: muted, fontSize: 11),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _PayoutStatus(status: payout.status),
                    Text(
                      'To $shortAddress',
                      style: const TextStyle(color: muted, fontSize: 11),
                    ),
                  ],
                ),
                if (payout.failureReason != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    payout.failureReason!,
                    style: const TextStyle(
                      color: Color(0xFF8F2E1E),
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _month(int value) => const [
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
  ][value - 1];
}

class _PayoutStatus extends StatelessWidget {
  const _PayoutStatus({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: status == 'CONFIRMED' ? const Color(0xFFF1FFD0) : background,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      status.toLowerCase(),
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
    ),
  );
}

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final usernameController = TextEditingController();
  final nameController = TextEditingController();
  final bioController = TextEditingController();
  final payoutAddressController = TextEditingController();
  String? loadedProfileId;
  bool editing = false;
  bool saving = false;
  bool savingPayoutAddress = false;
  bool payoutAddressLoaded = false;
  String? errorMessage;
  String? payoutErrorMessage;

  @override
  void dispose() {
    usernameController.dispose();
    nameController.dispose();
    bioController.dispose();
    payoutAddressController.dispose();
    super.dispose();
  }

  void loadControllers(UserProfile profile) {
    if (loadedProfileId == profile.id) return;
    loadedProfileId = profile.id;
    usernameController.text = profile.username;
    nameController.text = profile.displayName;
    bioController.text = profile.bio ?? '';
  }

  Future<void> save() async {
    final session = currentSession;
    if (session == null) return;
    final username = usernameController.text.trim().toLowerCase();
    final displayName = nameController.text.trim();
    if (!RegExp(r'^[a-z0-9_]{3,30}$').hasMatch(username)) {
      setState(() {
        errorMessage =
            'Username needs 3–30 lowercase letters, numbers, or underscores.';
      });
      return;
    }
    if (displayName.isEmpty || displayName.characters.length > 80) {
      setState(() => errorMessage = 'Display name needs 1–80 characters.');
      return;
    }
    if (bioController.text.characters.length > 240) {
      setState(() => errorMessage = 'Bio cannot exceed 240 characters.');
      return;
    }

    setState(() {
      saving = true;
      errorMessage = null;
    });
    try {
      final updated = await ref.read(questRepositoryProvider).updateMyProfile({
        'username': username,
        'display_name': displayName,
        'bio': bioController.text.trim(),
      }, session.accessToken);
      loadedProfileId = null;
      ref.invalidate(myProfileProvider);
      if (mounted) {
        loadControllers(updated);
        setState(() => editing = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Profile updated.')));
      }
    } on DioException catch (error) {
      final data = error.response?.data;
      setState(() {
        errorMessage = data is Map<String, dynamic>
            ? data['message'] as String? ?? 'Your profile could not be updated.'
            : 'Your profile could not be updated.';
      });
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> savePayoutAddress() async {
    final session = currentSession;
    if (session == null) return;
    setState(() {
      savingPayoutAddress = true;
      payoutErrorMessage = null;
    });
    try {
      final destination = await ref
          .read(questRepositoryProvider)
          .setPayoutDestination(
            payoutAddressController.text.trim(),
            session.accessToken,
          );
      payoutAddressController.text = destination.address;
      ref.invalidate(payoutDestinationProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('NIM payout address saved.')),
        );
      }
    } on DioException catch (error) {
      final data = error.response?.data;
      setState(() {
        payoutErrorMessage = data is Map<String, dynamic>
            ? data['message'] as String? ??
                  'That Nimiq address could not be saved.'
            : 'That Nimiq address could not be saved.';
      });
    } finally {
      if (mounted) setState(() => savingPayoutAddress = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: background,
        actions: [
          if (!editing)
            IconButton(
              tooltip: 'Edit profile',
              onPressed: () => setState(() => editing = true),
              icon: const Icon(Icons.edit_outlined),
            ),
        ],
      ),
      body: SafeArea(
        child: ref
            .watch(myProfileProvider)
            .when(
              loading: () =>
                  const Center(child: CircularProgressIndicator(color: ink)),
              error: (_, _) => Center(
                child: _QuestFeedError(
                  onRetry: () => ref.invalidate(myProfileProvider),
                ),
              ),
              data: (profile) {
                loadControllers(profile);
                return ListView(
                  padding: const EdgeInsets.fromLTRB(24, 14, 24, 40),
                  children: [
                    _ProfileAvatar(profile: profile),
                    const SizedBox(height: 18),
                    if (editing)
                      _buildEditor(profile)
                    else
                      _buildProfile(profile, session.user.email ?? ''),
                    const SizedBox(height: 28),
                    _buildPayoutDestination(),
                    const SizedBox(height: 28),
                    OutlinedButton.icon(
                      onPressed: saving
                          ? null
                          : () async {
                              await Supabase.instance.client.auth.signOut();
                              ref.invalidate(myProfileProvider);
                              ref.invalidate(myQuestsProvider);
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
                );
              },
            ),
      ),
    );
  }

  Widget _buildPayoutDestination() {
    final destination = ref.watch(payoutDestinationProvider);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              CircleAvatar(
                backgroundColor: Color(0xFFF1FFD0),
                foregroundColor: ink,
                child: Icon(Icons.account_balance_wallet_outlined),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'NIM reward destination',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Required before entering a rewarded quest.',
                      style: TextStyle(color: muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          destination.when(
            loading: () => const LinearProgressIndicator(color: accent),
            error: (_, _) => _QuestFeedError(
              onRetry: () => ref.invalidate(payoutDestinationProvider),
            ),
            data: (value) {
              if (!payoutAddressLoaded) {
                payoutAddressLoaded = true;
                payoutAddressController.text = value?.address ?? '';
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: payoutAddressController,
                    autocorrect: false,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Nimiq Testnet address',
                      hintText: 'NQ00 0000 0000 0000 0000 0000 0000 0000 0000',
                      helperText: 'Locked when a rewarded entry is submitted.',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (payoutErrorMessage != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      payoutErrorMessage!,
                      style: const TextStyle(color: Color(0xFF8F2E1E)),
                    ),
                  ],
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: savingPayoutAddress ? null : savePayoutAddress,
                    style: FilledButton.styleFrom(
                      backgroundColor: ink,
                      foregroundColor: Colors.white,
                    ),
                    icon: savingPayoutAddress
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.verified_outlined),
                    label: Text(
                      savingPayoutAddress
                          ? 'Validating…'
                          : 'Save payout address',
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildProfile(UserProfile profile, String email) {
    final quests = ref
        .watch(myQuestsProvider)
        .maybeWhen(data: (value) => value, orElse: () => const <MyQuest>[]);
    final created = quests.where((quest) => quest.isCreator).length;
    final active = quests.where((quest) => !quest.isCompleted).length;
    final completed = quests.where((quest) => quest.isCompleted).length;
    return Column(
      children: [
        Text(
          profile.displayName,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w700,
            letterSpacing: -.8,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          '@${profile.username}',
          textAlign: TextAlign.center,
          style: const TextStyle(color: muted, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 3),
        Text(email, style: const TextStyle(color: muted, fontSize: 12)),
        if (profile.bio?.isNotEmpty ?? false) ...[
          const SizedBox(height: 14),
          Text(
            profile.bio!,
            textAlign: TextAlign.center,
            style: const TextStyle(height: 1.45),
          ),
        ],
        const SizedBox(height: 24),
        Row(
          children: [
            _ProfileStat(value: '$completed', label: 'Completed'),
            const SizedBox(width: 8),
            _ProfileStat(value: '$active', label: 'Active'),
            const SizedBox(width: 8),
            _ProfileStat(value: '$created', label: 'Created'),
          ],
        ),
        const SizedBox(height: 22),
        FilledButton.icon(
          onPressed: () => context.push('/my-quests'),
          style: FilledButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: ink,
            minimumSize: const Size.fromHeight(52),
          ),
          icon: const Icon(Icons.emoji_events_outlined),
          label: const Text('Manage my quests'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => context.push('/wallet'),
          style: OutlinedButton.styleFrom(
            foregroundColor: ink,
            minimumSize: const Size.fromHeight(52),
          ),
          icon: const Icon(Icons.account_balance_wallet_outlined),
          label: const Text('View reward wallet'),
        ),
      ],
    );
  }

  Widget _buildEditor(UserProfile profile) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      TextField(
        controller: nameController,
        maxLength: 80,
        textCapitalization: TextCapitalization.words,
        decoration: const InputDecoration(
          labelText: 'Display name',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: usernameController,
        maxLength: 30,
        autocorrect: false,
        textCapitalization: TextCapitalization.none,
        decoration: const InputDecoration(
          labelText: 'Username',
          prefixText: '@',
          helperText: 'Lowercase letters, numbers, and underscores only.',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: bioController,
        maxLength: 240,
        minLines: 3,
        maxLines: 5,
        decoration: const InputDecoration(
          labelText: 'Bio',
          border: OutlineInputBorder(),
        ),
      ),
      if (errorMessage != null) ...[
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFEAE5),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text(
            errorMessage!,
            style: const TextStyle(color: Color(0xFF8F2E1E)),
          ),
        ),
      ],
      const SizedBox(height: 16),
      Row(
        children: [
          OutlinedButton(
            onPressed: saving
                ? null
                : () {
                    loadedProfileId = null;
                    loadControllers(profile);
                    setState(() {
                      editing = false;
                      errorMessage = null;
                    });
                  },
            child: const Text('Cancel'),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton.icon(
              onPressed: saving ? null : save,
              style: FilledButton.styleFrom(
                backgroundColor: ink,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(50),
              ),
              icon: saving
                  ? const SizedBox.square(
                      dimension: 17,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.save_outlined),
              label: const Text('Save profile'),
            ),
          ),
        ],
      ),
    ],
  );
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.profile});
  final UserProfile profile;

  @override
  Widget build(BuildContext context) => Center(
    child: CircleAvatar(
      radius: 48,
      backgroundColor: ink,
      foregroundImage: profile.avatarUrl == null
          ? null
          : NetworkImage(profile.avatarUrl!),
      child: profile.avatarUrl == null
          ? Text(
              profile.displayName.characters.first.toUpperCase(),
              style: const TextStyle(
                color: accent,
                fontSize: 31,
                fontWeight: FontWeight.w800,
              ),
            )
          : null,
    ),
  );
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: line),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 3),
          Text(label, style: const TextStyle(color: muted, fontSize: 10)),
        ],
      ),
    ),
  );
}

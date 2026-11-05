// SideQuest v5 social screens: the tab bar, Friends, group rooms, room votes, group invites
// and short share links. Friends challenges never appear on Discover.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../main.dart';

enum AppTab { discover, friends, create, quests, profile }

/// Bottom navigation from the v5 design: Discover, Friends, Create, My quests, Profile.
class SideQuestTabBar extends StatelessWidget {
  const SideQuestTabBar({super.key, required this.current});
  final AppTab current;

  static const _routes = {
    AppTab.discover: '/discover',
    AppTab.friends: '/friends',
    AppTab.create: '/create',
    AppTab.quests: '/my-quests',
    AppTab.profile: '/profile',
  };

  @override
  Widget build(BuildContext context) {
    final signedIn = currentSession != null;
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Container(
        height: 64,
        decoration: BoxDecoration(
          color: ink,
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [
            BoxShadow(color: Color(0x3D111111), blurRadius: 36, offset: Offset(0, 16)),
          ],
        ),
        child: Row(
          children: [
            for (final tab in AppTab.values)
              Expanded(
                child: tab == AppTab.create
                    ? Center(
                        child: Semantics(
                          button: true,
                          label: 'Create a quest',
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => _go(context, tab, signedIn),
                            child: Container(
                              width: 48,
                              height: 48,
                              decoration: const BoxDecoration(
                                color: accent,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.add_rounded, color: ink),
                            ),
                          ),
                        ),
                      )
                    : InkWell(
                        borderRadius: BorderRadius.circular(999),
                        onTap: () => _go(context, tab, signedIn),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              switch (tab) {
                                AppTab.discover => Icons.explore_outlined,
                                AppTab.friends => Icons.group_outlined,
                                AppTab.quests => Icons.sports_martial_arts_outlined,
                                _ => Icons.person_outline,
                              },
                              color: Colors.white.withValues(
                                alpha: tab == current ? 1 : 0.65,
                              ),
                              size: 20,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              switch (tab) {
                                AppTab.discover => 'Discover',
                                AppTab.friends => 'Friends',
                                AppTab.quests => 'My quests',
                                _ => 'Profile',
                              },
                              style: TextStyle(
                                color: Colors.white.withValues(
                                  alpha: tab == current ? 1 : 0.65,
                                ),
                                fontSize: 10,
                                fontWeight: tab == current
                                    ? FontWeight.w700
                                    : FontWeight.w600,
                              ),
                            ),
                            if (tab == current)
                              Container(
                                margin: const EdgeInsets.only(top: 3),
                                width: 5,
                                height: 5,
                                decoration: const BoxDecoration(
                                  color: accent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                      ),
              ),
          ],
        ),
      ),
    );
  }

  void _go(BuildContext context, AppTab tab, bool signedIn) {
    if (tab == current) return;
    final route = _routes[tab]!;
    if (tab == AppTab.discover) {
      context.go(route);
    } else {
      context.push(signedIn ? route : '/auth?next=$route');
    }
  }
}

class FriendPerson {
  const FriendPerson({
    required this.id,
    required this.username,
    required this.displayName,
    required this.state,
  });

  factory FriendPerson.fromJson(Map<String, dynamic> json) => FriendPerson(
    id: json['id'] as String,
    username: json['username'] as String,
    displayName: json['display_name'] as String,
    state: json['state'] as String,
  );

  final String id;
  final String username;
  final String displayName;

  /// ACCEPTED, INCOMING or OUTGOING.
  final String state;
}

class FriendGroup {
  const FriendGroup({
    required this.id,
    required this.name,
    required this.inviteCode,
    required this.memberCount,
    required this.activeChallenges,
    required this.viewerRole,
  });

  factory FriendGroup.fromJson(Map<String, dynamic> json) => FriendGroup(
    id: json['id'] as String,
    name: json['name'] as String,
    inviteCode: json['invite_code'] as String,
    memberCount: (json['member_count'] as num).toInt(),
    activeChallenges: (json['active_challenges'] as num).toInt(),
    viewerRole: json['viewer_role'] as String,
  );

  final String id;
  final String name;
  final String inviteCode;
  final int memberCount;
  final int activeChallenges;
  final String viewerRole;
}

class FriendsChallenge {
  const FriendsChallenge({
    required this.id,
    required this.title,
    required this.status,
    required this.deadline,
    required this.votesCloseAt,
    required this.method,
    required this.stake,
    required this.creator,
    required this.entries,
    required this.viewerVoted,
  });

  factory FriendsChallenge.fromJson(Map<String, dynamic> json) =>
      FriendsChallenge(
        id: json['id'] as String,
        title: json['title'] as String,
        status: json['status'] as String,
        deadline: DateTime.parse(json['deadline'] as String).toLocal(),
        votesCloseAt: DateTime.parse(json['votes_close_at'] as String).toLocal(),
        method: json['winner_selection_method'] as String,
        stake: json['friendly_stake'] as String?,
        creator: json['creator_display_name'] as String,
        entries: (json['entries_received'] as num).toInt(),
        viewerVoted: json['viewer_voted'] as bool? ?? false,
      );

  final String id;
  final String title;
  final String status;
  final DateTime deadline;
  final DateTime votesCloseAt;
  final String method;
  final String? stake;
  final String creator;
  final int entries;
  final bool viewerVoted;

  /// OPEN, VOTING, CLOSING or FINISHED.
  String get phase {
    final now = DateTime.now();
    if (status == 'FINALIZED') return 'FINISHED';
    if (deadline.isAfter(now)) return 'OPEN';
    if (method == 'ROOM_VOTE' && votesCloseAt.isAfter(now)) return 'VOTING';
    return 'CLOSING';
  }
}

class GroupMember {
  const GroupMember({
    required this.displayName,
    required this.username,
    required this.role,
    required this.seasonWins,
  });

  factory GroupMember.fromJson(Map<String, dynamic> json) => GroupMember(
    displayName: json['display_name'] as String,
    username: json['username'] as String,
    role: json['role'] as String,
    seasonWins: (json['season_wins'] as num).toInt(),
  );

  final String displayName;
  final String username;
  final String role;
  final int seasonWins;
}

class GroupRoom {
  const GroupRoom({required this.group, required this.members, required this.challenges});
  final FriendGroup group;
  final List<GroupMember> members;
  final List<FriendsChallenge> challenges;
}

class VoteCandidate {
  const VoteCandidate({
    required this.entryId,
    required this.participantId,
    required this.name,
    required this.caption,
    required this.mediaUrl,
    required this.votes,
  });

  factory VoteCandidate.fromJson(Map<String, dynamic> json) => VoteCandidate(
    entryId: json['entry_id'] as String,
    participantId: json['participant_id'] as String,
    name: json['participant_display_name'] as String,
    caption: json['caption'] as String?,
    mediaUrl: json['media_url'] as String?,
    votes: (json['votes'] as num?)?.toInt(),
  );

  final String entryId;
  final String participantId;
  final String name;
  final String? caption;
  final String? mediaUrl;
  final int? votes;
}

class VoteBallot {
  const VoteBallot({
    required this.title,
    required this.groupName,
    required this.votesCloseAt,
    required this.phase,
    required this.viewerVote,
    required this.canVote,
    required this.candidates,
  });

  factory VoteBallot.fromJson(Map<String, dynamic> json) => VoteBallot(
    title: json['title'] as String,
    groupName: json['group_name'] as String?,
    votesCloseAt: DateTime.parse(json['votes_close_at'] as String).toLocal(),
    phase: json['phase'] as String,
    viewerVote: json['viewer_vote'] as String?,
    canVote: json['viewer_can_vote'] as bool? ?? false,
    candidates: (json['candidates'] as List<dynamic>)
        .map((item) => VoteCandidate.fromJson(item as Map<String, dynamic>))
        .toList(growable: false),
  );

  final String title;
  final String? groupName;
  final DateTime votesCloseAt;
  final String phase;
  final String? viewerVote;
  final bool canVote;
  final List<VoteCandidate> candidates;
}

class FriendsRepository {
  FriendsRepository([Dio? dio])
    : _dio = dio ?? Dio(BaseOptions(baseUrl: apiBaseUrl));
  final Dio _dio;

  Options get _auth {
    final session = currentSession;
    return Options(
      headers: {
        if (session != null) 'Authorization': 'Bearer ${session.accessToken}',
      },
    );
  }

  Future<List<FriendPerson>> friends() async {
    final response = await _dio.get<List<dynamic>>('/friends', options: _auth);
    return response.data!
        .map((item) => FriendPerson.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<List<FriendGroup>> groups() async {
    final response = await _dio.get<List<dynamic>>(
      '/friends/groups',
      options: _auth,
    );
    return response.data!
        .map((item) => FriendGroup.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<List<FriendsChallenge>> challenges() async {
    final response = await _dio.get<List<dynamic>>(
      '/friends/challenges',
      options: _auth,
    );
    return response.data!
        .map((item) => FriendsChallenge.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<GroupRoom> room(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/friends/groups/$id',
      options: _auth,
    );
    final data = response.data!;
    return GroupRoom(
      group: FriendGroup.fromJson(data['group'] as Map<String, dynamic>),
      members: (data['members'] as List<dynamic>)
          .map((item) => GroupMember.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
      challenges: (data['challenges'] as List<dynamic>)
          .map((item) => FriendsChallenge.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  Future<String> requestFriend(String username) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/friends/requests',
      data: {'username': username},
      options: _auth,
    );
    return response.data!['state'] as String;
  }

  Future<void> acceptFriend(String userId) =>
      _dio.post<void>('/friends/requests/$userId/accept', options: _auth);

  Future<void> removeFriend(String userId) =>
      _dio.delete<void>('/friends/$userId', options: _auth);

  Future<String> createGroup(String name) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/friends/groups',
      data: {'name': name},
      options: _auth,
    );
    return response.data!['id'] as String;
  }

  Future<Map<String, dynamic>> previewGroup(String code) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/g/$code',
      options: _auth,
    );
    return response.data!;
  }

  Future<String> joinGroup(String code) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/g/$code/join',
      options: _auth,
    );
    return response.data!['id'] as String;
  }

  Future<VoteBallot> ballot(String questId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/quests/$questId/vote',
      options: _auth,
    );
    return VoteBallot.fromJson(response.data!);
  }

  Future<void> vote(String questId, String entryId) => _dio.post<void>(
    '/quests/$questId/vote',
    data: {'entry_id': entryId},
    options: _auth,
  );

  Future<Map<String, dynamic>> resolveShortCode(String code) async {
    final response = await _dio.get<Map<String, dynamic>>('/q/$code');
    return response.data!;
  }
}

final friendsRepositoryProvider = Provider<FriendsRepository>(
  (ref) => FriendsRepository(),
);
final friendsListProvider = FutureProvider.autoDispose<List<FriendPerson>>(
  (ref) => ref.watch(friendsRepositoryProvider).friends(),
);
final friendGroupsProvider = FutureProvider.autoDispose<List<FriendGroup>>(
  (ref) => ref.watch(friendsRepositoryProvider).groups(),
);
final friendsChallengesProvider =
    FutureProvider.autoDispose<List<FriendsChallenge>>(
      (ref) => ref.watch(friendsRepositoryProvider).challenges(),
    );
final groupRoomProvider = FutureProvider.autoDispose.family<GroupRoom, String>(
  (ref, id) => ref.watch(friendsRepositoryProvider).room(id),
);
final ballotProvider = FutureProvider.autoDispose.family<VoteBallot, String>(
  (ref, id) => ref.watch(friendsRepositoryProvider).ballot(id),
);

String _apiMessage(Object error, String fallback) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic> && data['message'] is String) {
      return data['message'] as String;
    }
  }
  return fallback;
}

const _display = TextStyle(
  fontWeight: FontWeight.w900,
  letterSpacing: -1.2,
  height: 0.9,
);

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  final usernameController = TextEditingController();
  bool working = false;

  @override
  void dispose() {
    usernameController.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() task, String done) async {
    setState(() => working = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await task();
      ref
        ..invalidate(friendsListProvider)
        ..invalidate(friendGroupsProvider);
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } on Object catch (error) {
      messenger.showSnackBar(
        SnackBar(content: Text(_apiMessage(error, 'That did not work. Try again.'))),
      );
    } finally {
      if (mounted) setState(() => working = false);
    }
  }

  Future<void> _newGroup() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New group'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 40,
          decoration: const InputDecoration(hintText: 'Lekki Crew'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.length < 2 || !mounted) return;
    try {
      final id = await ref.read(friendsRepositoryProvider).createGroup(name);
      ref.invalidate(friendGroupsProvider);
      if (mounted) context.push('/friends/groups/$id');
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_apiMessage(error, 'The group could not be created.'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final challenges = ref.watch(friendsChallengesProvider);
    final groups = ref.watch(friendGroupsProvider);
    final people = ref.watch(friendsListProvider);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref
              ..invalidate(friendsChallengesProvider)
              ..invalidate(friendGroupsProvider)
              ..invalidate(friendsListProvider);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text('FRIENDS', style: TextStyle(fontSize: 46, fontWeight: FontWeight.w900, letterSpacing: -2.4, height: 0.9)),
                  ),
                  FilledButton.icon(
                    onPressed: () => context.push('/create'),
                    style: FilledButton.styleFrom(backgroundColor: accent, foregroundColor: ink),
                    icon: const Icon(Icons.bolt_rounded),
                    label: const Text('Challenge', style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              const _SectionTitle('Your challenges'),
              challenges.when(
                loading: () => const LinearProgressIndicator(),
                error: (_, _) => const Text('Challenges could not load. Pull to retry.', style: TextStyle(color: muted)),
                data: (items) => items.isEmpty
                    ? const _EmptyCard(
                        title: 'DARE YOUR PEOPLE.',
                        body: 'Cook-offs, photo recreations, sunset runs. Send a challenge, then the room votes the winner.',
                      )
                    : Column(children: [for (final challenge in items) _ChallengeTile(challenge: challenge)]),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Expanded(child: _SectionTitle('Your groups')),
                  TextButton.icon(onPressed: _newGroup, icon: const Icon(Icons.add_rounded), label: const Text('New group')),
                ],
              ),
              groups.when(
                loading: () => const LinearProgressIndicator(),
                error: (_, _) => const SizedBox.shrink(),
                data: (items) => items.isEmpty
                    ? const Text('No groups yet. Start one for your crew.', style: TextStyle(color: muted))
                    : Column(
                        children: [
                          for (final group in items)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                backgroundColor: coral,
                                foregroundColor: ink,
                                child: Text(group.name.substring(0, group.name.length < 2 ? 1 : 2).toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800)),
                              ),
                              title: Text(group.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                              subtitle: Text('${group.memberCount} members'),
                              trailing: group.activeChallenges > 0 ? Chip(label: Text('${group.activeChallenges} live'), backgroundColor: const Color(0xFFFFE9E1), side: BorderSide.none) : const Icon(Icons.chevron_right_rounded),
                              onTap: () => context.push('/friends/groups/${group.id}'),
                            ),
                        ],
                      ),
              ),
              const SizedBox(height: 24),
              const _SectionTitle('Friends'),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: usernameController,
                      autocorrect: false,
                      textCapitalization: TextCapitalization.none,
                      decoration: InputDecoration(
                        hintText: '@username',
                        filled: true,
                        fillColor: sunken,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 18),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: working
                        ? null
                        : () {
                            final username = usernameController.text.trim();
                            if (username.isEmpty) return;
                            _run(() async {
                              await ref.read(friendsRepositoryProvider).requestFriend(username);
                              usernameController.clear();
                            }, 'Friend request sent.');
                          },
                    style: FilledButton.styleFrom(backgroundColor: ink, foregroundColor: Colors.white, minimumSize: const Size(64, 48)),
                    child: const Text('Add'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              people.when(
                loading: () => const LinearProgressIndicator(),
                error: (_, _) => const SizedBox.shrink(),
                data: (items) => Column(
                  children: [
                    for (final person in items)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: CircleAvatar(
                          backgroundColor: person.state == 'ACCEPTED' ? accent : sunken,
                          foregroundColor: ink,
                          child: Text(person.displayName.characters.first.toUpperCase()),
                        ),
                        title: Text(person.displayName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(switch (person.state) {
                          'INCOMING' => 'Wants to be friends',
                          'OUTGOING' => 'Request sent',
                          _ => '@${person.username}',
                        }),
                        onTap: person.state == 'ACCEPTED' ? () => context.push('/users/${person.username}') : null,
                        trailing: person.state == 'ACCEPTED'
                            ? null
                            : Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (person.state == 'INCOMING')
                                    IconButton(
                                      tooltip: 'Accept',
                                      onPressed: working ? null : () => _run(() => ref.read(friendsRepositoryProvider).acceptFriend(person.id), 'You are friends now.'),
                                      icon: const Icon(Icons.check_circle_rounded),
                                    ),
                                  IconButton(
                                    tooltip: person.state == 'INCOMING' ? 'Decline' : 'Cancel request',
                                    onPressed: working ? null : () => _run(() => ref.read(friendsRepositoryProvider).removeFriend(person.id), 'Request removed.'),
                                    icon: const Icon(Icons.close_rounded),
                                  ),
                                ],
                              ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(22)),
                child: const Text(
                  'No money between friends. Stakes are text only, like "Loser buys suya". After each deadline the room votes for 24 hours, one vote each, never for yourself. Ties share the win.',
                  style: TextStyle(color: Colors.white, height: 1.4),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: const SideQuestTabBar(current: AppTab.friends),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(text.toUpperCase(), style: _display.copyWith(fontSize: 22)),
  );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      border: Border.all(color: line),
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _display.copyWith(fontSize: 28)),
        const SizedBox(height: 8),
        Text(body, style: const TextStyle(color: muted, height: 1.4)),
      ],
    ),
  );
}

class _ChallengeTile extends StatelessWidget {
  const _ChallengeTile({required this.challenge});
  final FriendsChallenge challenge;

  @override
  Widget build(BuildContext context) {
    final phase = challenge.phase;
    final voting = phase == 'VOTING';
    final hours = (voting ? challenge.votesCloseAt : challenge.deadline)
        .difference(DateTime.now())
        .inHours
        .clamp(0, 9999);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: line),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: voting ? coral : limeTint,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    switch (phase) {
                      'VOTING' => 'VOTING OPEN · ${hours}H LEFT',
                      'OPEN' => 'SUBMIT IN ${hours}H',
                      'FINISHED' => 'FINISHED',
                      _ => 'RESULTS COMING',
                    },
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.1),
                  ),
                ),
                const SizedBox(height: 8),
                Text(challenge.title.toUpperCase(), style: _display.copyWith(fontSize: 22)),
                const SizedBox(height: 4),
                Text(
                  'By ${challenge.creator} · ${challenge.entries} in${challenge.stake == null ? '' : ' · ${challenge.stake}'}',
                  style: const TextStyle(color: muted, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(
            onPressed: () => context.push(
              voting ? '/quests/${challenge.id}/vote' : '/quests/${challenge.id}',
            ),
            style: FilledButton.styleFrom(
              backgroundColor: voting && !challenge.viewerVoted ? accent : sunken,
              foregroundColor: ink,
            ),
            child: Text(voting ? (challenge.viewerVoted ? 'Ballot' : 'Vote') : 'Open'),
          ),
        ],
      ),
    );
  }
}

class GroupRoomScreen extends ConsumerWidget {
  const GroupRoomScreen({super.key, required this.groupId});
  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final room = ref.watch(groupRoomProvider(groupId));
    return Scaffold(
      appBar: AppBar(backgroundColor: background, surfaceTintColor: background),
      body: room.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const Center(child: Text('This group could not load.')),
        data: (room) {
          final inviteUrl = Uri.parse(webBaseUrl).resolve('/g/${room.group.inviteCode}').toString();
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
            children: [
              Text(room.group.name.toUpperCase(), style: _display.copyWith(fontSize: 40)),
              const SizedBox(height: 4),
              Text('Private room · ${room.members.length} members', style: const TextStyle(color: muted)),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => context.push('/create'),
                style: FilledButton.styleFrom(backgroundColor: accent, foregroundColor: ink, minimumSize: const Size.fromHeight(52)),
                icon: const Icon(Icons.bolt_rounded),
                label: const Text('CHALLENGE THE ROOM', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.4)),
              ),
              const SizedBox(height: 22),
              const _SectionTitle('Challenges'),
              if (room.challenges.isEmpty)
                const Text('Quiet in here. Start the first challenge.', style: TextStyle(color: muted)),
              for (final challenge in room.challenges) _ChallengeTile(challenge: challenge),
              const SizedBox(height: 22),
              const _SectionTitle('Leaderboard'),
              for (final (index, member) in room.members.indexed)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: index == 0 && member.seasonWins > 0 ? accent : sunken,
                    foregroundColor: ink,
                    child: Text('${index + 1}', style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                  title: Text(member.displayName, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: member.role == 'OWNER' ? const Text('Owner') : null,
                  trailing: Text('${member.seasonWins}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  onTap: () => context.push('/users/${member.username}'),
                ),
              const SizedBox(height: 22),
              const _SectionTitle('Invite to the room'),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(color: Colors.white, border: Border.all(color: line), borderRadius: BorderRadius.circular(12)),
                    child: QrImageView(data: inviteUrl, size: 96),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(inviteUrl.replaceFirst(RegExp(r'^https?://'), ''), style: const TextStyle(fontWeight: FontWeight.w700)),
                        TextButton.icon(
                          onPressed: () async {
                            await Clipboard.setData(ClipboardData(text: inviteUrl));
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invite link copied.')));
                            }
                          },
                          icon: const Icon(Icons.copy_rounded, size: 16),
                          label: const Text('Copy link'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class VoteScreen extends ConsumerStatefulWidget {
  const VoteScreen({super.key, required this.questId});
  final String questId;

  @override
  ConsumerState<VoteScreen> createState() => _VoteScreenState();
}

class _VoteScreenState extends ConsumerState<VoteScreen> {
  String? pick;
  bool sending = false;

  Future<void> _cast() async {
    final entryId = pick;
    if (entryId == null) return;
    setState(() => sending = true);
    try {
      await ref.read(friendsRepositoryProvider).vote(widget.questId, entryId);
      ref.invalidate(ballotProvider(widget.questId));
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_apiMessage(error, 'Your vote could not be cast.'))),
        );
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ballot = ref.watch(ballotProvider(widget.questId));
    final viewerId = currentSession?.user.id;
    return Scaffold(
      appBar: AppBar(backgroundColor: background, surfaceTintColor: background),
      body: ballot.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const Center(child: Text('This vote could not load.')),
        data: (ballot) {
          final hours = ballot.votesCloseAt.difference(DateTime.now()).inHours.clamp(0, 999);
          final closed = ballot.phase == 'CLOSED';
          final candidates = closed
              ? ([...ballot.candidates]..sort((a, b) => (b.votes ?? 0).compareTo(a.votes ?? 0)))
              : ballot.candidates;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    decoration: BoxDecoration(color: coral, borderRadius: BorderRadius.circular(999)),
                    child: Text(
                      '${(ballot.groupName ?? 'Room').toUpperCase()} · ROOM VOTE',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6),
                    ),
                  ),
                  const Spacer(),
                  Text(closed ? 'DONE' : '${hours}H', style: _display.copyWith(fontSize: 30)),
                ],
              ),
              const SizedBox(height: 14),
              Text(ballot.title.toUpperCase(), style: _display.copyWith(fontSize: 36)),
              const SizedBox(height: 12),
              const Text(
                'One vote each · Not for yourself · Ties share the win',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: muted),
              ),
              const SizedBox(height: 16),
              if (ballot.phase == 'SUBMITTING')
                const Text('Voting opens when submissions close.', style: TextStyle(color: muted)),
              for (final candidate in candidates)
                _CandidateTile(
                  candidate: candidate,
                  own: candidate.participantId == viewerId,
                  closed: closed,
                  selected: (pick ?? ballot.viewerVote) == candidate.entryId,
                  enabled: ballot.canVote && candidate.participantId != viewerId,
                  onTap: () => setState(() => pick = candidate.entryId),
                ),
              if (ballot.viewerVote != null && !closed)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text('Vote cast. Results show when voting closes.', textAlign: TextAlign.center),
                ),
            ],
          );
        },
      ),
      bottomNavigationBar: ballot.maybeWhen(
        data: (ballot) => ballot.canVote
            ? SafeArea(
                minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: FilledButton(
                  onPressed: pick == null || sending ? null : _cast,
                  style: FilledButton.styleFrom(backgroundColor: accent, foregroundColor: ink, minimumSize: const Size.fromHeight(58)),
                  child: Text(sending ? 'SENDING…' : 'CAST VOTE', style: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 2)),
                ),
              )
            : null,
        orElse: () => null,
      ),
    );
  }
}

class _CandidateTile extends StatelessWidget {
  const _CandidateTile({
    required this.candidate,
    required this.own,
    required this.closed,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final VoteCandidate candidate;
  final bool own;
  final bool closed;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final media = candidate.mediaUrl;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: selected ? limeTint : Colors.white,
            border: Border.all(color: selected ? ink : line, width: selected ? 2 : 1),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 72,
                  height: 72,
                  child: media != null && media.startsWith('https://')
                      ? Opacity(opacity: own ? 0.5 : 1, child: Image.network(media, fit: BoxFit.cover))
                      : Container(color: sunken, child: const Icon(Icons.image_outlined, color: muted)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text((own ? 'You' : candidate.name).toUpperCase(), style: _display.copyWith(fontSize: 18)),
                    if (candidate.caption != null)
                      Text(candidate.caption!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: muted, fontSize: 13)),
                    if (own) const Text("You can't vote for your own entry", style: TextStyle(color: muted, fontSize: 12)),
                  ],
                ),
              ),
              if (closed)
                Text('${candidate.votes ?? 0}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20))
              else
                Icon(
                  selected ? Icons.radio_button_checked : Icons.radio_button_off,
                  color: enabled || selected ? ink : line,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class GroupInviteScreen extends ConsumerStatefulWidget {
  const GroupInviteScreen({super.key, required this.code});
  final String code;

  @override
  ConsumerState<GroupInviteScreen> createState() => _GroupInviteScreenState();
}

class _GroupInviteScreenState extends ConsumerState<GroupInviteScreen> {
  late final Future<Map<String, dynamic>> preview = ref
      .read(friendsRepositoryProvider)
      .previewGroup(widget.code);
  bool joining = false;

  Future<void> _join() async {
    if (currentSession == null) {
      context.push('/auth?next=${Uri.encodeComponent('/g/${widget.code}')}');
      return;
    }
    setState(() => joining = true);
    try {
      final id = await ref.read(friendsRepositoryProvider).joinGroup(widget.code);
      if (mounted) context.go('/friends/groups/$id');
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_apiMessage(error, 'You could not join this group.'))),
        );
      }
    } finally {
      if (mounted) setState(() => joining = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(backgroundColor: background, surfaceTintColor: background),
    body: FutureBuilder<Map<String, dynamic>>(
      future: preview,
      builder: (context, snapshot) {
        if (snapshot.hasError) return const Center(child: Text('This invite link is not valid.'));
        final group = snapshot.data;
        if (group == null) return const Center(child: CircularProgressIndicator());
        return Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${group['owner_display_name']} invited you to a group', style: const TextStyle(color: muted)),
              const SizedBox(height: 10),
              Text((group['name'] as String).toUpperCase(), style: _display.copyWith(fontSize: 44)),
              const SizedBox(height: 8),
              Text('${group['member_count']} members · private room · challenges won by vote', style: const TextStyle(color: muted)),
              const Spacer(),
              FilledButton(
                onPressed: joining ? null : _join,
                style: FilledButton.styleFrom(backgroundColor: accent, foregroundColor: ink, minimumSize: const Size.fromHeight(56)),
                child: const Text('JOIN THE GROUP', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.6)),
              ),
            ],
          ),
        );
      },
    ),
  );
}

/// Opens sdqst.app/q/CODE links inside the app: resolves the code, then shows the quest.
class ShortLinkScreen extends ConsumerStatefulWidget {
  const ShortLinkScreen({super.key, required this.code});
  final String code;

  @override
  ConsumerState<ShortLinkScreen> createState() => _ShortLinkScreenState();
}

class _ShortLinkScreenState extends ConsumerState<ShortLinkScreen> {
  String? error;

  @override
  void initState() {
    super.initState();
    ref.read(friendsRepositoryProvider).resolveShortCode(widget.code).then((target) {
      if (mounted) context.replace('/quests/${target['quest_id']}');
    }).catchError((Object _) {
      if (mounted) setState(() => error = 'This link is not valid, or the quest was removed.');
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(backgroundColor: background, surfaceTintColor: background),
    body: Center(
      child: error == null
          ? const CircularProgressIndicator()
          : Padding(padding: const EdgeInsets.all(24), child: Text(error!, textAlign: TextAlign.center)),
    ),
  );
}

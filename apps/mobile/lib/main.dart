import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

const background = Color(0xFFF8F8F5);
const ink = Color(0xFF171917);
const muted = Color(0xFF6F756F);
const accent = Color(0xFFC7FF00);
const line = Color(0xFFE6E8E2);

void main() => runApp(const ProviderScope(child: SideQuestApp()));

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/discover',
    routes: [
      GoRoute(
        path: '/discover',
        builder: (context, state) => const DiscoverScreen(),
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
        fontFamily: 'Avenir Next',
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
    required this.title,
    required this.creator,
    required this.image,
    required this.meta,
  });
  final String title;
  final String creator;
  final String image;
  final String meta;
}

const quests = [
  Quest(
    title: 'Show us your coffee ritual',
    creator: 'Brew & Co.',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85',
    meta: r'$10 · 3/5 entries',
  ),
  Quest(
    title: 'Campus talent hunt',
    creator: 'Uni Lagos',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=85',
    meta: r'$30 · 2/5 entries',
  ),
  Quest(
    title: 'Weekend run challenge',
    creator: 'Run Club',
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=85',
    meta: r'$15 · 4/10 entries',
  ),
];

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  int selectedFilter = 0;

  @override
  Widget build(BuildContext context) {
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
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              sliver: SliverToBoxAdapter(
                child: _FeaturedQuest(quest: quests.first),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
              sliver: SliverToBoxAdapter(
                child: Row(
                  children: [
                    Text(
                      'Trending quests',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontSize: 19),
                    ),
                    const Spacer(),
                    const Text(
                      'See all  →',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 110),
              sliver: SliverList.separated(
                itemCount: quests.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (context, index) =>
                    _QuestRow(quest: quests[index]),
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
                child: const Text(
                  'FEATURED EXPLORE',
                  style: TextStyle(
                    color: ink,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .6,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'City sunset challenge',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 23,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Capture the best sunset spot in your city.',
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 14),
              const Text(
                r'$20 reward  ·  3/5 entries  ·  1 winner',
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
    return Container(
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
                  quest.meta,
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
    );
  }
}

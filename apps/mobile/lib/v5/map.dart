// Apple Maps for SideQuest.
//
// iOS renders native MapKit through apple_maps_flutter. Android has no native Apple Maps, so
// it shows the web app's MapKit JS view (/embed/map) in a WebView; marker taps come back
// through the `SideQuestBridge` JavaScript channel and open the native quest screen.
import 'dart:convert';
import 'dart:io';

import 'package:apple_maps_flutter/apple_maps_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../main.dart';

/// Opens Apple Maps directions to a place (Apple Maps app on iOS, maps.apple.com elsewhere).
Future<void> openAppleDirections(double latitude, double longitude, String name) {
  return launchUrl(
    Uri.https('maps.apple.com', '/', {
      'daddr': '$latitude,$longitude',
      'q': name,
    }),
    mode: LaunchMode.externalApplication,
  );
}

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  String? selectedId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: background,
        surfaceTintColor: background,
        title: const Text(
          'ON THE MAP',
          style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.8),
        ),
      ),
      body: Platform.isIOS ? _nativeMap(context) : const _WebAppleMap(),
    );
  }

  Widget _nativeMap(BuildContext context) {
    final asyncQuests = ref.watch(questsProvider);
    return asyncQuests.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => Center(
        child: TextButton(
          onPressed: () => ref.invalidate(questsProvider),
          child: const Text('The map could not load. Try again.'),
        ),
      ),
      data: (quests) {
        final located = quests
            .where(
              (quest) =>
                  quest.status == 'OPEN' &&
                  quest.latitude != null &&
                  quest.longitude != null,
            )
            .toList(growable: false);
        Quest? selected;
        for (final quest in located) {
          if (quest.id == selectedId) selected = quest;
        }
        final center = located.isEmpty
            ? const LatLng(6.5244, 3.3792)
            : LatLng(located.first.latitude!, located.first.longitude!);
        return Stack(
          children: [
            AppleMap(
              initialCameraPosition: CameraPosition(target: center, zoom: 12),
              myLocationEnabled: true,
              myLocationButtonEnabled: true,
              annotations: {
                for (final quest in located)
                  Annotation(
                    annotationId: AnnotationId(quest.id),
                    position: LatLng(quest.latitude!, quest.longitude!),
                    infoWindow: InfoWindow(
                      title: quest.title,
                      snippet: quest.isHunt
                          ? 'Hunt · ${quest.checkpointCount} stops · ${quest.rewardLabel}'
                          : quest.rewardLabel,
                    ),
                    onTap: () => setState(() => selectedId = quest.id),
                  ),
              },
            ),
            if (located.isEmpty)
              const Positioned(
                left: 16,
                right: 16,
                top: 16,
                child: _MapNotice(
                  text:
                      'No bounties with a place yet. They show here when their creator adds a location.',
                ),
              ),
            if (selected != null)
              Positioned(
                left: 12,
                right: 12,
                bottom: 24,
                child: _SelectedQuestCard(quest: selected),
              ),
          ],
        );
      },
    );
  }
}

class _SelectedQuestCard extends StatelessWidget {
  const _SelectedQuestCard({required this.quest});
  final Quest quest;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(22),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    quest.title.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.6,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      quest.rewardLabel,
                      if (quest.isHunt) '${quest.checkpointCount} stops',
                      ?quest.locationName,
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: muted, fontSize: 13),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Directions in Apple Maps',
              onPressed: () => openAppleDirections(
                quest.latitude!,
                quest.longitude!,
                quest.locationName ?? quest.title,
              ),
              icon: const Icon(Icons.directions_outlined),
            ),
            FilledButton(
              onPressed: () => context.push('/quests/${quest.id}', extra: quest),
              style: FilledButton.styleFrom(
                backgroundColor: accent,
                foregroundColor: ink,
              ),
              child: const Text(
                'VIEW',
                style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapNotice extends StatelessWidget {
  const _MapNotice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(18),
    elevation: 4,
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Text(text, style: const TextStyle(color: muted)),
    ),
  );
}

class _WebAppleMap extends StatefulWidget {
  const _WebAppleMap();

  @override
  State<_WebAppleMap> createState() => _WebAppleMapState();
}

class _WebAppleMapState extends State<_WebAppleMap> {
  late final WebViewController controller;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    final brightness =
        WidgetsBinding.instance.platformDispatcher.platformBrightness;
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(background)
      ..addJavaScriptChannel(
        'SideQuestBridge',
        onMessageReceived: (message) {
          final data = jsonDecode(message.message);
          if (data is Map<String, dynamic> &&
              data['type'] == 'open' &&
              data['questId'] is String &&
              mounted) {
            context.push('/quests/${data['questId']}');
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => loading = false);
          },
          // Keep the web view on the map; any other link opens the native screen or browser.
          onNavigationRequest: (request) {
            final uri = Uri.parse(request.url);
            if (uri.path.startsWith('/embed/map') ||
                uri.host.contains('apple-mapkit.com') ||
                uri.host.contains('apple.com')) {
              return NavigationDecision.navigate;
            }
            if (uri.path.startsWith('/quests/') && mounted) {
              context.push(uri.path);
            }
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(
        Uri.parse(webBaseUrl).resolve(
          '/embed/map?theme=${brightness == Brightness.dark ? 'dark' : 'light'}',
        ),
      );
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      WebViewWidget(controller: controller),
      if (loading) const Center(child: CircularProgressIndicator()),
    ],
  );
}

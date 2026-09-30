import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:sis_patrimonio_mobile/screens/home_screen.dart';
import 'package:sis_patrimonio_mobile/screens/welcome_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  runApp(const SisPatrimonioApp());
}

class SisPatrimonioApp extends StatelessWidget {
  const SisPatrimonioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SisPatrimonio',
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('pt', 'BR')],
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F172A),
          brightness: Brightness.light,
        ),
      ),
      home: const AuthGateScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class AuthGateScreen extends StatefulWidget {
  const AuthGateScreen({super.key});

  @override
  State<AuthGateScreen> createState() => _AuthGateScreenState();
}

class _AuthGateScreenState extends State<AuthGateScreen> {
  final ApiService _api = ApiService();
  bool _isCheckingSession = true;
  bool _hasValidSession = false;
  String _syncStatus = 'Verificando sessao...';
  double? _syncProgress;

  @override
  void initState() {
    super.initState();
    ApiService.sessionExpired.addListener(_onSessionExpired);
    _bootstrapSession();
  }

  @override
  void dispose() {
    ApiService.sessionExpired.removeListener(_onSessionExpired);
    super.dispose();
  }

  void _onSessionExpired() {
    if (!ApiService.sessionExpired.value || !mounted) return;
    setState(() {
      _hasValidSession = false;
      _isCheckingSession = false;
      _syncProgress = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
    });
  }

  Future<void> _bootstrapSession() async {
    final hasSession = await _api.hasValidSession();

    if (!mounted) return;

    if (!hasSession) {
      setState(() {
        _hasValidSession = false;
        _isCheckingSession = false;
        _syncProgress = null;
      });
      return;
    }

    if (!mounted) return;

    setState(() {
      _hasValidSession = true;
      _isCheckingSession = false;
      _syncProgress = null;
      _syncStatus = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingSession) {
      return SessionLoadingScreen(status: _syncStatus, progress: _syncProgress);
    }

    if (_hasValidSession) {
      return const HomeScreen();
    }

    return WelcomeScreen(
      notice: ApiService.sessionExpired.value
          ? 'Sua sessão expirou. Entre novamente para continuar.'
          : null,
    );
  }
}

class SessionLoadingScreen extends StatelessWidget {
  final String status;
  final double? progress;

  const SessionLoadingScreen({super.key, required this.status, this.progress});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Colors.white),
            const SizedBox(height: 20),
            Text(
              status,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            if (progress != null) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: 220,
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: Colors.white24,
                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

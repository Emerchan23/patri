import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/screens/login_screen.dart';
import 'package:sis_patrimonio_mobile/screens/settings_screen.dart';
import 'package:sis_patrimonio_mobile/public_consultation/home_screen.dart'
    as viewer;

class WelcomeScreen extends StatelessWidget {
  final String? notice;

  const WelcomeScreen({super.key, this.notice});

  void _open(BuildContext context, Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    const navy = Color(0xFF0F172A);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
              shrinkWrap: true,
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    tooltip: 'Configurar endereço do servidor',
                    onPressed: () => _open(
                      context,
                      const SettingsScreen(showLogout: false),
                    ),
                    icon: const Icon(Icons.settings_outlined),
                  ),
                ),
                const Icon(Icons.inventory_2_outlined, size: 58, color: navy),
                const SizedBox(height: 16),
                const Text(
                  'SIS Patrimônio',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: navy,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Consulte um bem ou acesse a gestão patrimonial.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.blueGrey.shade700,
                    height: 1.4,
                  ),
                ),
                if (notice != null) ...[
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFED7AA)),
                    ),
                    child: Text(
                      notice!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFF9A3412)),
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                _WelcomeAction(
                  icon: Icons.qr_code_scanner,
                  title: 'Consulta rápida',
                  subtitle:
                      'Leia um QR Code ou digite o código do bem ou da sala.',
                  color: const Color(0xFF2563EB),
                  onTap: () => _open(context, const viewer.HomeScreen()),
                ),
                const SizedBox(height: 14),
                _WelcomeAction(
                  icon: Icons.lock_outline,
                  title: 'Entrar como gestor',
                  subtitle:
                      'Acesse movimentações e as demais funções administrativas.',
                  color: navy,
                  onTap: () => _open(context, const LoginScreen()),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _WelcomeAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _WelcomeAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Colors.blueGrey.shade100),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: color.withValues(alpha: 0.1),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.blueGrey.shade700,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

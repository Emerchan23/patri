import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/services/settings_service.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/screens/welcome_screen.dart';

class SettingsScreen extends StatefulWidget {
  final bool showLogout;
  final ApiService? apiService;

  const SettingsScreen({super.key, this.showLogout = true, this.apiService});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _urlController = TextEditingController();
  final SettingsService _settingsService = SettingsService();
  late final ApiService _apiService = widget.apiService ?? ApiService();
  bool _isTesting = false;

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final url = await _settingsService.getServerUrl();
    if (!mounted) return;
    setState(() {
      _urlController.text = url;
    });
  }

  String? _normalizedUrl() {
    return _normalizeUrl(_urlController.text);
  }

  String? _normalizeUrl(String input) {
    var value = input.trim();
    if (value.isEmpty) return null;
    if (!value.contains('://')) value = 'http://$value';
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !{'http', 'https'}.contains(uri.scheme.toLowerCase()) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      return null;
    }
    final normalizedPath = uri.path.replaceFirst(RegExp(r'/+$'), '');
    return uri
        .replace(path: normalizedPath)
        .toString()
        .replaceFirst(RegExp(r'/+$'), '');
  }

  Future<bool> _confirmServerChange() async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Trocar servidor?'),
          content: const Text(
            'A sessão atual será encerrada por segurança. Você precisará entrar novamente no servidor selecionado.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Trocar servidor'),
            ),
          ],
        ),
      ) ??
      false;

  void _openWelcome() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const WelcomeScreen()),
      (_) => false,
    );
  }

  Future<void> _saveSettings() async {
    final url = _normalizedUrl();
    if (url == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Informe uma URL válida iniciando com http:// ou https://.',
          ),
        ),
      );
      return;
    }
    final previousUrl = await _settingsService.getServerUrl();
    final serverChanged = (_normalizeUrl(previousUrl) ?? previousUrl) != url;
    if (serverChanged && !await _confirmServerChange()) return;

    await _settingsService.setServerUrl(url);
    if (serverChanged) {
      await _apiService.clearStoredSession();
      if (mounted) _openWelcome();
      return;
    }
    if (mounted) {
      _urlController.text = url;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Configurações salvas!')));
    }
  }

  Future<void> _testConnection() async {
    final url = _normalizedUrl();
    if (url == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Informe uma URL válida iniciando com http:// ou https://.',
          ),
        ),
      );
      return;
    }
    final previousUrl = await _settingsService.getServerUrl();
    final serverChanged = (_normalizeUrl(previousUrl) ?? previousUrl) != url;
    if (serverChanged && !await _confirmServerChange()) return;
    if (!mounted) return;
    setState(() => _isTesting = true);
    await _settingsService.setServerUrl(url);
    final success = await _apiService.testConnection();
    if (!success) await _settingsService.setServerUrl(previousUrl);
    if (!mounted) return;
    setState(() => _isTesting = false);
    if (success) {
      _urlController.text = url;
      if (serverChanged) {
        await _apiService.clearStoredSession();
        if (mounted) _openWelcome();
        return;
      }
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Conexão bem-sucedida!'
                : 'Não foi possível alcançar o servidor. Confira o IP e a porta, a conexão à rede/VPN e se o serviço do SIS Patrimônio está ativo.',
          ),
          backgroundColor: success ? Colors.green : Colors.red,
        ),
      );
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sair da conta?'),
        content: const Text(
          'Você precisará informar seu usuário e senha para entrar novamente.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Continuar conectado'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sair'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _apiService.clearStoredSession();
    if (mounted) _openWelcome();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text(
          'Configurações',
          style: TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Não precisa de domínio: informe o IP e a porta do servidor (ex.: 192.168.1.10:7400). No emulador, 10.0.2.2 aponta para o computador; para acessar a VPS, use o IP da VPS. HTTP não criptografa senha nem sessão: use somente em rede local confiável ou VPN. Não use HTTP pela internet pública.',
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _urlController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'URL do Servidor',
                labelStyle: TextStyle(color: Colors.white70),
                helperText: 'Ex.: 192.168.1.10:7400 (sem domínio)',
                helperStyle: TextStyle(color: Colors.white54),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.white24),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: Colors.white),
                ),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 12,
              runSpacing: 12,
              children: [
                OutlinedButton.icon(
                  onPressed: _isTesting ? null : _testConnection,
                  icon: _isTesting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.wifi, color: Colors.white),
                  label: const Text(
                    'Testar',
                    style: TextStyle(color: Colors.white),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white70),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: _saveSettings,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 32,
                      vertical: 12,
                    ),
                  ),
                  child: const Text('Salvar'),
                ),
              ],
            ),
            if (widget.showLogout) ...[
              const SizedBox(height: 28),
              OutlinedButton.icon(
                onPressed: _logout,
                icon: const Icon(Icons.logout),
                label: const Text('Sair da conta'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white70),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

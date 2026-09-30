import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class SystemAdminSettingsScreen extends StatefulWidget {
  final Future<CurrentUserSession?> Function()? userSessionLoader;
  final Future<SystemAdminSettings> Function()? settingsLoader;
  final Future<void> Function(SystemAdminSettings settings)? saveSettings;

  const SystemAdminSettingsScreen({
    super.key,
    this.userSessionLoader,
    this.settingsLoader,
    this.saveSettings,
  });

  @override
  State<SystemAdminSettingsScreen> createState() =>
      _SystemAdminSettingsScreenState();
}

class _SystemAdminSettingsScreenState extends State<SystemAdminSettingsScreen> {
  final ApiService _api = ApiService();
  final _webDaysController = TextEditingController();
  final _mobileDaysController = TextEditingController();
  final _xmlLinkController = TextEditingController();
  final _portalLinkController = TextEditingController();
  late Future<CurrentUserSession?> _userFuture;
  Future<SystemAdminSettings>? _settingsFuture;
  String _themeColor = 'blue';
  String _sidebarColor = 'dark';
  bool _initialized = false;
  bool _saving = false;

  static const _themes = <String, String>{
    'blue': 'Azul (padrão)',
    'green': 'Verde',
    'red': 'Vermelho',
    'orange': 'Laranja',
    'purple': 'Roxo',
    'slate': 'Cinza',
  };
  static const _sidebars = <String, String>{
    'dark': 'Escuro (padrão)',
    'light': 'Claro',
    'navy': 'Azul-marinho',
    'slate': 'Cinza moderno',
  };

  @override
  void initState() {
    super.initState();
    _userFuture = _loadUser();
  }

  @override
  void dispose() {
    _webDaysController.dispose();
    _mobileDaysController.dispose();
    _xmlLinkController.dispose();
    _portalLinkController.dispose();
    super.dispose();
  }

  Future<CurrentUserSession?> _loadUser() =>
      widget.userSessionLoader?.call() ?? _api.getCurrentUserSession();

  Future<SystemAdminSettings> _loadSettings() =>
      widget.settingsLoader?.call() ?? _api.getSystemAdminSettings();

  Future<void> _saveSettings(SystemAdminSettings value) =>
      widget.saveSettings?.call(value) ?? _api.saveSystemAdminSettings(value);

  void _applyLoadedSettings(SystemAdminSettings settings) {
    if (_initialized) return;
    _initialized = true;
    _themeColor = _themes.containsKey(settings.themeColor)
        ? settings.themeColor
        : 'blue';
    _sidebarColor = _sidebars.containsKey(settings.sidebarColor)
        ? settings.sidebarColor
        : 'dark';
    _webDaysController.text = settings.sessionDaysWeb.toString();
    _mobileDaysController.text = settings.sessionDaysMobile.toString();
    _xmlLinkController.text = settings.linkExtensaoXml;
    _portalLinkController.text = settings.linkPortalSefaz;
  }

  String? _validateUrl(String value, String label) {
    final input = value.trim();
    if (input.isEmpty || input.length > 500) {
      return '$label: informe um endereço com até 500 caracteres.';
    }
    final uri = Uri.tryParse(input);
    if (uri == null ||
        !{'http', 'https'}.contains(uri.scheme.toLowerCase()) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty) {
      return '$label: use uma URL HTTP ou HTTPS válida.';
    }
    return null;
  }

  Future<bool> _confirmSave() async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.tune),
          title: const Text('Salvar configurações globais?'),
          content: const Text(
            'As cores e os links serão alterados no sistema web para todos. '
            'Os novos prazos valem apenas para próximos logins; sessões atuais '
            'não serão encerradas.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Revisar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Salvar para todos'),
            ),
          ],
        ),
      ) ??
      false;

  Future<void> _save() async {
    final webDays = int.tryParse(_webDaysController.text.trim());
    final mobileDays = int.tryParse(_mobileDaysController.text.trim());
    final urlError =
        _validateUrl(_xmlLinkController.text, 'Link da extensão') ??
        _validateUrl(_portalLinkController.text, 'Link do portal SEFAZ');
    if (webDays == null || webDays < 1 || webDays > 365) {
      _showMessage('A validade da sessão web deve ser de 1 a 365 dias.');
      return;
    }
    if (mobileDays == null || mobileDays < 1 || mobileDays > 365) {
      _showMessage('A validade da sessão do app deve ser de 1 a 365 dias.');
      return;
    }
    if (urlError != null) {
      _showMessage(urlError);
      return;
    }
    if (!await _confirmSave() || !mounted) return;

    setState(() => _saving = true);
    try {
      await _saveSettings(
        SystemAdminSettings(
          themeColor: _themeColor,
          sidebarColor: _sidebarColor,
          linkExtensaoXml: _xmlLinkController.text.trim(),
          linkPortalSefaz: _portalLinkController.text.trim(),
          sessionDaysWeb: webDays,
          sessionDaysMobile: mobileDays,
        ),
      );
      if (mounted) _showMessage('Configurações globais salvas.');
    } catch (error) {
      if (mounted) {
        _showMessage(
          error.toString().replaceFirst(RegExp(r'^Exception: ?'), ''),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Widget _section({
    required IconData icon,
    required String title,
    required String help,
    required List<Widget> children,
  }) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(help, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    ),
  );

  Widget _dropdown({
    required String label,
    required String value,
    required Map<String, String> options,
    required ValueChanged<String?> onChanged,
  }) => DropdownButtonFormField<String>(
    key: ValueKey('$label:$value'),
    initialValue: value,
    isExpanded: true,
    decoration: InputDecoration(labelText: label),
    items: options.entries
        .map(
          (entry) => DropdownMenuItem(
            value: entry.key,
            child: Text(entry.value, overflow: TextOverflow.ellipsis),
          ),
        )
        .toList(),
    onChanged: onChanged,
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Configurações globais')),
    body: FutureBuilder<CurrentUserSession?>(
      future: _userFuture,
      builder: (context, userSnapshot) {
        if (userSnapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (userSnapshot.data?.role != 'administrador') {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'Somente administradores podem alterar configurações globais.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        }

        _settingsFuture ??= _loadSettings();
        return FutureBuilder<SystemAdminSettings>(
          future: _settingsFuture,
          builder: (context, settingsSnapshot) {
            if (settingsSnapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (settingsSnapshot.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        settingsSnapshot.error.toString().replaceFirst(
                          RegExp(r'^Exception: ?'),
                          '',
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () => setState(() {
                          _settingsFuture = _loadSettings();
                          _initialized = false;
                        }),
                        icon: const Icon(Icons.refresh),
                        label: const Text('Tentar novamente'),
                      ),
                    ],
                  ),
                ),
              );
            }

            _applyLoadedSettings(settingsSnapshot.data!);
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                _section(
                  icon: Icons.shield_outlined,
                  title: 'Validade das sessões',
                  help:
                      'Os prazos são aplicados a novos logins. Não encerram sessões já abertas.',
                  children: [
                    TextField(
                      controller: _webDaysController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        labelText: 'Sessão do site (dias)',
                        helperText: 'De 1 a 365 dias',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _mobileDaysController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        labelText: 'Sessão do aplicativo (dias)',
                        helperText: 'De 1 a 365 dias',
                      ),
                    ),
                  ],
                ),
                _section(
                  icon: Icons.palette_outlined,
                  title: 'Aparência do sistema web',
                  help:
                      'Essas opções alteram o portal web; a aparência deste aplicativo não é afetada.',
                  children: [
                    _dropdown(
                      label: 'Cor principal',
                      value: _themeColor,
                      options: _themes,
                      onChanged: (value) =>
                          setState(() => _themeColor = value ?? _themeColor),
                    ),
                    const SizedBox(height: 12),
                    _dropdown(
                      label: 'Estilo do menu web',
                      value: _sidebarColor,
                      options: _sidebars,
                      onChanged: (value) => setState(
                        () => _sidebarColor = value ?? _sidebarColor,
                      ),
                    ),
                  ],
                ),
                _section(
                  icon: Icons.link_outlined,
                  title: 'Links de nota fiscal',
                  help:
                      'Endereços usados pelo fluxo de entrada de nota fiscal no sistema.',
                  children: [
                    TextField(
                      controller: _xmlLinkController,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        labelText: 'Link da extensão de XML',
                        helperText: 'URL HTTP ou HTTPS, até 500 caracteres',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _portalLinkController,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        labelText: 'Link do portal SEFAZ',
                        helperText: 'URL HTTP ou HTTPS, até 500 caracteres',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(_saving ? 'Salvando…' : 'Salvar para o sistema'),
                ),
              ],
            );
          },
        );
      },
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class ApiKeysScreen extends StatefulWidget {
  final Future<CurrentUserSession?> Function()? userSessionLoader;
  final Future<List<ApiAccessKey>> Function()? keysLoader;
  final Future<String> Function(String name)? createKey;
  final Future<void> Function(String id)? revokeKey;

  const ApiKeysScreen({
    super.key,
    this.userSessionLoader,
    this.keysLoader,
    this.createKey,
    this.revokeKey,
  });

  @override
  State<ApiKeysScreen> createState() => _ApiKeysScreenState();
}

class _ApiKeysScreenState extends State<ApiKeysScreen> {
  final ApiService _api = ApiService();
  late Future<CurrentUserSession?> _userFuture;
  Future<List<ApiAccessKey>>? _keysFuture;
  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _userFuture = _loadUser();
  }

  Future<CurrentUserSession?> _loadUser() =>
      widget.userSessionLoader?.call() ?? _api.getCurrentUserSession();

  Future<List<ApiAccessKey>> _loadKeys() =>
      widget.keysLoader?.call() ?? _api.getApiAccessKeys();

  Future<String> _createKey(String name) =>
      widget.createKey?.call(name) ?? _api.createApiAccessKey(name);

  Future<void> _revokeKey(String id) =>
      widget.revokeKey?.call(id) ?? _api.revokeApiAccessKey(id);

  Future<void> _reload() async {
    setState(() {
      _userFuture = _loadUser();
      _keysFuture = null;
    });
    final user = await _userFuture;
    if (user?.role != 'administrador' || !mounted) return;
    setState(() => _keysFuture = _loadKeys());
    await _keysFuture;
  }

  Future<void> _openCreateDialog() async {
    final name = await showDialog<String>(
      context: context,
      builder: (context) => const _CreateApiKeyDialog(),
    );
    if (name == null || name.trim().isEmpty || !mounted) return;

    setState(() => _creating = true);
    try {
      final secret = await _createKey(name.trim());
      if (!mounted) return;
      setState(() => _creating = false);
      await _showCreatedKey(secret);
      if (!mounted) return;
      setState(() => _keysFuture = _loadKeys());
      await _keysFuture;
    } catch (error) {
      if (mounted) _showMessage(_readableError(error));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _showCreatedKey(String secret) async {
    var copied = false;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          icon: const Icon(Icons.key, color: Color(0xFF047857)),
          title: const Text('Guarde esta chave agora'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Por segurança, a chave completa só aparece nesta tela. '
                  'Depois de fechar, o sistema mostrará apenas a versão mascarada.',
                ),
                const SizedBox(height: 16),
                SelectableText(
                  secret,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            OutlinedButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: secret));
                setDialogState(() => copied = true);
              },
              icon: Icon(copied ? Icons.check : Icons.copy),
              label: Text(copied ? 'Copiada' : 'Copiar chave'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Já guardei'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmRevoke(ApiAccessKey key) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.warning_amber_outlined),
        title: const Text('Revogar chave?'),
        content: Text(
          'O sistema “${key.name}” perderá o acesso imediatamente. '
          'Esta ação não pode ser desfeita.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Revogar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _revokeKey(key.id);
      if (!mounted) return;
      setState(() => _keysFuture = _loadKeys());
      _showMessage('Chave revogada. O acesso foi removido.');
      await _keysFuture;
    } catch (error) {
      if (mounted) _showMessage(_readableError(error));
    }
  }

  String _readableError(Object error) =>
      error.toString().replaceFirst(RegExp(r'^Exception: ?'), '');

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Integrações e API')),
      body: FutureBuilder<CurrentUserSession?>(
        future: _userFuture,
        builder: (context, userSnapshot) {
          if (userSnapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (userSnapshot.data?.role != 'administrador') {
            return const _AccessMessage(
              icon: Icons.lock_outline,
              message:
                  'Somente administradores podem gerenciar chaves de integração.',
            );
          }
          _keysFuture ??= _loadKeys();
          return FutureBuilder<List<ApiAccessKey>>(
            future: _keysFuture,
            builder: (context, keysSnapshot) {
              if (keysSnapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              if (keysSnapshot.hasError) {
                return _AccessMessage(
                  icon: Icons.cloud_off_outlined,
                  message: _readableError(keysSnapshot.error!),
                  action: TextButton.icon(
                    onPressed: () => setState(() => _keysFuture = _loadKeys()),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Tentar novamente'),
                  ),
                );
              }

              final keys = keysSnapshot.data ?? const <ApiAccessKey>[];
              return RefreshIndicator(
                onRefresh: _reload,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      color: Theme.of(context)
                          .colorScheme
                          .primaryContainer
                          .withValues(alpha: 0.45),
                      child: const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          'Uma chave permite que um sistema externo autorizado atualize o status '
                          'do bem pela integração de manutenção. Compartilhe apenas com o serviço '
                          'confiável que precisa desse acesso e revogue chaves sem uso.',
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _creating ? null : _openCreateDialog,
                      icon: _creating
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.add),
                      label: Text(
                        _creating ? 'Gerando chave…' : 'Criar chave de API',
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (keys.isEmpty)
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Column(
                            children: [
                              Icon(Icons.key_off_outlined, size: 34),
                              SizedBox(height: 8),
                              Text('Nenhuma chave configurada.'),
                            ],
                          ),
                        ),
                      )
                    else
                      ...keys.map((key) => _ApiKeyCard(
                            keyInfo: key,
                            onRevoke: () => _confirmRevoke(key),
                          )),
                    const SizedBox(height: 24),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _ApiKeyCard extends StatelessWidget {
  final ApiAccessKey keyInfo;
  final VoidCallback onRevoke;

  const _ApiKeyCard({required this.keyInfo, required this.onRevoke});

  @override
  Widget build(BuildContext context) {
    final date = keyInfo.createdAt == null
        ? 'Data indisponível'
        : DateFormat('dd/MM/yyyy').format(keyInfo.createdAt!.toLocal());
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.integration_instructions_outlined),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    keyInfo.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Chip(
                  avatar: Icon(
                    keyInfo.active ? Icons.check_circle : Icons.pause_circle,
                    size: 18,
                  ),
                  label: Text(keyInfo.active ? 'Ativa' : 'Inativa'),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 10),
            SelectableText(
              keyInfo.maskedKey,
              style: const TextStyle(fontFamily: 'monospace'),
            ),
            const SizedBox(height: 6),
            Text('Criada em $date', style: Theme.of(context).textTheme.bodySmall),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onRevoke,
                icon: const Icon(Icons.delete_outline),
                label: const Text('Revogar'),
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreateApiKeyDialog extends StatefulWidget {
  const _CreateApiKeyDialog();

  @override
  State<_CreateApiKeyDialog> createState() => _CreateApiKeyDialogState();
}

class _CreateApiKeyDialogState extends State<_CreateApiKeyDialog> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Nova chave de integração'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'A chave permite ao sistema atualizar o status de bens pela integração de manutenção. '
                'O segredo completo será exibido uma única vez.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _controller,
                autofocus: true,
                maxLength: 100,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Nome do sistema',
                  hintText: 'Ex.: Sistema de Manutenção',
                ),
                onSubmitted: (value) => Navigator.pop(context, value.trim()),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, _controller.text.trim()),
            child: const Text('Gerar chave'),
          ),
        ],
      );
}

class _AccessMessage extends StatelessWidget {
  final IconData icon;
  final String message;
  final Widget? action;

  const _AccessMessage({required this.icon, required this.message, this.action});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 40),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              if (action != null) ...[const SizedBox(height: 8), action!],
            ],
          ),
        ),
      );
}

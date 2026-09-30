import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class BackupAdminScreen extends StatefulWidget {
  final Future<CurrentUserSession?> Function()? userSessionLoader;
  final Future<BackupSchedule> Function()? scheduleLoader;
  final Future<List<BackupFileInfo>> Function()? filesLoader;
  final Future<void> Function(BackupSchedule schedule)? saveSchedule;

  const BackupAdminScreen({
    super.key,
    this.userSessionLoader,
    this.scheduleLoader,
    this.filesLoader,
    this.saveSchedule,
  });

  @override
  State<BackupAdminScreen> createState() => _BackupAdminScreenState();
}

class _BackupAdminScreenState extends State<BackupAdminScreen> {
  final ApiService _api = ApiService();
  final _retentionController = TextEditingController();
  late Future<CurrentUserSession?> _userFuture;
  Future<BackupSchedule>? _scheduleFuture;
  Future<List<BackupFileInfo>>? _filesFuture;
  String _frequency = 'daily';
  TimeOfDay _time = const TimeOfDay(hour: 0, minute: 0);
  bool _enabled = false;
  bool _initialized = false;
  bool _saving = false;

  static const _frequencies = <String, String>{
    'daily': 'Diário',
    'weekly': 'Semanal — segunda-feira',
    'monthly': 'Mensal — dia 1',
  };

  @override
  void initState() {
    super.initState();
    _userFuture = _loadUser();
  }

  @override
  void dispose() {
    _retentionController.dispose();
    super.dispose();
  }

  Future<CurrentUserSession?> _loadUser() =>
      widget.userSessionLoader?.call() ?? _api.getCurrentUserSession();

  Future<BackupSchedule> _loadSchedule() =>
      widget.scheduleLoader?.call() ?? _api.getBackupSchedule();

  Future<List<BackupFileInfo>> _loadFiles() =>
      widget.filesLoader?.call() ?? _api.getBackupFiles();

  Future<void> _save(BackupSchedule value) =>
      widget.saveSchedule?.call(value) ?? _api.saveBackupSchedule(value);

  void _apply(BackupSchedule value) {
    if (_initialized) return;
    _initialized = true;
    _enabled = value.enabled;
    _frequency = _frequencies.containsKey(value.frequency)
        ? value.frequency
        : 'daily';
    final parts = value.time.split(':');
    final hour = parts.length == 2 ? int.tryParse(parts[0]) : null;
    final minute = parts.length == 2 ? int.tryParse(parts[1]) : null;
    _time =
        hour != null &&
            minute != null &&
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59
        ? TimeOfDay(hour: hour, minute: minute)
        : const TimeOfDay(hour: 0, minute: 0);
    _retentionController.text = value.keepCount.toString();
  }

  String get _timeText =>
      '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}';

  Future<void> _chooseTime() async {
    final selected = await showTimePicker(context: context, initialTime: _time);
    if (selected != null && mounted) setState(() => _time = selected);
  }

  Future<bool> _confirmSave() async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.warning_amber_outlined),
          title: const Text('Atualizar backup automático?'),
          content: const Text(
            'A programação altera os backups de todo o sistema. Reduzir a retenção '
            'pode apagar os arquivos mais antigos na próxima execução. Os backups '
            'contêm dados patrimoniais e devem permanecer acessíveis apenas a administradores. '
            'Esta ação não executa um backup agora.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Revisar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirmar alteração'),
            ),
          ],
        ),
      ) ??
      false;

  Future<void> _saveChanges() async {
    final keepCount = int.tryParse(_retentionController.text.trim());
    if (keepCount == null || keepCount < 1 || keepCount > 30) {
      _showMessage('A retenção deve ficar entre 1 e 30 arquivos.');
      return;
    }
    if (!await _confirmSave() || !mounted) return;

    setState(() => _saving = true);
    try {
      await _save(
        BackupSchedule(
          enabled: _enabled,
          frequency: _frequency,
          time: _timeText,
          keepCount: keepCount,
        ),
      );
      if (mounted) _showMessage('Agendamento de backup atualizado.');
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

  Future<void> _refresh() async {
    setState(() {
      _scheduleFuture = _loadSchedule();
      _filesFuture = _loadFiles();
      _initialized = false;
    });
    await Future.wait([_scheduleFuture!, _filesFuture!]);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  String _formatSize(int size) {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(0)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Backups automáticos')),
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
                'Somente administradores podem consultar ou alterar backups.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        }

        _scheduleFuture ??= _loadSchedule();
        _filesFuture ??= _loadFiles();
        return FutureBuilder<BackupSchedule>(
          future: _scheduleFuture,
          builder: (context, scheduleSnapshot) {
            if (scheduleSnapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (scheduleSnapshot.hasError) {
              return _loadError(scheduleSnapshot.error!);
            }
            _apply(scheduleSnapshot.data!);
            return FutureBuilder<List<BackupFileInfo>>(
              future: _filesFuture,
              builder: (context, filesSnapshot) {
                if (filesSnapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (filesSnapshot.hasError) {
                  return _loadError(filesSnapshot.error!);
                }

                final files = filesSnapshot.data ?? const <BackupFileInfo>[];
                return RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      Card(
                        color: Theme.of(
                          context,
                        ).colorScheme.errorContainer.withValues(alpha: 0.45),
                        child: const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                            'Backups incluem dados do banco e são confidenciais. '
                            'Esta tela permite apenas consultar arquivos e configurar '
                            'a rotina automática; restauração e download completo ficam '
                            'no portal web para reduzir risco no celular.',
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Agendamento',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 12),
                              SwitchListTile.adaptive(
                                contentPadding: EdgeInsets.zero,
                                title: const Text('Ativar backup automático'),
                                subtitle: const Text(
                                  'Horário local de Brasília',
                                ),
                                value: _enabled,
                                onChanged: (value) =>
                                    setState(() => _enabled = value),
                              ),
                              if (_enabled) ...[
                                const SizedBox(height: 8),
                                DropdownButtonFormField<String>(
                                  key: ValueKey('frequency:$_frequency'),
                                  initialValue: _frequency,
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Frequência',
                                  ),
                                  items: _frequencies.entries
                                      .map(
                                        (entry) => DropdownMenuItem(
                                          value: entry.key,
                                          child: Text(
                                            entry.value,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      )
                                      .toList(),
                                  onChanged: (value) => setState(
                                    () => _frequency = value ?? _frequency,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                OutlinedButton.icon(
                                  onPressed: _chooseTime,
                                  icon: const Icon(Icons.schedule),
                                  label: Text('Horário: $_timeText'),
                                ),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: _retentionController,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: [
                                    FilteringTextInputFormatter.digitsOnly,
                                  ],
                                  decoration: const InputDecoration(
                                    labelText: 'Manter últimos arquivos',
                                    helperText: 'De 1 a 30 backups automáticos',
                                  ),
                                ),
                              ],
                              const SizedBox(height: 16),
                              FilledButton.icon(
                                onPressed: _saving ? null : _saveChanges,
                                icon: _saving
                                    ? const SizedBox.square(
                                        dimension: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Icon(Icons.save_outlined),
                                label: Text(
                                  _saving ? 'Salvando…' : 'Salvar agendamento',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Arquivos disponíveis (${files.length})',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (files.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(18),
                            child: Text('Nenhum backup automático armazenado.'),
                          ),
                        )
                      else
                        ...files.map(
                          (file) => Card(
                            child: ListTile(
                              leading: const Icon(Icons.archive_outlined),
                              title: Text(
                                file.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                '${file.createdAt == null ? 'Data indisponível' : DateFormat('dd/MM/yyyy HH:mm').format(file.createdAt!.toLocal())} · ${_formatSize(file.size)}',
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    ),
  );

  Widget _loadError(Object error) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            error.toString().replaceFirst(RegExp(r'^Exception: ?'), ''),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => setState(() {
              _scheduleFuture = _loadSchedule();
              _filesFuture = _loadFiles();
            }),
            icon: const Icon(Icons.refresh),
            label: const Text('Tentar novamente'),
          ),
        ],
      ),
    ),
  );
}

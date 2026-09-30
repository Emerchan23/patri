import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/utils/audit_csv.dart';

class AuditLogsScreen extends StatefulWidget {
  final ApiService? apiService;

  const AuditLogsScreen({super.key, this.apiService});

  @override
  State<AuditLogsScreen> createState() => _AuditLogsScreenState();
}

class _AuditLogsScreenState extends State<AuditLogsScreen> {
  late final ApiService _api;
  final TextEditingController _search = TextEditingController();
  final TextEditingController _actionFilter = TextEditingController();
  final TextEditingController _userFilter = TextEditingController();
  List<Map<String, dynamic>> _logs = const [];
  bool _loading = true;
  String? _error;
  int _page = 1;
  int _totalPages = 1;
  DateTime? _startDate;
  DateTime? _endDate;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _load();
  }

  Future<void> _load({int page = 1}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await _api.getAuditLogs(
        page: page,
        search: _search.text,
        action: _actionFilter.text,
        user: _userFilter.text,
        startDate: _startDate == null
            ? null
            : DateFormat('yyyy-MM-dd').format(_startDate!),
        endDate: _endDate == null
            ? null
            : DateFormat('yyyy-MM-dd').format(_endDate!),
      );
      final rows = (response['data'] as List)
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      final meta = response['meta'] is Map
          ? Map<String, dynamic>.from(response['meta'] as Map)
          : const <String, dynamic>{};
      if (!mounted) return;
      setState(() {
        _logs = rows;
        _page = page;
        _totalPages = int.tryParse(meta['totalPages']?.toString() ?? '') ?? 1;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _pickDate({required bool start}) async {
    final selected = await showDatePicker(
      context: context,
      initialDate: (start ? _startDate : _endDate) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (!mounted || selected == null) return;
    setState(() {
      if (start) {
        _startDate = selected;
        if (_endDate != null && _endDate!.isBefore(selected)) _endDate = null;
      } else {
        _endDate = selected;
        if (_startDate != null && selected.isBefore(_startDate!)) {
          _startDate = null;
        }
      }
    });
    _load();
  }

  void _clearDates() {
    setState(() {
      _startDate = null;
      _endDate = null;
    });
    _load();
  }

  Future<void> _showAdvancedFilters() async {
    final filters = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _AuditFiltersDialog(
        initialAction: _actionFilter.text,
        initialUser: _userFilter.text,
      ),
    );
    if (!mounted || filters == null) return;
    _actionFilter.text = filters['action'] ?? '';
    _userFilter.text = filters['user'] ?? '';
    _load();
  }

  Future<void> _exportFilteredLogs() async {
    setState(() => _exporting = true);
    try {
      const exportLimit = 500;
      final first = await _api.getAuditLogs(
        page: 1,
        search: _search.text,
        action: _actionFilter.text,
        user: _userFilter.text,
        startDate: _startDate == null
            ? null
            : DateFormat('yyyy-MM-dd').format(_startDate!),
        endDate: _endDate == null
            ? null
            : DateFormat('yyyy-MM-dd').format(_endDate!),
        limit: 100,
      );
      final meta = first['meta'] is Map
          ? Map<String, dynamic>.from(first['meta'] as Map)
          : const <String, dynamic>{};
      final total = int.tryParse(meta['total']?.toString() ?? '') ?? 0;
      final rows = <Map<String, dynamic>>[
        ...((first['data'] as List).whereType<Map>().map(
          (row) => Map<String, dynamic>.from(row),
        )),
      ];
      final pages = ((total.clamp(0, exportLimit) + 99) ~/ 100);
      for (var page = 2; page <= pages; page++) {
        final response = await _api.getAuditLogs(
          page: page,
          search: _search.text,
          action: _actionFilter.text,
          user: _userFilter.text,
          startDate: _startDate == null
              ? null
              : DateFormat('yyyy-MM-dd').format(_startDate!),
          endDate: _endDate == null
              ? null
              : DateFormat('yyyy-MM-dd').format(_endDate!),
          limit: 100,
        );
        rows.addAll(
          (response['data'] as List).whereType<Map>().map(
            (row) => Map<String, dynamic>.from(row),
          ),
        );
      }
      final directory = await getTemporaryDirectory();
      final file = File('${directory.path}/auditoria_sis_patrimonio.csv');
      await file.writeAsBytes(auditCsvBytes(rows.take(exportLimit)));
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'text/csv')],
        text: total > exportLimit
            ? 'Auditoria filtrada — exportadas as primeiras $exportLimit de $total linhas.'
            : 'Auditoria filtrada — $total linhas.',
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Não foi possível exportar: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  void dispose() {
    _search.dispose();
    _actionFilter.dispose();
    _userFilter.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Histórico de auditoria'),
        actions: [
          IconButton(
            tooltip: 'Filtrar por ação ou usuário',
            onPressed: _showAdvancedFilters,
            icon: Badge(
              isLabelVisible:
                  _actionFilter.text.isNotEmpty || _userFilter.text.isNotEmpty,
              child: const Icon(Icons.tune),
            ),
          ),
          IconButton(
            tooltip: 'Compartilhar CSV (máximo 500 registros)',
            onPressed: _exporting ? null : _exportFilteredLogs,
            icon: _exporting
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.ios_share),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(112),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Column(
              children: [
                TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _load(),
                  decoration: InputDecoration(
                    hintText: 'Buscar descrição ou bem',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(
                      tooltip: 'Aplicar busca',
                      onPressed: () => _load(),
                      icon: const Icon(Icons.arrow_forward),
                    ),
                    border: const OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton.icon(
                      onPressed: () => _pickDate(start: true),
                      icon: const Icon(Icons.event_outlined),
                      label: Text(
                        _startDate == null
                            ? 'Data inicial'
                            : DateFormat('dd/MM/yy').format(_startDate!),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () => _pickDate(start: false),
                      icon: const Icon(Icons.event_available_outlined),
                      label: Text(
                        _endDate == null
                            ? 'Data final'
                            : DateFormat('dd/MM/yy').format(_endDate!),
                      ),
                    ),
                    if (_startDate != null || _endDate != null)
                      IconButton(
                        tooltip: 'Limpar período',
                        onPressed: _clearDates,
                        icon: const Icon(Icons.filter_alt_off_outlined),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.cloud_off_outlined,
                      size: 48,
                      color: Colors.red,
                    ),
                    const SizedBox(height: 12),
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: () => _load(page: _page),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: _logs.isEmpty
                      ? const Center(child: Text('Nenhum registro encontrado.'))
                      : RefreshIndicator(
                          onRefresh: () => _load(page: _page),
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _logs.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) =>
                                _AuditLogCard(item: _logs[index]),
                          ),
                        ),
                ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        OutlinedButton.icon(
                          onPressed: _page > 1
                              ? () => _load(page: _page - 1)
                              : null,
                          icon: const Icon(Icons.chevron_left),
                          label: const Text('Anterior'),
                        ),
                        Text('Página $_page de $_totalPages'),
                        OutlinedButton.icon(
                          onPressed: _page < _totalPages
                              ? () => _load(page: _page + 1)
                              : null,
                          icon: const Icon(Icons.chevron_right),
                          label: const Text('Próxima'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _AuditFiltersDialog extends StatefulWidget {
  const _AuditFiltersDialog({
    required this.initialAction,
    required this.initialUser,
  });

  final String initialAction;
  final String initialUser;

  @override
  State<_AuditFiltersDialog> createState() => _AuditFiltersDialogState();
}

class _AuditFiltersDialogState extends State<_AuditFiltersDialog> {
  late final TextEditingController _action = TextEditingController(
    text: widget.initialAction,
  );
  late final TextEditingController _user = TextEditingController(
    text: widget.initialUser,
  );

  @override
  void dispose() {
    _action.dispose();
    _user.dispose();
    super.dispose();
  }

  void _apply() => Navigator.pop(context, {
    'action': _action.text.trim(),
    'user': _user.text.trim(),
  });

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Filtrar auditoria'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _action,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: 'Ação',
            hintText: 'Ex.: CADASTRO, TRANSFERENCIA, LOGIN',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _user,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(
            labelText: 'Usuário',
            hintText: 'Nome (pode ser parcial)',
            border: OutlineInputBorder(),
          ),
          onSubmitted: (_) => _apply(),
        ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      TextButton(
        onPressed: () {
          _action.clear();
          _user.clear();
          setState(() {});
        },
        child: const Text('Limpar'),
      ),
      FilledButton(onPressed: _apply, child: const Text('Aplicar')),
    ],
  );
}

class _AuditLogCard extends StatelessWidget {
  const _AuditLogCard({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final user = item['usuario'] is Map
        ? (item['usuario'] as Map)['nome']?.toString()
        : null;
    final entity = item['entidade'] is Map
        ? (item['entidade'] as Map)['descricao']?.toString()
        : null;
    final date = item['dataHora']?.toString();
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: const CircleAvatar(child: Icon(Icons.history)),
        title: Text(
          item['descricao']?.toString() ??
              item['acao']?.toString() ??
              'Registro',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            [
              if (user != null && user.isNotEmpty) user,
              if (entity != null && entity.isNotEmpty) entity,
              _formatDate(date),
            ].join(' • '),
          ),
        ),
      ),
    );
  }

  String _formatDate(String? value) {
    if (value == null) return '-';
    try {
      return DateFormat('dd/MM/yyyy HH:mm').format(DateTime.parse(value));
    } catch (_) {
      return value;
    }
  }
}

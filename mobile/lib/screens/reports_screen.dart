import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final ApiService _api = ApiService();
  final NumberFormat _currency = NumberFormat.currency(
    locale: 'pt_BR',
    symbol: 'R\$',
  );
  String _type = 'geral';
  dynamic _report;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final report = await _api.getReport(_type);
      if (!mounted) return;
      setState(() {
        _report = report;
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

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Relatórios'),
      actions: [
        IconButton(
          onPressed: _load,
          tooltip: 'Atualizar',
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: Column(
      children: [
        SizedBox(
          height: 58,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            children: [
              _chip('geral', 'Patrimônio'),
              _chip('movimentacoes', 'Movimentações'),
              _chip('emprestimos', 'Empréstimos'),
              _chip('baixas', 'Baixados'),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  ),
                )
              : _type == 'geral'
              ? _generalReport()
              : _recordsReport(),
        ),
      ],
    ),
  );

  Widget _chip(String type, String label) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: _type == type,
      onSelected: (_) {
        setState(() => _type = type);
        _load();
      },
    ),
  );

  Widget _generalReport() {
    final data = _report is Map
        ? Map<String, dynamic>.from(_report as Map)
        : <String, dynamic>{};
    final categories = _mapList(data['porCategoria']);
    final states = _mapList(data['porEstado']);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: _summary(
                'Bens ativos',
                data['totalBens']?.toString() ?? '0',
                Icons.inventory_2_outlined,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _summary(
                'Valor total',
                _currency.format(_number(data['valorTotal'])),
                Icons.account_balance_wallet_outlined,
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        _section('Por categoria', categories, 'categoria'),
        const SizedBox(height: 16),
        _section('Por estado de conservação', states, 'estado'),
      ],
    );
  }

  Widget _summary(String title, String value, IconData icon) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 12),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          Text(title, style: TextStyle(color: Colors.grey.shade700)),
        ],
      ),
    ),
  );

  Widget _section(
    String title,
    List<Map<String, dynamic>> rows,
    String labelKey,
  ) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (rows.isEmpty) const Text('Sem dados para este relatório.'),
          ...rows.map(
            (row) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(row[labelKey]?.toString() ?? 'Não informado'),
              trailing: Text(row['total']?.toString() ?? '0'),
              subtitle: row['valor'] == null
                  ? null
                  : Text(_currency.format(_number(row['valor']))),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _recordsReport() {
    final rows = _mapList(_report);
    if (rows.isEmpty) {
      return const Center(child: Text('Não há registros para este relatório.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: rows.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, index) => _recordCard(rows[index]),
      ),
    );
  }

  Widget _recordCard(Map<String, dynamic> row) {
    final movement = _type == 'movimentacoes';
    final loan = _type == 'emprestimos';
    final heading =
        row['bem_descricao'] ??
        row['assetDescricao'] ??
        row['descricao'] ??
        'Registro patrimonial';
    final code = row['patrimonio']?.toString() ?? 'Sem patrimônio';
    final subtitle = movement
        ? 'De ${row['de_departamento'] ?? '—'} / ${row['de_sala'] ?? '—'} para ${row['para_departamento'] ?? '—'} / ${row['para_sala'] ?? '—'}'
        : loan
        ? 'Recebedor: ${row['responsavel_recebimento'] ?? '—'} · Status: ${row['status'] ?? '—'}'
        : 'Status: ${row['status'] ?? 'baixado'} · Categoria: ${row['categoria_slug'] ?? '—'}';
    return Card(
      child: ListTile(
        leading: Icon(
          movement
              ? Icons.swap_horiz
              : loan
              ? Icons.handshake_outlined
              : Icons.inventory_2_outlined,
        ),
        title: Text(
          heading.toString(),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text('$code\n$subtitle'),
        isThreeLine: true,
      ),
    );
  }

  List<Map<String, dynamic>> _mapList(dynamic value) {
    if (value is! List) return [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  double _number(dynamic value) =>
      double.tryParse(value?.toString() ?? '') ?? 0;
}

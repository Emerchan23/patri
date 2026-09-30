import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  final bool unitOnly;
  final Future<Map<String, dynamic>> Function(bool unitOnly)? statsLoader;

  const DashboardScreen({super.key, this.unitOnly = false, this.statsLoader});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ApiService _api = ApiService();
  final NumberFormat _currency = NumberFormat.currency(
    locale: 'pt_BR',
    symbol: 'R\$',
  );
  Map<String, dynamic>? _data;
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
      final result = widget.statsLoader == null
          ? await _api.getDashboardStats(unitOnly: widget.unitOnly)
          : await widget.statsLoader!(widget.unitOnly);
      if (!mounted) return;
      setState(() {
        _data = result;
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

  int _integer(String key) => int.tryParse(_data?[key]?.toString() ?? '') ?? 0;

  double _decimal(String key) =>
      double.tryParse(_data?[key]?.toString() ?? '') ?? 0;

  String? _movementDate(dynamic value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '');
    if (parsed == null) return null;
    return DateFormat('dd/MM/yyyy').format(parsed.toLocal());
  }

  String _categoryName(dynamic value) {
    final raw = value?.toString().trim() ?? '';
    if (raw.isEmpty) return 'Sem categoria';
    const known = {
      'informatica': 'Informática',
      'moveis': 'Móveis',
      'eletrodomestico': 'Eletrodomésticos',
      'eletronico': 'Eletrônicos',
      'veiculo': 'Veículos',
    };
    final normalized = raw.toLowerCase().replaceAll(' ', '_');
    if (known.containsKey(normalized)) return known[normalized]!;
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .map(
          (word) => word.isEmpty
              ? word
              : '${word[0].toUpperCase()}${word.substring(1)}',
        )
        .join(' ');
  }

  List<Map<String, dynamic>> _rows(String key) {
    final value = _data?[key];
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Visão geral do patrimônio'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            tooltip: 'Atualizar painel',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading && _data == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _data == null
          ? _errorState()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) _refreshError(),
                  _scopeBanner(),
                  const SizedBox(height: 16),
                  _sectionTitle('Resumo dos bens'),
                  const SizedBox(height: 10),
                  _metricGrid(),
                  const SizedBox(height: 22),
                  _sectionTitle('Empréstimos'),
                  const SizedBox(height: 10),
                  _loanSummary(),
                  const SizedBox(height: 22),
                  _sectionTitle('Movimentações recentes'),
                  const SizedBox(height: 8),
                  _recentMovements(),
                  const SizedBox(height: 22),
                  _sectionTitle('Bens com patrimônio provisório'),
                  const SizedBox(height: 8),
                  _provisionalAssets(),
                  const SizedBox(height: 22),
                  _sectionTitle('Distribuição por categoria'),
                  const SizedBox(height: 8),
                  _categories(),
                ],
              ),
            ),
    );
  }

  Widget _errorState() => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 44),
          const SizedBox(height: 12),
          Text(_error ?? 'Não foi possível carregar o painel.'),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
            label: const Text('Tentar novamente'),
          ),
        ],
      ),
    ),
  );

  Widget _refreshError() => Card(
    color: Theme.of(context).colorScheme.errorContainer,
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Text('Falha ao atualizar: $_error'),
    ),
  );

  Widget _scopeBanner() => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.primaryContainer,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.shield_outlined),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            widget.unitOnly
                ? 'Mostrando os dados permitidos para a sua unidade.'
                : 'Os dados respeitam seu perfil e o escopo configurado no sistema.',
          ),
        ),
      ],
    ),
  );

  Widget _sectionTitle(String title) => Text(
    title,
    style: Theme.of(
      context,
    ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
  );

  Widget _metricGrid() {
    final metrics = <_DashboardMetric>[
      _DashboardMetric(
        'Total de bens',
        _integer('totalBens'),
        Icons.inventory_2_outlined,
      ),
      _DashboardMetric(
        'Ativos',
        _integer('totalAtivos'),
        Icons.check_circle_outline,
      ),
      _DashboardMetric(
        'Em manutenção',
        _integer('totalManutencao'),
        Icons.build_outlined,
      ),
      _DashboardMetric(
        'Baixados',
        _integer('totalBaixados'),
        Icons.remove_circle_outline,
      ),
      _DashboardMetric(
        'Provisórios',
        _integer('totalProvisorio'),
        Icons.sell_outlined,
      ),
      _DashboardMetric(
        'Veículos',
        _integer('totalVeiculos'),
        Icons.directions_car_outlined,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 600 ? 3 : 2;
        final baseAspectRatio = columns == 3 ? 1.8 : 1.55;
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: baseAspectRatio / textScale,
          children: [
            ...metrics.map(
              (metric) => _MetricCard(
                label: metric.label,
                value: metric.value.toString(),
                icon: metric.icon,
              ),
            ),
            _MetricCard(
              label: 'Valor cadastrado',
              value: _currency.format(_decimal('valorTotal')),
              icon: Icons.account_balance_wallet_outlined,
            ),
          ],
        );
      },
    );
  }

  Widget _loanSummary() => Row(
    children: [
      Expanded(
        child: _MetricCard(
          label: 'Em andamento',
          value: _integer('emprestimosAtivos').toString(),
          icon: Icons.handshake_outlined,
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: _MetricCard(
          label: 'Atrasados',
          value: _integer('emprestimosAtrasados').toString(),
          icon: Icons.event_busy_outlined,
          alert: _integer('emprestimosAtrasados') > 0,
        ),
      ),
    ],
  );

  Widget _recentMovements() {
    final rows = _rows('movimentacoesRecentes');
    if (rows.isEmpty) return _emptyInfo('Nenhuma movimentação recente.');
    return Column(
      children: rows.take(5).map((row) {
        final description =
            row['bem_descricao']?.toString().trim().isNotEmpty == true
            ? row['bem_descricao'].toString()
            : 'Bem patrimonial';
        final from = row['de_departamento']?.toString() ?? '—';
        final to = row['para_departamento']?.toString() ?? '—';
        final responsible = row['responsavel']?.toString();
        final date = _movementDate(row['data_movimentacao']);
        final details = [
          if (responsible?.isNotEmpty == true) responsible!,
          ?date,
        ].join(' · ');
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: const Icon(Icons.swap_horiz),
            title: Text(
              description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text('$from → $to${details.isEmpty ? '' : '\n$details'}'),
          ),
        );
      }).toList(),
    );
  }

  Widget _provisionalAssets() {
    final rows = _rows('provisorios');
    if (rows.isEmpty) return _emptyInfo('Nenhum bem provisório encontrado.');
    return Column(
      children: rows.take(5).map((row) {
        final code = row['numero_provisorio']?.toString() ?? 'Sem código';
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: const Icon(Icons.sell_outlined),
            title: Text(
              row['descricao']?.toString() ?? 'Bem sem descrição',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              '$code · ${row['departamento']?.toString() ?? 'Local não informado'}',
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _categories() {
    final rows = _rows('porCategoria');
    if (rows.isEmpty) return _emptyInfo('Sem dados por categoria.');
    rows.sort(
      (a, b) => _asInt(b['quantidade']).compareTo(_asInt(a['quantidade'])),
    );
    final maxCount = rows
        .map((row) => _asInt(row['quantidade']))
        .fold<int>(0, (max, value) => value > max ? value : max);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: rows.take(6).map((row) {
            final count = _asInt(row['quantidade']);
            final fraction = maxCount == 0 ? 0.0 : count / maxCount;
            final label = _categoryName(row['categoria']);
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(label)),
                      Text(count.toString()),
                    ],
                  ),
                  const SizedBox(height: 5),
                  LinearProgressIndicator(value: fraction),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _emptyInfo(String text) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Text(text, style: TextStyle(color: Colors.grey.shade700)),
    ),
  );

  int _asInt(dynamic value) => int.tryParse(value?.toString() ?? '') ?? 0;
}

class _DashboardMetric {
  final String label;
  final int value;
  final IconData icon;

  const _DashboardMetric(this.label, this.value, this.icon);
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool alert;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    this.alert = false,
  });

  @override
  Widget build(BuildContext context) => Card(
    color: alert ? Theme.of(context).colorScheme.errorContainer : null,
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: alert ? Theme.of(context).colorScheme.error : null),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/screens/asset_details_screen.dart';
import 'package:sis_patrimonio_mobile/screens/loans_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class PendingAssetsScreen extends StatefulWidget {
  const PendingAssetsScreen({super.key});

  @override
  State<PendingAssetsScreen> createState() => _PendingAssetsScreenState();
}

class _PendingAssetsScreenState extends State<PendingAssetsScreen> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _response;
  bool _loading = true;
  String? _error;
  String _filter = 'semPlaqueta';

  static const _filters = {
    'semPlaqueta': 'Etiquetas',
    'semLocal': 'Sem local',
    'mauEstado': 'Conservação',
    'atrasados': 'Empréstimos atrasados',
  };

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
      final response = await _api.getPendingAssets();
      if (!mounted) return;
      setState(() {
        _response = response;
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

  List<Map<String, dynamic>> get _items {
    final rows = _response?[_filter];
    if (rows is! List) return const [];
    return rows
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  int _count(String key) {
    final totals = _response?['totals'];
    if (totals is! Map) return 0;
    return int.tryParse(totals[key]?.toString() ?? '') ?? 0;
  }

  Future<void> _openItem(Map<String, dynamic> item) async {
    if (_filter == 'atrasados') {
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LoansScreen()),
      );
      return;
    }
    final id = item['id']?.toString();
    if (id == null || id.isEmpty) return;
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => AssetDetailsScreen(assetId: id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totals = <String, String>{
      'semPlaqueta': 'Etiquetas',
      'semLocal': 'Sem local',
      'mauEstado': 'Conservação',
      'atrasados': 'Atrasados',
    };
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pendências patrimoniais'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _errorState()
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 98,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    scrollDirection: Axis.horizontal,
                    children: totals.entries.map((entry) {
                      return Card(
                        margin: const EdgeInsets.only(right: 10),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${_count(entry.key)}',
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(entry.value),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                SizedBox(
                  height: 54,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    scrollDirection: Axis.horizontal,
                    children: _filters.entries.map((entry) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: ChoiceChip(
                          label: Text(entry.value),
                          selected: _filter == entry.key,
                          onSelected: (_) =>
                              setState(() => _filter = entry.key),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                Expanded(
                  child: _items.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'Nenhuma pendência nesta categoria.',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _items.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, index) => _PendingItemCard(
                              item: _items[index],
                              type: _filter,
                              onTap: () => _openItem(_items[index]),
                            ),
                          ),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _errorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 52, color: Colors.red),
            const SizedBox(height: 12),
            const Text(
              'Não foi possível carregar as pendências',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PendingItemCard extends StatelessWidget {
  const _PendingItemCard({
    required this.item,
    required this.type,
    required this.onTap,
  });

  final Map<String, dynamic> item;
  final String type;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final title =
        item['descricao']?.toString() ??
        item['bem_descricao']?.toString() ??
        'Bem sem descrição';
    final patrimony =
        item['numero_patrimonio']?.toString() ?? item['patrimonio']?.toString();
    final location = [item['secretaria'], item['departamento'], item['sala']]
        .where((part) => part != null && part.toString().trim().isNotEmpty)
        .join(' • ');
    final supporting = switch (type) {
      'mauEstado' => 'Conservação: ${item['estado'] ?? 'não informada'}',
      'atrasados' => 'Responsável: ${item['responsavel'] ?? 'não informado'}',
      'semLocal' => location.isEmpty ? 'Localização incompleta' : location,
      _ => location.isEmpty ? 'Etiqueta patrimonial pendente' : location,
    };
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: Colors.orange.withValues(alpha: 0.12),
          child: Icon(
            type == 'atrasados' ? Icons.schedule : Icons.warning_amber_outlined,
            color: Colors.orange.shade800,
          ),
        ),
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            [
              if (patrimony != null && patrimony.isNotEmpty) patrimony,
              supporting,
            ].join(' • '),
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

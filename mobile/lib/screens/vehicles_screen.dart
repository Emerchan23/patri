import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/screens/asset_details_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class VehiclesScreen extends StatefulWidget {
  final ApiService? apiService;

  const VehiclesScreen({super.key, this.apiService});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  late final ApiService _api;
  late final Future<CurrentUserSession?> _sessionFuture;
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _vehicles = [];
  bool _loading = true;
  String? _error;
  String _statusFilter = 'todos';
  String? _deletingVehicleId;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _sessionFuture = _api.getCurrentUserSession();
    _load();
  }

  Future<void> _deleteVehicle(Map<String, dynamic> vehicle) async {
    final id = vehicle['id']?.toString();
    if (id == null || id.isEmpty) return;
    var reasonText = '';
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Excluir veículo?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${vehicle['descricao'] ?? 'Veículo'}${vehicle['placa'] == null ? '' : ' · ${vehicle['placa']}'} será removido do cadastro. Essa ação não pode ser desfeita.',
              ),
              const SizedBox(height: 16),
              TextField(
                maxLength: 1000,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Motivo da exclusão *',
                  hintText: 'Explique por que este veículo será excluído',
                  border: OutlineInputBorder(),
                ),
                onChanged: (value) => setDialogState(() => reasonText = value),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton.icon(
              onPressed: reasonText.trim().isEmpty
                  ? null
                  : () => Navigator.pop(context, reasonText.trim()),
              icon: const Icon(Icons.delete_outline),
              label: const Text('Excluir veículo'),
            ),
          ],
        ),
      ),
    );
    if (reason == null || !mounted) return;

    setState(() => _deletingVehicleId = id);
    try {
      await _api.deleteVehicle(id, reason: reason);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Veículo excluído.')));
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _deletingVehicleId = null);
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final vehicles = await _api.getVehicles();
      if (!mounted) return;
      setState(() {
        _vehicles = vehicles;
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
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredVehicles {
    final query = _searchController.text.trim().toLowerCase();
    return _vehicles
        .where((vehicle) {
          final matchesStatus =
              _statusFilter == 'todos' || vehicle['status'] == _statusFilter;
          if (!matchesStatus) return false;
          if (query.isEmpty) return true;
          final location = vehicle['localizacao'] is Map
              ? Map<String, dynamic>.from(vehicle['localizacao'])
              : <String, dynamic>{};
          final searchable = [
            vehicle['descricao'],
            vehicle['patrimonio'],
            vehicle['patrimonioProvisorio'],
            vehicle['placa'],
            vehicle['marca'],
            vehicle['modelo'],
            location['secretaria'],
            location['departamento'],
            location['sala'],
          ].whereType<Object>().join(' ').toLowerCase();
          return searchable.contains(query);
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Veículos'),
      actions: [
        IconButton(
          onPressed: _load,
          tooltip: 'Atualizar',
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          )
        : _vehicles.isEmpty
        ? const Center(child: Text('Não há veículos no escopo do seu perfil.'))
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                TextField(
                  key: const ValueKey('vehicle-search'),
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    labelText: 'Buscar veículo',
                    hintText: 'Descrição, patrimônio, placa ou local',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchController.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Limpar busca',
                            onPressed: () {
                              _searchController.clear();
                              setState(() {});
                            },
                            icon: const Icon(Icons.close),
                          ),
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    _statusChip('todos', 'Todos'),
                    _statusChip('ativo', 'Ativos'),
                    _statusChip('em_manutencao', 'Em manutenção'),
                    _statusChip('baixado', 'Baixados'),
                  ],
                ),
                const SizedBox(height: 8),
                if (_filteredVehicles.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Text(
                      _searchController.text.isNotEmpty ||
                              _statusFilter != 'todos'
                          ? 'Nenhum veículo corresponde a essa busca e filtro.'
                          : 'Não há veículos no escopo do seu perfil.',
                      textAlign: TextAlign.center,
                    ),
                  )
                else
                  ..._filteredVehicles.expand(
                    (vehicle) => [
                      _vehicleCard(vehicle),
                      const SizedBox(height: 10),
                    ],
                  ),
              ],
            ),
          ),
  );

  Widget _statusChip(String value, String label) => FilterChip(
    key: ValueKey('vehicle-status-$value'),
    selected: _statusFilter == value,
    label: Text(label),
    onSelected: (_) => setState(() => _statusFilter = value),
  );

  Widget _vehicleCard(Map<String, dynamic> vehicle) {
    final location = vehicle['localizacao'] is Map
        ? Map<String, dynamic>.from(vehicle['localizacao'])
        : <String, dynamic>{};
    final code =
        vehicle['patrimonio']?.toString() ??
        vehicle['patrimonioProvisorio']?.toString() ??
        '';
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: code.isEmpty
            ? null
            : () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AssetDetailsScreen(patrimonyCode: code),
                ),
              ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.directions_car_outlined, size: 30),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          vehicle['descricao']?.toString() ?? 'Veículo',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        Text(
                          code.isEmpty ? 'Sem número patrimonial' : code,
                          style: TextStyle(color: Colors.grey.shade700),
                        ),
                      ],
                    ),
                  ),
                  if (vehicle['placa']?.toString().isNotEmpty == true)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade400),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        vehicle['placa'].toString(),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  FutureBuilder<CurrentUserSession?>(
                    future: _sessionFuture,
                    builder: (context, snapshot) {
                      if (snapshot.data?.hasPermission('excluirBem') != true) {
                        return const SizedBox.shrink();
                      }
                      final id = vehicle['id']?.toString();
                      return IconButton(
                        tooltip: 'Excluir veículo',
                        onPressed: id == _deletingVehicleId
                            ? null
                            : () => _deleteVehicle(vehicle),
                        icon: id == _deletingVehicleId
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.delete_outline),
                      );
                    },
                  ),
                ],
              ),
              const Divider(height: 24),
              Wrap(
                spacing: 14,
                runSpacing: 8,
                children: [
                  _detail(
                    'Marca / modelo',
                    '${vehicle['marca'] ?? '—'} ${vehicle['modelo'] ?? ''}'
                        .trim(),
                  ),
                  _detail('Ano', vehicle['ano']?.toString() ?? '—'),
                  _detail(
                    'Quilometragem',
                    vehicle['kmAtual'] == null
                        ? '—'
                        : '${vehicle['kmAtual']} km',
                  ),
                  _detail('Status', vehicle['status']?.toString() ?? '—'),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                [
                      location['secretaria'],
                      location['departamento'],
                      location['sala'],
                    ]
                    .where(
                      (value) => value != null && value.toString().isNotEmpty,
                    )
                    .join(' / '),
                style: TextStyle(color: Colors.grey.shade700),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detail(String label, String value) => SizedBox(
    width: 145,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
        ),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    ),
  );
}

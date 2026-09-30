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
  List<Map<String, dynamic>> _vehicles = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _load();
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
              child: Text(_error!, textAlign: TextAlign.center),
            ),
          )
        : _vehicles.isEmpty
        ? const Center(child: Text('Não há veículos no escopo do seu perfil.'))
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: _vehicles.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, index) => _vehicleCard(_vehicles[index]),
            ),
          ),
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

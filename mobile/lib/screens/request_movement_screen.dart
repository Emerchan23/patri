import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/utils/location_match.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

class RequestMovementScreen extends StatefulWidget {
  final List<Asset> assets;
  final ApiService? apiService;

  const RequestMovementScreen({
    super.key,
    required this.assets,
    this.apiService,
  });

  @override
  State<RequestMovementScreen> createState() => _RequestMovementScreenState();
}

class _RequestMovementScreenState extends State<RequestMovementScreen> {
  late final ApiService _api;
  final TextEditingController _reason = TextEditingController();
  List<Map<String, dynamic>> _departments = [];
  List<Map<String, dynamic>> _rooms = [];
  String? _secretary;
  String? _department;
  String? _room;
  bool _loading = true;
  bool _submitting = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _loadCatalogs();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _loadCatalogs() async {
    try {
      final user = await _api.getCurrentUserSession();
      final secretaries = await _api.getSecretarias(forceRefresh: true);
      if (user == null || (user.secretaria ?? '').isEmpty) {
        throw Exception('O perfil não informa a secretaria desta unidade.');
      }
      final secretary = secretaries.cast<Map<String, dynamic>?>().firstWhere(
        (item) => item?['nome']?.toString() == user.secretaria,
        orElse: () => null,
      );
      final secretaryId = int.tryParse(secretary?['id']?.toString() ?? '');
      if (secretaryId == null) {
        throw Exception('Não foi possível localizar a secretaria vinculada.');
      }
      final departments = await _api.getDepartamentos(secretaryId);
      if (!mounted) return;
      setState(() {
        _secretary = user.secretaria;
        _departments = departments;
        _loading = false;
        _loadError = departments.isEmpty
            ? 'Não há departamentos disponíveis para esta secretaria.'
            : null;
      });
      final currentDepartment = user.departamento;
      final matchingDepartment = departments
          .cast<Map<String, dynamic>?>()
          .firstWhere(
            (item) => item?['nome']?.toString() == currentDepartment,
            orElse: () => null,
          );
      final departmentId = int.tryParse(
        matchingDepartment?['id']?.toString() ?? '',
      );
      if (departmentId != null) {
        await _selectDepartment(departmentId, preferredRoom: null);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _selectDepartment(int id, {String? preferredRoom}) async {
    final department = _departments.firstWhere(
      (item) => item['id'].toString() == id.toString(),
    );
    setState(() {
      _department = department['nome']?.toString();
      _room = null;
      _rooms = [];
    });
    try {
      final rooms = await _api.getSalas(id);
      if (!mounted) return;
      setState(() {
        _rooms = rooms;
        if (preferredRoom != null &&
            rooms.any((room) => room['nome']?.toString() == preferredRoom)) {
          _room = preferredRoom;
        }
      });
    } catch (error) {
      if (mounted) {
        _showMessage(error.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  Future<void> _submit() async {
    if (_department == null || _room == null || _secretary == null) {
      _showMessage('Selecione o departamento e a sala de destino.');
      return;
    }
    if (_reason.text.trim().isEmpty) {
      _showMessage('Descreva o motivo da solicitação.');
      return;
    }
    final alreadyAtDestination = widget.assets
        .where(
          (asset) => assetIsAtLocation(
            asset.localizacao,
            secretaria: _secretary,
            departamento: _department,
            sala: _room,
          ),
        )
        .toList();
    if (alreadyAtDestination.isNotEmpty) {
      final codes = alreadyAtDestination
          .map(
            (asset) =>
                asset.patrimonio ?? asset.patrimonioProvisorio ?? asset.id,
          )
          .join(', ');
      _showMessage('Já estão nesse destino: $codes. Remova-os do pedido.');
      return;
    }

    final destinationLabel = '$_secretary • $_department • $_room';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        scrollable: true,
        title: const Text('Conferir solicitação'),
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Enviar ${widget.assets.length} '
              '${widget.assets.length == 1 ? 'bem' : 'bens'} para aprovação?',
            ),
            const SizedBox(height: 8),
            Text(
              destinationLabel,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text('Motivo: ${_reason.text.trim()}'),
            const Divider(height: 24),
            ...widget.assets.map((asset) {
              final origin =
                  [
                        asset.localizacao?.secretaria,
                        asset.localizacao?.departamento,
                        asset.localizacao?.sala,
                      ]
                      .whereType<String>()
                      .where((part) => part.trim().isNotEmpty)
                      .join(' • ');
              return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.inventory_2_outlined),
                title: Text(
                  asset.patrimonio ??
                      asset.patrimonioProvisorio ??
                      'Sem patrimônio',
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      asset.descricao,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      'Origem: ${origin.isEmpty ? 'Não informada' : origin}',
                    ),
                  ],
                ),
              );
            }),
            const Text('O local só será alterado depois da aprovação.'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Voltar e revisar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Enviar pedido'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    try {
      await _api.createMovementRequest(
        assetIds: widget.assets.map((asset) => asset.id).toList(),
        secretariaDestino: _secretary!,
        departamentoDestino: _department!,
        salaDestino: _room!,
        motivo: _reason.text.trim(),
      );
      if (!mounted) return;
      _showMessage('Solicitação enviada para aprovação.');
      Navigator.pop(context, true);
    } catch (error) {
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Solicitar mudança')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_loadError!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () {
                        setState(() {
                          _loading = true;
                          _loadError = null;
                        });
                        _loadCatalogs();
                      },
                      icon: const Icon(Icons.refresh),
                      label: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${widget.assets.length} bem(ns) selecionado(s)',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 10),
                        ...widget.assets
                            .take(8)
                            .map(
                              (asset) => Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Text(
                                  '${asset.patrimonio ?? asset.patrimonioProvisorio ?? asset.id} · ${asset.descricao}',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                        if (widget.assets.length > 8)
                          Text('e mais ${widget.assets.length - 8} bem(ns)'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Secretaria de destino',
                    border: OutlineInputBorder(),
                  ),
                  child: Text(_secretary ?? 'Não definida'),
                ),
                const SizedBox(height: 14),
                SearchableDropdown<Map<String, dynamic>>(
                  label: 'Departamento de destino',
                  items: _departments,
                  selectedValue: _departments
                      .cast<Map<String, dynamic>?>()
                      .firstWhere(
                        (item) => item?['nome']?.toString() == _department,
                        orElse: () => null,
                      ),
                  itemLabel: (item) => item['nome']?.toString() ?? '',
                  onChanged: (item) {
                    if (item == null) return;
                    final id = int.tryParse(item['id'].toString());
                    if (id != null) _selectDepartment(id);
                  },
                ),
                const SizedBox(height: 14),
                SearchableDropdown<Map<String, dynamic>>(
                  label: _department == null
                      ? 'Selecione primeiro o departamento'
                      : 'Sala de destino',
                  items: _rooms,
                  selectedValue: _rooms
                      .cast<Map<String, dynamic>?>()
                      .firstWhere(
                        (item) => item?['nome']?.toString() == _room,
                        orElse: () => null,
                      ),
                  itemLabel: (item) => item['nome']?.toString() ?? '',
                  onChanged: (item) =>
                      setState(() => _room = item?['nome']?.toString()),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _reason,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    labelText: 'Motivo da mudança',
                    hintText:
                        'Explique por que os bens precisam mudar de local.',
                    border: OutlineInputBorder(),
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'A transferência só será efetivada após aprovação do gestor ou administrador.',
                  style: TextStyle(color: Colors.black54),
                ),
              ],
            ),
      bottomNavigationBar: _loading || _loadError != null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.all(16),
              child: FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_outlined),
                label: Text(
                  _submitting ? 'Enviando…' : 'Enviar para aprovação',
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
              ),
            ),
    );
  }
}

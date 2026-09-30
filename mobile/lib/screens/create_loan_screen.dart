import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/utils/location_match.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

class CreateLoanScreen extends StatefulWidget {
  final Asset asset;
  final ApiService? apiService;

  const CreateLoanScreen({super.key, required this.asset, this.apiService});

  @override
  State<CreateLoanScreen> createState() => _CreateLoanScreenState();
}

class _CreateLoanScreenState extends State<CreateLoanScreen> {
  late final ApiService _api;
  final _recipient = TextEditingController();
  final _reason = TextEditingController();
  final _notes = TextEditingController();
  List<Map<String, dynamic>> _secretaries = [];
  List<Map<String, dynamic>> _departments = [];
  List<Map<String, dynamic>> _rooms = [];
  String? _originSecretary;
  String? _originDepartment;
  String? _originRoom;
  String? _destinationSecretary;
  String? _destinationDepartment;
  String? _destinationRoom;
  DateTime _expectedReturn = DateTime.now().add(const Duration(days: 7));
  CurrentUserSession? _user;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _load();
  }

  @override
  void dispose() {
    _recipient.dispose();
    _reason.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final user = await _api.getCurrentUserSession();
      final secretaries = await _api.getSecretarias(forceRefresh: true);
      if (!mounted) return;
      setState(() {
        _user = user;
        _secretaries = secretaries;
        _originSecretary = widget.asset.localizacao?.secretaria;
        _originDepartment = widget.asset.localizacao?.departamento;
        _originRoom = widget.asset.localizacao?.sala;
        _loading = false;
        _error = secretaries.isEmpty
            ? 'Não foi possível carregar os destinos disponíveis.'
            : null;
      });
      final origin = secretaries.cast<Map<String, dynamic>?>().firstWhere(
        (entry) => entry?['nome']?.toString() == _originSecretary,
        orElse: () => null,
      );
      final id = int.tryParse(origin?['id']?.toString() ?? '');
      if (id != null) await _loadDepartments(id, initial: true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _loadDepartments(int secretaryId, {bool initial = false}) async {
    try {
      final items = await _api.getDepartamentos(secretaryId);
      if (!mounted) return;
      setState(() {
        _departments = items;
        if (!initial) {
          _destinationSecretary = _secretaries
              .firstWhere(
                (entry) => entry['id'].toString() == secretaryId.toString(),
              )['nome']
              ?.toString();
          _destinationDepartment = null;
          _destinationRoom = null;
          _rooms = [];
        }
      });
      if (initial) {
        final originDepartment = items.cast<Map<String, dynamic>?>().firstWhere(
          (entry) => entry?['nome']?.toString() == _originDepartment,
          orElse: () => null,
        );
        final departmentId = int.tryParse(
          originDepartment?['id']?.toString() ?? '',
        );
        if (departmentId != null) await _loadRooms(departmentId, initial: true);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    }
  }

  Future<void> _loadRooms(int departmentId, {bool initial = false}) async {
    try {
      final items = await _api.getSalas(departmentId);
      if (!mounted) return;
      setState(() {
        _rooms = items;
        if (initial) {
          // Do not preselect the origin as the destination: a loan must have
          // an explicitly chosen receiving location, distinct from the origin.
          _destinationSecretary = null;
          _destinationDepartment = null;
          _destinationRoom = null;
        }
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    }
  }

  Future<void> _selectSecretary(Map<String, dynamic>? item) async {
    final id = int.tryParse(item?['id']?.toString() ?? '');
    if (id != null) await _loadDepartments(id);
  }

  Future<void> _selectDepartment(Map<String, dynamic>? item) async {
    final id = int.tryParse(item?['id']?.toString() ?? '');
    if (id == null) return;
    setState(() {
      _destinationDepartment = item?['nome']?.toString();
      _destinationRoom = null;
    });
    await _loadRooms(id);
  }

  Future<void> _pickReturnDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _expectedReturn,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (selected != null && mounted) setState(() => _expectedReturn = selected);
  }

  Future<void> _submit() async {
    if ((_recipient.text.trim().isEmpty) ||
        (_reason.text.trim().isEmpty) ||
        _destinationSecretary == null ||
        _destinationDepartment == null ||
        _destinationRoom == null) {
      _message('Preencha recebedor, destino e motivo do empréstimo.');
      return;
    }
    if (sameLocationName(_originSecretary, _destinationSecretary) &&
        sameLocationName(_originDepartment, _destinationDepartment) &&
        sameLocationName(_originRoom, _destinationRoom)) {
      _message('Escolha um destino diferente da localização atual do bem.');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        scrollable: true,
        title: const Text('Conferir empréstimo'),
        content: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${widget.asset.patrimonio ?? widget.asset.patrimonioProvisorio ?? 'Bem'} · ${widget.asset.descricao}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              'Origem: ${_originSecretary ?? '—'} • ${_originDepartment ?? '—'} • ${_originRoom ?? '—'}',
            ),
            const SizedBox(height: 6),
            Text(
              'Destino: $_destinationSecretary • $_destinationDepartment • $_destinationRoom',
            ),
            const SizedBox(height: 6),
            Text('Recebedor: ${_recipient.text.trim()}'),
            Text(
              'Devolução prevista: ${DateFormat('dd/MM/yyyy').format(_expectedReturn)}',
            ),
            const SizedBox(height: 6),
            Text('Motivo: ${_reason.text.trim()}'),
            const SizedBox(height: 10),
            const Text(
              'O bem ficará marcado como emprestado e será gerado um termo de responsabilidade.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Voltar e revisar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Registrar empréstimo'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _saving = true);
    try {
      await _api.createLoan({
        'assetId': widget.asset.id,
        'assetDescricao': widget.asset.descricao,
        'patrimonio':
            widget.asset.patrimonio ?? widget.asset.patrimonioProvisorio,
        'origem': {
          'secretaria': _originSecretary,
          'departamento': _originDepartment,
          'sala': _originRoom,
        },
        'destino': {
          'secretaria': _destinationSecretary,
          'departamento': _destinationDepartment,
          'sala': _destinationRoom,
        },
        'responsavelEmprestimo': _user?.nome ?? '',
        'responsavelRecebimento': _recipient.text.trim(),
        'dataEmprestimo': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'dataPrevistaDevolucao': DateFormat(
          'yyyy-MM-dd',
        ).format(_expectedReturn),
        'motivo': _reason.text.trim(),
        'observacoes': _notes.text.trim(),
        'exigirTermo': true,
      });
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      _message(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _message(String value) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(value)));

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Novo empréstimo')),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(_error!, textAlign: TextAlign.center),
            ),
          )
        : ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              Card(
                child: ListTile(
                  leading: const Icon(Icons.inventory_2_outlined),
                  title: Text(
                    widget.asset.patrimonio ??
                        widget.asset.patrimonioProvisorio ??
                        'Bem',
                  ),
                  subtitle: Text(
                    widget.asset.descricao,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Origem',
                  border: OutlineInputBorder(),
                ),
                child: Text(
                  [
                    _originSecretary,
                    _originDepartment,
                    _originRoom,
                  ].where((part) => part?.isNotEmpty == true).join(' / '),
                ),
              ),
              const SizedBox(height: 14),
              SearchableDropdown<Map<String, dynamic>>(
                label: 'Secretaria de destino',
                items: _secretaries,
                selectedValue: _secretaries
                    .cast<Map<String, dynamic>?>()
                    .firstWhere(
                      (entry) =>
                          entry?['nome']?.toString() == _destinationSecretary,
                      orElse: () => null,
                    ),
                itemLabel: (entry) => entry['nome']?.toString() ?? '',
                onChanged: _selectSecretary,
              ),
              const SizedBox(height: 14),
              SearchableDropdown<Map<String, dynamic>>(
                label: 'Departamento de destino',
                items: _departments,
                selectedValue: _departments
                    .cast<Map<String, dynamic>?>()
                    .firstWhere(
                      (entry) =>
                          entry?['nome']?.toString() == _destinationDepartment,
                      orElse: () => null,
                    ),
                itemLabel: (entry) => entry['nome']?.toString() ?? '',
                onChanged: _selectDepartment,
              ),
              const SizedBox(height: 14),
              SearchableDropdown<Map<String, dynamic>>(
                label: 'Sala de destino',
                items: _rooms,
                selectedValue: _rooms.cast<Map<String, dynamic>?>().firstWhere(
                  (entry) => entry?['nome']?.toString() == _destinationRoom,
                  orElse: () => null,
                ),
                itemLabel: (entry) => entry['nome']?.toString() ?? '',
                onChanged: (entry) => setState(
                  () => _destinationRoom = entry?['nome']?.toString(),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _recipient,
                decoration: const InputDecoration(
                  labelText: 'Responsável que receberá *',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: _pickReturnDate,
                icon: const Icon(Icons.calendar_month),
                label: Text(
                  'Devolução prevista: ${DateFormat('dd/MM/yyyy').format(_expectedReturn)}',
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _reason,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Motivo do empréstimo *',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _notes,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Observações',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Será criado um termo de responsabilidade para o recebedor.',
              ),
            ],
          ),
    bottomNavigationBar: _loading || _error != null
        ? null
        : SafeArea(
            minimum: const EdgeInsets.all(16),
            child: FilledButton.icon(
              onPressed: _saving ? null : _submit,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              label: Text(_saving ? 'Salvando…' : 'Registrar empréstimo'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
            ),
          ),
  );
}

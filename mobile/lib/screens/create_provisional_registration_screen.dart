import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

class CreateProvisionalRegistrationScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;

  const CreateProvisionalRegistrationScreen({super.key, this.existing});

  @override
  State<CreateProvisionalRegistrationScreen> createState() =>
      _CreateProvisionalRegistrationScreenState();
}

class _CreateProvisionalRegistrationScreenState
    extends State<CreateProvisionalRegistrationScreen> {
  final ApiService _api = ApiService();
  final _formKey = GlobalKey<FormState>();
  final _description = TextEditingController();
  final _group = TextEditingController();
  final _brand = TextEditingController();
  final _model = TextEditingController();
  final _supplier = TextEditingController();
  final _serial = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  final _value = TextEditingController();
  final _responsible = TextEditingController();
  final _position = TextEditingController();
  final _notes = TextEditingController();

  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _departments = [];
  List<Map<String, dynamic>> _rooms = [];
  String? _category;
  String? _department;
  String? _room;
  String? _secretary;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fillExistingFields();
    _loadCatalogs();
  }

  void _fillExistingFields() {
    final item = widget.existing;
    if (item == null) return;
    _description.text = item['descricao']?.toString() ?? '';
    _group.text = item['grupo']?.toString() ?? '';
    _brand.text = item['marca']?.toString() ?? '';
    _model.text = item['modelo']?.toString() ?? '';
    _supplier.text = item['fornecedor']?.toString() ?? '';
    _serial.text = item['numeroSerie']?.toString() ?? '';
    _quantity.text = item['quantidade']?.toString() ?? '1';
    _value.text = item['valor']?.toString() ?? '';
    _responsible.text = item['responsavel']?['nome']?.toString() ?? '';
    _position.text = item['responsavel']?['cargo']?.toString() ?? '';
    _notes.text = item['observacoes']?.toString() ?? '';
    _category = item['categoria']?.toString();
    final location = item['localizacao'];
    if (location is Map) {
      _department = location['departamento']?.toString();
      _room = location['sala']?.toString();
    }
  }

  @override
  void dispose() {
    for (final controller in [
      _description,
      _group,
      _brand,
      _model,
      _supplier,
      _serial,
      _quantity,
      _value,
      _responsible,
      _position,
      _notes,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadCatalogs() async {
    try {
      final user = await _api.getCurrentUserSession();
      if (user == null || (user.secretaria ?? '').isEmpty) {
        throw Exception('Não consegui identificar a unidade do usuário.');
      }
      final categories = await _api.getCategorias(forceRefresh: true);
      final secretaries = await _api.getSecretarias(forceRefresh: true);
      final secretary = secretaries.cast<Map<String, dynamic>?>().firstWhere(
        (entry) => entry?['nome']?.toString() == user.secretaria,
        orElse: () => null,
      );
      final secretaryId = int.tryParse(secretary?['id']?.toString() ?? '');
      if (secretaryId == null) {
        throw Exception('Não encontrei a secretaria da unidade.');
      }
      final allDepartments = await _api.getDepartamentos(secretaryId);
      final allowedNames = <String>{
        if (user.departamento?.isNotEmpty == true) user.departamento!,
        ...user.departamentos,
      };
      final departments = allowedNames.isEmpty
          ? allDepartments
          : allDepartments
                .where(
                  (entry) => allowedNames.contains(entry['nome']?.toString()),
                )
                .toList();
      if (!mounted) return;
      setState(() {
        _secretary = user.secretaria;
        _categories = categories;
        _departments = departments;
        _loading = false;
        _error = categories.isEmpty
            ? 'Não foi possível carregar as categorias de bens.'
            : departments.isEmpty
            ? 'Não há departamentos liberados para esta unidade.'
            : null;
      });
      final targetDepartment = departments
          .cast<Map<String, dynamic>?>()
          .firstWhere(
            (entry) => entry?['nome']?.toString() == _department,
            orElse: () => null,
          );
      final departmentId = int.tryParse(
        targetDepartment?['id']?.toString() ?? '',
      );
      if (departmentId != null) {
        await _loadRooms(departmentId, preferredRoom: _room);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _loadRooms(int departmentId, {String? preferredRoom}) async {
    try {
      final rooms = await _api.getSalas(departmentId);
      if (!mounted) return;
      setState(() {
        _rooms = rooms;
        _room =
            preferredRoom != null &&
                rooms.any((entry) => entry['nome']?.toString() == preferredRoom)
            ? preferredRoom
            : null;
      });
    } catch (error) {
      if (mounted) _message(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_category == null || _department == null || _room == null) {
      _message('Selecione categoria, departamento e sala.');
      return;
    }
    final quantity = int.tryParse(_quantity.text.trim());
    if (quantity == null || quantity < 1) {
      _message('Informe uma quantidade válida.');
      return;
    }
    final value = double.tryParse(_value.text.trim().replaceAll(',', '.'));
    if (_value.text.trim().isNotEmpty && (value == null || value < 0)) {
      _message('Informe um valor válido.');
      return;
    }
    setState(() => _saving = true);
    try {
      await _api.saveProvisionalRegistration(
        id: widget.existing?['id']?.toString(),
        payload: {
          'descricao': _description.text.trim(),
          'categoria': _category,
          'grupo': _group.text.trim(),
          'marca': _brand.text.trim(),
          'modelo': _model.text.trim(),
          'fornecedor': _supplier.text.trim(),
          'numeroSerie': _serial.text.trim(),
          'quantidade': quantity,
          'valor': value,
          'estadoConservacao': 'bom',
          'responsavelNome': _responsible.text.trim(),
          'responsavelCargo': _position.text.trim(),
          'observacoes': _notes.text.trim(),
          'secretaria': _secretary,
          'departamento': _department,
          'sala': _room,
          'tipoEntrada': 'compra',
        },
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      _message(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  @override
  Widget build(BuildContext context) {
    final existing = widget.existing != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          existing ? 'Corrigir cadastro' : 'Novo cadastro provisório',
        ),
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
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  if (existing)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Text(
                          'Código: ${widget.existing?['codigo'] ?? '—'} · ${widget.existing?['status'] ?? ''}',
                        ),
                      ),
                    ),
                  TextFormField(
                    controller: _description,
                    decoration: const InputDecoration(
                      labelText: 'Descrição do bem *',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 2,
                    validator: (value) => (value ?? '').trim().isEmpty
                        ? 'Informe a descrição.'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  SearchableDropdown<Map<String, dynamic>>(
                    label: 'Categoria *',
                    items: _categories,
                    selectedValue: _categories
                        .cast<Map<String, dynamic>?>()
                        .firstWhere(
                          (entry) => entry?['slug']?.toString() == _category,
                          orElse: () => null,
                        ),
                    itemLabel: (entry) => entry['nome']?.toString() ?? '',
                    onChanged: (entry) =>
                        setState(() => _category = entry?['slug']?.toString()),
                  ),
                  const SizedBox(height: 14),
                  InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Secretaria',
                      border: OutlineInputBorder(),
                    ),
                    child: Text(_secretary ?? '—'),
                  ),
                  const SizedBox(height: 14),
                  SearchableDropdown<Map<String, dynamic>>(
                    label: 'Departamento *',
                    items: _departments,
                    selectedValue: _departments
                        .cast<Map<String, dynamic>?>()
                        .firstWhere(
                          (entry) => entry?['nome']?.toString() == _department,
                          orElse: () => null,
                        ),
                    itemLabel: (entry) => entry['nome']?.toString() ?? '',
                    onChanged: (entry) {
                      final name = entry?['nome']?.toString();
                      final id = int.tryParse(entry?['id']?.toString() ?? '');
                      setState(() {
                        _department = name;
                        _room = null;
                        _rooms = [];
                      });
                      if (id != null) _loadRooms(id);
                    },
                  ),
                  const SizedBox(height: 14),
                  SearchableDropdown<Map<String, dynamic>>(
                    label: 'Sala *',
                    items: _rooms,
                    selectedValue: _rooms
                        .cast<Map<String, dynamic>?>()
                        .firstWhere(
                          (entry) => entry?['nome']?.toString() == _room,
                          orElse: () => null,
                        ),
                    itemLabel: (entry) => entry['nome']?.toString() ?? '',
                    onChanged: (entry) =>
                        setState(() => _room = entry?['nome']?.toString()),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(child: _field(_group, 'Grupo')),
                      const SizedBox(width: 10),
                      Expanded(child: _field(_brand, 'Marca')),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(child: _field(_model, 'Modelo')),
                      const SizedBox(width: 10),
                      Expanded(child: _field(_serial, 'Nº de série')),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _field(
                          _quantity,
                          'Quantidade *',
                          keyboard: TextInputType.number,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _field(
                          _value,
                          'Valor (R\$)',
                          keyboard: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _field(_supplier, 'Fornecedor'),
                  const SizedBox(height: 14),
                  _field(_responsible, 'Responsável atual'),
                  const SizedBox(height: 14),
                  _field(_position, 'Cargo do responsável'),
                  const SizedBox(height: 14),
                  _field(_notes, 'Observações', lines: 3),
                  const SizedBox(height: 16),
                  const Text(
                    'O cadastro será enviado ao fluxo de conferência do patrimônio.',
                  ),
                ],
              ),
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
                    : const Icon(Icons.send_outlined),
                label: Text(
                  _saving
                      ? 'Enviando…'
                      : existing
                      ? 'Enviar correção'
                      : 'Enviar cadastro',
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
              ),
            ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboard,
    int lines = 1,
  }) => TextField(
    controller: controller,
    keyboardType: keyboard,
    minLines: lines,
    maxLines: lines,
    decoration: InputDecoration(
      labelText: label,
      border: const OutlineInputBorder(),
      alignLabelWithHint: lines > 1,
    ),
  );
}

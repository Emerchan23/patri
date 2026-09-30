import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/models/movement_result.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/utils/location_match.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

class MoveAssetScreen extends StatefulWidget {
  final List<Asset> assets;
  final Map<String, String?>? initialDestination;
  final ApiService? apiService;

  const MoveAssetScreen({
    super.key,
    required this.assets,
    this.initialDestination,
    this.apiService,
  });

  @override
  State<MoveAssetScreen> createState() => _MoveAssetScreenState();
}

class _MoveAssetScreenState extends State<MoveAssetScreen> {
  late final ApiService _apiService;
  final _formKey = GlobalKey<FormState>();

  bool _isLoading = false;
  bool _isCatalogLoading = true;
  String? _catalogError;

  // Dropdown data
  List<Map<String, dynamic>> _secretarias = [];
  List<Map<String, dynamic>> _departamentos = [];
  List<Map<String, dynamic>> _salas = [];

  // Selections (ID)
  int? _selectedSecretariaId;
  int? _selectedDepartamentoId;
  int? _selectedSalaId;

  // Selections (Name - for API)
  String? _selectedSecretariaName;
  String? _selectedDepartamentoName;
  String? _selectedSalaName;

  final TextEditingController _reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _initializeCatalogs();
  }

  Future<void> _initializeCatalogs() async {
    if (mounted) {
      setState(() {
        _isCatalogLoading = true;
        _catalogError = null;
      });
    }

    try {
      final data = await _apiService.getSecretarias(forceRefresh: true);
      if (!mounted) return;

      setState(() {
        _secretarias = data;
        _isCatalogLoading = false;
        _catalogError = _secretarias.isEmpty
            ? 'Não foi possível carregar as secretarias para movimentação.'
            : null;
      });

      if (_catalogError == null && widget.initialDestination != null) {
        await _applyInitialDestination(widget.initialDestination!);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isCatalogLoading = false;
        _catalogError =
            'Não foi possível sincronizar os locais para movimentação.';
      });
    }
  }

  Future<void> _loadDepartamentos(int secretariaId) async {
    setState(() {
      _departamentos = [];
      _salas = [];
      _selectedDepartamentoId = null;
      _selectedDepartamentoName = null;
      _selectedSalaId = null;
      _selectedSalaName = null;
    });
    try {
      final data = await _apiService.getDepartamentos(secretariaId);
      if (!mounted || _selectedSecretariaId != secretariaId) return;
      setState(() {
        _departamentos = data;
      });
    } catch (error) {
      if (mounted && _selectedSecretariaId == secretariaId) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    }
  }

  Future<void> _loadSalas(int departamentoId) async {
    setState(() {
      _salas = [];
      _selectedSalaId = null;
      _selectedSalaName = null;
    });
    try {
      final data = await _apiService.getSalas(departamentoId);
      if (!mounted || _selectedDepartamentoId != departamentoId) return;
      setState(() {
        _salas = data;
      });
    } catch (error) {
      if (mounted && _selectedDepartamentoId == departamentoId) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    }
  }

  Future<void> _applyInitialDestination(
    Map<String, String?> destination,
  ) async {
    final secretariaName = destination['secretaria'];
    final departamentoName = destination['departamento'];
    final salaName = destination['sala'];
    if (secretariaName == null ||
        departamentoName == null ||
        salaName == null) {
      return;
    }

    final secretaria = _secretarias.cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['nome']?.toString() == secretariaName,
      orElse: () => null,
    );
    final secretariaId = int.tryParse(secretaria?['id']?.toString() ?? '');
    if (secretariaId == null) return;

    if (mounted) {
      setState(() {
        _selectedSecretariaId = secretariaId;
        _selectedSecretariaName = secretariaName;
      });
    }
    await _loadDepartamentos(secretariaId);
    if (!mounted) return;

    final departamento = _departamentos
        .cast<Map<String, dynamic>?>()
        .firstWhere(
          (item) => item?['nome']?.toString() == departamentoName,
          orElse: () => null,
        );
    final departamentoId = int.tryParse(departamento?['id']?.toString() ?? '');
    if (departamentoId == null) return;

    setState(() {
      _selectedDepartamentoId = departamentoId;
      _selectedDepartamentoName = departamentoName;
    });
    await _loadSalas(departamentoId);
    if (!mounted) return;

    final sala = _salas.cast<Map<String, dynamic>?>().firstWhere(
      (item) => item?['nome']?.toString() == salaName,
      orElse: () => null,
    );
    final salaId = int.tryParse(sala?['id']?.toString() ?? '');
    if (salaId != null) {
      setState(() {
        _selectedSalaId = salaId;
        _selectedSalaName = salaName;
      });
    }
  }

  Widget _buildCatalogLoadingState() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Sincronizando locais para movimentação…'),
          ],
        ),
      ),
    );
  }

  Widget _buildCatalogErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.sync_problem, size: 48, color: Colors.orange),
            const SizedBox(height: 16),
            Text(
              _catalogError ?? 'Não foi possível carregar os locais.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _initializeCatalogs,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedSalaName == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecione o destino completo')),
      );
      return;
    }
    final alreadyThere = widget.assets
        .where(
          (asset) => assetIsAtLocation(
            asset.localizacao,
            secretaria: _selectedSecretariaName,
            departamento: _selectedDepartamentoName,
            sala: _selectedSalaName,
          ),
        )
        .toList();
    if (alreadyThere.isNotEmpty) {
      final codes = alreadyThere
          .map(
            (asset) =>
                asset.patrimonio ?? asset.patrimonioProvisorio ?? asset.id,
          )
          .join(', ');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Já estão nesse destino: $codes. Remova-os da lista antes de continuar.',
          ),
        ),
      );
      return;
    }

    final destinationLabel = [
      _selectedSecretariaName,
      _selectedDepartamentoName,
      _selectedSalaName,
    ].whereType<String>().join(' • ');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Conferir transferência'),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Transferir ${widget.assets.length} '
                  '${widget.assets.length == 1 ? 'bem' : 'bens'} para:',
                ),
                const SizedBox(height: 8),
                Text(
                  destinationLabel,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text('Motivo: ${_reasonController.text.trim()}'),
                const SizedBox(height: 12),
                const Divider(height: 1),
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
                const SizedBox(height: 4),
                const Text(
                  'Após confirmar, o histórico será registrado para cada bem.',
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Voltar e revisar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isLoading = true);

    try {
      await _apiService.createMovement(
        assetIds: widget.assets.map((asset) => asset.id).toList(),
        destination: {
          'secretaria': _selectedSecretariaName,
          'departamento': _selectedDepartamentoName,
          'sala': _selectedSalaName,
        },
        motivo: _reasonController.text.trim(),
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Movimentação realizada com sucesso!')),
      );
      Navigator.pop(
        context,
        MovementResult(
          destination: {
            'secretaria': _selectedSecretariaName,
            'departamento': _selectedDepartamentoName,
            'sala': _selectedSalaName,
          },
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
          duration: const Duration(seconds: 5),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isCatalogLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Movimentar bens')),
        body: _buildCatalogLoadingState(),
      );
    }

    if (_catalogError != null && _secretarias.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Movimentar bens')),
        body: _buildCatalogErrorState(),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Movimentar bens')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Selected assets summary
              Card(
                color: Colors.blue[50],
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${widget.assets.length} '
                        '${widget.assets.length == 1 ? 'bem selecionado' : 'bens selecionados'}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      ...widget.assets.map(
                        (asset) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            '${asset.patrimonio ?? asset.patrimonioProvisorio ?? 'Sem patrimônio'} — ${asset.descricao}\n'
                            'Origem: ${[asset.localizacao?.secretaria, asset.localizacao?.departamento, asset.localizacao?.sala].whereType<String>().where((part) => part.trim().isNotEmpty).join(' • ')}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              const Text(
                'Destino da transferência',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              // Secretaria Dropdown
              SearchableDropdown<int>(
                selectedValue: _selectedSecretariaId,
                label: 'Secretaria',
                items: _secretarias.map((s) => s['id'] as int).toList(),
                itemLabel: (id) =>
                    _secretarias.firstWhere((s) => s['id'] == id)['nome'],
                onChanged: (val) {
                  setState(() {
                    _selectedSecretariaId = val;
                    _selectedSecretariaName = _secretarias.firstWhere(
                      (e) => e['id'] == val,
                    )['nome'];
                  });
                  if (val != null) _loadDepartamentos(val);
                },
                validator: (v) => v == null ? 'Obrigatório' : null,
              ),
              const SizedBox(height: 16),

              // Departamento Dropdown
              SearchableDropdown<int>(
                selectedValue: _selectedDepartamentoId,
                label: 'Departamento',
                items: _departamentos.map((d) => d['id'] as int).toList(),
                itemLabel: (id) =>
                    _departamentos.firstWhere((d) => d['id'] == id)['nome'],
                onChanged: _selectedSecretariaId == null
                    ? (_) {}
                    : (val) {
                        if (val == null) return;
                        setState(() {
                          _selectedDepartamentoId = val;
                          _selectedDepartamentoName = _departamentos.firstWhere(
                            (e) => e['id'] == val,
                          )['nome'];
                        });
                        _loadSalas(val);
                      },
                validator: (v) => v == null ? 'Obrigatório' : null,
              ),
              const SizedBox(height: 16),

              // Sala Dropdown
              SearchableDropdown<int>(
                selectedValue: _selectedSalaId,
                label: 'Sala',
                items: _salas.map((s) => s['id'] as int).toList(),
                itemLabel: (id) =>
                    _salas.firstWhere((s) => s['id'] == id)['nome'],
                onChanged: _selectedDepartamentoId == null
                    ? (_) {}
                    : (val) {
                        if (val == null) return;
                        setState(() {
                          _selectedSalaId = val;
                          _selectedSalaName = _salas.firstWhere(
                            (e) => e['id'] == val,
                          )['nome'];
                        });
                      },
                validator: (v) => v == null ? 'Obrigatório' : null,
              ),
              const SizedBox(height: 16),

              // Motivo
              TextFormField(
                controller: _reasonController,
                decoration: const InputDecoration(
                  labelText: 'Motivo da movimentação',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Informe o motivo' : null,
              ),

              const SizedBox(height: 32),

              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text('CONFIRMAR MOVIMENTAÇÃO'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }
}

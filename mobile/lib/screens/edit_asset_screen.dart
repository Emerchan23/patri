import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'dart:convert';

class EditAssetScreen extends StatefulWidget {
  final Asset asset;

  const EditAssetScreen({super.key, required this.asset});

  @override
  State<EditAssetScreen> createState() => _EditAssetScreenState();
}

class _EditAssetScreenState extends State<EditAssetScreen> {
  final ApiService _apiService = ApiService();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  bool _isCatalogLoading = true;
  String? _catalogError;

  late TextEditingController _descricaoController;
  late TextEditingController _categoriaController;
  late TextEditingController _grupoController;
  late TextEditingController _fornecedorController;
  late TextEditingController _marcaController;
  late TextEditingController _valorController;
  late TextEditingController _modeloController;
  late TextEditingController _serieController;
  late TextEditingController _statusController;
  late TextEditingController _responsavelController;
  late TextEditingController _tempoGarantiaController;
  late TextEditingController _observacoesController;
  late TextEditingController _emendaController;

  // Dropdown data
  List<Map<String, dynamic>> _secretarias = [];
  List<Map<String, dynamic>> _departamentos = [];
  List<Map<String, dynamic>> _salas = [];
  List<Map<String, dynamic>> _categorias = [];
  List<Map<String, dynamic>> _grupos = [];
  List<Map<String, dynamic>> _fornecedores = [];
  List<Map<String, dynamic>> _marcas = [];
  List<Map<String, dynamic>> _servidores = [];

  // Selections
  int? _selectedSecretariaId;
  String? _selectedSecretariaName;
  int? _selectedDepartamentoId;
  String? _selectedDepartamentoName;
  String? _selectedSalaName;
  String? _selectedCategoria;
  String? _selectedGrupo;
  String? _selectedFornecedor;
  String? _selectedMarca;
  String? _selectedResponsavel;

  File? _newImage;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _descricaoController = TextEditingController(text: widget.asset.descricao);
    _categoriaController = TextEditingController(text: widget.asset.categoria);
    _grupoController = TextEditingController(
      text: widget.asset.grupo ?? 'Geral',
    );
    _fornecedorController = TextEditingController(
      text: widget.asset.fornecedor ?? '',
    );
    _marcaController = TextEditingController(text: widget.asset.marca ?? '');
    _valorController = TextEditingController(
      text: widget.asset.valor.toString(),
    );
    _modeloController = TextEditingController(text: widget.asset.modelo ?? '');
    _serieController = TextEditingController(
      text: widget.asset.numeroSerie ?? '',
    );
    _statusController = TextEditingController(text: widget.asset.status);
    _responsavelController = TextEditingController(
      text: widget.asset.responsavel?.nome ?? '',
    );
    _tempoGarantiaController = TextEditingController(
      text: widget.asset.tempoGarantia?.toString() ?? '',
    );
    _observacoesController = TextEditingController(
      text: widget.asset.observacoes ?? '',
    );
    _emendaController = TextEditingController(
      text: widget.asset.emendaParlamentar ?? '',
    );

    _selectedCategoria = widget.asset.categoria;
    _selectedGrupo = widget.asset.grupo;
    _selectedFornecedor = widget.asset.fornecedor;
    _selectedMarca = widget.asset.marca;
    _selectedResponsavel = widget.asset.responsavel?.nome;

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
      final results = await Future.wait([
        _apiService.getSecretarias(forceRefresh: true),
        _apiService.getCategorias(forceRefresh: true),
        _apiService.getGrupos(forceRefresh: true),
        _apiService.getFornecedores(forceRefresh: true),
        _apiService.getMarcas(forceRefresh: true),
        _apiService.getServidores(forceRefresh: true),
      ]);

      if (!mounted) return;

      setState(() {
        _secretarias = results[0];
        _categorias = results[1];
        _grupos = results[2];
        _fornecedores = results[3];
        _marcas = results[4];
        _servidores = results[5];
        _isCatalogLoading = false;
        _catalogError = _secretarias.isEmpty || _categorias.isEmpty
            ? 'Nao foi possivel carregar os dados auxiliares da edicao.'
            : null;
      });

      if (_secretarias.isNotEmpty &&
          widget.asset.localizacao?.secretaria != null) {
        try {
          final match = _secretarias.firstWhere(
            (s) => s['nome'] == widget.asset.localizacao!.secretaria,
          );
          _selectedSecretariaId = match['id'];
          _selectedSecretariaName = match['nome'];
          await _loadDepartamentos(_selectedSecretariaId!);
        } catch (_) {}
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isCatalogLoading = false;
        _catalogError = 'Nao foi possivel sincronizar os dados da edicao.';
      });
    }
  }

  Future<void> _loadDepartamentos(int secretariaId) async {
    try {
      final data = await _apiService.getDepartamentos(secretariaId);
      if (!mounted) return;
      setState(() {
        _departamentos = data;

        // Try to find current dept ID by name
        if (widget.asset.localizacao?.departamento != null &&
            _selectedSecretariaId != null) {
          try {
            final match = _departamentos.firstWhere(
              (d) => d['nome'] == widget.asset.localizacao!.departamento,
            );
            _selectedDepartamentoId = match['id'];
            _selectedDepartamentoName = match['nome'];
            _loadSalas(_selectedDepartamentoId!);
          } catch (_) {}
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

  Future<void> _loadSalas(int departamentoId) async {
    try {
      final data = await _apiService.getSalas(departamentoId);
      if (!mounted) return;
      setState(() {
        _salas = data;

        // Try to find current room ID by name
        if (widget.asset.localizacao?.sala != null &&
            _selectedDepartamentoId != null) {
          try {
            final match = _salas.firstWhere(
              (s) => s['nome'] == widget.asset.localizacao!.sala,
            );
            _selectedSalaName = match['nome'];
          } catch (_) {}
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

  Widget _buildCatalogLoadingState() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Sincronizando categorias, grupos, marcas e locais...'),
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
              _catalogError ?? 'Nao foi possivel carregar os dados auxiliares.',
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

  String _fornecedorLabel(Map<String, dynamic> fornecedor) {
    final nomeFantasia = fornecedor['nome_fantasia']?.toString().trim() ?? '';
    if (nomeFantasia.isNotEmpty) {
      return nomeFantasia;
    }

    final nome = fornecedor['nome']?.toString().trim() ?? '';
    if (nome.isNotEmpty) {
      return nome;
    }

    final razaoSocial = fornecedor['razao_social']?.toString().trim() ?? '';
    if (razaoSocial.isNotEmpty) {
      return razaoSocial;
    }

    final cnpj = fornecedor['cnpj']?.toString().trim() ?? '';
    if (cnpj.isNotEmpty) {
      return 'Fornecedor $cnpj';
    }

    return 'Fornecedor #${fornecedor['id'] ?? ''}'.trim();
  }

  String _marcaLabel(Map<String, dynamic> marca) {
    final nome = marca['nome']?.toString().trim() ?? '';
    if (nome.isNotEmpty) {
      return nome;
    }

    final descricao = marca['descricao']?.toString().trim() ?? '';
    if (descricao.isNotEmpty) {
      return descricao;
    }

    return 'Marca #${marca['id'] ?? ''}'.trim();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        setState(() {
          _newImage = File(pickedFile.path);
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Erro ao selecionar imagem: $e');
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    String? base64Image;
    if (_newImage != null) {
      List<int> imageBytes = await _newImage!.readAsBytes();
      String base64String = base64Encode(imageBytes);
      // Determine extension or just assume jpeg/png
      // Ideally we detect it, but for simplicity we can check file path extension
      String ext = _newImage!.path.split('.').last.toLowerCase();
      if (ext == 'jpg') ext = 'jpeg';
      base64Image = 'data:image/$ext;base64,$base64String';
    }

    double? valor;
    if (_valorController.text.isNotEmpty) {
      String cleanVal = _valorController.text
          .replaceAll('R\$', '')
          .replaceAll('.', '')
          .replaceAll(',', '.')
          .trim();
      valor = double.tryParse(cleanVal);
    }

    final updatedData = {
      'descricao': _descricaoController.text,
      'categoria': _selectedCategoria ?? _categoriaController.text,
      'grupo': _selectedGrupo ?? _grupoController.text,
      'fornecedor': _selectedFornecedor ?? _fornecedorController.text,
      'marca': _selectedMarca ?? _marcaController.text,
      'modelo': _modeloController.text,
      'numeroSerie': _serieController.text,
      'valor': valor,
      'status': _statusController.text,
      'responsavel': {
        'nome': _selectedResponsavel ?? _responsavelController.text,
        // cargo preserved if not edited
        'cargo': widget.asset.responsavel?.cargo,
      },
      'localizacao': {
        'secretaria':
            _selectedSecretariaName ?? widget.asset.localizacao?.secretaria,
        'departamento':
            _selectedDepartamentoName ?? widget.asset.localizacao?.departamento,
        'sala': _selectedSalaName ?? widget.asset.localizacao?.sala,
      },
      // Ensure patrimony is NOT sent or sent as original to avoid accidental change if API allowed it
      'patrimonio': widget.asset.patrimonio,
      'imagem': base64Image,
      'tempoGarantia': int.tryParse(_tempoGarantiaController.text),
      'observacoes': _observacoesController.text,
      'emendaParlamentar': _emendaController.text,
    };

    final success = await _apiService.updateAsset(widget.asset.id, updatedData);

    setState(() => _isLoading = false);

    if (success) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bem atualizado com sucesso!')),
        );
        Navigator.pop(context, true);
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Erro ao atualizar bem')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isCatalogLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Editar Bem')),
        body: _buildCatalogLoadingState(),
      );
    }

    if (_catalogError != null &&
        (_secretarias.isEmpty || _categorias.isEmpty)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Editar Bem')),
        body: _buildCatalogErrorState(),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Editar Bem')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Read-only Patrimony
              TextFormField(
                initialValue: widget.asset.patrimonio,
                decoration: const InputDecoration(
                  labelText: 'Patrimônio',
                  border: OutlineInputBorder(),
                  filled: true,
                  fillColor: Colors.black12,
                ),
                readOnly: true,
                enabled: false,
              ),
              const SizedBox(height: 16),

              // Image Picker
              Center(
                child: GestureDetector(
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      builder: (context) => SafeArea(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ListTile(
                              leading: const Icon(Icons.camera_alt),
                              title: const Text('Tirar Foto'),
                              onTap: () {
                                Navigator.pop(context);
                                _pickImage(ImageSource.camera);
                              },
                            ),
                            ListTile(
                              leading: const Icon(Icons.photo_library),
                              title: const Text('Escolher da Galeria'),
                              onTap: () {
                                Navigator.pop(context);
                                _pickImage(ImageSource.gallery);
                              },
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                  child: Container(
                    width: double.infinity,
                    height: 200,
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey[400]!),
                    ),
                    child: _newImage != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(_newImage!, fit: BoxFit.cover),
                          )
                        : widget.asset.imagem != null
                        ? FutureBuilder<String?>(
                            future: _apiService.getImageUrl(
                              widget.asset.imagem,
                            ),
                            builder: (context, snapshot) {
                              if (snapshot.hasData && snapshot.data != null) {
                                return ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    snapshot.data!,
                                    fit: BoxFit.cover,
                                  ),
                                );
                              }
                              return const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.add_a_photo,
                                    size: 50,
                                    color: Colors.grey,
                                  ),
                                  SizedBox(height: 8),
                                  Text('Toque para alterar a foto'),
                                ],
                              );
                            },
                          )
                        : const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.add_a_photo,
                                size: 50,
                                color: Colors.grey,
                              ),
                              SizedBox(height: 8),
                              Text('Toque para adicionar foto'),
                            ],
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _descricaoController,
                decoration: const InputDecoration(
                  labelText: 'Descrição',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => v == null || v.isEmpty ? 'Obrigatório' : null,
              ),
              const SizedBox(height: 16),

              // Categoria Dropdown
              SearchableDropdown<String>(
                selectedValue: _selectedCategoria,
                label: 'Categoria',
                items: _categorias.map((c) => c['slug'].toString()).toList(),
                itemLabel: (slug) {
                  final cat = _categorias.firstWhere(
                    (c) => c['slug'] == slug,
                    orElse: () => {'nome': slug},
                  );
                  return cat['nome'].toString();
                },
                onChanged: (val) {
                  setState(() {
                    _selectedCategoria = val;
                    _categoriaController.text = val ?? '';
                  });
                },
                validator: (v) => v == null ? 'Obrigatório' : null,
              ),
              const SizedBox(height: 16),

              // Grupo Dropdown
              SearchableDropdown<String>(
                selectedValue: _selectedGrupo,
                label: 'Grupo',
                items: _grupos.map((g) => g['nome'].toString()).toList(),
                itemLabel: (nome) => nome,
                onChanged: (val) {
                  setState(() {
                    _selectedGrupo = val;
                    _grupoController.text = val ?? '';
                  });
                },
              ),
              const SizedBox(height: 16),

              // Fornecedor Dropdown
              SearchableDropdown<String>(
                selectedValue: _selectedFornecedor,
                label: 'Fornecedor',
                items: _fornecedores.map(_fornecedorLabel).toList(),
                itemLabel: (nome) => nome,
                onChanged: (val) {
                  setState(() {
                    _selectedFornecedor = val;
                    _fornecedorController.text = val ?? '';
                  });
                },
              ),
              const SizedBox(height: 16),

              // Marca Dropdown
              SearchableDropdown<String>(
                selectedValue: _selectedMarca,
                label: 'Marca',
                items: _marcas.map(_marcaLabel).toList(),
                itemLabel: (nome) => nome,
                onChanged: (val) {
                  setState(() {
                    _selectedMarca = val;
                    _marcaController.text = val ?? '';
                  });
                },
              ),
              const SizedBox(height: 16),

              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _modeloController,
                      decoration: const InputDecoration(
                        labelText: 'Modelo',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextFormField(
                      controller: _serieController,
                      decoration: const InputDecoration(
                        labelText: 'Nº Série',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _valorController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Valor (R\$)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              // Status Dropdown
              DropdownButtonFormField<String>(
                initialValue:
                    [
                      'ativo',
                      'baixado',
                      'em_manutencao',
                    ].contains(_statusController.text)
                    ? _statusController.text
                    : 'ativo',
                decoration: const InputDecoration(
                  labelText: 'Status',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'ativo', child: Text('Ativo')),
                  DropdownMenuItem(value: 'baixado', child: Text('Baixado')),
                  DropdownMenuItem(
                    value: 'em_manutencao',
                    child: Text('Em Manutenção'),
                  ),
                ],
                onChanged: (val) =>
                    setState(() => _statusController.text = val!),
              ),
              const SizedBox(height: 24),

              const Text(
                'Localização (Somente Leitura)',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const Text(
                'Para alterar a localização, utilize a função "Movimentar".',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 8),

              TextFormField(
                initialValue:
                    _selectedSecretariaName ??
                    widget.asset.localizacao?.secretaria,
                decoration: const InputDecoration(
                  labelText: 'Secretaria',
                  border: OutlineInputBorder(),
                  filled: true,
                  fillColor: Colors.black12,
                ),
                readOnly: true,
                enabled: false,
              ),
              const SizedBox(height: 16),

              TextFormField(
                initialValue:
                    _selectedDepartamentoName ??
                    widget.asset.localizacao?.departamento,
                decoration: const InputDecoration(
                  labelText: 'Departamento',
                  border: OutlineInputBorder(),
                  filled: true,
                  fillColor: Colors.black12,
                ),
                readOnly: true,
                enabled: false,
              ),
              const SizedBox(height: 16),

              TextFormField(
                initialValue:
                    _selectedSalaName ?? widget.asset.localizacao?.sala,
                decoration: const InputDecoration(
                  labelText: 'Sala',
                  border: OutlineInputBorder(),
                  filled: true,
                  fillColor: Colors.black12,
                ),
                readOnly: true,
                enabled: false,
              ),
              const SizedBox(height: 24),

              // Responsável Dropdown
              SearchableDropdown<String>(
                selectedValue: _selectedResponsavel,
                label: 'Responsável',
                items: _servidores.map((s) => s['nome'].toString()).toList(),
                itemLabel: (nome) => nome,
                onChanged: (val) {
                  setState(() {
                    _selectedResponsavel = val;
                    if (val != null) {
                      _responsavelController.text = val;
                    }
                  });
                },
              ),

              const SizedBox(height: 16),

              TextFormField(
                controller: _tempoGarantiaController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Garantia (meses)',
                  border: OutlineInputBorder(),
                ),
              ),

              const SizedBox(height: 16),

              TextFormField(
                controller: _emendaController,
                decoration: const InputDecoration(
                  labelText: 'Emenda Parlamentar',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _observacoesController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Observações',
                  border: OutlineInputBorder(),
                ),
              ),

              const SizedBox(height: 32),

              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24.0),
                  child: SizedBox(
                    height: 50,
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _submit,
                      child: _isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text('SALVAR ALTERAÇÕES'),
                    ),
                  ),
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
    _descricaoController.dispose();
    _categoriaController.dispose();
    _grupoController.dispose();
    _fornecedorController.dispose();
    _marcaController.dispose();
    _valorController.dispose();
    _modeloController.dispose();
    _serieController.dispose();
    _statusController.dispose();
    _responsavelController.dispose();
    _tempoGarantiaController.dispose();
    _observacoesController.dispose();
    _emendaController.dispose();
    super.dispose();
  }
}

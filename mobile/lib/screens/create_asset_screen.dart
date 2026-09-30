import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'dart:convert';

class CreateAssetScreen extends StatefulWidget {
  final ApiService? apiService;

  const CreateAssetScreen({super.key, this.apiService});

  @override
  State<CreateAssetScreen> createState() => _CreateAssetScreenState();
}

class _CreateAssetScreenState extends State<CreateAssetScreen> {
  late final ApiService _apiService;
  final _formKey = GlobalKey<FormState>();
  final ScrollController _formScrollController = ScrollController();
  int _currentStep = 0;
  bool _isLoading = false;
  bool _isCatalogLoading = true;
  String? _catalogError;

  final TextEditingController _descricaoController = TextEditingController();
  final TextEditingController _categoriaController = TextEditingController();
  final TextEditingController _grupoController = TextEditingController();
  final TextEditingController _fornecedorController = TextEditingController();
  final TextEditingController _marcaController = TextEditingController();
  final TextEditingController _responsavelController = TextEditingController();
  final TextEditingController _tempoGarantiaController =
      TextEditingController();
  final TextEditingController _valorController = TextEditingController();
  final TextEditingController _modeloController = TextEditingController();
  final TextEditingController _serieController = TextEditingController();
  final TextEditingController _numeroController = TextEditingController();

  // Patrimonio type
  String _patrimonioTipo = 'provisorio'; // 'definitivo' or 'provisorio'
  bool _isProvisorioManual = false;
  final TextEditingController _provisorioManualController =
      TextEditingController();
  final TextEditingController _provisorioAnoController = TextEditingController(
    text: DateTime.now().year.toString(),
  );

  // Dropdown data
  List<Map<String, dynamic>> _secretarias = [];
  List<Map<String, dynamic>> _departamentos = [];
  List<Map<String, dynamic>> _salas = [];
  List<Map<String, dynamic>> _categorias = [];
  List<Map<String, dynamic>> _grupos = [];
  List<Map<String, dynamic>> _marcas = [];
  List<Map<String, dynamic>> _servidores = [];
  List<Map<String, dynamic>> _fornecedores = [];

  // Selections
  int? _selectedSecretariaId;
  String? _selectedSecretariaName;
  int? _selectedDepartamentoId;
  String? _selectedDepartamentoName;
  int? _selectedSalaId;
  String? _selectedSalaName;
  String? _selectedCategoria;
  String? _selectedGrupo;
  String? _selectedMarca;
  String? _selectedResponsavel;
  String? _selectedFornecedor;
  String _estadoConservacao = 'novo';

  File? _newImage;
  final ImagePicker _picker = ImagePicker();

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
      final results = await Future.wait([
        _apiService.getSecretarias(forceRefresh: true),
        _apiService.getCategorias(forceRefresh: true),
        _apiService.getGrupos(forceRefresh: true),
        _apiService.getServidores(forceRefresh: true),
        _apiService.getMarcas(forceRefresh: true),
        _apiService.getFornecedores(forceRefresh: true),
      ]);

      if (!mounted) return;

      setState(() {
        _secretarias = results[0];
        _categorias = results[1];
        _grupos = results[2];
        _servidores = results[3];
        _marcas = results[4];
        _fornecedores = results[5];
        _isCatalogLoading = false;
        _catalogError = _secretarias.isEmpty || _categorias.isEmpty
            ? 'Nao foi possivel carregar os dados auxiliares do cadastro.'
            : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isCatalogLoading = false;
        _catalogError = 'Nao foi possivel sincronizar os dados do cadastro.';
      });
    }
  }

  Future<void> _loadDepartamentos(int secretariaId) async {
    try {
      final data = await _apiService.getDepartamentos(secretariaId);
      if (!mounted) return;
      setState(() {
        _departamentos = data;
        _selectedDepartamentoId = null;
        _selectedDepartamentoName = null;
        _selectedSalaId = null;
        _selectedSalaName = null;
        _salas = [];
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
        _selectedSalaId = null;
        _selectedSalaName = null;
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

    // Validate location
    if (_selectedSecretariaId == null ||
        _selectedDepartamentoId == null ||
        _selectedSalaId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Selecione a localização completa (Secretaria, Departamento e Sala)',
          ),
        ),
      );
      return;
    }

    // Validate patrimony if definitive
    if (_patrimonioTipo == 'definitivo') {
      if (_numeroController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Informe o Número do patrimônio')),
        );
        return;
      }
    } else if (_patrimonioTipo == 'provisorio' && _isProvisorioManual) {
      if (_provisorioManualController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Informe o Número provisório')),
        );
        return;
      }
    }

    setState(() => _isLoading = true);
    try {
      String? base64Image;
      if (_newImage != null) {
        List<int> imageBytes = await _newImage!.readAsBytes();
        String base64String = base64Encode(imageBytes);
        String ext = _newImage!.path.split('.').last.toLowerCase();
        if (ext == 'jpg') ext = 'jpeg';
        base64Image = 'data:image/$ext;base64,$base64String';
      }

      // Parse currency
      double? valor;
      if (_valorController.text.isNotEmpty) {
        // Basic clean up for R$
        String cleanVal = _valorController.text
            .replaceAll('R\$', '')
            .replaceAll('.', '')
            .replaceAll(',', '.')
            .trim();
        valor = double.tryParse(cleanVal);
      }

      final data = {
        'descricao': _descricaoController.text.toUpperCase(),
        'categoria': _selectedCategoria ?? _categoriaController.text,
        'grupo': _selectedGrupo ?? _grupoController.text,
        'fornecedor': _selectedFornecedor ?? _fornecedorController.text,
        'status': 'ativo',
        'responsavel': {
          'nome': _responsavelController.text.toUpperCase(),
          'cargo': '', // Optional in mobile
        },
        'localizacao': {
          'secretaria': _selectedSecretariaName,
          'departamento': _selectedDepartamentoName,
          'sala': _selectedSalaName,
        },
        'patrimonioTipo': _patrimonioTipo,
        'patrimonio': _patrimonioTipo == 'definitivo'
            ? _numeroController.text
            : null,
        'patrimonioProvisorio': _patrimonioTipo == 'provisorio'
            ? (_isProvisorioManual
                  ? 'PROV-${_provisorioAnoController.text}-${_provisorioManualController.text}'
                  : 'PROV-${DateTime.now().year}-AUTO')
            : null,
        'imagem': base64Image,
        'tempoGarantia': int.tryParse(_tempoGarantiaController.text),
        'valor': valor,
        'marca': _selectedMarca ?? _marcaController.text.toUpperCase(),
        'modelo': _modeloController.text.toUpperCase(),
        'numeroSerie': _serieController.text.toUpperCase(),
        'estadoConservacao': _estadoConservacao,
        'dataAquisicao': DateTime.now().toIso8601String().split('T')[0],
        'quantidade': 1,
      };

      final result = await _apiService.createAsset(data);
      if (!mounted) return;

      if (result == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bem cadastrado com sucesso!')),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result is String
                  ? 'Erro: $result'
                  : 'Erro ao cadastrar bem. Tente novamente.',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Erro ao cadastrar bem: ${error.toString().replaceFirst('Exception: ', '')}',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _continueForm() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_currentStep == 2) {
      _submit();
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _currentStep++);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_formScrollController.hasClients) {
        _formScrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _previousStep() {
    FocusScope.of(context).unfocus();
    setState(() => _currentStep--);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_formScrollController.hasClients) {
        _formScrollController.jumpTo(0);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isCatalogLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Cadastrar Bem')),
        body: _buildCatalogLoadingState(),
      );
    }

    if (_catalogError != null &&
        (_secretarias.isEmpty || _categorias.isEmpty)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Cadastrar Bem')),
        body: _buildCatalogErrorState(),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Novo Bem')),
      body: SingleChildScrollView(
        controller: _formScrollController,
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Etapa ${_currentStep + 1} de 3 · ${['Identificar bem', 'Local e responsável', 'Complementos'][_currentStep]}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(value: (_currentStep + 1) / 3),
              const SizedBox(height: 20),
              if (_currentStep == 2) ...[
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
                const SizedBox(height: 24),
              ],

              if (_currentStep == 0) ...[
                // Tipo de Patrimônio
                const Text(
                  'Tipo de Patrimônio',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                RadioGroup<String>(
                  groupValue: _patrimonioTipo,
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => _patrimonioTipo = value);
                    }
                  },
                  child: Row(
                    children: [
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text(
                            'Provisório',
                            style: TextStyle(fontSize: 14),
                          ),
                          value: 'provisorio',
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text(
                            'Definitivo',
                            style: TextStyle(fontSize: 14),
                          ),
                          value: 'definitivo',
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ],
                  ),
                ),

                if (_patrimonioTipo == 'definitivo')
                  TextFormField(
                    controller: _numeroController,
                    keyboardType: TextInputType.text,
                    decoration: const InputDecoration(
                      labelText: 'Número Patrimônio',
                      border: OutlineInputBorder(),
                      hintText: 'Ex: 12345',
                    ),
                    validator: (v) =>
                        _patrimonioTipo == 'definitivo' &&
                            (v == null || v.isEmpty)
                        ? 'Obrigatório'
                        : null,
                  ),

                if (_patrimonioTipo == 'provisorio') ...[
                  SwitchListTile(
                    title: const Text('Inserir número manualmente?'),
                    value: _isProvisorioManual,
                    onChanged: (val) =>
                        setState(() => _isProvisorioManual = val),
                    contentPadding: EdgeInsets.zero,
                  ),
                  if (_isProvisorioManual)
                    Row(
                      children: [
                        SizedBox(
                          width: 100,
                          child: TextFormField(
                            controller: _provisorioAnoController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Ano',
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) =>
                                _patrimonioTipo == 'provisorio' &&
                                    _isProvisorioManual &&
                                    (v == null || v.isEmpty)
                                ? 'Obri.'
                                : null,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: TextFormField(
                            controller: _provisorioManualController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Número Provisório',
                              border: OutlineInputBorder(),
                              prefixText: 'PROV-',
                            ),
                            validator: (v) =>
                                _patrimonioTipo == 'provisorio' &&
                                    _isProvisorioManual &&
                                    (v == null || v.isEmpty)
                                ? 'Obrigatório'
                                : null,
                          ),
                        ),
                      ],
                    )
                  else
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.amber.withValues(alpha: 0.5),
                        ),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.info_outline, color: Colors.amber),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Número provisório será gerado automaticamente.',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],

                const SizedBox(height: 16),

                TextFormField(
                  controller: _descricaoController,
                  decoration: const InputDecoration(
                    labelText: 'Descrição',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      v == null || v.isEmpty ? 'Obrigatório' : null,
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
              ],

              if (_currentStep == 2) ...[
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
                const SizedBox(height: 24),
              ],

              if (_currentStep == 1) ...[
                const Text(
                  'Localização',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 8),

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
                        (s) => s['id'] == val,
                      )['nome'];
                      _selectedDepartamentoId = null;
                      _selectedDepartamentoName = null;
                      _selectedSalaId = null;
                      _selectedSalaName = null;
                      _departamentos = [];
                      _salas = [];
                    });
                    if (val != null) _loadDepartamentos(val);
                  },
                  validator: (v) => v == null ? 'Obrigatório' : null,
                ),
                const SizedBox(height: 16),

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
                            _selectedDepartamentoName = _departamentos
                                .firstWhere((d) => d['id'] == val)['nome'];
                            _selectedSalaId = null;
                            _selectedSalaName = null;
                            _salas = [];
                          });
                          _loadSalas(val);
                        },
                  validator: (v) => v == null ? 'Obrigatório' : null,
                ),
                const SizedBox(height: 16),

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
                              (s) => s['id'] == val,
                            )['nome'];
                          });
                        },
                  validator: (v) => v == null ? 'Obrigatório' : null,
                ),
                const SizedBox(height: 24),

                TextFormField(
                  controller: _responsavelController,
                  decoration: const InputDecoration(
                    labelText: 'Nome do Responsável (Manual)',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      v == null || v.isEmpty ? 'Responsável obrigatório' : null,
                ),
                const SizedBox(height: 8),

                SearchableDropdown<String>(
                  selectedValue: _selectedResponsavel,
                  label: 'Ou Selecione o Responsável',
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
              ],

              if (_currentStep == 2) ...[
                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _valorController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Valor (R\$)',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: TextFormField(
                        controller: _tempoGarantiaController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Garantia (meses)',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                DropdownButtonFormField<String>(
                  initialValue: _estadoConservacao,
                  decoration: const InputDecoration(
                    labelText: 'Estado de Conservação',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'novo', child: Text('Novo')),
                    DropdownMenuItem(value: 'bom', child: Text('Bom')),
                    DropdownMenuItem(value: 'regular', child: Text('Regular')),
                    DropdownMenuItem(value: 'ruim', child: Text('Ruim')),
                    DropdownMenuItem(
                      value: 'inoperante',
                      child: Text('Inoperante'),
                    ),
                  ],
                  onChanged: (v) => setState(() => _estadoConservacao = v!),
                ),
              ],

              const SizedBox(height: 32),

              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24.0),
                  child: Row(
                    children: [
                      if (_currentStep > 0) ...[
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _isLoading ? null : _previousStep,
                            icon: const Icon(Icons.arrow_back),
                            label: const Text('Voltar'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 15),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        flex: _currentStep == 0 ? 1 : 2,
                        child: ElevatedButton.icon(
                          onPressed: _isLoading ? null : _continueForm,
                          icon: _isLoading
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Icon(
                                  _currentStep == 2
                                      ? Icons.check
                                      : Icons.arrow_forward,
                                ),
                          label: Text(
                            _currentStep == 2 ? 'Cadastrar bem' : 'Continuar',
                          ),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 15),
                          ),
                        ),
                      ),
                    ],
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
    _formScrollController.dispose();
    _descricaoController.dispose();
    _categoriaController.dispose();
    _grupoController.dispose();
    _fornecedorController.dispose();
    _marcaController.dispose();
    _responsavelController.dispose();
    _tempoGarantiaController.dispose();
    _valorController.dispose();
    _modeloController.dispose();
    _serieController.dispose();
    _numeroController.dispose();
    _provisorioManualController.dispose();
    _provisorioAnoController.dispose();
    super.dispose();
  }
}

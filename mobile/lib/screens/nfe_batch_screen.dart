import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:sis_patrimonio_mobile/models/nfe_import.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class NfeBatchScreen extends StatefulWidget {
  const NfeBatchScreen({super.key});

  @override
  State<NfeBatchScreen> createState() => _NfeBatchScreenState();
}

class _NfeBatchScreenState extends State<NfeBatchScreen> {
  final ApiService _api = ApiService();
  final ImagePicker _imagePicker = ImagePicker();
  final TextEditingController _supplier = TextEditingController();
  final TextEditingController _responsible = TextEditingController();
  final TextEditingController _position = TextEditingController();
  final List<Map<String, dynamic>> _secretarias = [];
  final List<Map<String, dynamic>> _categories = [];

  NfeInvoice? _invoice;
  List<NfeItem> _items = [];
  String? _xmlFileName;
  String? _pdfDataUrl;
  String? _secretary;
  String? _department;
  String? _room;
  String? _error;
  String _assetType = 'provisorio';
  String _entryType = 'compra';
  int _step = 0;
  bool _loadingCatalogs = true;
  bool _busy = false;

  int get _assetCount => _items.fold(0, (sum, item) => sum + item.quantity);
  double get _itemsTotal =>
      _items.fold(0, (sum, item) => sum + item.totalValue);

  Map<String, dynamic>? get _selectedSecretary => _secretarias
      .where((row) => row['nome']?.toString() == _secretary)
      .firstOrNull;

  List<Map<String, dynamic>> get _departments =>
      (_selectedSecretary?['departamentos'] as List? ?? const [])
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();

  Map<String, dynamic>? get _selectedDepartment => _departments
      .where((row) => row['nome']?.toString() == _department)
      .firstOrNull;

  List<String> get _rooms {
    final raw = _selectedDepartment?['salas'] as List? ?? const [];
    return raw
        .map((room) => room is Map ? room['nome']?.toString() : room.toString())
        .whereType<String>()
        .where((room) => room.isNotEmpty)
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _loadCatalogs();
  }

  Future<void> _loadCatalogs() async {
    try {
      final results = await Future.wait([
        _api.getSecretarias(forceRefresh: true),
        _api.getCategorias(forceRefresh: true),
      ]);
      if (!mounted) return;
      setState(() {
        _secretarias
          ..clear()
          ..addAll(results[0]);
        _categories
          ..clear()
          ..addAll(results[1]);
        _loadingCatalogs = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingCatalogs = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _pickXml() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['xml'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      final file = result.files.single;
      final bytes = file.bytes;
      if (bytes == null) {
        throw const FormatException('Não foi possível ler o conteúdo do XML.');
      }
      if (bytes.length > 5 * 1024 * 1024) {
        throw const FormatException('O XML deve ter no máximo 5 MB.');
      }
      String xml;
      try {
        xml = utf8.decode(bytes);
      } on FormatException {
        xml = latin1.decode(bytes);
      }
      final parsed = NfeImport.parse(xml);
      if (!mounted) return;
      setState(() {
        _invoice = parsed.invoice;
        _items = parsed.items;
        _supplier.text = parsed.invoice.supplierName;
        _xmlFileName = file.name;
        _error = null;
        _step = 1;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error.toString().replaceFirst('FormatException: ', ''),
      );
    }
  }

  Future<void> _pickPdf() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      final file = result.files.single;
      final bytes = file.bytes;
      if (bytes == null) {
        throw const FormatException('Não foi possível ler o conteúdo do PDF.');
      }
      if (bytes.length > 8 * 1024 * 1024) {
        throw const FormatException('O PDF deve ter no máximo 8 MB.');
      }
      if (bytes.length < 5 || ascii.decode(bytes.take(5).toList()) != '%PDF-') {
        throw const FormatException(
          'O arquivo selecionado não parece ser um PDF válido.',
        );
      }
      setState(
        () =>
            _pdfDataUrl = 'data:application/pdf;base64,${base64Encode(bytes)}',
      );
    } catch (error) {
      if (mounted) {
        _showMessage(error.toString().replaceFirst('FormatException: ', ''));
      }
    }
  }

  Future<void> _pickItemPhoto(int index) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Tirar foto'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Escolher da galeria'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    try {
      final image = await _imagePicker.pickImage(
        source: source,
        imageQuality: 68,
        maxWidth: 1100,
      );
      if (image == null) return;
      final bytes = await image.readAsBytes();
      final extension = image.name.toLowerCase().split('.').last;
      final mime = extension == 'png' ? 'image/png' : 'image/jpeg';
      _updateItem(
        index,
        _items[index].copyWith(
          imageDataUrl: 'data:$mime;base64,${base64Encode(bytes)}',
        ),
      );
    } catch (error) {
      if (mounted) _showMessage('Não foi possível obter a foto: $error');
    }
  }

  void _updateItem(int index, NfeItem item) {
    setState(() => _items[index] = item);
  }

  void _addManualItem() {
    setState(() {
      _items.add(
        const NfeItem(
          description: '',
          originalDescription: '',
          quantity: 1,
          unitValue: 0,
          totalValue: 0,
          ncm: '',
          cfop: '',
          unit: 'UN',
          suggestedCategory: '',
        ),
      );
    });
  }

  Future<void> _continueFromItems() async {
    final invalid = <String>[];
    for (var index = 0; index < _items.length; index++) {
      final item = _items[index];
      if (item.description.trim().isEmpty) {
        invalid.add('Item ${index + 1}: informe a descrição.');
      }
      if ((item.category ?? item.suggestedCategory).isEmpty) {
        invalid.add('Item ${index + 1}: selecione uma categoria.');
      }
      if (item.imageDataUrl == null) {
        invalid.add('Item ${index + 1}: adicione uma foto.');
      }
    }
    if (_items.isEmpty) {
      invalid.add('Adicione ao menos um item à nota.');
    }
    if (_assetCount > 100) {
      invalid.add('O lote pode conter no máximo 100 bens por envio.');
    }
    if (invalid.isNotEmpty) {
      _showMessage(invalid.take(3).join('\n'));
      return;
    }
    setState(() {
      _step = 2;
      _error = null;
    });
  }

  Future<void> _confirmBatch() async {
    if (_loadingCatalogs) {
      _showMessage('Aguarde o carregamento dos locais e categorias.');
      return;
    }
    if (_secretary == null || _department == null || _room == null) {
      _showMessage('Selecione secretaria, departamento e sala.');
      return;
    }
    if (_responsible.text.trim().isEmpty || _position.text.trim().isEmpty) {
      _showMessage('Informe o responsável e o cargo.');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar entrada em lote?'),
        content: Text(
          'Serão cadastrados $_assetCount bens no local $_room, em ${_items.length} tipos de item. Essa ação atualiza o patrimônio e não pode ser desfeita pelo app.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Revisar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Cadastrar $_assetCount bens'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      final issueDate =
          _invoice?.issueDate ??
          DateTime.now().toIso8601String().split('T').first;
      final year = DateTime.tryParse(issueDate)?.year ?? DateTime.now().year;
      final goods = <Map<String, dynamic>>[];
      for (final item in _items) {
        for (var unit = 0; unit < item.quantity; unit++) {
          goods.add({
            'descricao': item.description.trim(),
            'categoria': item.category ?? item.suggestedCategory,
            'grupo': item.group?.trim().isNotEmpty == true
                ? item.group
                : 'Geral',
            'marca': item.brand,
            'modelo': item.model,
            'valor': item.unitValue,
            'localizacao': {
              'secretaria': _secretary,
              'departamento': _department,
              'sala': _room,
            },
            'responsavel': {
              'nome': _responsible.text.trim(),
              'cargo': _position.text.trim(),
            },
            'dataAquisicao': issueDate,
            'estadoConservacao': 'novo',
            'status': 'ativo',
            'observacoes':
                'Importado via NF ${_invoice?.number ?? ''} - Fornecedor: ${_supplier.text.trim()}',
            'patrimonioTipo': _assetType,
            'patrimonio': _assetType == 'definitivo' ? 'PAT-$year-AUTO' : null,
            'patrimonioProvisorio': _assetType == 'provisorio'
                ? 'PROV-$year-AUTO'
                : null,
            'patrimonioAutoGerado': true,
            'imagem': item.imageDataUrl,
            'fornecedor': _supplier.text.trim(),
            'notaFiscal': _pdfDataUrl,
            'tipoEntrada': _entryType,
          });
        }
      }
      final result = await _api.createAssetsBatch(goods);
      if (!mounted) return;
      final count =
          int.tryParse(result['count']?.toString() ?? '') ?? goods.length;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.check_circle_outline, color: Colors.green),
          title: const Text('Entrada concluída'),
          content: Text('$count bens foram cadastrados com sucesso.'),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Concluir'),
            ),
          ],
        ),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
        _showMessage(_error!);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 5)),
    );
  }

  @override
  void dispose() {
    _supplier.dispose();
    _responsible.dispose();
    _position.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Entrada por nota fiscal'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Row(
              children: List.generate(3, (index) {
                final active = index <= _step;
                return Expanded(
                  child: Container(
                    height: 5,
                    margin: EdgeInsets.only(right: index == 2 ? 0 : 8),
                    decoration: BoxDecoration(
                      color: active
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(
                              context,
                            ).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: switch (_step) {
                0 => _buildImportStep(),
                1 => _buildItemsStep(),
                _ => _buildDestinationStep(),
              },
            ),
            _buildNavigation(),
          ],
        ),
      ),
    );
  }

  Widget _buildImportStep() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Text(
        '1 de 3 · Importar XML',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 8),
      const Text(
        'Selecione o XML oficial da NF-e. O processamento acontece no aparelho; confira os dados antes de cadastrar os bens.',
      ),
      const SizedBox(height: 20),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const Icon(Icons.description_outlined, size: 48),
              const SizedBox(height: 12),
              Text(
                _xmlFileName ?? 'Nenhuma NF-e selecionada',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: _busy ? null : _pickXml,
                icon: const Icon(Icons.upload_file),
                label: const Text('Selecionar arquivo XML'),
              ),
            ],
          ),
        ),
      ),
      if (_invoice != null) ...[const SizedBox(height: 12), _invoiceSummary()],
      if (_error != null) ...[const SizedBox(height: 12), _errorCard()],
      const SizedBox(height: 8),
      const Text(
        'O arquivo deve estar no formato XML padrão SEFAZ e ter até 5 MB.',
      ),
    ],
  );

  Widget _invoiceSummary() => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'NF ${_invoice!.number} · Série ${_invoice!.series}',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            _invoice!.supplierName.isEmpty
                ? 'Fornecedor não identificado'
                : _invoice!.supplierName,
          ),
          if (_invoice!.supplierDocument.isNotEmpty)
            Text('CNPJ/CPF: ${_invoice!.supplierDocument}'),
          Text('${_items.length} tipos de item · $_assetCount bens'),
          Text('Total da nota: ${_money(_invoice!.totalValue)}'),
        ],
      ),
    ),
  );

  Widget _buildItemsStep() => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '2 de 3 · Revisar $_assetCount bens',
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            Text(_money(_itemsTotal)),
          ],
        ),
      ),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text(
            'A foto e a categoria são obrigatórias para cada tipo de item. A quantidade cria bens separados.',
          ),
        ),
      ),
      Expanded(
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
          itemCount: _items.length,
          itemBuilder: (context, index) => _itemCard(index),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        child: OutlinedButton.icon(
          onPressed: _addManualItem,
          icon: const Icon(Icons.add),
          label: const Text('Adicionar item que não veio no XML'),
        ),
      ),
    ],
  );

  Widget _itemCard(int index) {
    final item = _items[index];
    final category = item.category ?? item.suggestedCategory;
    final categoryExists = _categories.any(
      (row) => row['slug']?.toString() == category,
    );
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: ExpansionTile(
        // ExpansionTile stores its expanded flag in PageStorage. Descendant
        // TextFormFields also own Scrollables; sharing a PageStorageKey here
        // makes those Scrollables try to restore that bool as a scroll offset.
        key: ValueKey('nfe-item-$index'),
        leading: CircleAvatar(child: Text('${index + 1}')),
        title: Text(
          item.description.isEmpty ? 'Novo item' : item.description,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${item.quantity} un. · ${_money(item.totalValue)}${item.ncm.isEmpty ? '' : ' · NCM ${item.ncm}'}',
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          if (item.originalDescription.isNotEmpty &&
              item.description != item.originalDescription)
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Descrição original: ${item.originalDescription}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          TextFormField(
            key: ValueKey('nfe-desc-$index'),
            initialValue: item.description,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Descrição do bem'),
            onChanged: (value) =>
                _updateItem(index, item.copyWith(description: value)),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            key: ValueKey('nfe-category-$index'),
            initialValue: categoryExists ? category : null,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Categoria *'),
            items: _categories
                .where((row) => row['slug'] != null)
                .map(
                  (row) => DropdownMenuItem<String>(
                    value: row['slug'].toString(),
                    child: Text(
                      row['nome']?.toString() ?? row['slug'].toString(),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value != null) {
                _updateItem(index, item.copyWith(category: value));
              }
            },
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: ValueKey('nfe-qty-$index'),
                  initialValue: '${item.quantity}',
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText:
                        'Quantidade (${item.unit.isEmpty ? 'un.' : item.unit})',
                  ),
                  onChanged: (value) {
                    final quantity = int.tryParse(value);
                    if (quantity != null && quantity > 0 && quantity <= 99999) {
                      _updateItem(index, item.copyWith(quantity: quantity));
                    }
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  key: ValueKey('nfe-value-$index'),
                  initialValue: item.unitValue.toStringAsFixed(2),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Valor unitário (R\$)',
                  ),
                  onChanged: (value) {
                    final amount = double.tryParse(value.replaceAll(',', '.'));
                    if (amount != null && amount >= 0) {
                      _updateItem(index, item.copyWith(unitValue: amount));
                    }
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextFormField(
            key: ValueKey('nfe-brand-$index'),
            initialValue: item.brand,
            decoration: const InputDecoration(labelText: 'Marca (opcional)'),
            onChanged: (value) =>
                _updateItem(index, item.copyWith(brand: value)),
          ),
          const SizedBox(height: 8),
          TextFormField(
            key: ValueKey('nfe-model-$index'),
            initialValue: item.model,
            decoration: const InputDecoration(labelText: 'Modelo (opcional)'),
            onChanged: (value) =>
                _updateItem(index, item.copyWith(model: value)),
          ),
          const SizedBox(height: 12),
          if (item.imageDataUrl != null)
            Stack(
              alignment: Alignment.topRight,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.memory(
                    base64Decode(item.imageDataUrl!.split(',').last),
                    height: 170,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: () =>
                      _updateItem(index, item.copyWith(removeImage: true)),
                  icon: const Icon(Icons.close),
                  tooltip: 'Remover foto',
                ),
              ],
            )
          else
            Container(
              height: 104,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: Border.all(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text('Foto obrigatória para este item'),
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _pickItemPhoto(index),
            icon: const Icon(Icons.add_a_photo_outlined),
            label: Text(
              item.imageDataUrl == null ? 'Adicionar foto' : 'Trocar foto',
            ),
          ),
          if (item.originalDescription.isEmpty)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => setState(() => _items.removeAt(index)),
                icon: const Icon(Icons.delete_outline),
                label: const Text('Remover item'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDestinationStep() {
    if (_loadingCatalogs) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_secretarias.isEmpty || _categories.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error ?? 'Não foi possível carregar locais e categorias.'),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _loadCatalogs,
                icon: const Icon(Icons.refresh),
                label: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          '3 de 3 · Destino e confirmação',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _invoiceSummary(),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _assetType,
          decoration: const InputDecoration(labelText: 'Tipo de patrimônio'),
          items: const [
            DropdownMenuItem(
              value: 'provisorio',
              child: Text('Provisório (recomendado)'),
            ),
            DropdownMenuItem(value: 'definitivo', child: Text('Definitivo')),
          ],
          onChanged: (value) =>
              setState(() => _assetType = value ?? 'provisorio'),
        ),
        const SizedBox(height: 8),
        Text(
          _assetType == 'provisorio'
              ? 'O servidor atribuirá números provisórios únicos automaticamente.'
              : 'O servidor atribuirá a próxima sequência definitiva disponível.',
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _entryType,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Tipo de entrada'),
          items: const [
            DropdownMenuItem(value: 'compra', child: Text('Compra')),
            DropdownMenuItem(value: 'aquisicao', child: Text('Aquisição')),
            DropdownMenuItem(value: 'doacao', child: Text('Doação')),
            DropdownMenuItem(
              value: 'transferencia',
              child: Text('Transferência'),
            ),
            DropdownMenuItem(value: 'comodato', child: Text('Comodato')),
            DropdownMenuItem(value: 'cessao', child: Text('Cessão')),
            DropdownMenuItem(value: 'permuta', child: Text('Permuta')),
            DropdownMenuItem(value: 'outro', child: Text('Outro')),
          ],
          onChanged: (value) => setState(() => _entryType = value ?? 'compra'),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _supplier,
          decoration: const InputDecoration(
            labelText: 'Fornecedor',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          key: ValueKey('secretary-$_secretary'),
          initialValue: _secretary,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Secretaria *'),
          items: _secretarias.map((row) {
            final name = row['nome']?.toString() ?? '';
            return DropdownMenuItem(
              value: name,
              child: Text(name, overflow: TextOverflow.ellipsis),
            );
          }).toList(),
          onChanged: (value) => setState(() {
            _secretary = value;
            _department = null;
            _room = null;
          }),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          key: ValueKey('department-$_secretary-$_department'),
          initialValue: _department,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Departamento *'),
          items: _departments.map((row) {
            final name = row['nome']?.toString() ?? '';
            return DropdownMenuItem(
              value: name,
              child: Text(name, overflow: TextOverflow.ellipsis),
            );
          }).toList(),
          onChanged: _secretary == null
              ? null
              : (value) => setState(() {
                  _department = value;
                  _room = null;
                }),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          key: ValueKey('room-$_department-$_room'),
          initialValue: _room,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Sala *'),
          items: _rooms
              .map(
                (name) => DropdownMenuItem(
                  value: name,
                  child: Text(name, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: _department == null
              ? null
              : (value) => setState(() => _room = value),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _responsible,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(
            labelText: 'Responsável *',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _position,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(
            labelText: 'Cargo do responsável *',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _pickPdf,
          icon: Icon(
            _pdfDataUrl == null
                ? Icons.picture_as_pdf_outlined
                : Icons.check_circle_outline,
          ),
          label: Text(
            _pdfDataUrl == null
                ? 'Anexar PDF da nota (opcional)'
                : 'PDF anexado · tocar para trocar',
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: const Icon(Icons.inventory_2_outlined),
            title: Text('$_assetCount bens · ${_items.length} tipos de item'),
            subtitle: Text(
              '${_money(_itemsTotal)} em produtos · '
              '${_secretary ?? 'Selecione a secretaria'} / '
              '${_department ?? 'selecione o departamento'} / '
              '${_room ?? 'selecione a sala'}',
            ),
          ),
        ),
        if (_error != null) ...[const SizedBox(height: 8), _errorCard()],
      ],
    );
  }

  Widget _errorCard() => Card(
    color: Theme.of(context).colorScheme.errorContainer,
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Text(
        _error!,
        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
      ),
    ),
  );

  Widget _buildNavigation() => SafeArea(
    top: false,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(
        children: [
          if (_step > 0)
            OutlinedButton.icon(
              onPressed: _busy ? null : () => setState(() => _step--),
              icon: const Icon(Icons.arrow_back),
              label: const Text('Voltar'),
            ),
          const Spacer(),
          if (_step == 0)
            FilledButton.icon(
              onPressed: _invoice == null
                  ? null
                  : () => setState(() => _step = 1),
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Revisar itens'),
            )
          else if (_step == 1)
            FilledButton.icon(
              onPressed: _continueFromItems,
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Definir destino'),
            )
          else
            FilledButton.icon(
              onPressed: _busy ? null : _confirmBatch,
              icon: _busy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.inventory_2_outlined),
              label: Text(
                _busy ? 'Cadastrando…' : 'Confirmar e cadastrar $_assetCount',
              ),
            ),
        ],
      ),
    ),
  );

  String _money(double value) =>
      'R\$ ${value.toStringAsFixed(2).replaceAll('.', ',')}';
}

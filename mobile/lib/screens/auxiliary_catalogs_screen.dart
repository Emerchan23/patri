import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class AuxiliaryCatalogsScreen extends StatefulWidget {
  final ApiService? apiService;

  const AuxiliaryCatalogsScreen({super.key, this.apiService});

  @override
  State<AuxiliaryCatalogsScreen> createState() =>
      _AuxiliaryCatalogsScreenState();
}

class _AuxiliaryCatalogsScreenState extends State<AuxiliaryCatalogsScreen>
    with SingleTickerProviderStateMixin {
  late final ApiService _api;
  final TextEditingController _name = TextEditingController();
  final TextEditingController _search = TextEditingController();
  late final TabController _tabs;
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  int _loadVersion = 0;

  static const _catalogs = [
    'categorias',
    'marcas',
    'secretarias',
    'fornecedores',
  ];
  static const _titles = [
    'Categorias',
    'Marcas',
    'Secretarias',
    'Fornecedores',
  ];

  String get _catalog => _catalogs[_tabs.index];

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _tabs = TabController(length: _catalogs.length, vsync: this)
      ..addListener(_onTabChanged);
    _load();
  }

  void _onTabChanged() {
    if (!_tabs.indexIsChanging) {
      _search.clear();
      _load();
    }
  }

  Future<List<Map<String, dynamic>>> _fetch(String catalog) async {
    return switch (catalog) {
      'categorias' => _api.getCategorias(forceRefresh: true),
      'marcas' => _api.getMarcas(forceRefresh: true),
      'secretarias' => _api.getSecretarias(forceRefresh: true),
      'fornecedores' => _api.getFornecedores(forceRefresh: true),
      _ => const [],
    };
  }

  Future<void> _load() async {
    final version = ++_loadVersion;
    final catalog = _catalog;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _fetch(catalog);
      if (!mounted) return;
      if (version != _loadVersion) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      if (version != _loadVersion) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
        _items = const [];
        _loading = false;
      });
    }
  }

  Future<void> _create() async {
    if (_catalog == 'fornecedores') {
      await _manageSupplier();
      return;
    }
    final name = _name.text.trim();
    if (name.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Informe um nome com pelo menos 2 letras.'),
        ),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await _api.createAuxiliaryCatalogItem(catalog: _catalog, name: name);
      _name.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_titles[_tabs.index]} cadastrado com sucesso.'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _createLocationChild({
    required String parentCatalog,
    required String parentId,
    required String parentName,
    required String childCatalog,
  }) async {
    final noun = _singularTitle(childCatalog);
    final name = await showDialog<String>(
      context: context,
      builder: (_) => _CatalogNameDialog(
        title: 'Novo(a) $noun',
        helperText: 'Em: $parentName',
        submitLabel: 'Cadastrar',
      ),
    );
    if (name == null) return;
    if (name.length < 2) {
      _showMessage('Informe um nome com pelo menos 2 letras.');
      return;
    }
    await _performCatalogAction(
      () => _api.createAuxiliaryLocationChild(
        parentCatalog: parentCatalog,
        parentId: parentId,
        name: name,
      ),
      '${_singularTitle(childCatalog)} cadastrado(a) com sucesso.',
    );
  }

  Future<void> _edit(Map<String, dynamic> item, {String? catalog}) async {
    final itemCatalog = catalog ?? _catalog;
    if (itemCatalog == 'fornecedores') {
      await _manageSupplier(supplier: item);
      return;
    }
    final id = item['id']?.toString();
    if (id == null || id.isEmpty) {
      _showMessage('Este registro não possui um identificador para edição.');
      return;
    }
    final name = await showDialog<String>(
      context: context,
      builder: (_) => _CatalogNameDialog(
        title: 'Editar ${_singularTitle(itemCatalog)}',
        initialValue: item['nome']?.toString() ?? '',
        submitLabel: 'Salvar',
      ),
    );
    if (name == null) return;
    if (name.length < 2) {
      _showMessage('Informe um nome com pelo menos 2 letras.');
      return;
    }
    await _performCatalogAction(
      () => _api.updateAuxiliaryCatalogItem(
        catalog: itemCatalog,
        id: id,
        name: name,
      ),
      '${_singularTitle(itemCatalog)} atualizado com sucesso.',
    );
  }

  Future<void> _delete(Map<String, dynamic> item, {String? catalog}) async {
    final itemCatalog = catalog ?? _catalog;
    final id = item['id']?.toString();
    final name = item['nome']?.toString() ?? 'este registro';
    if (id == null || id.isEmpty) {
      _showMessage('Este registro não possui um identificador para exclusão.');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Excluir ${_singularTitle(itemCatalog)}?'),
        content: Text(
          'O registro "$name" será removido. Se estiver vinculado a bens, '
          'o sistema bloqueará a exclusão.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton.tonal(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _performCatalogAction(
      () => itemCatalog == 'fornecedores'
          ? _api.deleteFornecedor(id)
          : _api.deleteAuxiliaryCatalogItem(catalog: itemCatalog, id: id),
      '${_singularTitle(itemCatalog)} excluído(a).',
    );
  }

  Future<void> _manageSupplier({Map<String, dynamic>? supplier}) async {
    final values = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => _SupplierDialog(supplier: supplier),
    );
    if (values == null) return;
    final digits = (values['cnpj'] ?? '').replaceAll(RegExp(r'\D'), '');
    if ((values['nome'] ?? '').length < 2 ||
        ![11, 14].contains(digits.length)) {
      _showMessage('Informe nome e CPF/CNPJ com 11 ou 14 dígitos.');
      return;
    }
    final id = supplier?['id']?.toString();
    await _performCatalogAction(
      () => id == null
          ? _api.createFornecedor(values)
          : _api.updateFornecedor(id: id, supplier: values),
      id == null
          ? 'Fornecedor cadastrado com sucesso.'
          : 'Fornecedor atualizado com sucesso.',
    );
  }

  Future<void> _performCatalogAction(
    Future<void> Function() action,
    String successMessage,
  ) async {
    final catalog = _catalog;
    setState(() => _saving = true);
    try {
      await action();
      await _load();
      if (mounted) _showMessage(successMessage);
    } catch (error) {
      if (mounted) {
        _showMessage(error.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
    // Keep the current tab visible if a slow response returned after a swipe.
    if (mounted && catalog != _catalog) _load();
  }

  String _singularTitle([String? catalog]) => switch (catalog ?? _catalog) {
    'categorias' => 'categoria',
    'marcas' => 'marca',
    'secretarias' => 'secretaria',
    'departamentos' => 'departamento',
    'salas' => 'sala',
    'fornecedores' => 'fornecedor',
    _ => 'registro',
  };

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    _tabs.removeListener(_onTabChanged);
    _tabs.dispose();
    _name.dispose();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final search = _search.text.trim().toLowerCase();
    final visibleItems = _items
        .where((item) => _matchesSearch(item, search))
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cadastros auxiliares'),
        actions: [
          IconButton(
            tooltip: 'Atualizar lista',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: _titles.map((title) => Tab(text: title)).toList(),
        ),
      ),
      body: Column(
        children: [
          if (_catalog == 'fornecedores')
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Card(
                child: ListTile(
                  leading: const Icon(Icons.business_outlined),
                  title: const Text('Fornecedores'),
                  subtitle: const Text(
                    'Cadastre e mantenha os dados cadastrais do fornecedor.',
                  ),
                  trailing: IconButton.filledTonal(
                    tooltip: 'Novo fornecedor',
                    onPressed: _saving ? null : _create,
                    icon: const Icon(Icons.add),
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _create(),
                      decoration: InputDecoration(
                        labelText:
                            'Novo(a) ${_titles[_tabs.index].toLowerCase().replaceFirst(RegExp(r's$'), '')}',
                        border: const OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _saving ? null : _create,
                    child: _saving
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.add),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                labelText: _catalog == 'secretarias'
                    ? 'Buscar secretaria, departamento ou sala'
                    : 'Buscar ${_titles[_tabs.index].toLowerCase()}',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Limpar busca',
                        onPressed: () => setState(_search.clear),
                        icon: const Icon(Icons.close),
                      ),
                border: const OutlineInputBorder(),
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  TextButton.icon(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Tentar novamente'),
                  ),
                ],
              ),
            )
          else if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (visibleItems.isEmpty)
            const Expanded(
              child: Center(child: Text('Nenhum registro encontrado.')),
            )
          else
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: visibleItems.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 6),
                  itemBuilder: (context, index) =>
                      _catalogItemTile(visibleItems[index]),
                ),
              ),
            ),
        ],
      ),
    );
  }

  bool _matchesSearch(Map<String, dynamic> item, String search) {
    if (search.isEmpty) return true;
    bool includesName(Map row) =>
        row['nome']?.toString().toLowerCase().contains(search) ?? false;
    if (includesName(item)) return true;
    if (_catalog == 'fornecedores') {
      for (final field in ['cnpj', 'cidade', 'razao_social', 'nome_fantasia']) {
        if (item[field]?.toString().toLowerCase().contains(search) ?? false) {
          return true;
        }
      }
      return false;
    }
    if (_catalog != 'secretarias') return false;
    final departments = item['departamentos'] as List? ?? const [];
    for (final department in departments.whereType<Map>()) {
      if (includesName(department)) return true;
      final rooms = department['salas'] as List? ?? const [];
      if (rooms.whereType<Map>().any(includesName)) return true;
    }
    return false;
  }

  Widget _catalogItemTile(Map<String, dynamic> item) {
    if (_catalog == 'secretarias') return _secretariatTile(item);
    if (_catalog == 'fornecedores') return _supplierTile(item);
    return _simpleCatalogTile(item, catalog: _catalog);
  }

  Widget _supplierTile(Map<String, dynamic> supplier) => ListTile(
    leading: const CircleAvatar(child: Icon(Icons.business_outlined)),
    title: Text(
      (supplier['nome_fantasia'] ?? supplier['nome'] ?? 'Fornecedor')
          .toString(),
    ),
    subtitle: Text(
      [
        supplier['cnpj']?.toString(),
        supplier['cidade']?.toString(),
        supplier['estado']?.toString(),
      ].where((value) => value != null && value.trim().isNotEmpty).join(' · '),
    ),
    trailing: _actionsMenu(
      onEdit: () => _edit(supplier, catalog: 'fornecedores'),
      onDelete: () => _delete(supplier, catalog: 'fornecedores'),
    ),
    tileColor: Theme.of(context).colorScheme.surfaceContainerLow,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  );

  Widget _simpleCatalogTile(
    Map<String, dynamic> item, {
    required String catalog,
    IconData icon = Icons.category_outlined,
  }) => ListTile(
    leading: CircleAvatar(child: Icon(icon)),
    title: Text(item['nome']?.toString() ?? 'Sem nome'),
    trailing: _actionsMenu(
      onEdit: () => _edit(item, catalog: catalog),
      onDelete: () => _delete(item, catalog: catalog),
    ),
    tileColor: Theme.of(context).colorScheme.surfaceContainerLow,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  );

  Widget _secretariatTile(Map<String, dynamic> secretaria) {
    final id = secretaria['id']?.toString() ?? '';
    final name = secretaria['nome']?.toString() ?? 'Sem nome';
    final departments = (secretaria['departamentos'] as List? ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    return Card(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        key: ValueKey('secretariat-$id'),
        leading: const CircleAvatar(
          child: Icon(Icons.account_balance_outlined),
        ),
        title: Text(name),
        subtitle: _departmentCount(departments),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.expand_more),
            _actionsMenu(
              onEdit: () => _edit(secretaria, catalog: 'secretarias'),
              onDelete: () => _delete(secretaria, catalog: 'secretarias'),
            ),
          ],
        ),
        children: [
          ListTile(
            title: const Text('Departamentos'),
            trailing: IconButton(
              tooltip: 'Adicionar departamento',
              onPressed: _saving || id.isEmpty
                  ? null
                  : () => _createLocationChild(
                      parentCatalog: 'secretarias',
                      parentId: id,
                      parentName: name,
                      childCatalog: 'departamentos',
                    ),
              icon: const Icon(Icons.add_circle_outline),
            ),
          ),
          if (departments.isEmpty)
            const ListTile(
              dense: true,
              title: Text('Nenhum departamento cadastrado.'),
            ),
          for (final department in departments)
            _departmentTile(department, secretariaName: name),
        ],
      ),
    );
  }

  Widget _departmentTile(
    Map<String, dynamic> department, {
    required String secretariaName,
  }) {
    final id = department['id']?.toString() ?? '';
    final name = department['nome']?.toString() ?? 'Sem nome';
    final rooms = (department['salas'] as List? ?? const [])
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
    return ExpansionTile(
      key: ValueKey('department-$id'),
      leading: const Icon(Icons.apartment_outlined),
      title: Text(name),
      subtitle: Text('${rooms.length} ${rooms.length == 1 ? 'sala' : 'salas'}'),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.expand_more),
          _actionsMenu(
            onEdit: () => _edit(department, catalog: 'departamentos'),
            onDelete: () => _delete(department, catalog: 'departamentos'),
          ),
        ],
      ),
      children: [
        ListTile(
          title: const Text('Salas'),
          trailing: IconButton(
            tooltip: 'Adicionar sala',
            onPressed: _saving || id.isEmpty
                ? null
                : () => _createLocationChild(
                    parentCatalog: 'departamentos',
                    parentId: id,
                    parentName: '$secretariaName / $name',
                    childCatalog: 'salas',
                  ),
            icon: const Icon(Icons.add_circle_outline),
          ),
        ),
        if (rooms.isEmpty)
          const ListTile(dense: true, title: Text('Nenhuma sala cadastrada.')),
        for (final room in rooms)
          _simpleCatalogTile(
            room,
            catalog: 'salas',
            icon: Icons.meeting_room_outlined,
          ),
      ],
    );
  }

  Widget _actionsMenu({
    required VoidCallback onEdit,
    required VoidCallback onDelete,
  }) => PopupMenuButton<String>(
    tooltip: 'Ações do registro',
    enabled: !_saving,
    onSelected: (action) {
      if (action == 'edit') onEdit();
      if (action == 'delete') onDelete();
    },
    itemBuilder: (context) => const [
      PopupMenuItem(
        value: 'edit',
        child: ListTile(
          leading: Icon(Icons.edit_outlined),
          title: Text('Editar'),
          contentPadding: EdgeInsets.zero,
        ),
      ),
      PopupMenuItem(
        value: 'delete',
        child: ListTile(
          leading: Icon(Icons.delete_outline),
          title: Text('Excluir'),
          contentPadding: EdgeInsets.zero,
        ),
      ),
    ],
  );

  Widget _departmentCount(List departments) {
    final count = departments.length;
    return Text('$count ${count == 1 ? 'departamento' : 'departamentos'}');
  }
}

class _CatalogNameDialog extends StatefulWidget {
  const _CatalogNameDialog({
    required this.title,
    required this.submitLabel,
    this.initialValue = '',
    this.helperText,
  });

  final String title;
  final String submitLabel;
  final String initialValue;
  final String? helperText;

  @override
  State<_CatalogNameDialog> createState() => _CatalogNameDialogState();
}

class _CatalogNameDialogState extends State<_CatalogNameDialog> {
  late final TextEditingController _name = TextEditingController(
    text: widget.initialValue,
  );

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _submit() => Navigator.pop(context, _name.text.trim());

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.title),
    content: TextField(
      controller: _name,
      autofocus: true,
      textCapitalization: TextCapitalization.words,
      decoration: InputDecoration(
        labelText: 'Nome',
        helperText: widget.helperText,
        border: const OutlineInputBorder(),
      ),
      onSubmitted: (_) => _submit(),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(onPressed: _submit, child: Text(widget.submitLabel)),
    ],
  );
}

class _SupplierDialog extends StatefulWidget {
  const _SupplierDialog({this.supplier});

  final Map<String, dynamic>? supplier;

  @override
  State<_SupplierDialog> createState() => _SupplierDialogState();
}

class _SupplierDialogState extends State<_SupplierDialog> {
  late final Map<String, TextEditingController> _fields;

  @override
  void initState() {
    super.initState();
    final supplier = widget.supplier;
    _fields = {
      'nome': TextEditingController(text: supplier?['nome']?.toString() ?? ''),
      'cnpj': TextEditingController(text: supplier?['cnpj']?.toString() ?? ''),
      'nome_fantasia': TextEditingController(
        text: supplier?['nome_fantasia']?.toString() ?? '',
      ),
      'razao_social': TextEditingController(
        text: supplier?['razao_social']?.toString() ?? '',
      ),
      'estado': TextEditingController(
        text: supplier?['estado']?.toString() ?? '',
      ),
      'cidade': TextEditingController(
        text: supplier?['cidade']?.toString() ?? '',
      ),
      'telefone': TextEditingController(
        text: supplier?['telefone']?.toString() ?? '',
      ),
      'endereco': TextEditingController(
        text: supplier?['endereco']?.toString() ?? '',
      ),
    };
  }

  @override
  void dispose() {
    for (final controller in _fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Widget _field(
    String key,
    String label, {
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.words,
    int? maxLength,
    int maxLines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextField(
      controller: _fields[key],
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      maxLength: maxLength,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        counterText: maxLength == null ? null : '',
      ),
    ),
  );

  Map<String, String> _values() =>
      _fields.map((key, controller) => MapEntry(key, controller.text.trim()));

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.supplier == null ? 'Novo fornecedor' : 'Editar fornecedor',
    ),
    content: SizedBox(
      width: 480,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _field('nome', 'Nome / razão social *'),
            _field('cnpj', 'CNPJ ou CPF *', keyboardType: TextInputType.number),
            _field('nome_fantasia', 'Nome fantasia'),
            _field('razao_social', 'Razão social'),
            Row(
              children: [
                Expanded(flex: 2, child: _field('cidade', 'Cidade')),
                const SizedBox(width: 8),
                Expanded(
                  child: _field(
                    'estado',
                    'UF',
                    textCapitalization: TextCapitalization.characters,
                    maxLength: 2,
                  ),
                ),
              ],
            ),
            _field('telefone', 'Telefone', keyboardType: TextInputType.phone),
            _field('endereco', 'Endereço', maxLines: 2),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, _values()),
        child: Text(widget.supplier == null ? 'Cadastrar' : 'Salvar'),
      ),
    ],
  );
}

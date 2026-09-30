import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class AlienationsScreen extends StatefulWidget {
  const AlienationsScreen({super.key});

  @override
  State<AlienationsScreen> createState() => _AlienationsScreenState();
}

class _AlienationsScreenState extends State<AlienationsScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _api.getAlienations();
      if (!mounted) return;
      setState(() {
        _items = items;
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
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alienações'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.push<bool>(
            context,
            MaterialPageRoute(builder: (_) => const _NewAlienationScreen()),
          );
          if (created == true) _load();
        },
        icon: const Icon(Icons.add),
        label: const Text('Nova alienação'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.cloud_off_outlined,
                      size: 48,
                      color: Colors.red,
                    ),
                    const SizedBox(height: 12),
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              ),
            )
          : _items.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Nenhum processo de alienação encontrado.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) => _AlienationCard(
                  item: _items[index],
                  onTap: () async {
                    final deleted = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => _AlienationDetailScreen(
                          id: _items[index]['id'].toString(),
                        ),
                      ),
                    );
                    if (deleted == true) _load();
                  },
                ),
              ),
            ),
    );
  }
}

class _NewAlienationScreen extends StatefulWidget {
  const _NewAlienationScreen();

  @override
  State<_NewAlienationScreen> createState() => _NewAlienationScreenState();
}

class _NewAlienationScreenState extends State<_NewAlienationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _api = ApiService();
  final _process = TextEditingController();
  final _notice = TextEditingController();
  final _notes = TextEditingController();
  final _search = TextEditingController();
  final _members = List.generate(3, (_) => _CommitteeMemberControllers());
  final Set<String> _selectedIds = {};
  List<Asset> _assets = [];
  String _type = 'doacao';
  DateTime _openingDate = DateTime.now();
  bool _loadingAssets = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAssets();
  }

  @override
  void dispose() {
    _process.dispose();
    _notice.dispose();
    _notes.dispose();
    _search.dispose();
    for (final member in _members) {
      member.dispose();
    }
    super.dispose();
  }

  Future<void> _loadAssets({String? search}) async {
    setState(() {
      _loadingAssets = true;
      _error = null;
    });
    try {
      final result = await _api.getAssets(search: search);
      if (!mounted) return;
      setState(() {
        _assets = result
            .where((asset) => asset.status.toLowerCase() == 'ativo')
            .toList();
        _loadingAssets = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
        _loadingAssets = false;
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Selecione ao menos um bem para o processo.'),
        ),
      );
      return;
    }
    final completedMembers = _members
        .where(
          (member) =>
              member.name.text.trim().isNotEmpty ||
              member.role.text.trim().isNotEmpty,
        )
        .toList();
    if (completedMembers.length < 3 ||
        completedMembers.any(
          (member) =>
              member.name.text.trim().isEmpty ||
              member.role.text.trim().isEmpty,
        )) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Informe nome e cargo dos 3 membros da comissão.'),
        ),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await _api.createAlienation({
        'tipo': _type,
        'numero_processo': _process.text.trim(),
        'numero_edital': _notice.text.trim().isEmpty
            ? null
            : _notice.text.trim(),
        'data_abertura': DateFormat('yyyy-MM-dd').format(_openingDate),
        'observacoes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'comissao': completedMembers
            .asMap()
            .entries
            .map(
              (entry) => {
                'nome': entry.value.name.text.trim(),
                'cargo': entry.value.role.text.trim(),
                'tipo_membro': entry.key == 0 ? 'presidente' : 'membro',
              },
            )
            .toList(),
        'bens': _selectedIds.toList(),
      });
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nova alienação')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
          children: [
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Tipo de alienação'),
              items: const [
                DropdownMenuItem(value: 'leilao', child: Text('Leilão')),
                DropdownMenuItem(value: 'venda', child: Text('Venda direta')),
                DropdownMenuItem(value: 'doacao', child: Text('Doação')),
                DropdownMenuItem(value: 'permuta', child: Text('Permuta')),
                DropdownMenuItem(value: 'descarte', child: Text('Descarte')),
              ],
              onChanged: (value) => setState(() => _type = value ?? _type),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _process,
              decoration: const InputDecoration(
                labelText: 'Número do processo *',
              ),
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Informe o número do processo.'
                  : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notice,
              decoration: const InputDecoration(
                labelText: 'Número do edital (opcional)',
              ),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Data de abertura'),
              subtitle: Text(DateFormat('dd/MM/yyyy').format(_openingDate)),
              trailing: const Icon(Icons.calendar_month_outlined),
              onTap: () async {
                final selected = await showDatePicker(
                  context: context,
                  initialDate: _openingDate,
                  firstDate: DateTime(2000),
                  lastDate: DateTime(2100),
                );
                if (selected != null) setState(() => _openingDate = selected);
              },
            ),
            TextFormField(
              controller: _notes,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Observações'),
            ),
            const SizedBox(height: 20),
            Text(
              'Comissão de avaliação',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const Text('Informe os três membros do processo.'),
            for (var index = 0; index < _members.length; index++) ...[
              const SizedBox(height: 8),
              TextFormField(
                controller: _members[index].name,
                decoration: InputDecoration(
                  labelText: 'Membro ${index + 1} — nome',
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _members[index].role,
                decoration: const InputDecoration(labelText: 'Cargo'),
              ),
            ],
            const SizedBox(height: 20),
            Text(
              'Bens vinculados',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text('${_selectedIds.length} selecionado(s)'),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    decoration: const InputDecoration(
                      hintText: 'Buscar por nome ou patrimônio',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onSubmitted: (value) => _loadAssets(search: value.trim()),
                  ),
                ),
                IconButton(
                  tooltip: 'Buscar bens',
                  onPressed: () => _loadAssets(search: _search.text.trim()),
                  icon: const Icon(Icons.search),
                ),
              ],
            ),
            if (_loadingAssets) const LinearProgressIndicator(),
            if (_error != null) ...[
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              TextButton(
                onPressed: () => _loadAssets(search: _search.text.trim()),
                child: const Text('Tentar novamente'),
              ),
            ],
            if (!_loadingAssets && _error == null && _assets.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Nenhum bem disponível.'),
              ),
            ..._assets.take(50).map((asset) {
              final selected = _selectedIds.contains(asset.id);
              return CheckboxListTile(
                value: selected,
                controlAffinity: ListTileControlAffinity.leading,
                title: Text(
                  asset.descricao,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  '${asset.patrimonio ?? asset.patrimonioProvisorio ?? asset.id} • ${asset.status}',
                ),
                secondary: Text(
                  NumberFormat.currency(
                    locale: 'pt_BR',
                    symbol: 'R\$',
                  ).format(asset.valor),
                ),
                onChanged: (checked) => setState(() {
                  if (checked == true) {
                    _selectedIds.add(asset.id);
                  } else {
                    _selectedIds.remove(asset.id);
                  }
                }),
              );
            }),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check),
            label: Text(_saving ? 'Salvando...' : 'Abrir processo'),
          ),
        ),
      ),
    );
  }
}

class _CommitteeMemberControllers {
  final name = TextEditingController();
  final role = TextEditingController();

  void dispose() {
    name.dispose();
    role.dispose();
  }
}

class _AlienationCard extends StatelessWidget {
  const _AlienationCard({required this.item, required this.onTap});

  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final process =
        item['numero_processo']?.toString() ?? 'Processo sem número';
    final status = item['status']?.toString() ?? 'sem status';
    final date = _date(item['data_abertura']);
    final count = item['total_itens_count']?.toString() ?? '0';
    final value = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$').format(
      num.tryParse(item['valor_total_avaliacao']?.toString() ?? '') ?? 0,
    );
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: const CircleAvatar(child: Icon(Icons.gavel_outlined)),
        title: Text(
          process,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            '${_label(item['tipo'])} • ${_label(status)}\n$date • $count bem(ns) • $value',
          ),
        ),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _AlienationDetailScreen extends StatefulWidget {
  const _AlienationDetailScreen({required this.id});
  final String id;

  @override
  State<_AlienationDetailScreen> createState() =>
      _AlienationDetailScreenState();
}

class _AlienationDetailScreenState extends State<_AlienationDetailScreen> {
  final ApiService _api = ApiService();
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _api.getAlienation(widget.id);
  }

  Future<void> _confirmConclude(Map<String, dynamic> item) async {
    final recipient = TextEditingController(
      text: item['destinatario_nome']?.toString() ?? '',
    );
    final document = TextEditingController(
      text: item['destinatario_documento']?.toString() ?? '',
    );
    final address = TextEditingController(
      text: item['destinatario_endereco']?.toString() ?? '',
    );
    final notes = TextEditingController(
      text: item['observacoes']?.toString() ?? '',
    );
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Concluir alienação?'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Esta ação dá baixa em todos os bens pendentes deste processo e não pode ser desfeita.',
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: recipient,
                  decoration: const InputDecoration(labelText: 'Destinatário'),
                ),
                TextField(
                  controller: document,
                  decoration: const InputDecoration(labelText: 'CPF/CNPJ'),
                ),
                TextField(
                  controller: address,
                  decoration: const InputDecoration(labelText: 'Endereço'),
                ),
                TextField(
                  controller: notes,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Observações finais',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Confirmar baixa'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
      await _api.concludeAlienation(widget.id, {
        'destinatario_nome': recipient.text.trim(),
        'destinatario_documento': document.text.trim(),
        'destinatario_endereco': address.text.trim(),
        'observacoes': notes.text.trim(),
      });
      if (!mounted) return;
      setState(() => _future = _api.getAlienation(widget.id));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Alienação concluída e baixa registrada.'),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      recipient.dispose();
      document.dispose();
      address.dispose();
      notes.dispose();
    }
  }

  Future<void> _addAsset(
    Map<String, dynamic> process,
    List<Map> currentAssets,
  ) async {
    try {
      final existingIds = currentAssets
          .map((asset) => asset['bem_id']?.toString())
          .toSet();
      final available = (await _api.getAssets())
          .where(
            (asset) =>
                asset.status.toLowerCase() == 'ativo' &&
                !existingIds.contains(asset.id),
          )
          .toList();
      if (!mounted) return;
      var search = '';
      final chosen = await showDialog<Asset>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) {
            final matches = available
                .where((asset) {
                  final query = search.toLowerCase();
                  return query.isEmpty ||
                      asset.descricao.toLowerCase().contains(query) ||
                      (asset.patrimonio ?? '').toLowerCase().contains(query) ||
                      (asset.patrimonioProvisorio ?? '').toLowerCase().contains(
                        query,
                      );
                })
                .take(50)
                .toList();
            return AlertDialog(
              title: const Text('Adicionar bem'),
              content: SizedBox(
                width: 480,
                height: 420,
                child: Column(
                  children: [
                    TextField(
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        hintText: 'Buscar por patrimônio ou descrição',
                      ),
                      onChanged: (value) =>
                          setDialogState(() => search = value.trim()),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: matches.isEmpty
                          ? const Center(
                              child: Text('Nenhum bem ativo encontrado.'),
                            )
                          : ListView.builder(
                              itemCount: matches.length,
                              itemBuilder: (context, index) {
                                final asset = matches[index];
                                return ListTile(
                                  title: Text(
                                    asset.descricao,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  subtitle: Text(
                                    asset.patrimonio ??
                                        asset.patrimonioProvisorio ??
                                        asset.id,
                                  ),
                                  onTap: () =>
                                      Navigator.pop(dialogContext, asset),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Cancelar'),
                ),
              ],
            );
          },
        ),
      );
      if (chosen == null || !mounted) return;
      await _api.addAlienationAsset(widget.id, chosen.id);
      if (!mounted) return;
      setState(() => _future = _api.getAlienation(widget.id));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bem vinculado ao processo.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  Future<void> _removeAsset(String assetId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remover bem do processo?'),
        content: const Text(
          'Esta ação remove apenas o vínculo enquanto o item ainda estiver pendente.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Remover'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.removeAlienationAsset(widget.id, assetId);
      if (!mounted) return;
      setState(() => _future = _api.getAlienation(widget.id));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bem removido do processo.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  Future<void> _deleteProcess(Map<String, dynamic> item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Excluir processo?'),
        content: const Text(
          'O processo e os vínculos de bens/comissão serão excluídos. Esta ação só é permitida para processos em aberto.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Excluir processo'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.deleteAlienation(widget.id);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  Future<void> _editProcess(Map<String, dynamic> item) async {
    final process = TextEditingController(
      text: item['numero_processo']?.toString() ?? '',
    );
    final notice = TextEditingController(
      text: item['numero_edital']?.toString() ?? '',
    );
    final notes = TextEditingController(
      text: item['observacoes']?.toString() ?? '',
    );
    var type = item['tipo']?.toString() ?? 'doacao';
    final rawOpeningDate = item['data_abertura']?.toString() ?? '';
    var openingDate =
        DateTime.tryParse(
          rawOpeningDate.length >= 10
              ? rawOpeningDate.substring(0, 10)
              : rawOpeningDate,
        ) ??
        DateTime.now();
    try {
      final updated = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: const Text('Editar processo'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: type,
                    decoration: const InputDecoration(labelText: 'Tipo'),
                    items: const [
                      DropdownMenuItem(value: 'leilao', child: Text('Leilão')),
                      DropdownMenuItem(
                        value: 'venda',
                        child: Text('Venda direta'),
                      ),
                      DropdownMenuItem(value: 'doacao', child: Text('Doação')),
                      DropdownMenuItem(
                        value: 'permuta',
                        child: Text('Permuta'),
                      ),
                      DropdownMenuItem(
                        value: 'descarte',
                        child: Text('Descarte'),
                      ),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => type = value ?? type),
                  ),
                  TextField(
                    controller: process,
                    decoration: const InputDecoration(
                      labelText: 'Número do processo',
                    ),
                  ),
                  TextField(
                    controller: notice,
                    decoration: const InputDecoration(labelText: 'Edital'),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Data de abertura'),
                    subtitle: Text(
                      DateFormat('dd/MM/yyyy').format(openingDate),
                    ),
                    trailing: const Icon(Icons.calendar_month_outlined),
                    onTap: () async {
                      final selected = await showDatePicker(
                        context: context,
                        initialDate: openingDate,
                        firstDate: DateTime(2000),
                        lastDate: DateTime(2100),
                      );
                      if (selected != null) {
                        setDialogState(() => openingDate = selected);
                      }
                    },
                  ),
                  TextField(
                    controller: notes,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(labelText: 'Observações'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Salvar'),
              ),
            ],
          ),
        ),
      );
      if (updated != true || !mounted) return;
      if (process.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Informe o número do processo.')),
        );
        return;
      }
      await _api.updateAlienation(widget.id, {
        'tipo': type,
        'numero_processo': process.text.trim(),
        'numero_edital': notice.text.trim(),
        'data_abertura': DateFormat('yyyy-MM-dd').format(openingDate),
        'observacoes': notes.text.trim(),
      });
      if (!mounted) return;
      setState(() => _future = _api.getAlienation(widget.id));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Processo atualizado.')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      process.dispose();
      notice.dispose();
      notes.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detalhes da alienação')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Não foi possível abrir o processo. ${snapshot.error}',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          final item = snapshot.data!;
          final members = item['comissao'] is List
              ? (item['comissao'] as List).whereType<Map>().toList()
              : const <Map>[];
          final assets = item['itens'] is List
              ? (item['itens'] as List).whereType<Map>().toList()
              : const <Map>[];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['numero_processo']?.toString() ?? 'Processo',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 10),
                      _detail('Tipo', _label(item['tipo'])),
                      _detail('Status', _label(item['status'])),
                      _detail('Data de abertura', _date(item['data_abertura'])),
                      _detail(
                        'Edital',
                        item['numero_edital']?.toString() ?? '-',
                      ),
                      _detail(
                        'Criado por',
                        item['criado_por_nome']?.toString() ?? '-',
                      ),
                      if ((item['observacoes']?.toString() ?? '').isNotEmpty)
                        _detail('Observações', item['observacoes'].toString()),
                      if ((item['destinatario_nome']?.toString() ?? '')
                          .isNotEmpty)
                        _detail(
                          'Destinatário',
                          item['destinatario_nome'].toString(),
                        ),
                    ],
                  ),
                ),
              ),
              if ([
                'aberto',
                'em_avaliacao',
              ].contains(item['status']?.toString())) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => _editProcess(item),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Editar dados do processo'),
                ),
                OutlinedButton.icon(
                  onPressed: () => _addAsset(item, assets),
                  icon: const Icon(Icons.add_box_outlined),
                  label: const Text('Adicionar bem ao processo'),
                ),
                FilledButton.icon(
                  onPressed: () => _confirmConclude(item),
                  icon: const Icon(Icons.task_alt),
                  label: const Text('Concluir e baixar bens'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.error,
                  ),
                ),
              ],
              if (item['status'] == 'aberto') ...[
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: () => _deleteProcess(item),
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Excluir processo em aberto'),
                  style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.error,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text(
                'Bens vinculados (${assets.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              if (assets.isEmpty)
                const Card(
                  child: ListTile(title: Text('Nenhum bem vinculado.')),
                )
              else
                ...assets.map(
                  (asset) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.inventory_2_outlined),
                      title: Text(
                        asset['descricao']?.toString() ?? 'Bem patrimonial',
                      ),
                      subtitle: Text(
                        '${asset['patrimonio'] ?? '-'} • ${_label(asset['status_item'])}',
                      ),
                      trailing:
                          ['aberto', 'em_avaliacao'].contains(item['status']) &&
                              asset['status_item'] == 'pendente'
                          ? IconButton(
                              tooltip: 'Remover vínculo',
                              onPressed: () =>
                                  _removeAsset(asset['bem_id'].toString()),
                              icon: const Icon(Icons.remove_circle_outline),
                            )
                          : null,
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Text(
                'Comissão (${members.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              if (members.isEmpty)
                const Card(
                  child: ListTile(title: Text('Nenhum membro informado.')),
                )
              else
                ...members.map(
                  (member) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.person_outline),
                      title: Text(member['nome']?.toString() ?? 'Membro'),
                      subtitle: Text(
                        '${member['cargo'] ?? '-'} • ${_label(member['tipo_membro'])}',
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _detail(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 135,
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
        Expanded(child: Text(value)),
      ],
    ),
  );
}

String _label(Object? value) {
  final text = value?.toString().trim() ?? '';
  if (text.isEmpty) return '-';
  return text.replaceAll('_', ' ');
}

String _date(Object? value) {
  if (value == null) return '-';
  try {
    final raw = value.toString();
    final dateOnly = raw.length >= 10 ? raw.substring(0, 10) : raw;
    return DateFormat('dd/MM/yyyy').format(DateTime.parse(dateOnly));
  } catch (_) {
    return value.toString();
  }
}

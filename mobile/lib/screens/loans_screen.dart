import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/screens/assets_list_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class LoansScreen extends StatefulWidget {
  final ApiService? apiService;

  const LoansScreen({super.key, this.apiService});

  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> {
  late final ApiService _api;
  List<Map<String, dynamic>> _loans = [];
  String _filter = 'ativo';
  bool _loading = true;
  String? _error;
  String? _returning;

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
      final loans = await _api.getLoans(status: _filter);
      if (!mounted) return;
      setState(() {
        _loans = loans;
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

  Future<void> _return(Map<String, dynamic> loan) async {
    final id = loan['id']?.toString();
    if (id == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Registrar devolução?'),
        content: Text(
          'Confirme a devolução de ${loan['bemDescricao'] ?? 'este bem'}. O status do bem voltará para ativo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Ainda não'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirmar devolução'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _returning = id);
    try {
      await _api.returnLoan(id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Devolução registrada.')));
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _returning = null);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Empréstimos'),
      actions: [
        IconButton(
          onPressed: _load,
          tooltip: 'Atualizar',
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: Column(
      children: [
        SizedBox(
          height: 58,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            children: [
              _chip('ativo', 'Ativos'),
              _chip('atrasado', 'Atrasados'),
              _chip('devolvido', 'Devolvidos'),
              _chip('todos', 'Todos'),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center),
                  ),
                )
              : _loans.isEmpty
              ? const Center(child: Text('Não há empréstimos nesta situação.'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _loans.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) => _loanCard(_loans[index]),
                  ),
                ),
        ),
      ],
    ),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () async {
        final created = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
            builder: (_) => const AssetsListScreen(selectForLoan: true),
          ),
        );
        if (created == true) _load();
      },
      icon: const Icon(Icons.add),
      label: const Text('Novo empréstimo'),
    ),
  );

  Widget _chip(String value, String label) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: _filter == value,
      onSelected: (_) {
        setState(() => _filter = value);
        _load();
      },
    ),
  );

  Widget _loanCard(Map<String, dynamic> loan) {
    final origin = loan['origem'] is Map
        ? Map<String, dynamic>.from(loan['origem'])
        : <String, dynamic>{};
    final destination = loan['destino'] is Map
        ? Map<String, dynamic>.from(loan['destino'])
        : <String, dynamic>{};
    final active = loan['status'] == 'ativo' || loan['status'] == 'atrasado';
    final id = loan['id']?.toString();
    final description = loan['bemDescricao']?.toString().trim();
    final assetCode = loan['patrimonio']?.toString().trim();
    final hasDescription = description != null && description.isNotEmpty;
    final hasAssetCode = assetCode != null && assetCode.isNotEmpty;
    return Card(
      child: ExpansionTile(
        title: Text(
          hasDescription
              ? description
              : hasAssetCode
              ? 'Bem patrimonial $assetCode'
              : 'Bem sem identificação',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${hasAssetCode ? 'Patrimônio $assetCode · ' : ''}${_status(loan['status']?.toString())}',
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text('De: ${_location(origin)}'),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Para: ${_location(destination)}'),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Recebedor: ${loan['responsavelRecebimento'] ?? '—'}'),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Empréstimo: ${loan['dataEmprestimo'] ?? '—'} · Devolução prevista: ${loan['dataPrevistaDevolucao'] ?? '—'}',
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Motivo: ${loan['motivo'] ?? '—'}'),
          ),
          if (active)
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonalIcon(
                onPressed: id == null || _returning == id
                    ? null
                    : () => _return(loan),
                icon: _returning == id
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.assignment_return_outlined),
                label: const Text('Registrar devolução'),
              ),
            ),
        ],
      ),
    );
  }

  String _location(Map<String, dynamic> value) => [
    value['secretaria'],
    value['departamento'],
    value['sala'],
  ].where((part) => part != null && part.toString().isNotEmpty).join(' / ');

  String _status(String? value) => switch (value) {
    'ativo' => 'Ativo',
    'atrasado' => 'Atrasado',
    'devolvido' => 'Devolvido',
    _ => value ?? '—',
  };
}

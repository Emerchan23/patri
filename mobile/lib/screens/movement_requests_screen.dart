import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class MovementRequestsScreen extends StatefulWidget {
  final ApiService? apiService;

  const MovementRequestsScreen({super.key, this.apiService});

  @override
  State<MovementRequestsScreen> createState() => _MovementRequestsScreenState();
}

class _MovementRequestsScreenState extends State<MovementRequestsScreen> {
  late final ApiService _api;
  late Future<CurrentUserSession?> _userFuture;
  List<Map<String, dynamic>> _requests = [];
  String _filter = 'pendente';
  bool _loading = true;
  String? _error;
  String? _actingOn;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _userFuture = _api.getCurrentUserSession();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final requests = await _api.getMovementRequests(status: _filter);
      if (!mounted) return;
      setState(() {
        _requests = requests;
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

  Future<void> _decide(Map<String, dynamic> request, String action) async {
    final id = request['id']?.toString();
    if (id == null) return;
    String? rejectionReason;
    final items = request['itens'] is List
        ? List<Map<String, dynamic>>.from(request['itens'] as List)
        : <Map<String, dynamic>>[];
    if (action == 'rejeitar') {
      rejectionReason = await _askRejectionReason();
      if (rejectionReason == null) return;
    } else if (action == 'aprovar') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          scrollable: true,
          title: const Text('Conferir solicitação'),
          content: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Aprovar e transferir ${items.length} '
                '${items.length == 1 ? 'bem' : 'bens'}?',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                'Destino: ${request['secretariaDestino'] ?? '—'} • '
                '${request['departamentoDestino'] ?? '—'} • ${request['salaDestino'] ?? '—'}',
              ),
              const SizedBox(height: 8),
              Text('Motivo: ${request['motivo'] ?? '—'}'),
              const Divider(height: 24),
              ...items.map((item) {
                final origin = item['de'] is Map
                    ? Map<String, dynamic>.from(item['de'] as Map)
                    : <String, dynamic>{};
                final originLabel =
                    [
                          origin['secretaria'],
                          origin['departamento'],
                          origin['sala'],
                        ]
                        .where(
                          (part) =>
                              part != null && part.toString().trim().isNotEmpty,
                        )
                        .join(' • ');
                return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.inventory_2_outlined),
                  title: Text(item['patrimonio']?.toString() ?? 'Bem'),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['bemDescricao']?.toString() ?? ''),
                      Text(
                        'Origem: ${originLabel.isEmpty ? 'Não informada' : originLabel}',
                      ),
                    ],
                  ),
                );
              }),
              const Text(
                'A aprovação atualiza a localização e o histórico de cada bem.',
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Voltar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Aprovar e transferir'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    } else if (action == 'cancelar') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Cancelar solicitação?'),
          content: const Text(
            'O pedido pendente será encerrado e não poderá ser aprovado.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Voltar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Cancelar pedido'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    setState(() => _actingOn = id);
    try {
      await _api.updateMovementRequest(
        id: id,
        action: action,
        rejectionReason: rejectionReason,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            action == 'cancelar'
                ? 'Solicitação cancelada.'
                : action == 'aprovar'
                ? 'Solicitação aprovada e bens transferidos.'
                : 'Solicitação rejeitada.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<String?> _askRejectionReason() async {
    return showDialog<String>(
      context: context,
      builder: (_) => const _RejectionReasonDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Solicitações'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 58,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              scrollDirection: Axis.horizontal,
              children: [
                _filterChip('pendente', 'Pendentes'),
                _filterChip('aprovada', 'Aprovadas'),
                _filterChip('rejeitada', 'Rejeitadas'),
                _filterChip('cancelada', 'Canceladas'),
                _filterChip('todas', 'Todas'),
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
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_error!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: _load,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _requests.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Não há solicitações nesta categoria.'),
                    ),
                  )
                : FutureBuilder<CurrentUserSession?>(
                    future: _userFuture,
                    builder: (context, userSnapshot) {
                      final user = userSnapshot.data;
                      return RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                          itemCount: _requests.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) =>
                              _requestCard(_requests[index], user),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String value, String label) => Padding(
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

  Widget _requestCard(Map<String, dynamic> request, CurrentUserSession? user) {
    final status = request['status']?.toString() ?? 'pendente';
    final id = request['id']?.toString() ?? '';
    final items = request['itens'] is List
        ? List<Map<String, dynamic>>.from(request['itens'] as List)
        : <Map<String, dynamic>>[];
    final pending = status == 'pendente';
    final canApprove =
        pending &&
        const {'administrador', 'gestor'}.contains(user?.role) &&
        (user?.hasPermission('aprovarMovimentacao') ?? false);
    final canCancel =
        pending &&
        user?.role == 'assistente' &&
        user?.id.isNotEmpty == true &&
        user?.id == request['solicitanteId']?.toString();
    final busy = _actingOn == id;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        title: Text(
          '${request['totalItens'] ?? items.length} bem(ns) · ${request['solicitanteNome'] ?? 'Solicitante'}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '${request['departamentoDestino'] ?? '—'} / ${request['salaDestino'] ?? '—'}',
        ),
        trailing: _statusBadge(status),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Origem: ${request['secretariaOrigem'] ?? '—'}'),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Motivo: ${request['motivo'] ?? '—'}'),
          ),
          if (request['motivoRejeicao']?.toString().isNotEmpty == true) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Motivo da rejeição: ${request['motivoRejeicao']}'),
            ),
          ],
          const Divider(height: 22),
          ...items.map(
            (item) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.inventory_2_outlined),
              title: Text(item['patrimonio']?.toString() ?? 'Bem'),
              subtitle: Text(
                item['bemDescricao']?.toString() ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          if (canApprove || canCancel) ...[
            const SizedBox(height: 8),
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 8,
              runSpacing: 8,
              children: [
                if (canCancel)
                  OutlinedButton(
                    onPressed: busy ? null : () => _decide(request, 'cancelar'),
                    child: const Text('Cancelar pedido'),
                  ),
                if (canApprove)
                  OutlinedButton(
                    onPressed: busy ? null : () => _decide(request, 'rejeitar'),
                    child: const Text('Rejeitar'),
                  ),
                if (canApprove)
                  FilledButton(
                    onPressed: busy ? null : () => _decide(request, 'aprovar'),
                    child: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Aprovar'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _statusBadge(String status) {
    final (label, color) = switch (status) {
      'aprovada' => ('Aprovada', Colors.green),
      'rejeitada' => ('Rejeitada', Colors.red),
      'cancelada' => ('Cancelada', Colors.grey),
      _ => ('Pendente', Colors.orange),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _RejectionReasonDialog extends StatefulWidget {
  const _RejectionReasonDialog();

  @override
  State<_RejectionReasonDialog> createState() => _RejectionReasonDialogState();
}

class _RejectionReasonDialogState extends State<_RejectionReasonDialog> {
  final TextEditingController _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Motivo da rejeição'),
    content: TextField(
      controller: _reason,
      autofocus: true,
      minLines: 2,
      maxLines: 4,
      onChanged: (_) => setState(() {}),
      decoration: const InputDecoration(
        labelText: 'Informe o motivo',
        border: OutlineInputBorder(),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        onPressed: _reason.text.trim().isEmpty
            ? null
            : () => Navigator.pop(context, _reason.text.trim()),
        child: const Text('Rejeitar'),
      ),
    ],
  );
}

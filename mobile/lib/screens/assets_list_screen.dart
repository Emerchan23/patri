import 'dart:async';

import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/screens/asset_details_screen.dart';
import 'package:sis_patrimonio_mobile/screens/move_asset_screen.dart';
import 'package:sis_patrimonio_mobile/screens/request_movement_screen.dart';
import 'package:sis_patrimonio_mobile/screens/create_loan_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class AssetsListScreen extends StatefulWidget {
  final bool selectForMovement;
  final bool selectForRequest;
  final bool selectForLoan;

  const AssetsListScreen({
    super.key,
    this.selectForMovement = false,
    this.selectForRequest = false,
    this.selectForLoan = false,
  });

  @override
  State<AssetsListScreen> createState() => _AssetsListScreenState();
}

class _AssetsListScreenState extends State<AssetsListScreen> {
  final ApiService _apiService = ApiService();
  final TextEditingController _searchController = TextEditingController();
  Timer? _searchDebounce;

  List<Asset> _assets = [];
  final Map<String, Asset> _selectedAssets = {};
  bool _isLoading = true;
  bool _isSelectingForMovement = false;
  String? _loadError;

  bool get _selectionMode =>
      widget.selectForMovement ||
      widget.selectForRequest ||
      widget.selectForLoan ||
      _isSelectingForMovement ||
      _selectedAssets.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _loadAssets();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadAssets([String? query]) async {
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    try {
      final results = await _apiService.getAssets(search: query);
      if (!mounted) return;
      setState(() {
        _assets = results;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.selectForLoan
              ? 'Selecionar um bem'
              : _selectionMode
              ? 'Selecionar bens'
              : 'Consultar Bens',
        ),
        actions: [
          if (!widget.selectForMovement &&
              !widget.selectForRequest &&
              !widget.selectForLoan)
            IconButton(
              tooltip: _selectionMode
                  ? 'Cancelar seleção'
                  : 'Selecionar vários',
              icon: Icon(_selectionMode ? Icons.close : Icons.checklist),
              onPressed: () => setState(() {
                final wasSelecting = _selectionMode;
                _selectedAssets.clear();
                _isSelectingForMovement = !wasSelecting;
              }),
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                labelText: 'Buscar patrimonio, descricao, sala ou grupo',
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: () {
                    _searchDebounce?.cancel();
                    _loadAssets(_searchController.text.trim());
                  },
                ),
              ),
              onChanged: (value) {
                _searchDebounce?.cancel();
                _searchDebounce = Timer(const Duration(milliseconds: 400), () {
                  if (mounted) _loadAssets(value.trim());
                });
              },
              onSubmitted: (value) {
                _searchDebounce?.cancel();
                _loadAssets(value.trim());
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                Text(
                  _selectionMode
                      ? '${_selectedAssets.length} selecionado(s) • ${_buildResultSummary()}'
                      : _buildResultSummary(),
                  style: TextStyle(
                    color: Colors.grey.shade700,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _loadError != null
                ? _buildErrorState()
                : _assets.isEmpty
                ? _buildEmptyState()
                : RefreshIndicator(
                    onRefresh: () => _loadAssets(_searchController.text.trim()),
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                      itemCount: _assets.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final asset = _assets[index];
                        return _AssetCompactCard(
                          asset: asset,
                          apiService: _apiService,
                          selected: _selectedAssets.containsKey(asset.id),
                          selectionMode: _selectionMode,
                          onTap: () {
                            if (_selectionMode) {
                              if (widget.selectForLoan &&
                                  asset.status.trim().toLowerCase() !=
                                      'ativo') {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Somente bens ativos podem ser emprestados.',
                                    ),
                                  ),
                                );
                                return;
                              }
                              setState(() {
                                if (_selectedAssets.containsKey(asset.id)) {
                                  _selectedAssets.remove(asset.id);
                                } else {
                                  if (widget.selectForLoan) {
                                    _selectedAssets.clear();
                                  }
                                  _selectedAssets[asset.id] = asset;
                                }
                              });
                              return;
                            }
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => AssetDetailsScreen(
                                  patrimonyCode: asset.patrimonio ?? '',
                                ),
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: _selectionMode && _selectedAssets.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: () async {
                final selected = _selectedAssets.values.toList();
                if (selected.isEmpty) return;
                if (widget.selectForRequest) {
                  final navigator = Navigator.of(context);
                  final sent = await navigator.push<bool>(
                    MaterialPageRoute(
                      builder: (_) => RequestMovementScreen(assets: selected),
                    ),
                  );
                  if (!mounted) return;
                  if (sent == true) navigator.pop(true);
                  return;
                }
                if (widget.selectForLoan) {
                  final navigator = Navigator.of(context);
                  final created = await Navigator.push<bool>(
                    navigator.context,
                    MaterialPageRoute(
                      builder: (_) => CreateLoanScreen(asset: selected.single),
                    ),
                  );
                  if (!mounted) return;
                  if (created == true) navigator.pop(true);
                  return;
                }
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => MoveAssetScreen(assets: selected),
                  ),
                );
              },
              icon: Icon(
                widget.selectForRequest
                    ? Icons.outgoing_mail
                    : widget.selectForLoan
                    ? Icons.handshake_outlined
                    : Icons.drive_file_move_outline,
              ),
              label: Text(
                widget.selectForRequest
                    ? 'Solicitar ${_selectedAssets.length}'
                    : widget.selectForLoan
                    ? 'Emprestar bem'
                    : 'Movimentar ${_selectedAssets.length}',
              ),
            )
          : null,
    );
  }

  String _buildResultSummary() {
    if (_isLoading) {
      return 'Carregando bens...';
    }

    if (_assets.isEmpty) {
      return 'Nenhum bem encontrado';
    }

    return '${_assets.length} ${_assets.length == 1 ? 'bem encontrado' : 'bens encontrados'}';
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.inventory_2_outlined,
              size: 62,
              color: Colors.grey,
            ),
            const SizedBox(height: 14),
            const Text(
              'Nenhum bem encontrado',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              'Tente buscar por patrimonio, descricao, grupo ou sala.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 56, color: Colors.red),
            const SizedBox(height: 14),
            const Text(
              'Não foi possível carregar os bens',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(_loadError!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => _loadAssets(_searchController.text.trim()),
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AssetCompactCard extends StatelessWidget {
  final Asset asset;
  final ApiService apiService;
  final VoidCallback onTap;
  final bool selected;
  final bool selectionMode;

  const _AssetCompactCard({
    required this.asset,
    required this.apiService,
    required this.onTap,
    required this.selected,
    required this.selectionMode,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(asset.status);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: selected ? Colors.blue : Colors.grey.shade200,
          width: selected ? 2 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 62,
                height: 62,
                child: asset.imagem != null
                    ? FutureBuilder<String?>(
                        future: apiService.getImageUrl(asset.imagem),
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
                          return _placeholderImage();
                        },
                      )
                    : _placeholderImage(),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _InlineChip(
                          label: asset.patrimonio ?? 'Sem patrimonio',
                          backgroundColor: const Color(0xFFE0E7FF),
                          textColor: const Color(0xFF3730A3),
                        ),
                        _InlineChip(
                          label: asset.status,
                          backgroundColor: statusColor.withValues(alpha: 0.14),
                          textColor: statusColor,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      asset.descricao,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _buildLocationLabel(asset),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey.shade700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _buildSecondaryLabel(asset),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: selectionMode
                    ? Icon(
                        selected ? Icons.check_circle : Icons.circle_outlined,
                        color: selected ? Colors.blue : Colors.grey,
                      )
                    : const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _placeholderImage() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Icon(Icons.inventory_2, color: Colors.grey),
    );
  }

  String _buildLocationLabel(Asset asset) {
    final parts = <String>[
      if (asset.localizacao?.secretaria != null &&
          asset.localizacao!.secretaria!.isNotEmpty)
        asset.localizacao!.secretaria!,
      if (asset.localizacao?.departamento != null &&
          asset.localizacao!.departamento!.isNotEmpty)
        asset.localizacao!.departamento!,
      if (asset.localizacao?.sala != null &&
          asset.localizacao!.sala!.isNotEmpty)
        asset.localizacao!.sala!,
    ];

    if (parts.isEmpty) {
      return 'Localizacao nao informada';
    }

    return parts.join(' • ');
  }

  String _buildSecondaryLabel(Asset asset) {
    final parts = <String>[
      if (asset.grupo != null && asset.grupo!.isNotEmpty) asset.grupo!,
      if (asset.categoria.isNotEmpty) asset.categoria,
    ];

    if (parts.isEmpty) {
      return 'Sem grupo ou categoria';
    }

    return parts.join(' • ');
  }

  Color _statusColor(String status) {
    final normalized = status.trim().toLowerCase();
    if (normalized.contains('ativo') || normalized.contains('uso')) {
      return const Color(0xFF166534);
    }
    if (normalized.contains('manut')) {
      return const Color(0xFFB45309);
    }
    if (normalized.contains('baix') || normalized.contains('inativ')) {
      return const Color(0xFFB91C1C);
    }
    return const Color(0xFF334155);
  }
}

class _InlineChip extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;

  const _InlineChip({
    required this.label,
    required this.backgroundColor,
    required this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: textColor,
        ),
      ),
    );
  }
}

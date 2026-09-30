import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/models/movement_result.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/screens/move_asset_screen.dart';
import 'package:sis_patrimonio_mobile/screens/movement_scan_screen.dart';
import 'package:sis_patrimonio_mobile/screens/edit_asset_screen.dart';

class AssetDetailsScreen extends StatefulWidget {
  final String? patrimonyCode;
  final String? assetId;

  const AssetDetailsScreen({super.key, this.patrimonyCode, this.assetId})
    : assert(patrimonyCode != null || assetId != null);

  @override
  State<AssetDetailsScreen> createState() => _AssetDetailsScreenState();
}

class _AssetDetailsScreenState extends State<AssetDetailsScreen> {
  final ApiService _apiService = ApiService();
  late Future<Asset?> _assetFuture;
  late Future<CurrentUserSession?> _userFuture;

  @override
  void initState() {
    super.initState();
    _userFuture = _apiService.getCurrentUserSession();
    _loadAsset();
  }

  void _loadAsset() {
    setState(() {
      _assetFuture = widget.assetId != null
          ? _apiService.getAssetById(widget.assetId!)
          : _apiService
                .getAssetByPatrimony(widget.patrimonyCode!)
                .then(
                  (asset) => asset ?? (throw Exception('Bem não encontrado.')),
                );
    });
  }

  Future<void> _handleMovement(Asset asset) async {
    final result = await Navigator.push<MovementResult>(
      context,
      MaterialPageRoute(builder: (_) => MoveAssetScreen(assets: [asset])),
    );
    if (result == null || !mounted) return;

    _loadAsset();
    final continueForSameDestination = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Bem transferido'),
        content: const Text('Quer escanear outro bem para o mesmo local?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Concluir'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(dialogContext, true),
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Escanear outro'),
          ),
        ],
      ),
    );

    if (continueForSameDestination == true && mounted) {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) =>
              MovementScanScreen(initialDestination: result.destination),
        ),
      );
    }
  }

  Future<void> _handleEdit(Asset asset) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => EditAssetScreen(asset: asset)),
    );
    if (result == true && mounted) _loadAsset();
  }

  Future<void> _handleLabelAction(Asset asset, String action) async {
    try {
      await _apiService.updateAssetLabelStatus(
        assetId: asset.id,
        action: action,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            action == 'confirmar_colada'
                ? 'Colagem da etiqueta confirmada.'
                : action == 'marcar_enviada'
                ? 'Etiqueta marcada como enviada.'
                : 'Pendência da etiqueta reaberta.',
          ),
        ),
      );
      _loadAsset();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detalhes do Bem')),
      body: FutureBuilder<Asset?>(
        future: _assetFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Erro ao buscar: ${snapshot.error}'));
          }

          if (!snapshot.hasData || snapshot.data == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    'Bem não encontrado:\n${widget.patrimonyCode ?? widget.assetId}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Voltar'),
                  ),
                ],
              ),
            );
          }

          final asset = snapshot.data!;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Imagem do Bem
                FutureBuilder<String?>(
                  future: _apiService.getImageUrl(asset.imagem),
                  builder: (context, imageSnapshot) {
                    if (imageSnapshot.hasData && imageSnapshot.data != null) {
                      return ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(
                          imageSnapshot.data!,
                          height: 250,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              height: 200,
                              color: Colors.grey[200],
                              child: const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.broken_image,
                                    size: 50,
                                    color: Colors.grey,
                                  ),
                                  Text('Erro ao carregar imagem'),
                                ],
                              ),
                            );
                          },
                        ),
                      );
                    } else {
                      return Container(
                        height: 200,
                        decoration: BoxDecoration(
                          color: Colors.grey[200],
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.image_not_supported,
                              size: 50,
                              color: Colors.grey,
                            ),
                            Text('Sem imagem'),
                          ],
                        ),
                      );
                    }
                  },
                ),

                const SizedBox(height: 24),

                // Informações Principais
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          asset.descricao,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 8),
                        Chip(
                          label: Text(asset.patrimonio ?? 'Sem Patrimônio'),
                          backgroundColor: Colors.blue[100],
                        ),
                        const Divider(),
                        _buildInfoRow('Status', asset.status),
                        if (asset.patrimonioTipo != null)
                          _buildInfoRow(
                            'Patrimônio',
                            asset.patrimonioTipo == 'provisorio'
                                ? 'Provisório'
                                : 'Definitivo',
                          ),
                        if (asset.etiquetaStatus != null)
                          _buildInfoRow(
                            'Etiqueta',
                            switch (asset.etiquetaStatus) {
                              'enviada' => 'Enviada para colagem',
                              'colada' => 'Colada',
                              _ => 'Pendente',
                            },
                          ),
                        _buildInfoRow('Categoria', asset.categoria),
                        _buildInfoRow(
                          'Localização',
                          '${asset.localizacao?.secretaria ?? "-"} > ${asset.localizacao?.sala ?? "-"}',
                        ),
                        _buildInfoRow(
                          'Responsável',
                          asset.responsavel?.nome ?? '-',
                        ),
                        _buildInfoRow('Fornecedor', asset.fornecedor ?? '-'),
                        _buildInfoRow('Emenda', asset.emendaParlamentar ?? '-'),
                        _buildInfoRow('Garantia', _formatWarranty(asset)),
                        const Divider(),
                        const Text(
                          'Observações:',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          asset.observacoes ?? 'Nenhuma observação registrada.',
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Ações
                FutureBuilder<CurrentUserSession?>(
                  future: _userFuture,
                  builder: (context, userSnapshot) {
                    final user = userSnapshot.data;
                    final canMove =
                        user?.hasPermission('registrarMovimentacao') ?? false;
                    final canEdit = user?.hasPermission('editarBem') ?? false;
                    final canConfirmLabel =
                        user?.role == 'assistente' &&
                        asset.etiquetaStatus == 'enviada';
                    final canManageLabel =
                        (user?.hasPermission('gerarEtiquetas') ?? false) &&
                        asset.patrimonioTipo != 'provisorio';
                    final labelAction = canConfirmLabel
                        ? 'confirmar_colada'
                        : canManageLabel && asset.etiquetaStatus == null
                        ? 'marcar_enviada'
                        : canManageLabel && asset.etiquetaStatus != null
                        ? 'reabrir_pendente'
                        : null;
                    if (!canMove && !canEdit && labelAction == null) {
                      return const SizedBox.shrink();
                    }

                    return Column(
                      children: [
                        if (canMove || canEdit)
                          Row(
                            children: [
                              if (canMove)
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: () => _handleMovement(asset),
                                    icon: const Icon(Icons.swap_horiz),
                                    label: const Text('MOVIMENTAR'),
                                    style: ElevatedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                    ),
                                  ),
                                ),
                              if (canMove && canEdit) const SizedBox(width: 8),
                              if (canEdit)
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => _handleEdit(asset),
                                    icon: const Icon(Icons.edit),
                                    label: const Text('EDITAR'),
                                    style: OutlinedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        if (labelAction != null) ...[
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () =>
                                  _handleLabelAction(asset, labelAction),
                              icon: Icon(
                                canConfirmLabel
                                    ? Icons.check_circle_outline
                                    : labelAction == 'marcar_enviada'
                                    ? Icons.local_offer_outlined
                                    : Icons.refresh,
                              ),
                              label: Text(
                                canConfirmLabel
                                    ? 'CONFIRMAR ETIQUETA COLADA'
                                    : labelAction == 'marcar_enviada'
                                    ? 'MARCAR ETIQUETA COMO ENVIADA'
                                    : 'REABRIR PENDÊNCIA DA ETIQUETA',
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    );
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _formatWarranty(Asset asset) {
    if (asset.tempoGarantia == null || asset.tempoGarantia == 0) return '-';

    String text = '${asset.tempoGarantia} meses';
    if (asset.dataAquisicao != null) {
      try {
        final aquisicao = DateTime.parse(asset.dataAquisicao!);
        final vencimento = DateTime(
          aquisicao.year,
          aquisicao.month + asset.tempoGarantia!,
          aquisicao.day,
        );
        final agora = DateTime.now();
        final expired = vencimento.isBefore(agora);

        text +=
            '\n${expired ? "Expirou" : "Vence"} em ${vencimento.day.toString().padLeft(2, '0')}/${vencimento.month.toString().padLeft(2, '0')}/${vencimento.year}';
      } catch (e) {
        // ignore date error
      }
    }
    return text;
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.grey,
              ),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

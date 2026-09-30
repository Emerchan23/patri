import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/screens/asset_details_screen.dart';
import 'package:sis_patrimonio_mobile/screens/room_assets_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/scanner_camera_error.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController controller = MobileScannerController(
    formats: const [BarcodeFormat.all],
  );
  final ApiService _apiService = ApiService();
  bool isProcessing = false;
  bool cameraFailed = false;

  Future<void> _openManualEntry() async {
    try {
      await controller.stop();
    } catch (_) {
      // A câmera pode ainda não ter iniciado; a consulta manual continua disponível.
    }
    if (!mounted) return;

    final codeController = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Digitar código'),
        content: TextField(
          controller: codeController,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            labelText: 'Patrimônio ou código da sala',
            hintText: 'Ex.: PROV-2026-01132',
            prefixIcon: Icon(Icons.search),
          ),
          onSubmitted: (value) => Navigator.pop(dialogContext, value.trim()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancelar'),
          ),
          FilledButton.icon(
            onPressed: () =>
                Navigator.pop(dialogContext, codeController.text.trim()),
            icon: const Icon(Icons.search),
            label: const Text('Consultar'),
          ),
        ],
      ),
    );
    codeController.dispose();
    if (!mounted) return;

    if (code != null && code.isNotEmpty) {
      await _handleCode(code);
    } else {
      await _resumeScanner();
    }
  }

  Future<void> _resumeScanner() async {
    try {
      await controller.start();
    } catch (_) {
      if (mounted) setState(() {});
    }
  }

  Future<void> _retryScanner() async {
    if (mounted) setState(() => cameraFailed = false);
    await _resumeScanner();
  }

  void _markCameraFailed() {
    if (!mounted || cameraFailed) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !cameraFailed) setState(() => cameraFailed = true);
    });
  }

  Future<void> _handleCode(String code) async {
    if (isProcessing) return;
    setState(() => isProcessing = true);

    try {
      await controller.stop();
      String cleanCode = code;
      if (RegExp(r'^\d+$').hasMatch(code)) {
        cleanCode = int.parse(code).toString();
      }

      if (cleanCode.startsWith('SALA:')) {
        final roomId = cleanCode.split(':')[1];
        final roomName = await _apiService.getRoomNameById(roomId);

        if (!mounted) return;

        if (roomName != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Abrindo bens da sala $roomName')),
          );

          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) =>
                  RoomAssetsScreen(roomName: roomName, roomId: roomId),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Sala não encontrada (ID: $roomId).')),
          );
        }
      } else {
        final asset = await _apiService.getAssetByPatrimony(cleanCode);
        if (!mounted) return;

        if (asset == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Bem não encontrado: $cleanCode.')),
          );
        } else {
          final openDetails = await _showAssetPreview(asset);
          if (!mounted) return;

          if (openDetails == true) {
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => AssetDetailsScreen(
                  patrimonyCode: asset.patrimonio ?? cleanCode,
                ),
              ),
            );
          }
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não foi possível consultar este código.'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isProcessing = false);
        await _resumeScanner();
      }
    }
  }

  Future<bool?> _showAssetPreview(Asset asset) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Leitura confirmada',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  'Confira o patrimônio lido antes de abrir os detalhes completos.',
                  style: TextStyle(color: Colors.grey.shade700, height: 1.35),
                ),
                const SizedBox(height: 18),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _previewRow(
                        'Patrimônio',
                        asset.patrimonio ?? 'Sem patrimônio',
                      ),
                      _previewRow('Descricao', asset.descricao),
                      _previewRow('Localização', _buildLocationLabel(asset)),
                      _previewRow('Status', asset.status),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Escanear outro'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Ver detalhes'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _previewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Colors.grey.shade600,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
        ],
      ),
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
      return 'Localização não informada';
    }

    return parts.join(' • ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ler patrimônio'),
        actions: [
          IconButton(
            tooltip: 'Digitar código',
            onPressed: _openManualEntry,
            icon: const Icon(Icons.keyboard_alt_outlined),
          ),
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: controller.torchState,
              builder: (context, state, child) {
                switch (state) {
                  case TorchState.off:
                    return const Icon(Icons.flash_off, color: Colors.grey);
                  case TorchState.on:
                    return const Icon(Icons.flash_on, color: Colors.yellow);
                }
              },
            ),
            onPressed: () => controller.toggleTorch(),
          ),
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: controller.cameraFacingState,
              builder: (context, state, child) {
                switch (state) {
                  case CameraFacing.front:
                    return const Icon(Icons.camera_front);
                  case CameraFacing.back:
                    return const Icon(Icons.camera_rear);
                }
              },
            ),
            onPressed: () => controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: controller,
            errorBuilder: (context, error, child) {
              _markCameraFailed();
              return ScannerCameraError(onRetry: _retryScanner);
            },
            onDetect: (capture) {
              final barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                if (barcode.rawValue != null) {
                  _handleCode(barcode.rawValue!);
                  break;
                }
              }
            },
          ),
          if (!cameraFailed)
            Center(
              child: Container(
                width: 300,
                height: 170,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: EdgeInsets.all(10),
                    child: Text(
                      'Aponte para o código de barras ou QR Code.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
                ),
              ),
            ),
          if (isProcessing)
            Container(
              color: Colors.black54,
              child: const Center(
                child: CircularProgressIndicator(color: Colors.white),
              ),
            ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 28,
            child: SafeArea(
              child: FilledButton.icon(
                onPressed: isProcessing ? null : _openManualEntry,
                icon: const Icon(Icons.keyboard_alt_outlined),
                label: const Text('Digitar código manualmente'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/models/movement_result.dart';
import 'package:sis_patrimonio_mobile/screens/move_asset_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/utils/location_match.dart';
import 'package:sis_patrimonio_mobile/widgets/scanner_camera_error.dart';

class MovementScanScreen extends StatefulWidget {
  final Map<String, String?>? initialDestination;
  final ApiService? apiService;
  final Widget Function(ValueChanged<String> onCode)? scannerPreviewBuilder;
  final Future<void> Function()? pauseCamera;
  final Future<void> Function()? resumeCamera;

  const MovementScanScreen({
    super.key,
    this.initialDestination,
    this.apiService,
    this.scannerPreviewBuilder,
    this.pauseCamera,
    this.resumeCamera,
  });

  @override
  State<MovementScanScreen> createState() => _MovementScanScreenState();
}

class _MovementScanScreenState extends State<MovementScanScreen> {
  final MobileScannerController _camera = MobileScannerController(
    formats: const [BarcodeFormat.all],
  );
  late final ApiService _api = widget.apiService ?? ApiService();
  final Map<String, Asset> _assets = {};
  bool _resolvingCode = false;
  bool _cameraReady = false;
  bool _cameraFailed = false;
  bool _cameraStartupTimedOut = false;
  Timer? _cameraStartupTimer;
  Map<String, String?>? _destination;

  @override
  void initState() {
    super.initState();
    _destination = widget.initialDestination;
    _cameraStartupTimer = Timer(const Duration(seconds: 8), () {
      if (mounted && !_cameraReady) {
        setState(() => _cameraStartupTimedOut = true);
      }
    });
  }

  String get _destinationLabel {
    final destination = _destination;
    if (destination == null) return '';
    return [
      destination['secretaria'],
      destination['departamento'],
      destination['sala'],
    ].where((part) => part != null && part.trim().isNotEmpty).join(' • ');
  }

  void _markCameraFailed() {
    if (!mounted || _cameraFailed) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_cameraFailed) setState(() => _cameraFailed = true);
    });
  }

  Future<void> _pauseCamera() async {
    final pause = widget.pauseCamera;
    if (pause != null) {
      await pause();
    } else {
      await _camera.stop();
    }
  }

  Future<void> _resumeCamera() async {
    final resume = widget.resumeCamera;
    if (resume != null) {
      await resume();
    } else {
      await _camera.start();
    }
  }

  Future<void> _retryScanner() async {
    if (mounted) setState(() => _cameraFailed = false);
    try {
      await _resumeCamera();
    } catch (_) {
      _markCameraFailed();
    }
  }

  Future<void> _resolveCode(String rawCode) async {
    final code = rawCode.trim();
    if (code.isEmpty || _resolvingCode) return;

    setState(() => _resolvingCode = true);
    try {
      try {
        await _pauseCamera();
      } catch (_) {
        // A camera-control failure must not prevent a manual or decoded lookup.
      }

      if (code.toUpperCase().startsWith('SALA:')) {
        _showMessage('Este QR identifica uma sala. Leia o código de um bem.');
        return;
      }

      final asset = await _api.getAssetByPatrimony(code);
      if (!mounted) return;

      if (asset == null) {
        _showMessage('Não encontrei um bem com o código $code.');
      } else if (_assets.containsKey(asset.id)) {
        _showMessage('Este bem já está na lista.');
      } else if (_destination != null &&
          assetIsAtLocation(
            asset.localizacao,
            secretaria: _destination!['secretaria'],
            departamento: _destination!['departamento'],
            sala: _destination!['sala'],
          )) {
        _showMessage('Este bem já está no destino selecionado.');
      } else {
        setState(() => _assets[asset.id] = asset);
        unawaited(HapticFeedback.selectionClick().catchError((_) {}));
        _showMessage('Bem adicionado. Pode escanear o próximo.');
      }
    } catch (error) {
      if (mounted) {
        final message = error.toString().replaceFirst('Exception: ', '');
        _showMessage(message);
      }
    } finally {
      if (mounted) {
        setState(() => _resolvingCode = false);
        try {
          await _resumeCamera();
        } catch (_) {
          _markCameraFailed();
        }
      }
    }
  }

  Future<void> _enterCodeManually() async {
    var typedCode = '';
    final code = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Digitar código do bem'),
        content: TextField(
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            labelText: 'Número de patrimônio',
            hintText: 'Ex.: PAT-00123 ou PROV-2026-00001',
            border: OutlineInputBorder(),
          ),
          onChanged: (value) => typedCode = value,
          onSubmitted: (value) => Navigator.pop(context, value),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, typedCode),
            child: const Text('Buscar bem'),
          ),
        ],
      ),
    );
    if (!mounted || code == null) return;
    await _resolveCode(code);
  }

  Future<void> _continueToDestination() async {
    if (_assets.isEmpty) return;

    try {
      await _pauseCamera();
    } catch (_) {
      // Continue to the destination form even if the camera was already paused.
    }
    if (!mounted) return;

    final navigator = Navigator.of(context);
    final result = await navigator.push<MovementResult>(
      MaterialPageRoute(
        builder: (_) => MoveAssetScreen(
          assets: _assets.values.toList(growable: false),
          initialDestination: _destination,
        ),
      ),
    );

    if (!mounted) return;
    if (result != null) {
      setState(() {
        _destination = result.destination;
        _assets.clear();
      });
      _showMessage(
        'Transferência concluída. O destino ficou pronto para os próximos bens.',
      );
    }

    try {
      await _resumeCamera();
    } catch (_) {
      _markCameraFailed();
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Widget _buildScannerPreview() {
    final previewBuilder = widget.scannerPreviewBuilder;
    if (previewBuilder != null) return previewBuilder(_resolveCode);

    return MobileScanner(
      controller: _camera,
      errorBuilder: (context, error, child) {
        _markCameraFailed();
        final message = switch (error.errorCode) {
          MobileScannerErrorCode.permissionDenied =>
            'Permita o acesso à câmera nas configurações do aparelho ou digite o patrimônio.',
          MobileScannerErrorCode.unsupported =>
            'Este aparelho não oferece leitura por câmera. Digite o patrimônio para continuar.',
          _ =>
            'Não foi possível iniciar a câmera. Você pode digitar o patrimônio.',
        };
        return ScannerCameraError(
          onRetry: _retryScanner,
          onManualEntry: _enterCodeManually,
          message: message,
        );
      },
      onDetect: (capture) {
        if (_resolvingCode) return;
        final code = capture.barcodes
            .map((barcode) => barcode.rawValue)
            .whereType<String>()
            .firstOrNull;
        if (code != null) _resolveCode(code);
      },
      onScannerStarted: (_) {
        _cameraStartupTimer?.cancel();
        if (mounted) {
          setState(() {
            _cameraFailed = false;
            _cameraReady = true;
            _cameraStartupTimedOut = false;
          });
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final count = _assets.length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Movimentar bens'),
        actions: [
          IconButton(
            tooltip: 'Digitar código',
            onPressed: _resolvingCode ? null : _enterCodeManually,
            icon: const Icon(Icons.keyboard_alt_outlined),
          ),
          IconButton(
            tooltip: 'Ligar ou desligar lanterna',
            onPressed: () => _camera.toggleTorch(),
            icon: ValueListenableBuilder<TorchState>(
              valueListenable: _camera.torchState,
              builder: (context, state, _) => Icon(
                state == TorchState.on ? Icons.flash_on : Icons.flash_off,
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              flex: 5,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _buildScannerPreview(),
                  if (!_cameraFailed)
                    IgnorePointer(
                      child: Center(
                        child: Container(
                          width: 280,
                          height: 170,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white, width: 3),
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                      ),
                    ),
                  if (!_cameraFailed)
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 14,
                      child: Card(
                        color: Colors.black.withValues(alpha: 0.68),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          child: Text(
                            _resolvingCode
                                ? 'Consultando bem…'
                                : _cameraReady
                                ? 'Aponte para o QR Code ou código de barras'
                                : _cameraStartupTimedOut
                                ? 'Câmera indisponível? Toque em Buscar para digitar o patrimônio.'
                                : 'Preparando a câmera…',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  if (_resolvingCode)
                    const Center(child: CircularProgressIndicator()),
                ],
              ),
            ),
            if (_destination != null)
              Container(
                width: double.infinity,
                color: Theme.of(context).colorScheme.primaryContainer,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_on_outlined),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Próximo destino: $_destinationLabel',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    TextButton(
                      onPressed: count == 0
                          ? () => setState(() => _destination = null)
                          : null,
                      child: const Text('Trocar'),
                    ),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      count == 0
                          ? 'Bens para transferir'
                          : '$count ${count == 1 ? 'bem na lista' : 'bens na lista'}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _enterCodeManually,
                    icon: const Icon(Icons.search),
                    label: const Text('Buscar'),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 4,
              child: count == 0
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Leia um bem para começar. Cada leitura será adicionada aqui para você conferir.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                      itemCount: _assets.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 6),
                      itemBuilder: (context, index) {
                        final asset = _assets.values.elementAt(index);
                        return Card(
                          margin: EdgeInsets.zero,
                          child: ListTile(
                            leading: const CircleAvatar(
                              child: Icon(Icons.inventory_2_outlined),
                            ),
                            title: Text(
                              asset.patrimonio ??
                                  asset.patrimonioProvisorio ??
                                  'Sem número patrimonial',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              asset.descricao,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: IconButton(
                              tooltip: 'Remover da lista',
                              onPressed: () =>
                                  setState(() => _assets.remove(asset.id)),
                              icon: const Icon(Icons.close),
                            ),
                          ),
                        );
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: count == 0 || _resolvingCode
                      ? null
                      : _continueToDestination,
                  icon: const Icon(Icons.arrow_forward),
                  label: Text(
                    count == 0
                        ? 'Escaneie pelo menos um bem'
                        : 'Escolher destino ($count)',
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _cameraStartupTimer?.cancel();
    _camera.dispose();
    super.dispose();
  }
}

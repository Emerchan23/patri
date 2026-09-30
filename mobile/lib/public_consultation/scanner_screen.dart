import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:sis_patrimonio_mobile/public_consultation/result_screen.dart';
import 'package:sis_patrimonio_mobile/widgets/scanner_camera_error.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _isProcessing = false;
  bool _cameraFailed = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _resumeScanner() async {
    try {
      await _controller.start();
    } catch (_) {
      if (mounted) setState(() {});
    }
  }

  Future<void> _retryScanner() async {
    if (mounted) setState(() => _cameraFailed = false);
    await _resumeScanner();
  }

  void _markCameraFailed() {
    if (!mounted || _cameraFailed) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_cameraFailed) setState(() => _cameraFailed = true);
    });
  }

  Future<void> _openManualEntry() async {
    try {
      await _controller.stop();
    } catch (_) {
      // A consulta manual não depende de a câmera ter iniciado.
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
            hintText: 'Ex.: PROV-2026-01132 ou SALA:15',
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
      await _reviewCode(_normalizeCode(code));
    } else {
      await _resumeScanner();
    }
  }

  Future<void> _reviewCode(String code) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);

    try {
      final shouldOpenResult =
          await showModalBottomSheet<bool>(
            context: context,
            isDismissible: false,
            enableDrag: false,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            builder: (context) =>
                _ScanPreviewSheet(code: code, scanType: _scanTypeLabel(code)),
          ) ??
          false;

      if (!mounted) return;

      if (shouldOpenResult) {
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => ResultScreen(code: code)),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
        await _resumeScanner();
      }
    }
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;

    for (final barcode in capture.barcodes) {
      if (barcode.rawValue == null) continue;

      final cleaned = _normalizeCode(barcode.rawValue!);
      try {
        await _controller.stop();
      } catch (_) {
        // Continue to the review even if the camera already stopped itself.
      }
      await _reviewCode(cleaned);
      break;
    }
  }

  String _normalizeCode(String rawValue) {
    final code = rawValue.trim();

    if (code.startsWith('http')) {
      try {
        final uri = Uri.parse(code);
        if (uri.pathSegments.isNotEmpty) {
          return uri.pathSegments.last.trim();
        }
      } catch (_) {
        return code;
      }
    }

    return code;
  }

  String _scanTypeLabel(String code) {
    if (code.toUpperCase().startsWith('SALA:')) {
      return 'Sala';
    }
    if (code.contains('PAT') || code.contains('PROV') || code.isNotEmpty) {
      return 'Patrimônio';
    }
    return 'Código';
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
            icon: ValueListenableBuilder<TorchState>(
              valueListenable: _controller.torchState,
              builder: (context, state, child) {
                switch (state) {
                  case TorchState.off:
                    return const Icon(Icons.flash_off, color: Colors.grey);
                  case TorchState.on:
                    return const Icon(Icons.flash_on, color: Colors.amber);
                }
              },
            ),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            errorBuilder: (context, error, child) {
              _markCameraFailed();
              return ScannerCameraError(onRetry: _retryScanner);
            },
            onDetect: _onDetect,
          ),
          if (!_cameraFailed)
            Center(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.green, width: 3),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.5),
                      spreadRadius: 1000,
                    ),
                  ],
                ),
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      color: Colors.black54,
                      child: const Text(
                        'Aponte para o QR Code do bem ou da sala.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          if (_isProcessing)
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
                onPressed: _isProcessing ? null : _openManualEntry,
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
}

class _ScanPreviewSheet extends StatelessWidget {
  final String code;
  final String scanType;

  const _ScanPreviewSheet({required this.code, required this.scanType});

  @override
  Widget build(BuildContext context) {
    final isSala = scanType == 'Sala';

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
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
            Text(
              isSala ? 'Sala identificada' : 'Patrimônio identificado',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Confira o código lido antes de abrir o resultado.',
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isSala ? Colors.green.shade50 : Colors.blue.shade50,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: isSala ? Colors.green.shade100 : Colors.blue.shade100,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    scanType,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isSala
                          ? Colors.green.shade800
                          : Colors.blue.shade800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    code,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Ler outro código'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('Ver resultado'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

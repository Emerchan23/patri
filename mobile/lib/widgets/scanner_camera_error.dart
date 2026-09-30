import 'package:flutter/material.dart';

class ScannerCameraError extends StatelessWidget {
  final Future<void> Function() onRetry;
  final VoidCallback? onManualEntry;
  final String? message;

  const ScannerCameraError({
    super.key,
    required this.onRetry,
    this.onManualEntry,
    this.message,
  });

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: Colors.black87,
    child: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 104),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.no_photography_outlined,
                color: Colors.white,
                size: 48,
              ),
              const SizedBox(height: 16),
              const Text(
                'Não foi possível iniciar a câmera.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 18),
              ),
              const SizedBox(height: 8),
              Text(
                message ??
                    'Verifique a permissão da câmera. Você também pode informar o código manualmente.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, height: 1.4),
              ),
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Tentar novamente'),
              ),
              if (onManualEntry != null) ...[
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: onManualEntry,
                  icon: const Icon(Icons.keyboard_alt_outlined),
                  label: const Text('Digitar patrimônio'),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

import 'package:sis_patrimonio_mobile/models/asset.dart';

String _normalizeLocationName(String? value) =>
    (value ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

bool sameLocationName(String? first, String? second) =>
    _normalizeLocationName(first) == _normalizeLocationName(second);

bool assetIsAtLocation(
  AssetLocation? location, {
  required String? secretaria,
  required String? departamento,
  required String? sala,
}) =>
    sameLocationName(location?.secretaria, secretaria) &&
    sameLocationName(location?.departamento, departamento) &&
    sameLocationName(location?.sala, sala);

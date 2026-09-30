import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/utils/location_match.dart';

void main() {
  test('normaliza caixa e espaços ao comparar partes de um local', () {
    expect(sameLocationName('  Centro   de Saúde ', 'centro de saúde'), isTrue);
    expect(sameLocationName('Sala 01', 'Sala 02'), isFalse);
  });

  test('compara secretaria, departamento e sala em conjunto', () {
    final origin = AssetLocation(
      secretaria: 'Fundo Municipal de Saúde',
      departamento: 'Centro - Especialidade',
      sala: 'Consultório 2',
    );

    expect(
      assetIsAtLocation(
        origin,
        secretaria: ' fundo municipal de saúde ',
        departamento: 'CENTRO - ESPECIALIDADE',
        sala: 'Consultório   2',
      ),
      isTrue,
    );
    expect(
      assetIsAtLocation(
        origin,
        secretaria: 'Fundo Municipal de Saúde',
        departamento: 'Centro - Especialidade',
        sala: 'Consultório 3',
      ),
      isFalse,
    );
  });

  test('local não informado não coincide com destino preenchido', () {
    expect(
      assetIsAtLocation(
        null,
        secretaria: 'Secretaria de Saúde',
        departamento: 'Administrativo',
        sala: 'Sala 1',
      ),
      isFalse,
    );
  });
}

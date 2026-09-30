import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/utils/audit_csv.dart';

void main() {
  group('auditLogsToCsv', () {
    test('inclui cabeçalho, usuário, entidade e BOM UTF-8', () {
      final rows = [
        {
          'dataHora': '2026-09-30 10:00:00',
          'acao': 'cadastro',
          'descricao': 'Bem criado',
          'usuario': {'nome': 'Emerson'},
          'entidade': {'descricao': 'Notebook'},
          'detalhes': 'Patrimônio 123',
        },
      ];

      final csv = auditLogsToCsv(rows);

      expect(csv, startsWith('Data;Ação;Descrição;'));
      expect(csv, contains('"Emerson";"Notebook";"Patrimônio 123"'));
      final bytes = auditCsvBytes(rows);
      expect(bytes.take(3), [0xEF, 0xBB, 0xBF]);
      expect(utf8.decode(bytes.sublist(3)), csv);
    });

    test('escapa delimitadores, aspas e fórmulas de planilha', () {
      final csv = auditLogsToCsv([
        {
          'descricao': '  =HYPERLINK("https://example.test";"clique")',
          'detalhes': 'linha 1; linha 2',
        },
      ]);

      expect(
        csv,
        contains(
          "\"'  =HYPERLINK(\"\"https://example.test\"\";\"\"clique\"\")\"",
        ),
      );
      expect(csv, contains('"linha 1; linha 2"'));
    });
  });
}

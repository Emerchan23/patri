import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/models/nfe_import.dart';

void main() {
  const xml = '''<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe><infNFe Id="NFe12345678901234567890123456789012345678901234">
    <ide><nNF>42</nNF><serie>3</serie><dhEmi>2026-09-30T09:30:00-03:00</dhEmi></ide>
    <emit><CNPJ>12345678000199</CNPJ><xNome>FORNECEDOR TESTE</xNome>
      <enderEmit><xLgr>Rua Central</xLgr><nro>10</nro><xMun>Chapadão</xMun><UF>GO</UF></enderEmit>
    </emit>
    <det nItem="1"><prod><xProd>NOTEBOOK 15 POLEGADAS</xProd><NCM>84713012</NCM>
      <CFOP>5102</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>3500.50</vUnCom><vProd>7001.00</vProd></prod></det>
    <total><ICMSTot><vNF>7001.00</vNF></ICMSTot></total>
  </infNFe></NFe>
</nfeProc>''';

  test('imports namespaced NF-e header and line item data', () {
    final parsed = NfeImport.parse(xml);

    expect(parsed.invoice.number, '42');
    expect(parsed.invoice.series, '3');
    expect(
      parsed.invoice.accessKey,
      '12345678901234567890123456789012345678901234',
    );
    expect(parsed.invoice.supplierName, 'FORNECEDOR TESTE');
    expect(parsed.invoice.supplierDocument, '12345678000199');
    expect(parsed.invoice.supplierCity, 'Chapadão');
    expect(parsed.invoice.supplierState, 'GO');
    expect(parsed.invoice.totalValue, 7001);
    expect(parsed.items, hasLength(1));
    expect(parsed.items.single.quantity, 2);
    expect(parsed.items.single.unitValue, 3500.5);
    expect(parsed.items.single.totalValue, 7001);
    expect(parsed.items.single.suggestedCategory, 'informatica');
    expect(parsed.items.single.ncm, '84713012');
  });

  test('rejects malformed XML and documents without products', () {
    expect(() => NfeImport.parse('<nfeProc>'), throwsFormatException);
    expect(
      () => NfeImport.parse(
        '<nfeProc><NFe><infNFe><ide><nNF>1</nNF></ide></infNFe></NFe></nfeProc>',
      ),
      throwsFormatException,
    );
  });
}

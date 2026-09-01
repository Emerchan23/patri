#!/bin/sh
set -e

echo "=== TESTE DE BACKUP E RESTAURAÇÃO ==="

echo "1. Verificando conexão com Banco..."
mysql -h db -u root -proot --skip-ssl -e "SELECT 1" sispatrimonio > /dev/null
echo "   OK."

echo "2. Criando registro de teste (TEST-RESTORE)..."
mysql -h db -u root -proot --skip-ssl sispatrimonio -e "INSERT INTO bens (patrimonio, descricao, categoria_slug, localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo, data_aquisicao) VALUES ('TEST-RESTORE', 'Item de Teste', 'informatica', 'Sec Teste', 'Dep Teste', 'Sala Teste', 'Tester', 'Tester', NOW());"
echo "   OK."

echo "3. Gerando Backup..."
mysqldump -h db -u root -proot --skip-ssl --single-transaction --quick --add-drop-table sispatrimonio > /tmp/test_backup.sql
if [ ! -s /tmp/test_backup.sql ]; then
    echo "   ERRO: Arquivo de backup vazio!"
    exit 1
fi
ls -lh /tmp/test_backup.sql
echo "   OK."

echo "4. Deletando registro de teste..."
mysql -h db -u root -proot --skip-ssl sispatrimonio -e "DELETE FROM bens WHERE patrimonio='TEST-RESTORE'"
# Verify deletion
COUNT=$(mysql -h db -u root -proot --skip-ssl sispatrimonio -e "SELECT COUNT(*) FROM bens WHERE patrimonio='TEST-RESTORE'" -sN)
if [ "$COUNT" -ne "0" ]; then
    echo "   ERRO: Falha ao deletar registro."
    exit 1
fi
echo "   OK (Registro deletado)."

echo "5. Restaurando Backup..."
mysql -h db -u root -proot --skip-ssl sispatrimonio < /tmp/test_backup.sql
echo "   OK."

echo "6. Verificando se o registro voltou..."
COUNT_FINAL=$(mysql -h db -u root -proot --skip-ssl sispatrimonio -e "SELECT COUNT(*) FROM bens WHERE patrimonio='TEST-RESTORE'" -sN)

if [ "$COUNT_FINAL" -eq "1" ]; then
    echo "   SUCESSO TOTAL: O registro foi restaurado corretamente!"
else
    echo "   FALHA CRÍTICA: O registro NÃO foi encontrado após a restauração."
    exit 1
fi

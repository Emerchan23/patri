# SIS Patrimônio — aplicativo móvel unificado

Aplicativo Flutter para consulta e gestão móvel de bens patrimoniais. A consulta pública/por QR Code e a área autenticada de gestão estão reunidas neste mesmo app e usam a mesma URL de servidor. Este é o projeto unificado localizado em `mobile/` dentro do repositório do sistema web; não gere nem distribua o APK da pasta legada `aplicativo de celular visualizador`.

## Funcionalidades móveis

- Consulta por QR Code, código digitado, lista pesquisável e detalhes do bem.
- Movimentação de um ou vários bens: seleção por lista ou leitura em sequência; destino comum revisado uma vez; opção de continuar para outro lote no mesmo destino.
- Solicitações de movimentação e cadastros provisórios, com ações de acompanhamento/revisão de acordo com perfil e permissões retornados pela API.
- Cadastro/edição de bens; empréstimos e devolução; consulta de veículos; notificações; relatórios; estados de envio/colagem de etiquetas.
- Painel de pendências patrimoniais: etiquetas, localização incompleta, conservação e empréstimos vencidos.
- Consulta de processos de alienação, bens vinculados e comissão (conclusão/baixa do processo permanece no fluxo web).
- Histórico de auditoria somente para administradores, sem exibir endereço IP ou snapshots de dados anteriores/novos.
- Integrações/API para administradores: listar chaves mascaradas, criar com exibição única do segredo e revogar com confirmação.
- Configuração compartilhada do endereço do servidor para as telas autenticadas e de consulta.

## Endereço do servidor

Abra **Configurações** no app e informe a origem da API, sem acrescentar `/api`:

- Emulador Android: `http://10.0.2.2:3005` quando o backend estiver na porta 3005 da máquina de desenvolvimento.
- VPS, sem domínio: informe `http://IP_DA_VPS:7400` se essa porta estiver acessível a partir do aparelho; também funciona com IP/porta de uma rede privada ou VPN. `10.0.2.2` só funciona no emulador e aponta para o computador que o executa, não para a VPS.
- Celular físico: use o IP/porta alcançável pelo aparelho na mesma rede local ou por uma VPN. Não é necessário cadastrar domínio.

**Segurança:** HTTP transmite senha e cookie de sessão sem criptografia. Use o endereço HTTP somente dentro de uma rede privada confiável ou de uma VPN (por exemplo, Tailscale/WireGuard); não exponha login HTTP à internet pública. HTTPS não é requisito do app, mas uma VPN/túnel criptografado é recomendável para acesso remoto.

Use **Testar** antes de salvar. O app não conhece nem presume o endereço público da VPS.

## Executar e validar

Na pasta deste projeto:

```powershell
flutter pub get
flutter test
flutter analyze
flutter run
```

Para gerar APK de teste Android:

```powershell
flutter build apk --debug
```

O APK gerado fica em `build/app/outputs/flutter-apk/app-debug.apk`. Uma compilação debug é para validação; distribuição requer preparar e assinar uma versão release.

### Assinatura de distribuição

O Release usa uma chave privada somente quando `android/key.properties` contém `keyAlias`, `keyPassword`, `storeFile` e `storePassword`. Esse arquivo e chaves `.jks`/`.keystore` já são ignorados pelo Git. Guarde a chave e uma cópia de segurança em local privado e controlado; nunca envie a chave ou senhas pelo chat nem as inclua no repositório. Depois de configurar, gere com `flutter build apk --release` e mantenha a mesma chave para todas as atualizações instaláveis do app. Sem `key.properties`, o Gradle avisa e assina com a chave debug para teste/sideload; esse APK não serve para distribuição oficial.

## Notas de validação

- O fluxo de seleção de múltiplos bens e revisão da movimentação foi aberto no emulador; nenhuma movimentação foi confirmada no servidor durante o teste.
- O emulador não representa a câmera de um telefone real; a leitura física de QR Code ainda precisa ser conferida em aparelho com câmera.
- `10.0.2.2` serve apenas para o emulador alcançar o computador local. Para a VPS, use IP e porta diretamente, sem domínio; confirme que o IP é roteável pelo emulador/aparelho. Se o tráfego usar HTTP, mantenha-o dentro de rede privada/VPN porque credenciais e sessões não são criptografadas.
- As funções móveis utilizam os endpoints e permissões existentes do sistema web. Alterações neste app não aplicam migrações ao banco de dados nem publicam a imagem Docker.

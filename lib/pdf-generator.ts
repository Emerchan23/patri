import { type PdfSettings, defaultPdfSettings } from "./data"
import { api } from "./api-client"

// PDF generation utility using browser print
// Generates HTML-based reports that can be printed/saved as PDF

function formatDateTime(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())
}

function buildHeader(settings: PdfSettings): string {
  const logoHtml =
    settings.mostrarLogo && settings.logoUrl
      ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 60px; max-width: 120px; object-fit: contain;" />`
      : settings.mostrarLogo
        ? `<div style="width: 60px; height: 60px; border-radius: 8px; background: #1a56a8; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">SP</div>`
        : ""

  return `
    <div style="display: flex; align-items: center; gap: 16px; padding-bottom: 16px; border-bottom: 2px solid #1a56a8; margin-bottom: 24px;">
      ${logoHtml}
      <div style="flex: 1;">
        <h1 style="margin: 0; font-size: 16px; font-weight: 700; color: #1a2332;">${settings.nomeOrgao}</h1>
        <p style="margin: 2px 0 0; font-size: 11px; color: #5a6577;">${settings.subtitulo}</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #8892a4;">${settings.endereco}</p>
        <p style="margin: 1px 0 0; font-size: 10px; color: #8892a4;">CNPJ: ${settings.cnpj} | Tel: ${settings.telefone}</p>
      </div>
      ${settings.mostrarDataHora ? `<div style="text-align: right; font-size: 10px; color: #8892a4;"><p style="margin:0;">Emitido em</p><p style="margin:2px 0 0; font-weight: 600; color: #5a6577;">${formatDateTime()}</p></div>` : ""}
    </div>
  `
}

function buildFooter(settings: PdfSettings, _pageNum?: number): string {
  return `
    <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #e0e4ea;">
      ${
        settings.mostrarAssinatura
          ? `
        <div style="margin: 40px auto 24px; width: 300px; text-align: center;">
          <div style="border-top: 1px solid #333; padding-top: 8px;">
            <p style="margin: 0; font-size: 12px; font-weight: 600;">${settings.assinaturaTexto}</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #5a6577;">${settings.assinaturaCargo}</p>
          </div>
        </div>
      `
          : ""
      }
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #8892a4;">
        <span>${settings.rodape}</span>
        ${settings.mostrarNumeroPagina ? "<span>Pagina 1</span>" : ""}
      </div>
    </div>
  `
}

function buildTable(headers: string[], rows: string[][]): string {
  const thStyle =
    'style="padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 600; color: #5a6577; background: #f4f6f9; border-bottom: 2px solid #e0e4ea; text-transform: uppercase; letter-spacing: 0.5px;"'
  const tdStyle =
    'style="padding: 7px 12px; font-size: 11px; color: #333; border-bottom: 1px solid #eef0f4;"'

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr>
          ${headers.map((h) => `<th ${thStyle}>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td ${tdStyle}>${cell}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `
}

function openPrintWindow(html: string, title: string) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    alert("Por favor, permita pop-ups para gerar o PDF.")
    return
  }
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { margin: 20mm 15mm; size: A4; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a2332; margin: 0; padding: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `)
  printWindow.document.close()
  setTimeout(() => printWindow.print(), 500)
}

// ==========================================
// REPORT GENERATORS
// ==========================================

export interface ReportOptions {
  settings?: PdfSettings
  secretaria?: string
  departamento?: string
  categoria?: string
  status?: string
  dataInicio?: string
  dataFim?: string
}

export function gerarRelatorioInventarioGeral(
  assets: Array<{
    patrimonio: string
    descricao: string
    categoria: string
    localizacao: { secretaria: string; departamento: string; sala: string }
    responsavel: { nome: string }
    valor: number
    status: string
  }>,
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const filtered = assets.filter((a) => {
    if (options.secretaria && options.secretaria !== "todas" && !a.localizacao.secretaria.includes(options.secretaria)) return false
    if (options.departamento && options.departamento !== "todos" && a.localizacao.departamento !== options.departamento) return false
    if (options.categoria && options.categoria !== "todas" && a.categoria !== options.categoria) return false
    if (options.status && options.status !== "todos" && a.status !== options.status) return false
    return true
  })

  const totalValor = filtered.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  const title = "Relatorio de Inventario Geral"
  const subtitle = options.secretaria && options.secretaria !== "todas" ? `Secretaria: ${options.secretaria}` : "Todas as Secretarias"

  const headers = ["Patrimonio", "Descricao", "Categoria", "Localizacao", "Responsavel", "Valor", "Status"]
  const rows = filtered.map((a) => [
    a.patrimonio,
    a.descricao,
    a.categoria,
    `${a.localizacao.departamento} / ${a.localizacao.sala}`,
    a.responsavel.nome,
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(a.valor),
    a.status,
  ])

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
      <p style="margin: 4px 0 0; font-size: 12px; color: #5a6577;">${subtitle}</p>
    </div>
    <div style="display: flex; gap: 24px; margin-bottom: 16px; padding: 12px; background: #f4f6f9; border-radius: 8px;">
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Total de Bens</span><span style="font-size: 16px; font-weight: 700;">${filtered.length}</span></div>
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Valor Total</span><span style="font-size: 16px; font-weight: 700;">${valorFormatado}</span></div>
    </div>
    ${buildTable(headers, rows)}
    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: "Relatorio de Inventario Geral gerado",
    detalhes: `Filtros: ${JSON.stringify({ ...options, settings: undefined })}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarRelatorioPorSecretaria(
  assets: Array<{
    patrimonio: string
    descricao: string
    categoria: string
    localizacao: { secretaria: string; departamento: string; sala: string }
    responsavel: { nome: string }
    valor: number
    status: string
  }>,
  secretariaNome: string,
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const filtered = assets.filter((a) => a.localizacao.secretaria.includes(secretariaNome))
  const totalValor = filtered.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  // Group by department
  const byDepartment: Record<string, typeof filtered> = {}
  for (const a of filtered) {
    const dept = a.localizacao.departamento
    if (!byDepartment[dept]) byDepartment[dept] = []
    byDepartment[dept].push(a)
  }

  const title = `Relatorio Patrimonial - Sec. de ${secretariaNome}`
  const headers = ["Patrimonio", "Descricao", "Sala", "Responsavel", "Valor", "Status"]

  let tablesHtml = ""
  for (const [dept, items] of Object.entries(byDepartment)) {
    const deptValor = items.reduce((sum, a) => sum + a.valor, 0)
    tablesHtml += `
      <div style="margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
           <h3 style="margin: 0; font-size: 13px; font-weight: 600; color: #1a2332;">${dept}</h3>
           <span style="font-size: 11px; color: #5a6577;">${items.length} bens | ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deptValor)}</span>
        </div>
        ${buildTable(
          headers,
          items.map((a) => [
            a.patrimonio,
            a.descricao,
            a.localizacao.sala,
            a.responsavel.nome,
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(a.valor),
            a.status,
          ])
        )}
      </div>
    `
  }

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
    </div>
    <div style="display: flex; gap: 24px; margin-bottom: 8px; padding: 12px; background: #f4f6f9; border-radius: 8px;">
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Total de Bens</span><span style="font-size: 16px; font-weight: 700;">${filtered.length}</span></div>
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Valor Total</span><span style="font-size: 16px; font-weight: 700;">${valorFormatado}</span></div>
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Departamentos</span><span style="font-size: 16px; font-weight: 700;">${Object.keys(byDepartment).length}</span></div>
    </div>
    ${tablesHtml}
    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: `Relatorio por Secretaria: ${secretariaNome}`,
    detalhes: `Secretaria: ${secretariaNome}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarRelatorioMovimentacoes(
  movements: Array<{
    patrimonio: string
    assetDescricao: string
    de: { secretaria: string; departamento: string; sala: string }
    para: { secretaria: string; departamento: string; sala: string }
    responsavel: string
    data: string
    motivo: string
  }>,
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const title = "Relatorio de Movimentacoes Patrimoniais"

  const headers = ["Patrimonio", "Descricao", "Origem", "Destino", "Responsavel", "Data", "Motivo"]
  const rows = movements.map((m) => [
    m.patrimonio,
    m.assetDescricao,
    `${m.de.departamento} / ${m.de.sala}`,
    `${m.para.departamento} / ${m.para.sala}`,
    m.responsavel,
    new Intl.DateTimeFormat("pt-BR").format(new Date(m.data + "T00:00:00")),
    m.motivo,
  ])

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
      <p style="margin: 4px 0 0; font-size: 12px; color: #5a6577;">Total de movimentacoes: ${movements.length}</p>
    </div>
    ${buildTable(headers, rows)}
    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: "Relatorio de Movimentacoes",
    detalhes: `Total: ${movements.length}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarRelatorioTermoResponsabilidade(
  asset: {
    patrimonio: string
    descricao: string
    categoria: string
    marca?: string
    modelo?: string
    numeroSerie?: string
    localizacao: { secretaria: string; departamento: string; sala: string }
    responsavel: { nome: string; cargo: string }
    valor: number
    dataAquisicao: string
    estadoConservacao?: string
  },
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const title = "Termo de Responsabilidade Patrimonial"
  const valorFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(asset.valor)

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 24px; text-align: center;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
    </div>

    <p style="font-size: 12px; line-height: 1.8; color: #333; text-align: justify;">
      Pelo presente termo, eu, <strong>${asset.responsavel.nome}</strong>, ocupante do cargo de
      <strong>${asset.responsavel.cargo}</strong>, lotado(a) na <strong>${asset.localizacao.secretaria}</strong>,
      departamento de <strong>${asset.localizacao.departamento}</strong>, declaro ter recebido e estar
      sob minha inteira responsabilidade o(s) bem(ns) patrimonial(is) abaixo descrito(s), comprometendo-me
      a zelar pela sua guarda, conservacao e uso adequado.
    </p>

    <div style="margin: 24px 0; padding: 16px; border: 1px solid #e0e4ea; border-radius: 8px;">
      <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #1a56a8;">Dados do Bem</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 12px; font-size: 11px; color: #8892a4; width: 160px;">Patrimonio</td>
          <td style="padding: 6px 12px; font-size: 12px; font-weight: 600;">${asset.patrimonio}</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Descricao</td>
          <td style="padding: 6px 12px; font-size: 12px; font-weight: 600;">${asset.descricao}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Categoria</td>
          <td style="padding: 6px 12px; font-size: 12px;">${asset.categoria}</td>
        </tr>
        ${asset.marca ? `<tr style="background: #f9fafb;"><td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Marca / Modelo</td><td style="padding: 6px 12px; font-size: 12px;">${asset.marca} ${asset.modelo || ""}</td></tr>` : ""}
        ${asset.numeroSerie ? `<tr><td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Numero de Serie</td><td style="padding: 6px 12px; font-size: 12px; font-family: monospace;">${asset.numeroSerie}</td></tr>` : ""}
        <tr style="background: #f9fafb;">
          <td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Localizacao</td>
          <td style="padding: 6px 12px; font-size: 12px;">${asset.localizacao.departamento} - ${asset.localizacao.sala}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Valor</td>
          <td style="padding: 6px 12px; font-size: 12px; font-weight: 600;">${valorFmt}</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Data de Aquisicao</td>
          <td style="padding: 6px 12px; font-size: 12px;">${new Intl.DateTimeFormat("pt-BR").format(new Date(asset.dataAquisicao + "T00:00:00"))}</td>
        </tr>
        ${asset.estadoConservacao ? `<tr><td style="padding: 6px 12px; font-size: 11px; color: #8892a4;">Estado de Conservacao</td><td style="padding: 6px 12px; font-size: 12px;">${asset.estadoConservacao}</td></tr>` : ""}
      </table>
    </div>

    <p style="font-size: 11px; line-height: 1.8; color: #5a6577; text-align: justify; margin-top: 16px;">
      Declaro estar ciente de que responderei por eventuais danos causados ao bem por
      negligencia, imprudencia ou mau uso, ficando obrigado(a) a comunicar imediatamente ao
      setor de patrimonio qualquer avaria, extravio ou sinistro que venha a ocorrer.
    </p>

    <div style="margin-top: 48px; display: flex; gap: 48px; justify-content: center;">
      <div style="text-align: center; width: 250px;">
        <div style="border-top: 1px solid #333; padding-top: 8px;">
          <p style="margin: 0; font-size: 11px; font-weight: 600;">${asset.responsavel.nome}</p>
          <p style="margin: 2px 0 0; font-size: 10px; color: #5a6577;">${asset.responsavel.cargo}</p>
        </div>
      </div>
      <div style="text-align: center; width: 250px;">
        <div style="border-top: 1px solid #333; padding-top: 8px;">
          <p style="margin: 0; font-size: 11px; font-weight: 600;">${settings.assinaturaTexto}</p>
          <p style="margin: 2px 0 0; font-size: 10px; color: #5a6577;">${settings.assinaturaCargo}</p>
        </div>
      </div>
    </div>

    <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #e0e4ea;">
      <div style="display: flex; justify-content: space-between; font-size: 9px; color: #8892a4;">
        <span>${settings.rodape}</span>
        ${settings.mostrarDataHora ? `<span>Emitido em: ${formatDateTime()}</span>` : ""}
      </div>
    </div>
  `

  api.createLog({
    acao: "termo_responsabilidade",
    descricao: `Termo de Responsabilidade: ${asset.descricao}`,
    entidade: { tipo: "bem", id: asset.patrimonio, descricao: asset.descricao },
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarRelatorioBaixas(
  assets: Array<{
    patrimonio: string
    descricao: string
    categoria: string
    localizacao: { secretaria: string; departamento: string; sala: string }
    valor: number
    status: string
  }>,
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const baixados = assets.filter((a) => a.status === "baixado")
  const totalValor = baixados.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  const title = "Relatorio de Bens Baixados"
  const headers = ["Patrimonio", "Descricao", "Categoria", "Secretaria", "Departamento", "Valor"]
  const rows = baixados.map((a) => [
    a.patrimonio,
    a.descricao,
    a.categoria,
    a.localizacao.secretaria,
    a.localizacao.departamento,
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(a.valor),
  ])

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
    </div>
    <div style="display: flex; gap: 24px; margin-bottom: 16px; padding: 12px; background: #fff0f0; border-radius: 8px; border: 1px solid #fecaca;">
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Bens Baixados</span><span style="font-size: 16px; font-weight: 700; color: #dc2626;">${baixados.length}</span></div>
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Valor Perdido</span><span style="font-size: 16px; font-weight: 700; color: #dc2626;">${valorFormatado}</span></div>
    </div>
    ${buildTable(headers, rows)}
    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: "Relatorio de Bens Baixados",
    detalhes: `Total baixados: ${baixados.length}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarRelatorioProvisorio(
  assets: Array<{
    patrimonio: string
    descricao: string
    categoria: string
    localizacao: { secretaria: string; departamento: string; sala: string }
    responsavel: { nome: string }
    valor: number
    patrimonioTipo: string
    dataAquisicao: string
  }>,
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const provisorios = assets.filter((a) => a.patrimonioTipo === "provisorio")
  const totalValor = provisorios.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  const title = "Relatorio de Patrimonios Provisorios"
  const headers = ["Patrimonio Prov.", "Descricao", "Categoria", "Localizacao", "Responsavel", "Data Aquisicao", "Valor"]
  const rows = provisorios.map((a) => [
    a.patrimonio,
    a.descricao,
    a.categoria,
    `${a.localizacao.departamento}`,
    a.responsavel.nome,
    new Intl.DateTimeFormat("pt-BR").format(new Date(a.dataAquisicao + "T00:00:00")),
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(a.valor),
  ])

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
      <p style="margin: 4px 0 0; font-size: 12px; color: #5a6577;">Bens aguardando atribuicao de patrimonio definitivo</p>
    </div>
    <div style="display: flex; gap: 24px; margin-bottom: 16px; padding: 12px; background: #fffbeb; border-radius: 8px; border: 1px solid #fed7aa;">
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Total Provisorios</span><span style="font-size: 16px; font-weight: 700; color: #d97706;">${provisorios.length}</span></div>
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Valor Total</span><span style="font-size: 16px; font-weight: 700; color: #d97706;">${valorFormatado}</span></div>
    </div>
    ${buildTable(headers, rows)}
    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: "Relatorio de Patrimonios Provisorios",
    detalhes: `Total provisorios: ${provisorios.length}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarTermoAlienacao(
  alienacao: {
    tipo: string
    numero_processo: string
    data_abertura: string
    observacoes: string
    destinatario_nome?: string
    destinatario_documento?: string
    itens: Array<{
      patrimonio: string
      descricao: string
      valor_avaliacao: number
      valor_contabil: number
    }>
    comissao: Array<{
      nome: string
      cargo: string
      tipo_membro: string
    }>
    valor_total_avaliacao: number
  },
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const tipoLabel = alienacao.tipo.charAt(0).toUpperCase() + alienacao.tipo.slice(1)
  const title = `Termo de ${tipoLabel} de Bens Patrimoniais`
  
  const valorTotalFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(alienacao.valor_total_avaliacao)
  
  const headers = ["Patrimonio", "Descricao", "Valor Avaliacao"]
  const rows = alienacao.itens.map((item) => [
    item.patrimonio,
    item.descricao,
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor_avaliacao),
  ])

  // Gerar HTML da comissao para assinatura
  const assinaturasComissao = alienacao.comissao.map(membro => `
    <div style="text-align: center; width: 200px;">
      <div style="border-top: 1px solid #333; padding-top: 8px; margin-top: 40px;">
        <p style="margin: 0; font-size: 11px; font-weight: 600;">${membro.nome}</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #5a6577;">${membro.cargo}</p>
        <p style="margin: 0; font-size: 9px; color: #8892a4;">(${membro.tipo_membro})</p>
      </div>
    </div>
  `).join('')

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 24px; text-align: center;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
      <p style="margin: 4px 0 0; font-size: 12px; color: #5a6577;">Processo Administrativo Nº ${alienacao.numero_processo}</p>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #333; text-align: justify; margin-bottom: 20px;">
      <p>
        Aos <strong>${new Date().toLocaleDateString("pt-BR")}</strong>, referente ao Processo Administrativo nº <strong>${alienacao.numero_processo}</strong>,
        o orgao <strong>${settings.nomeOrgao}</strong>, neste ato representado pela Comissao de Avaliacao designada,
        procede com a alienacao na modalidade <strong>${tipoLabel.toUpperCase()}</strong> dos bens abaixo relacionados,
        considerados inserviveis ou disponiveis para desfazimento.
      </p>
      ${alienacao.destinatario_nome ? `
      <p style="margin-top: 10px;">
        Destinatario: <strong>${alienacao.destinatario_nome}</strong><br>
        Documento (CPF/CNPJ): ${alienacao.destinatario_documento || "Nao informado"}
      </p>
      ` : ""}
    </div>

    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 14px; font-weight: 600; color: #1a56a8; margin-bottom: 8px;">Relacao de Bens</h3>
      ${buildTable(headers, rows)}
      <div style="text-align: right; font-size: 14px; font-weight: 700; margin-top: 8px;">
        Valor Total Avaliado: ${valorTotalFmt}
      </div>
    </div>

    <div style="font-size: 12px; line-height: 1.6; color: #333; text-align: justify;">
      <p>
        A Comissao de Avaliacao atesta que os valores acima refletem o estado atual dos bens e o valor de mercado estimado,
        estando de acordo com as normas legais vigentes para alienacao de bens publicos.
      </p>
      ${alienacao.observacoes ? `<p><strong>Observacoes:</strong> ${alienacao.observacoes}</p>` : ""}
    </div>

    <div style="margin-top: 40px;">
      <h3 style="font-size: 12px; font-weight: 600; text-align: center; margin-bottom: 20px;">Assinaturas da Comissao de Avaliacao</h3>
      <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 32px;">
        ${assinaturasComissao}
      </div>
    </div>

    ${alienacao.destinatario_nome ? `
    <div style="margin-top: 40px; display: flex; justify-content: center;">
      <div style="text-align: center; width: 300px;">
        <div style="border-top: 1px solid #333; padding-top: 8px;">
          <p style="margin: 0; font-size: 11px; font-weight: 600;">${alienacao.destinatario_nome}</p>
          <p style="margin: 2px 0 0; font-size: 10px; color: #5a6577;">Destinatario / Arrematante</p>
        </div>
      </div>
    </div>
    ` : ""}

    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: `Termo de Alienacao: ${alienacao.numero_processo}`,
    detalhes: `Tipo: ${alienacao.tipo}, Itens: ${alienacao.itens.length}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

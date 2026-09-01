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
  sala?: string
  categoria?: string
  grupo?: string
  status?: string
  dataInicio?: string
  dataFim?: string
  titulo?: string
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function gerarRelatorioInventarioGeral(
  assets: Array<{
    patrimonio: string
    descricao: string
    categoria: string
    grupo?: string
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
    if (options.grupo && options.grupo !== "todos" && a.grupo !== options.grupo) return false
    if (options.status && options.status !== "todos" && a.status !== options.status) return false
    return true
  })

  const totalValor = filtered.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  let title = "Relatorio de Inventario Geral"
  if (options.titulo) title = options.titulo
  
  const subtitle = options.secretaria && options.secretaria !== "todas" ? `Secretaria: ${options.secretaria}` : "Todas as Secretarias"

  const headers = ["Patrimonio", "Descricao", "Grupo", "Categoria", "Localizacao", "Responsavel", "Valor", "Status"]
  const rows = filtered.map((a) => [
    a.patrimonio,
    a.descricao,
    a.grupo || "-",
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
  const filtered = assets.filter((a) => secretariaNome === "todas" || a.localizacao.secretaria.includes(secretariaNome))
  const totalValor = filtered.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  // Group by department
  const byDepartment: Record<string, typeof filtered> = {}
  for (const a of filtered) {
    const dept = secretariaNome === "todas" 
        ? `${a.localizacao.secretaria} - ${a.localizacao.departamento}`
        : a.localizacao.departamento
    if (!byDepartment[dept]) byDepartment[dept] = []
    byDepartment[dept].push(a)
  }

  const title = secretariaNome === "todas" ? "Relatorio Patrimonial - Todas as Secretarias" : `Relatorio Patrimonial - Sec. de ${secretariaNome}`
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

export function gerarRelatorioPorDepartamento(
  assets: Array<{
    patrimonio: string
    descricao: string
    categoria: string
    localizacao: { secretaria: string; departamento: string; sala: string }
    responsavel: { nome: string }
    valor: number
    status: string
  }>,
  departamentoNome: string,
  secretariaNome: string,
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const filtered = assets.filter((a) => 
    (departamentoNome === "todos" || a.localizacao.departamento === departamentoNome) && 
    (secretariaNome === "todas" || a.localizacao.secretaria.includes(secretariaNome))
  )
  const totalValor = filtered.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  // Group by Sala
  const bySala: Record<string, typeof filtered> = {}
  for (const a of filtered) {
    const sala = departamentoNome === "todos" ? `${a.localizacao.departamento} - ${a.localizacao.sala}` : a.localizacao.sala
    if (!bySala[sala]) bySala[sala] = []
    bySala[sala].push(a)
  }

  const title = departamentoNome === "todos" ? "Relatorio Patrimonial - Todos os Departamentos" : `Relatorio Patrimonial - Depto. ${departamentoNome}`
  const subtitle = secretariaNome === "todas" ? "Todas as Secretarias" : `Secretaria: ${secretariaNome}`
  const headers = ["Patrimonio", "Descricao", "Responsavel", "Valor", "Status"]

  let tablesHtml = ""
  for (const [sala, items] of Object.entries(bySala)) {
    const salaValor = items.reduce((sum, a) => sum + a.valor, 0)
    tablesHtml += `
      <div style="margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
           <h3 style="margin: 0; font-size: 13px; font-weight: 600; color: #1a2332;">Sala: ${sala}</h3>
           <span style="font-size: 11px; color: #5a6577;">${items.length} bens | ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(salaValor)}</span>
        </div>
        ${buildTable(
          headers,
          items.map((a) => [
            a.patrimonio,
            a.descricao,
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
      <p style="margin: 4px 0 0; font-size: 12px; color: #5a6577;">${subtitle}</p>
    </div>
    <div style="display: flex; gap: 24px; margin-bottom: 8px; padding: 12px; background: #f4f6f9; border-radius: 8px;">
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Total de Bens</span><span style="font-size: 16px; font-weight: 700;">${filtered.length}</span></div>
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Valor Total</span><span style="font-size: 16px; font-weight: 700;">${valorFormatado}</span></div>
      <div><span style="font-size: 10px; color: #8892a4; display: block;">Salas</span><span style="font-size: 16px; font-weight: 700;">${Object.keys(bySala).length}</span></div>
    </div>
    ${tablesHtml}
    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: `Relatorio por Departamento: ${departamentoNome}`,
    detalhes: `Secretaria: ${secretariaNome}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarRelatorioPorSala(
  assets: Array<{
    patrimonio: string
    descricao: string
    categoria: string
    localizacao: { secretaria: string; departamento: string; sala: string }
    responsavel: { nome: string }
    valor: number
    status: string
  }>,
  salaNome: string,
  departamentoNome: string,
  secretariaNome: string,
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const filtered = assets.filter((a) => 
    (salaNome === "todos" || a.localizacao.sala === salaNome) && 
    (departamentoNome === "todos" || a.localizacao.departamento === departamentoNome) &&
    (secretariaNome === "todas" || a.localizacao.secretaria.includes(secretariaNome))
  )
  const totalValor = filtered.reduce((sum, a) => sum + a.valor, 0)
  const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValor)

  const title = salaNome === "todos" ? "Relatorio Patrimonial - Todas as Salas" : `Relatorio Patrimonial - Sala: ${salaNome}`
  const subtitle = `${secretariaNome === "todas" ? "Todas Secretarias" : secretariaNome} / ${departamentoNome === "todos" ? "Todos Departamentos" : departamentoNome}`
  const headers = ["Patrimonio", "Descricao", "Categoria", "Responsavel", "Valor", "Status"]

  const rows = filtered.map((a) => [
    a.patrimonio,
    a.descricao,
    a.categoria,
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
    descricao: `Relatorio por Sala: ${salaNome}`,
    detalhes: `Depto: ${departamentoNome}`,
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

  let title = "Relatorio de Inventario Geral"
  if (options.titulo) title = options.titulo
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

export function gerarPdfApoioColagemEtiquetas(
  assets: Array<{
    id: string | number
    patrimonio: string
    descricao: string
    numeroSerie?: string
    marca?: string
    modelo?: string
    imagem?: string
    etiquetaStatus?: "pendente" | "enviada" | "colada" | null
    localizacao: { secretaria: string; departamento: string; sala: string }
    responsavel: { nome: string }
  }>,
  options: ReportOptions & { somenteAguardandoColagem?: boolean } = {}
) {
  const settings = options.settings || defaultPdfSettings
  const filtered = options.somenteAguardandoColagem
    ? assets.filter((asset) => asset.etiquetaStatus === "enviada")
    : assets

  const comNumeroSerie = filtered.filter((asset) => Boolean(asset.numeroSerie?.trim())).length
  const semNumeroSerie = filtered.length - comNumeroSerie
  const title = options.somenteAguardandoColagem
    ? "PDF de Apoio a Colagem - Aguardando Colagem"
    : "PDF de Apoio a Colagem - Pendencias Filtradas"

  const escopo: string[] = []
  if (options.secretaria) escopo.push(`Secretaria: ${escapeHtml(options.secretaria)}`)
  if (options.departamento) escopo.push(`Departamento: ${escapeHtml(options.departamento)}`)
  if (options.sala) escopo.push(`Sala: ${escapeHtml(options.sala)}`)

  const cardsHtml = filtered
    .map((asset, index) => {
      const patrimonio = escapeHtml(asset.patrimonio || "Sem patrimonio")
      const descricao = escapeHtml(asset.descricao)
      const numeroSerie = asset.numeroSerie?.trim()
        ? escapeHtml(asset.numeroSerie)
        : "Sem numero de serie informado"
      const marcaModelo = [asset.marca, asset.modelo].filter(Boolean).map(escapeHtml).join(" / ")
      const localizacao = [
        asset.localizacao.secretaria,
        asset.localizacao.departamento,
        asset.localizacao.sala,
      ]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" / ")
      const responsavel = escapeHtml(asset.responsavel?.nome || "Nao informado")
      const status = asset.etiquetaStatus === "enviada" ? "Aguardando colagem" : "Pendente"
      const imageHtml = asset.imagem
        ? `<img src="${escapeHtml(asset.imagem)}" alt="${descricao}" style="width: 96px; height: 96px; object-fit: cover; border-radius: 10px; border: 1px solid #d9e0ea;" />`
        : `<div style="width: 96px; height: 96px; border-radius: 10px; border: 1px dashed #c7d0dd; display:flex; align-items:center; justify-content:center; font-size:11px; color:#7c8798; text-align:center; padding:8px;">Sem foto</div>`

      return `
        <div style="page-break-inside: avoid; border: 1px solid #d9e0ea; border-radius: 14px; padding: 14px; margin-bottom: 14px; background: #fff;">
          <div style="display: flex; gap: 14px; align-items: flex-start;">
            <div style="flex: 0 0 96px;">${imageHtml}</div>
            <div style="flex: 1;">
              <div style="display:flex; justify-content: space-between; gap: 10px; align-items:flex-start;">
                <div>
                  <div style="display:inline-block; padding: 4px 10px; border-radius: 999px; background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:700; letter-spacing:0.3px;">${patrimonio}</div>
                  <h3 style="margin: 10px 0 6px; font-size: 16px; line-height: 1.25; color:#122033;">${descricao}</h3>
                </div>
                <div style="padding: 4px 8px; border-radius: 999px; background:#fef3c7; color:#92400e; font-size:10px; font-weight:700; white-space:nowrap;">${status}</div>
              </div>
              <div style="margin-top: 8px; padding: 10px 12px; border-radius: 10px; background:#f8fafc; border:1px solid #e2e8f0;">
                <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Numero de Serie</div>
                <div style="margin-top:4px; font-size:15px; line-height:1.35; font-weight:700; color:#0f172a; font-family: 'Consolas', 'Courier New', monospace;">${numeroSerie}</div>
              </div>
              <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; margin-top: 10px;">
                <div>
                  <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Marca / Modelo</div>
                  <div style="margin-top:3px; font-size:12px; color:#1f2937;">${marcaModelo || "Nao informado"}</div>
                </div>
                <div>
                  <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Responsavel</div>
                  <div style="margin-top:3px; font-size:12px; color:#1f2937;">${responsavel}</div>
                </div>
                <div style="grid-column: 1 / -1;">
                  <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Localizacao</div>
                  <div style="margin-top:3px; font-size:12px; color:#1f2937;">${localizacao || "Nao informada"}</div>
                </div>
              </div>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap: 16px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed #d9e0ea;">
            <div style="font-size:11px; color:#64748b;">Item ${index + 1} de ${filtered.length}</div>
            <div style="display:flex; align-items:center; gap: 14px; font-size:11px; color:#334155;">
              <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border:1px solid #64748b; border-radius:3px; display:inline-block;"></span> Conferido</span>
              <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border:1px solid #64748b; border-radius:3px; display:inline-block;"></span> Etiqueta colada</span>
            </div>
          </div>
        </div>
      `
    })
    .join("")

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 18px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
      <p style="margin: 4px 0 0; font-size: 12px; color: #5a6577;">
        Folha operacional para conferencia e colagem de etiquetas patrimoniais.
      </p>
      ${escopo.length > 0 ? `<p style="margin: 8px 0 0; font-size: 11px; color: #64748b;">${escopo.join(" | ")}</p>` : ""}
    </div>
    <div style="display:flex; gap:16px; margin-bottom:16px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
      <div><span style="font-size:10px; color:#64748b; display:block;">Itens no PDF</span><span style="font-size:16px; font-weight:700;">${filtered.length}</span></div>
      <div><span style="font-size:10px; color:#64748b; display:block;">Com numero de serie</span><span style="font-size:16px; font-weight:700;">${comNumeroSerie}</span></div>
      <div><span style="font-size:10px; color:#64748b; display:block;">Sem numero de serie</span><span style="font-size:16px; font-weight:700;">${semNumeroSerie}</span></div>
    </div>
    ${cardsHtml || `<div style="padding:18px; border:1px dashed #cbd5e1; border-radius:10px; color:#64748b; font-size:12px;">Nenhum item encontrado para este PDF.</div>`}
    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: "PDF de apoio a colagem gerado",
    detalhes: `Total: ${filtered.length} | Somente aguardando colagem: ${options.somenteAguardandoColagem ? "sim" : "nao"}`,
  }).catch(console.error)

  openPrintWindow(html, title)
}

export function gerarPdfSolicitacaoMovimentacao(
  solicitacao: {
    id: string | number
    solicitanteNome: string
    solicitanteRole?: string
    secretariaOrigem: string
    secretariaDestino: string
    departamentoDestino: string
    salaDestino: string
    motivo: string
    status: string
    criadoEm?: string
    decididoEm?: string
    aprovadoPorNome?: string | null
    rejeitadoPorNome?: string | null
    canceladoPorNome?: string | null
    motivoRejeicao?: string
    itens: Array<{
      patrimonio: string
      bemDescricao: string
      de?: {
        secretaria?: string
        departamento?: string
        sala?: string
      }
    }>
  },
  options: ReportOptions = {}
) {
  const settings = options.settings || defaultPdfSettings
  const title = `Solicitacao de Mudanca Patrimonial #${solicitacao.id}`
  const statusLabel = {
    pendente: "Pendente",
    aprovada: "Aprovada",
    rejeitada: "Rejeitada",
    cancelada: "Cancelada",
  }[solicitacao.status] || solicitacao.status

  const itensRows = solicitacao.itens.map((item) => [
    escapeHtml(item.patrimonio || "-"),
    escapeHtml(item.bemDescricao || "-"),
    escapeHtml(item.de?.secretaria || solicitacao.secretariaOrigem || "-"),
    escapeHtml(item.de?.departamento || "-"),
    escapeHtml(item.de?.sala || "-"),
  ])

  const historicoDecisao = solicitacao.aprovadoPorNome
    ? `Aprovada por ${escapeHtml(solicitacao.aprovadoPorNome)}${solicitacao.decididoEm ? ` em ${new Intl.DateTimeFormat("pt-BR").format(new Date(solicitacao.decididoEm))}` : ""}.`
    : solicitacao.rejeitadoPorNome
      ? `Rejeitada por ${escapeHtml(solicitacao.rejeitadoPorNome)}${solicitacao.decididoEm ? ` em ${new Intl.DateTimeFormat("pt-BR").format(new Date(solicitacao.decididoEm))}` : ""}.`
      : solicitacao.canceladoPorNome
        ? `Cancelada por ${escapeHtml(solicitacao.canceladoPorNome)}${solicitacao.decididoEm ? ` em ${new Intl.DateTimeFormat("pt-BR").format(new Date(solicitacao.decididoEm))}` : ""}.`
        : "Aguardando decisao do patrimonio."

  const html = `
    ${buildHeader(settings)}
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a56a8;">${title}</h2>
      <p style="margin: 4px 0 0; font-size: 12px; color: #5a6577;">
        Documento de solicitacao de mudanca de local patrimonial.
      </p>
    </div>

    <div style="display:flex; gap: 16px; flex-wrap: wrap; margin-bottom: 18px;">
      <div style="flex:1; min-width:220px; padding:12px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Solicitacao</div>
        <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">#${escapeHtml(solicitacao.id)}</div>
        <div style="margin-top:4px; font-size:12px; color:#475569;">Status: ${escapeHtml(statusLabel)}</div>
      </div>
      <div style="flex:1; min-width:220px; padding:12px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Solicitante</div>
        <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">${escapeHtml(solicitacao.solicitanteNome)}</div>
        <div style="margin-top:4px; font-size:12px; color:#475569;">Perfil: ${escapeHtml(solicitacao.solicitanteRole || "Nao informado")}</div>
      </div>
      <div style="flex:1; min-width:220px; padding:12px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Data da solicitacao</div>
        <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">${solicitacao.criadoEm ? new Intl.DateTimeFormat("pt-BR").format(new Date(solicitacao.criadoEm)) : "-"}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px;">
      <div style="padding:14px; border:1px solid #e2e8f0; border-radius:12px;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Origem da solicitacao</div>
        <div style="margin-top:6px; font-size:15px; font-weight:700; color:#0f172a;">${escapeHtml(solicitacao.secretariaOrigem)}</div>
      </div>
      <div style="padding:14px; border:1px solid #e2e8f0; border-radius:12px;">
        <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Destino solicitado</div>
        <div style="margin-top:6px; font-size:15px; font-weight:700; color:#0f172a;">${escapeHtml(solicitacao.departamentoDestino)} / ${escapeHtml(solicitacao.salaDestino)}</div>
        <div style="margin-top:4px; font-size:12px; color:#475569;">${escapeHtml(solicitacao.secretariaDestino)}</div>
      </div>
    </div>

    <div style="margin-bottom: 16px; padding:14px; border:1px solid #e2e8f0; border-radius:12px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Motivo da solicitacao</div>
      <div style="margin-top:8px; font-size:13px; line-height:1.65; color:#1f2937; white-space:pre-wrap;">${escapeHtml(solicitacao.motivo || "-")}</div>
    </div>

    <div style="margin-bottom: 16px; padding:14px; border:1px solid #e2e8f0; border-radius:12px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Bens incluidos</div>
      ${buildTable(["Patrimonio", "Descricao", "Secretaria atual", "Departamento atual", "Sala atual"], itensRows)}
    </div>

    <div style="margin-bottom: 16px; padding:14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:#64748b; font-weight:700;">Andamento</div>
      <div style="margin-top:8px; font-size:13px; line-height:1.65; color:#1f2937;">${historicoDecisao}</div>
      ${solicitacao.motivoRejeicao ? `<div style="margin-top:8px; font-size:12px; color:#b91c1c;"><strong>Motivo da rejeicao:</strong> ${escapeHtml(solicitacao.motivoRejeicao)}</div>` : ""}
    </div>

    <div style="display:flex; gap:40px; justify-content:center; margin-top:52px;">
      <div style="text-align:center; width:280px;">
        <div style="border-top:1px solid #334155; padding-top:8px;">
          <p style="margin:0; font-size:11px; font-weight:600;">${escapeHtml(solicitacao.solicitanteNome)}</p>
          <p style="margin:2px 0 0; font-size:10px; color:#64748b;">Solicitante</p>
        </div>
      </div>
      <div style="text-align:center; width:280px;">
        <div style="border-top:1px solid #334155; padding-top:8px;">
          <p style="margin:0; font-size:11px; font-weight:600;">${escapeHtml(settings.assinaturaTexto)}</p>
          <p style="margin:2px 0 0; font-size:10px; color:#64748b;">${escapeHtml(settings.assinaturaCargo)}</p>
        </div>
      </div>
    </div>

    ${buildFooter(settings)}
  `

  api.createLog({
    acao: "relatorio_gerado",
    descricao: `PDF de solicitacao de movimentacao #${solicitacao.id}`,
    detalhes: `Status: ${solicitacao.status} | Itens: ${solicitacao.itens.length}`,
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

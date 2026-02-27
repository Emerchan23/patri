import { registrarLog } from "../lib/audit"
import { query } from "../lib/db"

async function testLogging() {
  console.log("Testing logging...")
  try {
    await registrarLog({
      acao: "relatorio_gerado",
      descricao: "Teste de log manual via script",
      detalhes: "Detalhes do teste",
      usuarioId: 999,
      usuarioNome: "Tester",
      usuarioRole: "administrador",
      entidadeTipo: "relatorio",
      entidadeId: "TEST-001",
      entidadeDescricao: "Relatorio de Teste"
    })
    console.log("Log registered successfully.")

    const logs = await query("SELECT * FROM audit_logs WHERE usuario_id = 999 ORDER BY id DESC LIMIT 1")
    console.log("Fetched log:", logs)
  } catch (error) {
    console.error("Error testing logging:", error)
  }
}

testLogging()

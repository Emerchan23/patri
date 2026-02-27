import { execute } from "../lib/db"

async function runMigration() {
  console.log("Adding acesso_app column to usuarios table...")
  try {
    await execute("ALTER TABLE usuarios ADD COLUMN acesso_app TINYINT(1) NOT NULL DEFAULT 0 AFTER ativo")
    console.log("Column added successfully.")
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists.")
    } else {
      console.error("Error adding column:", error)
    }
  }

  // Update existing users to have access (optional, but good for testing)
  // Let's set admin to have access by default
  await execute("UPDATE usuarios SET acesso_app = 1 WHERE role = 'administrador'")
  console.log("Admin users granted app access.")
}

runMigration().then(() => process.exit(0))

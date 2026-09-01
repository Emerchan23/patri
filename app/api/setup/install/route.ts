import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { queryOne } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth-utils';
import { isRuntimeSetupEnabled } from '@/lib/route-security';

const execAsync = util.promisify(exec);

export async function POST(request: Request) {
  try {
    if (!isRuntimeSetupEnabled()) {
      return NextResponse.json({ error: "Rota de instalacao desabilitada" }, { status: 403 });
    }

    let userCount = { count: 0 }
    try {
      userCount = (await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM usuarios")) || { count: 0 }
    } catch {
      userCount = { count: 0 }
    }
    if ((userCount?.count || 0) > 0) {
      const user = await getAuthUserFromRequest(request);
      if (!user || user.role !== "administrador") {
        return NextResponse.json({ error: "Sem permissao para executar instalacao" }, { status: 403 });
      }
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'sispatrimonio_completo_v2.sql');
    
    // Check if file exists (optional, but good practice)
    // Using fs.access or try-catch on exec

    // Construct mysql command
    // mysql -h host -u user -ppassword database < file.sql
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'sispatrimonio';
    const port = process.env.DB_PORT || '3306';

    // We need to be careful with passwords containing special characters in shell command
    // But since we are inside container and these are env vars, we can try to use them directly or pass via env to child process

    const command = `mysql -h ${host} -P ${port} -u ${user} -p"${password}" ${database} < "${scriptPath}"`;

    console.log(`Executing SQL setup script...`);
    // Mask password in logs
    console.log(`Command: mysql -h ${host} -P ${port} -u ${user} -p"*****" ${database} < "${scriptPath}"`);

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes('Using a password on the command line interface can be insecure')) {
        console.warn('MySQL Import Stderr:', stderr);
    }

    return NextResponse.json({ success: true, message: "Database setup completed successfully." });
  } catch (error: any) {
    console.error("Database setup failed:", error);
    return NextResponse.json({ 
        error: "Falha ao executar instalacao do banco." 
    }, { status: 500 });
  }
}

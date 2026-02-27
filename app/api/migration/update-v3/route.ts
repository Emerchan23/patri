import { NextResponse } from 'next/server';
import { execute } from '@/lib/db';

export async function GET() {
  try {
    // 1. Add new columns to fornecedores
    // We use a helper function to add column if not exists because MySQL doesn't support IF NOT EXISTS in ADD COLUMN directly in all versions easily in one line without procedure
    
    const addColumn = async (table: string, column: string, type: string) => {
      try {
        await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        console.log(`Column ${column} added to ${table}`);
      } catch (e: any) {
        if (e.message.includes('Duplicate column name')) {
          console.log(`Column ${column} already exists in ${table}`);
        } else {
          throw e;
        }
      }
    };

    await addColumn('fornecedores', 'razao_social', 'VARCHAR(255) DEFAULT NULL');
    await addColumn('fornecedores', 'estado', 'VARCHAR(2) DEFAULT NULL');
    await addColumn('fornecedores', 'cidade', 'VARCHAR(100) DEFAULT NULL');
    await addColumn('fornecedores', 'nome_fantasia', 'VARCHAR(255) DEFAULT NULL');
    // Rename 'nome' to match user expectation if needed, but we keep 'nome' as a required field, maybe for display or as alias to nome_fantasia

    // 2. Add Unique Indexes
    const addUniqueIndex = async (table: string, column: string, indexName: string) => {
        try {
            // Check if index exists (rough check by trying to create)
             await execute(`CREATE UNIQUE INDEX ${indexName} ON ${table}(${column})`);
             console.log(`Index ${indexName} created on ${table}`);
        } catch (e: any) {
             if (e.message.includes('Duplicate key name') || e.message.includes('already exists')) {
                 console.log(`Index ${indexName} already exists on ${table}`);
             } else {
                 console.log(`Error creating index ${indexName}: ${e.message}`);
                 // Don't throw, maybe duplicate data prevents it
             }
        }
    }

    await addUniqueIndex('fornecedores', 'cnpj', 'idx_fornecedores_cnpj');
    await addUniqueIndex('marcas', 'nome', 'idx_marcas_nome');
    await addUniqueIndex('grupos', 'nome', 'idx_grupos_nome');
    await addUniqueIndex('categorias', 'nome', 'idx_categorias_nome');

    return NextResponse.json({ success: true, message: "Migration v3 applied" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

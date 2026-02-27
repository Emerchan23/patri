import fs from "fs"
import path from "path"
import crypto from "crypto"

export function saveImageToDisk(base64Data: string | null | undefined): string | null {
  if (!base64Data) {
      console.log("saveImageToDisk: Dados de imagem vazios ou nulos");
      return null;
  }
  
  // Se for uma URL relativa já salva ou URL absoluta, retorna ela
  if (base64Data.startsWith('/uploads/') || base64Data.startsWith('http')) {
      console.log("saveImageToDisk: Já é uma URL, ignorando salvamento");
      return base64Data;
  }

  console.log(`saveImageToDisk: Recebido dados com tamanho ${base64Data.length}`);
  console.log(`saveImageToDisk: Inicio dos dados: ${base64Data.substring(0, 50)}...`);

  try {
    let extension = 'jpg';
    let data = base64Data;

    // Check if it has the data URI scheme
    if (base64Data.includes('base64,')) {
        // Método mais robusto: pega tudo depois da ÚLTIMA virgula
        const parts = base64Data.split('base64,');
        if (parts.length >= 2) {
             data = parts[parts.length - 1].replace(/\s/g, '');
             
             const header = parts[0].toLowerCase();
             if (header.includes('image/png')) extension = 'png';
             else if (header.includes('image/webp')) extension = 'webp';
             else if (header.includes('image/gif')) extension = 'gif';
             console.log(`saveImageToDisk: Detectado header ${header}, extensao ${extension}`);
        }
    } else {
        console.log("saveImageToDisk: Sem header base64, assumindo raw ou limpando");
        data = base64Data.replace(/[^A-Za-z0-9+/=]/g, "");
        if (data.length < 100) {
            console.log("saveImageToDisk: Dados muito curtos após limpeza, retornando original");
            return base64Data;
        }
    }
    
    const buffer = Buffer.from(data, 'base64');
    
    if (buffer.length === 0) {
        console.error("saveImageToDisk: Buffer vazio após decodificação");
        return null;
    }

    // Validação básica de tamanho
    if (buffer.length > 50 * 1024 * 1024) {
        console.error(`saveImageToDisk: Imagem muito grande descartada: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        return null;
    }

    const filename = `${crypto.randomUUID()}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'bens');
    
    console.log(`saveImageToDisk: Tentando salvar em ${uploadDir}/${filename}`);

    if (!fs.existsSync(uploadDir)) {
      console.log("saveImageToDisk: Criando diretorio...");
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`saveImageToDisk: Imagem salva com sucesso: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);

    return `/uploads/bens/${filename}`;
  } catch (error) {
    console.error('saveImageToDisk: Erro critico ao salvar imagem:', error);
    return null;
  }
}

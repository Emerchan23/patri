import fs from "fs"
import path from "path"
import crypto from "crypto"

export function saveFileToDisk(base64Data: string | null | undefined, folder: string = "docs"): string | null {
  if (!base64Data) {
      return null;
  }
  
  // Se for uma URL relativa já salva ou URL absoluta, retorna ela
  if (base64Data.startsWith('/uploads/') || base64Data.startsWith('http')) {
      return base64Data;
  }

  try {
    let extension = 'bin';
    let data = base64Data;

    // Detect extension and strip header
    if (base64Data.includes('base64,')) {
        const parts = base64Data.split('base64,');
        if (parts.length >= 2) {
             data = parts[parts.length - 1];
             const header = parts[0].toLowerCase();
             if (header.includes('application/pdf')) extension = 'pdf';
             else if (header.includes('image/png')) extension = 'png';
             else if (header.includes('image/jpeg')) extension = 'jpg';
             else if (header.includes('image/jpg')) extension = 'jpg';
             else if (header.includes('image/webp')) extension = 'webp';
        }
    } else {
        // Assume PDF if starts with JVBERi0 (base64 for %PDF-)
        if (base64Data.startsWith('JVBERi0')) {
            extension = 'pdf';
        }
    }
    
    const buffer = Buffer.from(data, 'base64');
    
    if (buffer.length === 0) return null;

    // Limit 10MB
    if (buffer.length > 10 * 1024 * 1024) {
        console.error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        return null;
    }

    const filename = `${crypto.randomUUID()}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/${folder}/${filename}`;
  } catch (error) {
    console.error('Error saving file:', error);
    return null;
  }
}

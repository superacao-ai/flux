// Script para gerar ícones PWA a partir da logo existente
// Execute com: node scripts/generate-pwa-icons.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputPath = path.join(__dirname, '../public/logo2.png');
const outputDir = path.join(__dirname, '../public/icons');

// Criar diretório se não existir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log('🎨 Gerando ícones PWA...\n');
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(inputPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ icon-${size}x${size}.png`);
    } catch (err) {
      console.error(`❌ Erro ao gerar icon-${size}x${size}.png:`, err.message);
    }
  }
  
  console.log('\n🎉 Ícones gerados com sucesso!');
}

generateIcons();

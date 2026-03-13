const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000/'; // We will ask the user to change this when deploying
const TOTAL_TABLES = 10;
const OUTPUT_DIR = path.join(__dirname, '..', 'qrcodes');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateQRCodes() {
    console.log(`Bắt đầu tạo QR Codes cho ${TOTAL_TABLES} bàn...`);
    console.log(`URL Cơ sở: ${BASE_URL}`);

    for (let i = 1; i <= TOTAL_TABLES; i++) {
        const tableUrl = `${BASE_URL}?table=${i}`;
        const filePath = path.join(OUTPUT_DIR, `Ban_${i}.png`);

        try {
            // Generate QR code and save it to file
            await qrcode.toFile(filePath, tableUrl, {
                color: {
                    dark: '#1a1a1a',  // Dark dots
                    light: '#ffffff' // White background
                },
                width: 300,
                margin: 2
            });
            console.log(`✅ Đã tạo mã QR cho Bàn ${i} -> ${filePath}`);
        } catch (err) {
            console.error(`❌ Lỗi khi tạo QR cho Bàn ${i}:`, err);
        }
    }
    
    console.log('\n🎉 Hoàn tất! Tất cả QR Code đã được lưu trong thư mục "qrcodes"');
}

generateQRCodes();

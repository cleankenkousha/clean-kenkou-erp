const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Windows日本語フォントのパス探索 (TTF形式)
function getJapaneseFont() {
  const fontPaths = [
    'C:\\Windows\\Fonts\\NotoSansJP-VF.ttf',
    'C:\\Windows\\Fonts\\yumin.ttf',
    'C:\\Windows\\Fonts\\yumindb.ttf',
  ];
  for (const fp of fontPaths) {
    if (fs.existsSync(fp)) {
      return fp;
    }
  }
  return null;
}

const defaultFont = getJapaneseFont();

// クリーン健康社デフォルト情報
const DEFAULT_COMPANY = {
  name: '有限会社 山鹿健康社',
  zip: '〒861-0533',
  address: '熊本県山鹿市古閑1013-1',
  tel: '0968-43-3450',
  fax: '0968-43-3451',
  invoiceRegNo: 'T1330002012345', // インボイス登録番号
  bankName: '肥後銀行 山鹿支店',
  bankAccount: '普通 1234567',
  accountHolder: '有限会社 山鹿健康社 代表取締役',
};

const server = new McpServer({
  name: 'clean-kenkou-report-pdf-engine',
  version: '1.0.0',
});

// 見積書PDF生成ツール
server.tool(
  'generate_quote_pdf',
  'クリーン健康社専用の見積書PDFを生成します。A4縦・日本語対応・税率明細付き。',
  {
    customerName: z.string().describe('宛先（顧客名） 例: 株式会社〇〇 御中 / 山田 太郎 様'),
    title: z.string().default('御見積書').describe('帳票タイトル'),
    quoteNo: z.string().optional().describe('見積番号'),
    quoteDate: z.string().optional().describe('発行日 (YYYY/MM/DD)'),
    validUntil: z.string().optional().describe('有効期限 例: 発行日より1ヶ月'),
    items: z
      .array(
        z.object({
          name: z.string().describe('品名・作業内容'),
          quantity: z.number().describe('数量'),
          unit: z.string().default('式').describe('単位 (式, 個, 台, kg, m3等)'),
          unitPrice: z.number().describe('単価'),
        })
      )
      .describe('品目明細リスト'),
    taxRate: z.number().default(0.1).describe('消費税率 (0.1 = 10%)'),
    notes: z.string().optional().describe('特記事項・備考・作業条件'),
    outputPath: z.string().describe('出力先PDFファイルパス (絶対パス)'),
  },
  async ({ customerName, title, quoteNo, quoteDate, validUntil, items, taxRate, notes, outputPath }) => {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      if (defaultFont) {
        doc.font(defaultFont);
      }

      const today = quoteDate || new Date().toLocaleDateString('ja-JP');
      const qNo = quoteNo || `Q-${Date.now().toString().slice(-6)}`;

      // ヘッダー部
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown(1);

      // 顧客情報 & 発行者情報 (左右分割)
      const topY = doc.y;
      
      // 左側: 顧客情報
      doc.fontSize(14).text(`${customerName}`, 40, topY, { underline: true });
      doc.fontSize(10).text('下記のとおり御見積申し上げます。', 40, topY + 25);

      // 右側: 自社情報
      const rightX = 350;
      doc.fontSize(9);
      doc.text(`見積番号: ${qNo}`, rightX, topY);
      doc.text(`発行日: ${today}`, rightX, topY + 14);
      if (validUntil) doc.text(`有効期限: ${validUntil}`, rightX, topY + 28);
      
      const compY = topY + 45;
      doc.fontSize(10).text(DEFAULT_COMPANY.name, rightX, compY);
      doc.fontSize(8);
      doc.text(DEFAULT_COMPANY.zip, rightX, compY + 16);
      doc.text(DEFAULT_COMPANY.address, rightX, compY + 28);
      doc.text(`TEL: ${DEFAULT_COMPANY.tel}  FAX: ${DEFAULT_COMPANY.fax}`, rightX, compY + 40);
      doc.text(`登録番号: ${DEFAULT_COMPANY.invoiceRegNo}`, rightX, compY + 52);

      // 計算
      let subtotal = 0;
      items.forEach((it) => {
        subtotal += it.quantity * it.unitPrice;
      });
      const taxAmount = Math.floor(subtotal * taxRate);
      const grandTotal = subtotal + taxAmount;

      // 合計金額表示枠
      const totalBoxY = compY + 75;
      doc.rect(40, totalBoxY, 280, 40).fillAndStroke('#f1f5f9', '#94a3b8');
      doc.fillColor('#0f172a').fontSize(11).text('御見積総額 (税込)', 50, totalBoxY + 8);
      doc.fontSize(16).text(`¥ ${grandTotal.toLocaleString()} -`, 160, totalBoxY + 12);

      // 明細テーブルヘッダー
      const tableTop = totalBoxY + 55;
      doc.rect(40, tableTop, 515, 22).fillAndStroke('#0284c7', '#0284c7');
      doc.fillColor('#ffffff').fontSize(9);
      doc.text('品名・作業内容', 50, tableTop + 6);
      doc.text('数量', 290, tableTop + 6, { width: 50, align: 'right' });
      doc.text('単価', 350, tableTop + 6, { width: 70, align: 'right' });
      doc.text('金額', 430, tableTop + 6, { width: 80, align: 'right' });

      // 明細行
      let curY = tableTop + 22;
      doc.fillColor('#1e293b');
      items.forEach((item, idx) => {
        const itemTotal = item.quantity * item.unitPrice;
        if (idx % 2 === 1) {
          doc.rect(40, curY, 515, 20).fill('#f8fafc');
        }
        doc.fillColor('#1e293b').fontSize(9);
        doc.text(item.name, 50, curY + 5, { width: 230 });
        doc.text(`${item.quantity} ${item.unit}`, 290, curY + 5, { width: 50, align: 'right' });
        doc.text(`¥${item.unitPrice.toLocaleString()}`, 350, curY + 5, { width: 70, align: 'right' });
        doc.text(`¥${itemTotal.toLocaleString()}`, 430, curY + 5, { width: 80, align: 'right' });
        curY += 20;
      });

      // テーブル枠線
      doc.rect(40, tableTop, 515, curY - tableTop).stroke('#cbd5e1');

      // 集計欄 (小計・消費税・合計)
      curY += 10;
      const sumX = 350;
      doc.fontSize(9);
      doc.text('小計 (税抜):', sumX, curY);
      doc.text(`¥${subtotal.toLocaleString()}`, 440, curY, { width: 80, align: 'right' });
      curY += 15;
      doc.text(`消費税 (${Math.round(taxRate * 100)}%):`, sumX, curY);
      doc.text(`¥${taxAmount.toLocaleString()}`, 440, curY, { width: 80, align: 'right' });
      curY += 15;
      doc.fontSize(10).font(defaultFont);
      doc.text('合計金額:', sumX, curY);
      doc.text(`¥${grandTotal.toLocaleString()}`, 440, curY, { width: 80, align: 'right' });

      // 備考・特記事項
      if (notes) {
        curY += 30;
        doc.rect(40, curY, 515, 60).fillAndStroke('#fafafa', '#e2e8f0');
        doc.fillColor('#334155').fontSize(9);
        doc.text('【備考・作業条件】', 48, curY + 8);
        doc.text(notes, 48, curY + 24, { width: 495 });
      }

      doc.end();

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      return {
        content: [
          {
            type: 'text',
            text: `見積書PDFを生成しました: ${outputPath} (合計金額: ¥${grandTotal.toLocaleString()})`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `見積書PDF生成エラー: ${err.message}` }],
      };
    }
  }
);

// 請求書PDF生成ツール (適格請求書・インボイス対応)
server.tool(
  'generate_invoice_pdf',
  'クリーン健康社専用の適格請求書（インボイス制度対応）PDFを生成します。',
  {
    customerName: z.string().describe('宛先（顧客名）'),
    invoiceNo: z.string().optional().describe('請求書番号'),
    issueDate: z.string().optional().describe('発行日 (YYYY/MM/DD)'),
    dueDate: z.string().optional().describe('お支払期日 (YYYY/MM/DD)'),
    items: z
      .array(
        z.object({
          name: z.string().describe('品名・回収作業内容'),
          quantity: z.number().describe('数量'),
          unit: z.string().default('式').describe('単位'),
          unitPrice: z.number().describe('単価'),
        })
      )
      .describe('請求明細リスト'),
    taxRate: z.number().default(0.1).describe('消費税率 (0.1 = 10%)'),
    notes: z.string().optional().describe('備考'),
    outputPath: z.string().describe('出力先PDFファイルパス (絶対パス)'),
  },
  async ({ customerName, invoiceNo, issueDate, dueDate, items, taxRate, notes, outputPath }) => {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      if (defaultFont) {
        doc.font(defaultFont);
      }

      const today = issueDate || new Date().toLocaleDateString('ja-JP');
      const invNo = invoiceNo || `INV-${Date.now().toString().slice(-6)}`;

      // タイトル
      doc.fontSize(20).text('御 請 求 書', { align: 'center' });
      doc.moveDown(1);

      const topY = doc.y;

      // 顧客情報
      doc.fontSize(14).text(`${customerName}`, 40, topY, { underline: true });
      doc.fontSize(10).text('下記のとおり御請求申し上げます。', 40, topY + 25);
      if (dueDate) {
        doc.fontSize(10).fillColor('#b91c1c').text(`お支払期日: ${dueDate}`, 40, topY + 45);
        doc.fillColor('#000000');
      }

      // 自社情報 (インボイス登録番号明記)
      const rightX = 350;
      doc.fontSize(9);
      doc.text(`請求番号: ${invNo}`, rightX, topY);
      doc.text(`発行日: ${today}`, rightX, topY + 14);

      const compY = topY + 35;
      doc.fontSize(10).text(DEFAULT_COMPANY.name, rightX, compY);
      doc.fontSize(8);
      doc.text(DEFAULT_COMPANY.zip, rightX, compY + 16);
      doc.text(DEFAULT_COMPANY.address, rightX, compY + 28);
      doc.text(`TEL: ${DEFAULT_COMPANY.tel}  FAX: ${DEFAULT_COMPANY.fax}`, rightX, compY + 40);
      doc.fontSize(9).fillColor('#0284c7').text(`登録番号: ${DEFAULT_COMPANY.invoiceRegNo}`, rightX, compY + 54);
      doc.fillColor('#000000');

      // 金額計算
      let subtotal = 0;
      items.forEach((it) => {
        subtotal += it.quantity * it.unitPrice;
      });
      const taxAmount = Math.floor(subtotal * taxRate);
      const grandTotal = subtotal + taxAmount;

      // 請求総額枠
      const totalBoxY = compY + 75;
      doc.rect(40, totalBoxY, 280, 42).fillAndStroke('#eff6ff', '#3b82f6');
      doc.fillColor('#1e3a8a').fontSize(11).text('御請求総額 (税込)', 50, totalBoxY + 8);
      doc.fontSize(17).text(`¥ ${grandTotal.toLocaleString()} -`, 150, totalBoxY + 12);

      // テーブル
      const tableTop = totalBoxY + 55;
      doc.rect(40, tableTop, 515, 22).fillAndStroke('#1e293b', '#1e293b');
      doc.fillColor('#ffffff').fontSize(9);
      doc.text('項目・品名', 50, tableTop + 6);
      doc.text('数量', 290, tableTop + 6, { width: 50, align: 'right' });
      doc.text('単価', 350, tableTop + 6, { width: 70, align: 'right' });
      doc.text('金額 (税抜)', 430, tableTop + 6, { width: 80, align: 'right' });

      let curY = tableTop + 22;
      doc.fillColor('#1e293b');
      items.forEach((item, idx) => {
        const itemTotal = item.quantity * item.unitPrice;
        if (idx % 2 === 1) {
          doc.rect(40, curY, 515, 20).fill('#f8fafc');
        }
        doc.fillColor('#1e293b').fontSize(9);
        doc.text(item.name, 50, curY + 5, { width: 230 });
        doc.text(`${item.quantity} ${item.unit}`, 290, curY + 5, { width: 50, align: 'right' });
        doc.text(`¥${item.unitPrice.toLocaleString()}`, 350, curY + 5, { width: 70, align: 'right' });
        doc.text(`¥${itemTotal.toLocaleString()}`, 430, curY + 5, { width: 80, align: 'right' });
        curY += 20;
      });

      doc.rect(40, tableTop, 515, curY - tableTop).stroke('#cbd5e1');

      // インボイス税率内訳表示
      curY += 10;
      const sumX = 330;
      doc.fontSize(9);
      doc.text('小計 (税抜):', sumX, curY);
      doc.text(`¥${subtotal.toLocaleString()}`, 440, curY, { width: 80, align: 'right' });
      curY += 15;
      doc.text(`10%対象額:`, sumX, curY);
      doc.text(`¥${subtotal.toLocaleString()}`, 440, curY, { width: 80, align: 'right' });
      curY += 15;
      doc.text(`消費税額 (10%):`, sumX, curY);
      doc.text(`¥${taxAmount.toLocaleString()}`, 440, curY, { width: 80, align: 'right' });
      curY += 16;
      doc.fontSize(10);
      doc.text('御請求金額:', sumX, curY);
      doc.text(`¥${grandTotal.toLocaleString()}`, 440, curY, { width: 80, align: 'right' });

      // お振込先情報
      curY += 28;
      doc.rect(40, curY, 515, 65).fillAndStroke('#f8fafc', '#94a3b8');
      doc.fillColor('#0f172a').fontSize(9);
      doc.text('【お振込先】', 48, curY + 8);
      doc.fontSize(9);
      doc.text(`金融機関: ${DEFAULT_COMPANY.bankName}`, 48, curY + 24);
      doc.text(`口座番号: ${DEFAULT_COMPANY.bankAccount}`, 48, curY + 38);
      doc.text(`口座名義: ${DEFAULT_COMPANY.accountHolder}`, 48, curY + 50);

      if (notes) {
        curY += 75;
        doc.fontSize(8).fillColor('#64748b').text(`備考: ${notes}`, 48, curY);
      }

      doc.end();

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      return {
        content: [
          {
            type: 'text',
            text: `請求書PDF（インボイス対応）を生成しました: ${outputPath} (請求総額: ¥${grandTotal.toLocaleString()})`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `請求書PDF生成エラー: ${err.message}` }],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});

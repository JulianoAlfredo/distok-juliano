'use strict';

const PDFDocument = require('pdfkit');

/**
 * Gera um PDF tabular com o branding do tenant (FR39).
 * Usa PDFKit (sem headless Chrome — leve para shared hosting, arch RT6).
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {Array<{label:string,key?:string,value?:Function,width?:number}>} opts.columns
 * @param {Array<object>} opts.rows
 * @param {object} opts.branding  { display_name, color_primary, report_footer }
 * @returns {Promise<Buffer>}
 */
function toPDF({ title, columns, rows, branding = {} }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const primary = /^#[0-9a-fA-F]{6}$/.test(branding.color_primary || '') ? branding.color_primary : '#2563EB';
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // cabeçalho branded
    doc.rect(0, 0, doc.page.width, 70).fill(primary);
    doc.fillColor('#FFFFFF').fontSize(18).text(branding.display_name || 'DISTOK', 40, 22);
    doc.fontSize(11).text(title, 40, 46);
    doc.fillColor('#000000');

    let y = 95;
    const startX = 40;
    const colWidth = (col) => (col.width ? col.width : pageWidth / columns.length);

    // header da tabela
    doc.fontSize(9).fillColor('#475569');
    let x = startX;
    columns.forEach((c) => { doc.text(c.label, x, y, { width: colWidth(c), ellipsis: true }); x += colWidth(c); });
    y += 16;
    doc.moveTo(startX, y).lineTo(startX + pageWidth, y).strokeColor('#E2E8F0').stroke();
    y += 6;

    // linhas
    doc.fillColor('#0F172A').fontSize(9);
    rows.forEach((row) => {
      if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
      x = startX;
      columns.forEach((c) => {
        const val = typeof c.value === 'function' ? c.value(row) : row[c.key];
        doc.text(val == null ? '' : String(val), x, y, { width: colWidth(c), ellipsis: true });
        x += colWidth(c);
      });
      y += 16;
    });

    // rodapé
    const footer = branding.report_footer || `Gerado por DISTOK — ${new Date().toLocaleString('pt-BR')}`;
    doc.fontSize(8).fillColor('#94A3B8').text(footer, 40, doc.page.height - 35, { width: pageWidth, align: 'center' });

    doc.end();
  });
}

module.exports = { toPDF };

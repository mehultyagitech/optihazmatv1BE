/* eslint-disable @typescript-eslint/no-var-requires */
// IHM Report PDF generator using pdfmake, with pdf-lib post-processing to
// merge attachment PDFs and stamp consistent page numbers.

import fs from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PdfPrinter = require('pdfmake');

// Load the Roboto fonts shipped with pdfmake's vfs (works in Node).
const vfsModule = require('pdfmake/build/vfs_fonts');
const vfs = vfsModule?.pdfMake?.vfs || vfsModule?.vfs || vfsModule;

const fonts = {
  Roboto: {
    normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const pad2 = (n: number) => String(n).padStart(2, '0');

export const fmtDate = (d?: Date | string | null): string => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return `${pad2(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
};

export interface IHMReportData {
  vessel: {
    vesselName: string;
    imoNumber: string;
    callSign?: string | null;
    vesselType?: string;
    flag?: string;
    portOfRegistry?: string;
    classSociety?: string;
    keelLaidDate?: Date | string | null;
    deliveryDate?: Date | string | null;
    owner?: string;
    manager?: string;
  };
  reportMeta: {
    version: string;
    issuedDate: Date | string;
    ihmReportNumber: string;
    periodToDate?: Date | string | null;
  };
  dp: Array<{
    name: string;
    position: string;
    initials: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  }>;
  inventory: {
    i1: InventoryRow[];
    i2: InventoryRow[];
    i3: InventoryRow[];
  };
  installed: {
    i1: InventoryRow[];
    i2: InventoryRow[];
    i3: InventoryRow[];
  };
  removed: {
    i1: InventoryRow[];
    i2: InventoryRow[];
    i3: InventoryRow[];
  };
  locationDiagrams: LocationDiagramSection[];
  purchaseOrders: {
    hazmat: PoRow[];
    hazmatFree: PoRow[];
    noDeclaration: PoRow[];
  };
  attachments: Array<{ title: string }>;
}

export interface PoRow {
  poNumber: string;
  receivedDate: string;
}

export interface InventoryRow {
  pointNo?: string;
  name?: string; // name of paint / equipment / structural element
  application?: string; // I-1 application of paint / parts where used
  location?: string;
  material?: string; // hazmat classification
  quantity?: string;
  date?: string; // installation date (§3.1) or replaced/removal date (§3.2)
  remarks?: string;
}

export interface LocationDiagramSection {
  location: string;
  subLocation: string;
  imageDataUri?: string | null;
  points: Array<{ no: number; description: string; pointNo?: string }>;
}

const GREY = '#f2f2f2';
const NAVY = '#1F3864';

const REGULATIONS = [
  'Hong Kong International Convention for the Safe and Environmentally Sound Recycling of Ships (SR/CONF 45)',
  'Guidelines for the Preparation of Inventory of Hazardous Materials (MEPC 379(80) as amended by MEPC 405 (83))',
  'EU Regulation on Ship Recycling (EU-SRR No. 1257/2013)',
  "EMSA's Best Practice Guidance on the Inventory of Hazardous Materials",
];

function inventoryTable(
  title: string,
  rows: InventoryRow[],
  kind: 'paint' | 'equipment' | 'structure',
  dateHeader?: string, // e.g. 'Installation Date' or 'Replaced / Removal Date'
) {
  const base =
    kind === 'paint'
      ? ['No.', 'Application of Paint', 'Name of paint', 'Location', 'Material', 'Approx. Qty']
      : kind === 'equipment'
        ? ['No.', 'Name of equipment and machinery', 'Location', 'Material', 'Parts where Used', 'Approx. Qty']
        : ['No.', 'Name of structural element', 'Location', 'Material', 'Parts where Used', 'Approx. Qty'];
  const header = [...base, ...(dateHeader ? [dateHeader] : []), 'Remarks'];

  const baseWidths =
    kind === 'paint' ? [16, '*', '*', 58, 66, 38] : [16, '*', 58, 66, 58, 38];
  const widths = [...baseWidths, ...(dateHeader ? [52] : []), 80];

  const headerCells = header.map((h) => ({ text: h, bold: true, fontSize: 8, fillColor: GREY }));

  const bodyRows =
    rows.length === 0
      ? [[{ text: 'No records to display', colSpan: header.length, alignment: 'center', italics: true, color: '#777', fontSize: 8 }, ...Array(header.length - 1).fill({})]]
      : rows.map((r, i) => {
          const remarks = [
            r.pointNo ? `INVENTORY POINT NO: ${r.pointNo}` : '',
            r.remarks || '',
          ].filter(Boolean).join('\n');
          const core =
            kind === 'paint'
              ? [String(i + 1), r.application || '-', r.name || '-', r.location || '-', r.material || '-', r.quantity || '-']
              : [String(i + 1), r.name || '-', r.location || '-', r.material || '-', r.application || '-', r.quantity || '-'];
          const withDate = dateHeader ? [...core, r.date || '-'] : core;
          return cellRow([...withDate, remarks || '-']);
        });

  return [
    { text: title, bold: true, fontSize: 9, margin: [0, 10, 0, 4], color: NAVY },
    {
      table: { headerRows: 1, widths, body: [headerCells, ...bodyRows] },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#bbb',
        vLineColor: () => '#bbb',
      },
    },
  ];
}

function inventoryGroup(
  rows: { i1: InventoryRow[]; i2: InventoryRow[]; i3: InventoryRow[] },
  dateHeader?: string,
) {
  return [
    ...inventoryTable('I-1  Paints and Coating Systems Containing Hazardous Materials', rows.i1, 'paint', dateHeader),
    ...inventoryTable('I-2  Equipment and Machinery Containing Hazardous Materials', rows.i2, 'equipment', dateHeader),
    ...inventoryTable('I-3  Structure and Hull Containing Hazardous Materials', rows.i3, 'structure', dateHeader),
  ];
}

// Purchase-order list rendered two PO pairs per row (like the sample).
function poListTable(title: string, pos: PoRow[]) {
  const headerCells = ['PO Number', 'PO Received Date', 'PO Number', 'PO Received Date'].map(
    (h) => ({ text: h, bold: true, fontSize: 8, fillColor: GREY }),
  );

  const body: any[] = [headerCells];
  if (pos.length === 0) {
    body.push([{ text: 'No records to display', colSpan: 4, alignment: 'center', italics: true, color: '#777', fontSize: 8 }, {}, {}, {}]);
  } else {
    for (let i = 0; i < pos.length; i += 2) {
      const a = pos[i];
      const b = pos[i + 1];
      body.push([
        { text: a.poNumber, fontSize: 8 },
        { text: a.receivedDate, fontSize: 8 },
        { text: b ? b.poNumber : '', fontSize: 8 },
        { text: b ? b.receivedDate : '', fontSize: 8 },
      ]);
    }
  }

  return [
    { text: title, bold: true, fontSize: 11, color: NAVY, margin: [0, 14, 0, 4] },
    {
      table: { headerRows: 1, widths: ['*', 90, '*', 90], body },
      layout: { hLineColor: () => '#ccc', vLineColor: () => '#ccc' },
    },
  ];
}

function locationDiagramSection(diagrams: LocationDiagramSection[]) {
  const content: any[] = [
    { text: '2  Location Diagram of Contained and PCHM', bold: true, fontSize: 13, color: NAVY, pageBreak: 'before', tocItem: true, margin: [0, 0, 0, 8] },
  ];

  if (diagrams.length === 0) {
    content.push({ text: 'No location diagrams available.', italics: true, color: '#777', fontSize: 9 });
    return content;
  }

  diagrams.forEach((d, idx) => {
    content.push({
      text: `2.${idx + 1}  Check points on ${d.location}`,
      bold: true,
      fontSize: 10,
      color: NAVY,
      margin: [0, idx === 0 ? 0 : 14, 0, 4],
      pageBreak: idx === 0 ? undefined : 'before',
    });
    content.push({ text: `Location: ${d.subLocation || d.location}`, fontSize: 9, margin: [0, 0, 0, 6], color: '#444' });
    if (d.imageDataUri) {
      content.push({ image: d.imageDataUri, fit: [500, 460], alignment: 'center', margin: [0, 0, 0, 8] });
    } else {
      content.push({ text: '[ diagram image unavailable ]', italics: true, color: '#999', fontSize: 8, margin: [0, 0, 0, 8] });
    }
    if (d.points.length > 0) {
      content.push({
        table: {
          headerRows: 1,
          widths: [30, '*', 120],
          body: [
            ['No.', 'Inventory Point', 'Point No'].map((h) => ({ text: h, bold: true, fontSize: 8, fillColor: GREY })),
            ...d.points.map((p) => cellRow([String(p.no), p.description || '-', p.pointNo || '-'])),
          ],
        },
        layout: { hLineColor: () => '#ccc', vLineColor: () => '#ccc' },
      });
    }
  });

  return content;
}

const cellRow = (vals: string[]) => vals.map((v) => ({ text: v, fontSize: 8 }));

function buildDocDefinition(data: IHMReportData) {
  const { vessel, reportMeta, dp, inventory, installed, removed, purchaseOrders, attachments } = data;

  const particulars: Array<[string, string]> = [
    ['Vessel Name', vessel.vesselName],
    ['IMO Number', vessel.imoNumber],
    ['Call Sign/ Distinct Number', vessel.callSign || '-'],
    ['Vessel Type', vessel.vesselType || '-'],
    ['Flag', vessel.flag || '-'],
    ['Port of Registry', vessel.portOfRegistry || '-'],
    ['Class Society', vessel.classSociety || '-'],
    ['Keel Laid Date', fmtDate(vessel.keelLaidDate)],
    ['Delivery Date', fmtDate(vessel.deliveryDate)],
    ['Owner', vessel.owner || '-'],
    ['Manager', vessel.manager || '-'],
  ];

  return {
    pageSize: 'A4',
    pageMargins: [40, 70, 40, 55],
    defaultStyle: { font: 'Roboto', fontSize: 9 },

    header(currentPage: number) {
      if (currentPage === 1) return null; // clean cover
      return {
        margin: [40, 18, 40, 0],
        stack: [
          {
            columns: [
              {
                width: '*',
                stack: [
                  { text: vessel.vesselName, bold: true, color: NAVY, fontSize: 11 },
                  { text: 'Inventory of Hazardous Material', italics: true, color: '#666', fontSize: 8, margin: [0, 1, 0, 0] },
                ],
              },
              {
                width: 150,
                table: {
                  widths: ['auto', '*'],
                  body: [
                    [{ text: 'IMO No:', bold: true, fontSize: 8, color: '#555' }, { text: vessel.imoNumber, fontSize: 8, color: '#555', alignment: 'right' }],
                    [{ text: 'Version:', bold: true, fontSize: 8, color: '#555' }, { text: reportMeta.version, fontSize: 8, color: '#555', alignment: 'right' }],
                    [{ text: 'Issued:', bold: true, fontSize: 8, color: '#555' }, { text: fmtDate(reportMeta.issuedDate), fontSize: 8, color: '#555', alignment: 'right' }],
                  ],
                },
                layout: 'noBorders',
              },
            ],
          },
          { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.7, lineColor: NAVY }] },
        ],
      };
    },

    footer(currentPage: number, pageCount: number) {
      if (currentPage === 1) return null; // clean cover
      return {
        margin: [40, 6, 40, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }] },
          {
            margin: [0, 4, 0, 0],
            columns: [
              {
                width: '*',
                fontSize: 7,
                color: '#777',
                stack: [
                  { text: 'OPTIHAZMAT PTE LTD', bold: true },
                  { text: '16 Raffles Quay, #33-03 Hong Leong Building, Singapore 048581' },
                  { text: 'https://www.optihazmat.com', color: '#3366cc' },
                ],
              },
              {
                width: 160,
                alignment: 'right',
                fontSize: 7,
                color: '#777',
                stack: [
                  { text: `Report No: ${reportMeta.ihmReportNumber}` },
                  { text: 'Printed by: HAZINVENT' },
                ],
              },
            ],
          },
        ],
      };
    },

    content: [
      // ---------- Cover ----------
      { text: 'INVENTORY OF HAZARDOUS MATERIAL PART-I', bold: true, fontSize: 16, color: NAVY, alignment: 'center', margin: [0, 60, 0, 30] },
      { text: 'For', alignment: 'center', color: '#555', margin: [0, 0, 0, 6] },
      { text: vessel.vesselName, bold: true, fontSize: 20, alignment: 'center', color: NAVY },
      { text: `IMO NO: ${vessel.imoNumber}`, alignment: 'center', margin: [0, 4, 0, 2] },
      { text: `Version: ${reportMeta.version}`, alignment: 'center' },
      { text: `Date: ${fmtDate(reportMeta.issuedDate)}`, alignment: 'center' },
      { text: `IHM Report Number: ${reportMeta.ihmReportNumber}`, alignment: 'center', margin: [0, 0, 0, 40] },
      { text: 'According To:', bold: true, margin: [0, 0, 0, 6] },
      { ul: REGULATIONS, fontSize: 9, color: '#333' },
      { text: 'Issued by OPTIHAZMAT PTE LTD', alignment: 'center', margin: [0, 50, 0, 0], color: '#555' },

      // ---------- Contents ----------
      { toc: { title: { text: 'Contents', fontSize: 16, bold: true, color: NAVY, margin: [0, 0, 0, 12] } }, pageBreak: 'before' },

      // ---------- Quality Policy ----------
      { text: 'Quality Policy', bold: true, fontSize: 13, color: NAVY, pageBreak: 'before', tocItem: true, margin: [0, 0, 0, 8] },
      { text: 'OPTIHAZMAT’s policy is to deliver high quality service and satisfaction to its customers. We ensure that we learn from feedback and post-job analyses, so that we continually improve our levels of performance.', fontSize: 9, margin: [0, 0, 0, 8] },
      { text: 'Disclaimer', bold: true, fontSize: 11, color: NAVY, margin: [0, 6, 0, 4] },
      { text: 'The results relate solely to the investigated materials.', fontSize: 9, margin: [0, 0, 0, 8] },
      { text: 'Copyright © All rights reserved. No part of this publication may be reproduced and/or made public by any means without prior written permission.', fontSize: 8, color: '#666' },

      // ---------- Vessel Particular ----------
      { text: 'Vessel Particular', bold: true, fontSize: 13, color: NAVY, pageBreak: 'before', tocItem: true, margin: [0, 0, 0, 10] },
      {
        table: {
          widths: [180, '*'],
          body: particulars.map(([k, v]) => [
            { text: k, bold: true, fontSize: 9, fillColor: GREY, margin: [2, 3, 2, 3] },
            { text: v, fontSize: 9, margin: [2, 3, 2, 3] },
          ]),
        },
        layout: { hLineColor: () => '#ccc', vLineColor: () => '#ccc' },
      },

      // ---------- Designated Persons ----------
      { text: 'Designated person(s) responsible for maintaining and updating the inventory', bold: true, fontSize: 11, color: NAVY, margin: [0, 20, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', 50, 70, 70],
          body: [
            ['Name', 'Position', 'Initials', 'Start Date', 'End Date'].map((h) => ({ text: h, bold: true, fontSize: 8, fillColor: GREY })),
            ...dp.map((p) =>
              cellRow([p.name, p.position, p.initials, fmtDate(p.startDate), p.endDate ? fmtDate(p.endDate) : '-']),
            ),
          ],
        },
        layout: { hLineColor: () => '#ccc', vLineColor: () => '#ccc' },
      },

      // ---------- Section 1: Inventory Part I ----------
      { text: '1  Inventory of Hazardous Materials Part I', bold: true, fontSize: 13, color: NAVY, pageBreak: 'before', tocItem: true, margin: [0, 0, 0, 6] },
      { text: 'Part I - Hazardous Material Contained in the Ship’s Structure and Equipment', fontSize: 8, italics: true, color: '#666', margin: [0, 0, 0, 4] },
      ...inventoryGroup(inventory),

      // ---------- Section 2: Location Diagrams ----------
      ...locationDiagramSection(data.locationDiagrams),

      // ---------- Section 3: Appendix 1 ----------
      { text: '3  Appendix 1', bold: true, fontSize: 13, color: NAVY, pageBreak: 'before', tocItem: true, margin: [0, 0, 0, 6] },
      { text: '3.1  Installed Items Containing Hazmat', bold: true, fontSize: 11, color: NAVY, margin: [0, 0, 0, 4] },
      ...inventoryGroup(installed, 'Installation Date'),

      { text: '3.2  Removed / Replaced Items Containing Hazmat', bold: true, fontSize: 11, color: NAVY, pageBreak: 'before', margin: [0, 0, 0, 4] },
      ...inventoryGroup(removed, 'Replaced / Removal Date'),

      { text: '', pageBreak: 'before' },
      ...poListTable('3.3  List of Purchase Orders containing Hazmat Items', purchaseOrders.hazmat),
      ...poListTable('3.4  List of Purchase Orders containing all Hazmat Free Items', purchaseOrders.hazmatFree),
      ...poListTable('3.5  List of Purchase Orders whose declarations are not received from suppliers', purchaseOrders.noDeclaration),

      // ---------- Section 4: Attachments ----------
      { text: '4  Attachments', bold: true, fontSize: 13, color: NAVY, pageBreak: 'before', tocItem: true, margin: [0, 0, 0, 8] },
      { text: 'Inventory Removal/Replacement Documents', bold: true, fontSize: 10, color: NAVY, margin: [0, 0, 0, 6] },
      attachments.length === 0
        ? { text: 'No attachments.', italics: true, color: '#777', fontSize: 9 }
        : { ol: attachments.map((a) => a.title), fontSize: 9 },
      attachments.length > 0
        ? { text: 'The documents listed above are appended on the following pages.', italics: true, fontSize: 8, color: '#666', margin: [0, 8, 0, 0] }
        : {},
    ],
  };
}

export async function renderIHMReportPdf(data: IHMReportData): Promise<Buffer> {
  const printer = new PdfPrinter(fonts);
  const docDefinition = buildDocDefinition(data);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

/**
 * Append attachment PDFs to the generated report and stamp "Page X of N"
 * on every page except the cover. Returns the final merged buffer.
 */
export async function finalizeReport(
  mainBuffer: Buffer,
  attachmentPaths: string[],
): Promise<Buffer> {
  const doc = await PDFDocument.load(mainBuffer);

  for (const p of attachmentPaths) {
    try {
      if (!fs.existsSync(p)) continue;
      const src = await PDFDocument.load(fs.readFileSync(p));
      const pages = await doc.copyPages(src, src.getPageIndices());
      pages.forEach((pg) => doc.addPage(pg));
    } catch (e) {
      console.error('Failed to merge attachment:', p, e);
    }
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  doc.getPages().forEach((page, i) => {
    if (i === 0) return; // clean cover, no page number
    const { width } = page.getSize();
    const label = `Page ${i + 1} of ${total}`;
    const w = font.widthOfTextAtSize(label, 8);
    page.drawText(label, {
      x: (width - w) / 2,
      y: 18,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  });

  return Buffer.from(await doc.save());
}

/* eslint-disable @typescript-eslint/no-var-requires */
// IHM Report PDF generator. pdfmake lays out the report, including blank
// placeholder pages (with header and footer) for the attachments; pdf-lib then
// draws each attachment page onto its placeholder, scaled inside the frame.
// Layout follows the client's existing IHM Part I reports.

import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';

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
    auditDate?: Date | string | null;
    photoDataUri?: string | null;
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
  inventory: InventoryGroups;
  installed: InventoryGroups;
  removed: InventoryGroups;
  locationDiagrams: LocationDiagramSection[];
  purchaseOrders: {
    hazmat: PoRow[];
    hazmatFree: PoRow[];
    noDeclaration: PoRow[];
  };
  attachments: ReportAttachment[];
}

export interface InventoryGroups {
  i1: InventoryRow[];
  i2: InventoryRow[];
  i3: InventoryRow[];
}

export interface PoRow {
  poNumber: string;
  receivedDate: string;
}

/** One row per hazmat of an inventory point. */
export interface InventoryRow {
  pointNo?: string; // e.g. IP-001
  name?: string; // name of paint / equipment / structural element
  application?: string; // I-1 application of paint / I-2, I-3 parts where used
  location?: string;
  material?: string; // hazmat classification
  quantity?: string; // number only
  unit?: string;
  date?: string; // installation date (3.1) or removal/replaced date (3.2)
  isPCHM?: boolean;
  referenceNo?: string;
  remarks?: string;
}

export interface LocationDiagramSection {
  location: string; // location category, e.g. "Bridge Deck"
  pointLocations: string; // where the points are, e.g. "Nav. Bri. Deck"
  imageDataUri?: string | null;
}

export interface ReportAttachment {
  group: string; // e.g. "Inventory Creation Documents"
  title: string;
  documentType: string;
  linkedPoints: string[]; // e.g. ["i2 - IP-001"]
  filePath: string;
  kind: 'pdf' | 'image';
  pageCount: number;
}

// ---- styling ----------------------------------------------------------------

const NAVY = '#1F3864';
const BLUE = '#2E74B5';
const LIGHT_BLUE = '#9DC3E6';
const HEAD_FILL = '#DDEBF7';
const RED = '#C00000';
const GRID = '#8C8C8C';

const PAGE_MARGINS: [number, number, number, number] = [40, 88, 40, 64];

const COVER_REGULATIONS = [
  'Hong Kong International Convention for the Safe and Environmentally Sound Recycling of Ships (SR/CONF 45)',
  'Guidelines for the Preparation of Inventory of Hazardous Materials (MEPC 379(80) as amended by MEPC 405 (83))',
  'EU Regulation on Ship Recycling (EU-SRR No. 1257/2013)',
  "EMSA's Best Practice Guidance on the Inventory of Hazardous Materials",
];

const INTRO_PARAGRAPH =
  'The Part I of The Inventory of hazardous materials is being updated and maintained under the provision of REGULATION (EU) NO 1257/2013 OF THE EUROPEAN PARLIAMENT AND OF THE COUNCIL OF 20 NOVEMBER 2013 ON SHIP RECYCLING AND AMENDING REGULATION (EC) NO 1013/2006 AND DIRECTIVE 2009/16/EC and the relevant IMO GUIDELINES (RESOLUTION MEPC.379(80))';

const ANNEX_SUFFIX = 'Containing Hazardous Materials Listed in Annex I/Annex II of the EU SRR Reg. 1257/2013';

// OptiHazmat mark: ship in plan view with a hazmat placard pinned on it.
const LOGO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<path d="M20 33H9Q6 33 6 36V52Q6 55 9 55H36C47 55 55 51 60 44C55 37 47 33 36 33H32" fill="none" stroke="#0D47A1" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M26 6L36 16L26 26L16 16Z" fill="#F57C00" stroke="#F57C00" stroke-width="2" stroke-linejoin="round"/>
<path d="M26 26V41" fill="none" stroke="#F57C00" stroke-width="3" stroke-linecap="round"/>
<circle cx="26" cy="44" r="4" fill="#F57C00"/>
</svg>`;

const logo = (size: number) => ({
  columns: [
    { svg: LOGO_MARK_SVG, width: size, height: size },
    {
      width: 'auto',
      margin: [4, size * 0.18, 0, 0],
      stack: [
        { text: 'OptiHazmat', bold: true, color: '#0D47A1', fontSize: size * 0.42 },
        { text: 'shipping IHM services', color: '#266E8C', fontSize: size * 0.2 },
      ],
    },
  ],
  columnGap: 0,
});

const tableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => GRID,
  vLineColor: () => GRID,
  paddingLeft: () => 3,
  paddingRight: () => 3,
  paddingTop: () => 2,
  paddingBottom: () => 2,
};

const headCell = (text: string, extra: Record<string, unknown> = {}) => ({
  text,
  fontSize: 7.5,
  fillColor: HEAD_FILL,
  alignment: 'left',
  ...extra,
});

const cell = (text: string | undefined, extra: Record<string, unknown> = {}) => ({
  text: text && text.trim() ? text : '',
  fontSize: 7.5,
  ...extra,
});

const heading = (text: string, level: 1 | 2 | 3, opts: Record<string, unknown> = {}) => {
  const sizes = { 1: 13, 2: 11, 3: 8.5 };
  return {
    text,
    bold: level !== 3,
    fontSize: sizes[level],
    color: level === 3 ? '#000000' : NAVY,
    margin: level === 1 ? [0, 0, 0, 8] : level === 2 ? [0, 4, 0, 6] : [0, 6, 0, 4],
    ...opts,
  };
};

// TOC entry helper: pdfmake indents with tocMargin.
const tocHeading = (text: string, level: 1 | 2 | 3, opts: Record<string, unknown> = {}) => ({
  ...heading(text, level === 3 ? 2 : level, opts),
  tocItem: true,
  tocMargin: [(level - 1) * 14, 0, 0, 0],
  tocStyle: level === 1 ? { bold: true } : {},
});

// ---- inventory tables ---------------------------------------------------------

function inventoryTable(
  kind: 'paint' | 'equipment' | 'structure',
  rows: InventoryRow[],
  dateHeader?: string,
) {
  const first =
    kind === 'paint'
      ? ['No.', 'Application of Paint', 'Name of paint', 'Location', 'Material\n(classification in\nappendix 1)']
      : kind === 'equipment'
        ? ['No.', 'Name of equipment\nand machinery', 'Location', 'Material\n(classification in\nappendix 1)', 'Parts where\nUsed']
        : ['No.', 'Name of structural\nelement', 'Location', 'Material\n(classification in\nappendix 1)', 'Parts where\nUsed'];

  const widths: Array<number | string> =
    kind === 'paint' ? [18, '*', '*', 62, 68] : [18, '*', 62, 68, 56];
  widths.push(34, 20); // Approximate Quantity: value | unit
  if (dateHeader) widths.push(48);
  widths.push(dateHeader ? 96 : 120);

  const header = [
    ...first.map((h) => headCell(h)),
    headCell('Approximate\nQuantity', { colSpan: 2 }),
    {},
    ...(dateHeader ? [headCell(dateHeader)] : []),
    headCell('Remarks'),
  ];
  const columns = header.length;

  const body: any[] = [header];
  if (rows.length === 0) {
    // Empty row, as in the reference report.
    body.push(Array.from({ length: columns }, () => cell(' ')));
  } else {
    rows.forEach((r, i) => {
      const remarks = [
        r.pointNo ? `INVENTORY POINT NO: ${r.pointNo}` : '',
        r.isPCHM ? 'PCHM' : '',
        r.referenceNo ? `Reference No: ${r.referenceNo}` : '',
        r.remarks ? `Remarks: ${r.remarks}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      const lead =
        kind === 'paint'
          ? [String(i + 1), r.application, r.name, r.location, r.material]
          : [String(i + 1), r.name, r.location, r.material, r.application];
      body.push([
        ...lead.map((v) => cell(v)),
        cell(r.quantity),
        cell(r.unit),
        ...(dateHeader ? [cell(r.date)] : []),
        cell(remarks),
      ]);
    });
  }

  return { table: { headerRows: 1, dontBreakRows: true, widths, body }, layout: tableLayout };
}

function inventoryPages(groups: InventoryGroups, dateHeader?: string) {
  return [
    heading(`I-1 Paints and Coating Systems ${ANNEX_SUFFIX}`, 3),
    inventoryTable('paint', groups.i1, dateHeader),
    heading(`I-2 Equipment and Machinery ${ANNEX_SUFFIX}`, 3, { pageBreak: 'before' }),
    inventoryTable('equipment', groups.i2, dateHeader),
    heading(`I-3 Structure and Hull ${ANNEX_SUFFIX}`, 3, { pageBreak: 'before' }),
    inventoryTable('structure', groups.i3, dateHeader),
  ];
}

const introBlock = () => [
  { text: INTRO_PARAGRAPH, fontSize: 7.5, margin: [0, 0, 0, 4] },
  { text: 'Part I - Hazardous Material Contained in The Ship’s Structure and Equipment', bold: true, fontSize: 7.5, margin: [0, 0, 0, 2] },
];

// ---- purchase orders ------------------------------------------------------------

function poTable(pos: PoRow[]) {
  const body: any[] = [
    ['PO Number', 'PO Received Date', 'PO Number', 'PO Received Date'].map((h) => headCell(h, { fontSize: 8 })),
  ];
  if (pos.length === 0) {
    body.push([cell(' '), cell(' '), cell(' '), cell(' ')]);
  }
  for (let i = 0; i < pos.length; i += 2) {
    const a = pos[i];
    const b = pos[i + 1];
    body.push([
      cell(a.poNumber, { fontSize: 8 }),
      cell(a.receivedDate, { fontSize: 8 }),
      cell(b?.poNumber, { fontSize: 8 }),
      cell(b?.receivedDate, { fontSize: 8 }),
    ]);
  }
  return {
    table: { headerRows: 1, widths: ['*', 80, '*', 80], body },
    layout: { ...tableLayout, hLineColor: () => '#000000', vLineColor: () => '#000000' },
  };
}

// ---- location diagrams --------------------------------------------------------

function locationDiagramPages(diagrams: LocationDiagramSection[]) {
  const content: any[] = [
    tocHeading('2 Location Diagram of Contained and PCHM', 1, { pageBreak: 'before' }),
  ];
  if (diagrams.length === 0) {
    content.push({ text: 'No inventory points containing hazardous materials are marked on location diagrams.', italics: true, color: '#777', fontSize: 9 });
    return content;
  }
  diagrams.forEach((d, idx) => {
    content.push(
      tocHeading(`2.${idx + 1} Check points on ${d.location}:`, 2, idx === 0 ? {} : { pageBreak: 'before' }),
    );
    content.push({
      table: {
        widths: ['*'],
        body: [[
          d.imageDataUri
            ? { image: d.imageDataUri, fit: [505, 520], alignment: 'center', margin: [0, 4, 0, 4] }
            : { text: '[ diagram image unavailable ]', italics: true, color: '#999', fontSize: 8, margin: [0, 40, 0, 40], alignment: 'center' },
        ]],
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#BFBFBF', vLineColor: () => '#BFBFBF' },
    });
    content.push({
      margin: [0, 8, 0, 0],
      table: {
        widths: [70, '*'],
        body: [[
          { text: 'Location', fontSize: 8, fillColor: LIGHT_BLUE },
          { text: d.pointLocations || '-', fontSize: 8 },
        ]],
      },
      layout: { ...tableLayout, hLineColor: () => '#000000', vLineColor: () => '#000000' },
    });
  });
  return content;
}

// ---- attachments -----------------------------------------------------------------

// Space reserved at the top of an attachment's first page for its heading (pt).
export const ATTACHMENT_HEADING_SPACE = 92;

function attachmentHeading(a: ReportAttachment, number: string, firstOfGroup: boolean) {
  const toc = (level: number) => ({ tocItem: true, tocMargin: [level * 14, 0, 0, 0] });
  return [
    { text: a.group, bold: true, fontSize: 11, color: NAVY, margin: [0, 0, 0, 2], ...(firstOfGroup ? toc(1) : {}) },
    { text: `${number} ${a.title} (${a.documentType})`, bold: true, fontSize: 9.5, color: NAVY, margin: [0, 2, 0, 2], ...toc(2) },
    { text: `Linked to Inventory Points: ${a.linkedPoints.join(', ') || '-'}`, fontSize: 8, margin: [10, 0, 0, 0] },
  ];
}

function attachmentPages(data: IHMReportData) {
  const { vessel, reportMeta, attachments } = data;
  const content: any[] = [
    // Cover page for the attachments.
    {
      pageBreak: 'before',
      stack: [
        { ...logo(46), margin: [150, 70, 0, 20] },
        { text: 'Attachments', bold: true, fontSize: 16, alignment: 'center', margin: [0, 20, 0, 18] },
        { text: 'To the', bold: true, fontSize: 13, alignment: 'center', margin: [0, 0, 0, 18] },
        { text: `IHM Report No. ${reportMeta.ihmReportNumber}`, bold: true, fontSize: 13, alignment: 'center', margin: [0, 0, 0, 18] },
        { text: 'For the Creation and Removal of Inventory of Hazardous Materials', fontSize: 13, alignment: 'center', margin: [0, 0, 0, 18] },
        { text: 'For', fontSize: 11, alignment: 'center', margin: [0, 0, 0, 18] },
        { text: vessel.vesselName, bold: true, fontSize: 15, alignment: 'center', margin: [0, 0, 0, 6] },
        { text: `IMO No.: ${vessel.imoNumber}`, bold: true, fontSize: 15, alignment: 'center' },
      ],
    },
    tocHeading('4 Attachments', 1, { pageBreak: 'before' }),
  ];

  if (attachments.length === 0) {
    content.push({ text: 'No documents are attached to this report.', italics: true, color: '#777', fontSize: 9 });
    return content;
  }

  // Index of all documents, grouped by document type.
  let lastGroup = '';
  attachments.forEach((a, i) => {
    if (a.group !== lastGroup) {
      content.push(heading(a.group, 2, { margin: [0, 8, 0, 4] }));
      lastGroup = a.group;
    }
    content.push(heading(`4.${i + 1} ${a.title} (${a.documentType})`, 2, { fontSize: 9.5, margin: [0, 4, 0, 2] }));
    content.push({ text: `Linked to Inventory Points: ${a.linkedPoints.join(', ') || '-'}`, fontSize: 8, margin: [10, 0, 0, 6] });
  });

  // One page per attachment page; pdf-lib draws the document onto these. The
  // first page carries the heading in its top ATTACHMENT_HEADING_SPACE points.
  attachments.forEach((a, i) => {
    content.push({
      pageBreak: 'before',
      stack: attachmentHeading(a, `4.${i + 1}`, i === 0 || attachments[i - 1].group !== a.group),
      unbreakable: true,
    });
    for (let p = 1; p < a.pageCount; p++) {
      content.push({ text: ' ', pageBreak: 'before' });
    }
  });
  return content;
}

// ---- document --------------------------------------------------------------------

function buildDocDefinition(data: IHMReportData) {
  const { vessel, reportMeta, dp, inventory, installed, removed, purchaseOrders } = data;
  const issued = fmtDate(reportMeta.issuedDate);

  const particulars: Array<[string, string]> = [
    ['Vessel Name', vessel.vesselName],
    ['IMO Number', vessel.imoNumber],
    ['Call Sign/ Distinct Number', vessel.callSign || ''],
    ['Vessel Type', vessel.vesselType || ''],
    ['Flag', vessel.flag || ''],
    ['Port of Registry', vessel.portOfRegistry || ''],
    ['Class Society', vessel.classSociety || ''],
    ['Keel Laid Date', vessel.keelLaidDate ? fmtDate(vessel.keelLaidDate) : ''],
    ['Delivery Date', vessel.deliveryDate ? fmtDate(vessel.deliveryDate) : ''],
    ['Owner', vessel.owner || ''],
    ['Manager', vessel.manager && vessel.manager !== '-' ? vessel.manager : ''],
  ];

  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    defaultStyle: { font: 'Roboto', fontSize: 9 },

    header(currentPage: number) {
      if (currentPage === 1) return null; // clean cover
      return {
        margin: [34, 20, 34, 0],
        stack: [
          {
            columns: [
              { width: 150, ...logo(30) },
              {
                width: '*',
                alignment: 'center',
                margin: [0, 6, 0, 0],
                stack: [
                  { text: vessel.vesselName, color: BLUE, fontSize: 11 },
                  { text: 'Inventory of Hazardous Material', fontSize: 8.5, margin: [0, 3, 0, 0] },
                ],
              },
              {
                width: 120,
                margin: [0, 4, 0, 0],
                table: {
                  widths: [42, '*'],
                  body: [
                    [{ text: 'IMO No:', fontSize: 7.5 }, { text: vessel.imoNumber, fontSize: 7.5, alignment: 'right' }],
                    [{ text: 'Version:', fontSize: 7.5 }, { text: reportMeta.version, fontSize: 7.5, alignment: 'right' }],
                    [{ text: 'Issued:', fontSize: 7.5 }, { text: issued, fontSize: 7.5, alignment: 'right' }],
                  ],
                },
                layout: { defaultBorder: false, paddingTop: () => 0, paddingBottom: () => 0 },
              },
            ],
          },
          { canvas: [{ type: 'line', x1: -34, y1: 10, x2: 561, y2: 10, lineWidth: 1, lineColor: LIGHT_BLUE }] },
        ],
      };
    },

    footer(currentPage: number, pageCount: number) {
      if (currentPage === 1) return null; // clean cover
      return {
        margin: [34, 8, 34, 0],
        stack: [
          { canvas: [{ type: 'line', x1: -34, y1: 0, x2: 561, y2: 0, lineWidth: 1, lineColor: LIGHT_BLUE }] },
          {
            margin: [0, 5, 0, 0],
            columns: [
              {
                width: '*',
                fontSize: 7,
                stack: [
                  { text: 'OPTIHAZMAT PTE LTD' },
                  { text: '16 Raffles Quay, #33-03 Hong Leong Building, Singapore 048581' },
                  { text: 'www.optihazmat.com' },
                ],
              },
              {
                width: 170,
                alignment: 'right',
                fontSize: 7,
                stack: [
                  { text: reportMeta.ihmReportNumber },
                  { text: [{ text: 'Printed by: ', italics: true }, { text: 'OptiHazmat', italics: true, color: '#0D47A1' }] },
                  { text: [{ text: 'Page ' }, { text: String(currentPage), bold: true }, { text: ' of ' }, { text: String(pageCount), bold: true }], fontSize: 8 },
                ],
              },
            ],
          },
        ],
      };
    },

    content: [
      // ---------- Cover ----------
      { ...logo(52), margin: [0, -40, 0, 36] },
      {
        alignment: 'right',
        stack: [
          { text: 'INVENTORY OF HAZARDOUS MATERIAL PART-I', color: BLUE, fontSize: 17, margin: [0, 0, 0, 10] },
          { text: 'For', fontSize: 9 },
          { text: vessel.vesselName, fontSize: 17, margin: [0, 2, 0, 4] },
          { text: [{ text: 'IMO NO: ', bold: true, color: BLUE }, { text: vessel.imoNumber, bold: true, color: BLUE }], fontSize: 11 },
          { text: `Version: ${reportMeta.version}`, color: BLUE, fontSize: 10, margin: [0, 3, 0, 0] },
          { text: `Date: ${issued}`, color: BLUE, fontSize: 10 },
        ],
      },
      vessel.photoDataUri
        ? { image: vessel.photoDataUri, fit: [260, 180], alignment: 'center', margin: [0, 40, 0, 40] }
        : { text: '', margin: [0, 230, 0, 0] },
      { text: 'According To:', fontSize: 9, margin: [0, 20, 0, 3] },
      ...COVER_REGULATIONS.map((r) => ({
        columns: [
          { width: 14, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="7" height="7"><path d="M1.5 6.5L4.5 9.5L10.5 2.5" fill="none" stroke="#2E74B5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', margin: [0, 2, 0, 0] },
          { width: '*', text: r, fontSize: 8.5 },
        ],
        margin: [8, 0, 0, 1],
      })),
      { text: 'www.optihazmat.com', alignment: 'center', fontSize: 11, margin: [0, 24, 0, 0] },

      // ---------- The IHM Part I ----------
      {
        pageBreak: 'before',
        stack: [
          { text: 'THE IHM', alignment: 'center', fontSize: 28, color: BLUE, margin: [0, 10, 0, 16] },
          { text: 'Part I', alignment: 'center', fontSize: 16, margin: [0, 0, 0, 14] },
          { text: '(Inventory of Hazardous materials)', alignment: 'center', fontSize: 13, margin: [0, 0, 0, 14] },
          { text: 'For', alignment: 'center', fontSize: 11, margin: [0, 0, 0, 14] },
          { text: vessel.vesselName, alignment: 'center', fontSize: 15 },
          { text: [{ text: 'IMO ' }, { text: vessel.imoNumber, color: BLUE }], alignment: 'center', fontSize: 11, margin: [0, 0, 0, 24] },
        ],
      },
      {
        margin: [10, 0, 0, 26],
        table: {
          widths: [55, '*'],
          body: [
            [{ text: 'Owner:', fontSize: 8.5 }, { text: vessel.owner || '', fontSize: 8.5 }],
            [{ text: 'Manager:', fontSize: 8.5 }, { text: vessel.manager && vessel.manager !== '-' ? vessel.manager : '', fontSize: 8.5 }],
            [{ text: 'Audit Date:', fontSize: 8.5 }, { text: vessel.auditDate ? fmtDate(vessel.auditDate) : '', fontSize: 8.5 }],
          ],
        },
        layout: 'noBorders',
      },
      { text: 'This Inventory of Hazardous Materials for existing ships was prepared in accordance with the:', fontSize: 8.5, margin: [10, 0, 0, 8] },
      {
        ul: [
          'Hong Kong International Convention for the Safe and Environmentally Sound Recycling of Ships (SR/CONF 45)',
          'EU Regulation on Ship Recycling (EU-SRR No. 1257/2013)',
          'Guidelines for the Preparation of Inventory of Hazardous Materials (MEPC Res 379(80))',
          'EMSA’s Best Practice Guidance on the Inventory of Hazardous Materials',
        ],
        fontSize: 8.5,
        margin: [20, 0, 0, 26],
      },
      { text: 'Designated person(s) responsible for maintaining and updating the inventory:', fontSize: 8.5, margin: [10, 0, 0, 8] },
      {
        margin: [10, 0, 0, 0],
        table: {
          headerRows: 1,
          widths: ['*', '*', 40, 62, 50, 90],
          body: [
            ['Name', 'Position', 'Initials', 'Start Date', 'End Date', 'Signature'].map((h) => headCell(h, { fontSize: 8, fillColor: LIGHT_BLUE })),
            ...dp.map((p) => [
              cell(p.name, { fontSize: 8 }),
              cell(p.position, { fontSize: 8 }),
              cell(p.initials, { fontSize: 8 }),
              cell(fmtDate(p.startDate), { fontSize: 8 }),
              cell(p.endDate ? fmtDate(p.endDate) : '-', { fontSize: 8 }),
              cell(' ', { fontSize: 8, margin: [0, 8, 0, 8] }),
            ]),
          ],
        },
        layout: tableLayout,
      },

      // ---------- Contents ----------
      {
        pageBreak: 'before',
        toc: {
          title: { text: 'Contents', fontSize: 15, color: BLUE, margin: [0, 0, 0, 10] },
          textStyle: { fontSize: 8.5 },
          numberStyle: { fontSize: 8.5 },
          textMargin: [0, 3, 0, 3],
        },
      },

      // ---------- Quality Policy ----------
      tocHeading('Quality Policy', 1, { pageBreak: 'before', margin: [0, 30, 0, 6] }),
      { text: 'OPTIHAZMAT’s policy is to deliver high quality service and satisfaction to its customers.', fontSize: 9, margin: [0, 0, 0, 6] },
      { text: 'We ensure that we learn from feedback and post job analyses, so that we continually improve our levels of performance.', fontSize: 9, margin: [0, 0, 0, 6] },
      { text: 'We welcome our customers to provide their feedback, either personally or by email to: contact@optihazmat.com.', fontSize: 9, margin: [0, 0, 0, 18] },
      heading('Disclaimer', 2),
      { text: 'The results relate solely to the investigated materials', fontSize: 9, margin: [0, 0, 0, 18] },
      heading(`Copyright© ${new Date(reportMeta.issuedDate).getFullYear()} All rights reserved.`, 2),
      { text: 'No part of this publication may be reproduced and/or made public by means of print or by way of any other transmission, e.g. photocopying, microfilm, recording, or otherwise, without prior written permission.', fontSize: 9, margin: [0, 0, 0, 6] },
      { text: 'In the event any information is distributed, copied, reproduced, modified, distorted, or transmitted without prior written permission, OPTIHAZMAT PTE LTD reserves the right to legally enforce any infringement of its intellectual property rights', fontSize: 9, margin: [0, 0, 0, 24] },
      { text: 'OPTIHAZMAT PTE LTD', bold: true, fontSize: 9 },
      { text: '16 Raffles Quay, #33-03 Hong Leong Building', fontSize: 9 },
      { text: 'Singapore 048581', fontSize: 9 },

      // ---------- Vessel Particular ----------
      tocHeading('Vessel Particular', 1, { pageBreak: 'before', alignment: 'center', margin: [0, 10, 0, 18] }),
      {
        margin: [20, 0, 20, 0],
        table: {
          widths: [140, '*'],
          body: particulars.map(([k, v]) => [
            { text: k, fontSize: 10, alignment: 'right', fillColor: '#F2F2F2', margin: [2, 5, 6, 5] },
            { text: v, fontSize: 10, margin: [6, 5, 2, 5] },
          ]),
        },
        layout: { ...tableLayout, hLineColor: () => '#000000', vLineColor: () => '#000000' },
      },

      // ---------- Section 1 ----------
      tocHeading('1 Inventory of Hazardous Materials Part I', 1, { pageBreak: 'before' }),
      ...introBlock(),
      ...inventoryPages(inventory),

      // ---------- Section 2 ----------
      ...locationDiagramPages(data.locationDiagrams),

      // ---------- Section 3: Appendix 1 ----------
      tocHeading('3 Appendix 1', 1, { pageBreak: 'before' }),
      tocHeading('3.1 Installed Items Containing Hazmat', 2, { color: BLUE }),
      ...introBlock(),
      ...inventoryPages(installed, 'Installation\nDate'),

      tocHeading('3.2 Removed/Replaced Items Containing Hazmat', 2, { color: RED, pageBreak: 'before' }),
      ...introBlock(),
      ...inventoryPages(removed, 'Removal/\nReplaced\nDate'),

      tocHeading('3.3 List of Purchase orders containing Hazmat Items', 2, { pageBreak: 'before', color: RED }),
      poTable(purchaseOrders.hazmat),
      tocHeading('3.4 List of Purchase orders containing all Hazmat Free items', 2, { pageBreak: 'before', color: '#548235' }),
      poTable(purchaseOrders.hazmatFree),
      tocHeading('3.5 List of Purchase orders whose declarations are not received from suppliers', 2, { pageBreak: 'before', color: '#7F7F7F' }),
      poTable(purchaseOrders.noDeclaration),

      // ---------- Section 4: Attachments ----------
      ...attachmentPages(data),
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
 * Draw every attachment page onto its placeholder page (the last pages of the
 * report, in order), scaled to fit inside the header and footer.
 */
export async function finalizeReport(
  mainBuffer: Buffer,
  attachments: ReportAttachment[],
): Promise<Buffer> {
  const doc = await PDFDocument.load(mainBuffer);
  const pages = doc.getPages();
  const totalPlaceholders = attachments.reduce((sum, a) => sum + a.pageCount, 0);
  let pageIndex = pages.length - totalPlaceholders;
  if (pageIndex < 0) return Buffer.from(await doc.save());

  const [left, top, right, bottom] = PAGE_MARGINS;

  for (const a of attachments) {
    const firstIndex = pageIndex;
    try {
      const bytes = fs.readFileSync(a.filePath);
      const drawInto = (placeholderIndex: number, draw: (box: { x: number; y: number; w: number; h: number }) => void) => {
        const target = pages[placeholderIndex];
        const { width, height } = target.getSize();
        const reserve = placeholderIndex === firstIndex ? ATTACHMENT_HEADING_SPACE : 0;
        draw({ x: left, y: bottom, w: width - left - right, h: height - top - bottom - reserve });
      };
      const fit = (srcW: number, srcH: number, box: { x: number; y: number; w: number; h: number }) => {
        const scale = Math.min(box.w / srcW, box.h / srcH, 1);
        const w = srcW * scale;
        const h = srcH * scale;
        return { x: box.x + (box.w - w) / 2, y: box.y + box.h - h, width: w, height: h };
      };

      if (a.kind === 'pdf') {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const embedded = await doc.embedPages(src.getPages());
        embedded.forEach((ep, i) => {
          drawInto(pageIndex + i, (box) => {
            const pos = fit(ep.width, ep.height, box);
            pages[pageIndex + i].drawPage(ep, pos);
          });
        });
      } else {
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        drawInto(pageIndex, (box) => {
          const pos = fit(image.width, image.height, box);
          pages[pageIndex].drawImage(image, pos);
        });
      }
    } catch (e) {
      console.error('Failed to place attachment:', a.filePath, e);
    }
    pageIndex += a.pageCount;
  }

  return Buffer.from(await doc.save());
}

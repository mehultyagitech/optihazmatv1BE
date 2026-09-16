import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';
import { PDFDocument } from 'pdf-lib';
import {
  renderIHMReportPdf,
  finalizeReport,
  fmtDate,
  IHMReportData,
  InventoryRow,
  LocationDiagramSection,
  PoRow,
  ReportAttachment,
} from '../services/IHMReportService';

const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

// Draw each point on a location-diagram image: a marker at the point and a
// callout label (point number and name) with a leader line, like the
// reference reports. Pin x/y are percentages (0..100).
async function annotateDiagram(
  imageFile: string,
  pins: Array<{ x: number; y: number; code: string; label: string }>,
): Promise<string | null> {
  try {
    const imgPath = path.join(UPLOADS_DIR, imageFile);
    if (!fs.existsSync(imgPath)) return null;
    const meta = await sharp(imgPath).metadata();
    const W = meta.width || 800;
    const H = meta.height || 600;
    const r = Math.max(8, Math.round(W * 0.012));
    const fs1 = Math.max(12, Math.round(W * 0.018));
    const fs2 = Math.max(14, Math.round(W * 0.024));
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const markers = pins
      .map((p, i) => {
        const cx = Math.round(((p.x ?? 0) / 100) * W);
        const cy = Math.round(((p.y ?? 0) / 100) * H);
        const short = p.label.length > 24 ? `${p.label.slice(0, 23)}…` : p.label;
        const name = esc(short);
        const boxW = Math.round(Math.max(p.code.length * fs1 * 0.62, short.length * fs2 * 0.68) + fs1 * 1.2);
        const boxH = Math.round(fs1 + fs2 + fs1 * 0.9);
        // Put the label above-left or above-right of the point, inside the image.
        let bx = cx + (cx > W / 2 ? -boxW - 3 * r : 3 * r);
        let by = cy - boxH - 3 * r - (i % 3) * Math.round(boxH * 0.4);
        bx = Math.min(Math.max(2, bx), W - boxW - 2);
        by = Math.min(Math.max(2, by), H - boxH - 2);
        const lx = bx + (bx > cx ? 0 : boxW);
        const ly = by + boxH;
        return `<line x1="${cx}" y1="${cy}" x2="${lx}" y2="${ly}" stroke="#E91E8C" stroke-width="${Math.max(2, r / 3)}"/>
<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" fill="#FFFFFF" fill-opacity="0.92" stroke="#E91E8C" stroke-width="${Math.max(2, r / 3)}"/>
<text x="${bx + fs1 / 2}" y="${by + fs1 * 1.1}" font-size="${fs1}" fill="#E91E8C" font-family="Arial">${esc(p.code)}</text>
<text x="${bx + fs1 / 2}" y="${by + fs1 * 1.1 + fs2 * 1.05}" font-size="${fs2}" fill="#C2185B" font-family="Arial" font-weight="bold">${name}</text>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="#E91E8C" stroke="#fff" stroke-width="2"/>`;
      })
      .join('');
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${markers}</svg>`;
    const out = await sharp(imgPath)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch (e) {
    console.error('annotateDiagram error:', e);
    return null;
  }
}

// Vessel photo for the cover, downsized.
async function vesselPhoto(file?: string): Promise<string | null> {
  try {
    if (!file) return null;
    const imgPath = path.join(UPLOADS_DIR, file);
    if (!fs.existsSync(imgPath)) return null;
    const out = await sharp(imgPath).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch (e) {
    console.error('vesselPhoto error:', e);
    return null;
  }
}

// Guard against fields saved as the literal strings "undefined"/"null".
const clean = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v);
  const t = s.trim();
  return t === 'undefined' || t === 'null' ? '' : t;
};

const initialsOf = (name?: string | null) =>
  (name || '')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 3)
    .toUpperCase();

const positionOf = (roles?: string) =>
  roles === 'ADMIN' ? 'IHM Maintenance Manager' : 'User';

// PO dates are stored as text, "DD/MM/YYYY" from the PO upload.
const parsePoDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

// Attachment groups in report order.
const GROUP_ORDER = [
  'Inventory Creation Document',
  'Inventory Removal Document',
  'Inventory Replacement Document',
];

/** One report row per hazmat of the point (a point without hazmats gets one row). */
const pinToRows = (pin: any, pointNo: string, date?: string): InventoryRow[] => {
  const hazmats: any[] = pin.PinHazmat?.length ? pin.PinHazmat : [null];
  const name = clean(pin.Description) || clean(pin.equipment?.name) || '-';
  return hazmats.map((h) => ({
    pointNo,
    name,
    application: clean(h?.object?.name) || clean(pin.object?.name) || clean(pin.equipment?.name),
    location: clean(pin.subLocation?.name),
    material: clean(h?.hazmat?.name),
    quantity: h ? String(h.totalMass ?? '') : '',
    unit: clean(h?.unit?.name),
    date,
    isPCHM: !!pin.isPCHM,
    referenceNo: clean(pin.referenceNo),
    remarks: [clean(h?.remarks), clean(pin.remarks)].filter(Boolean).join('\n'),
  }));
};

/** Answer a failed report request instead of rethrowing (which crashes the API). */
const handleReportError = (res: Response, error: unknown, action: string) => {
  console.error(`Failed to ${action} IHM report:`, error);
  return res.status(500).json({ success: false, message: `Could not ${action} the IHM report` });
};

export async function generateIHMReport(req: Request, res: Response) {
  try {
    const { user } = res.locals;
    const { id: vesselId } = req.params;
    const { version = '1.0', periodToDate } = req.body || {};

    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      include: { Client: true, Manager: true, VesselImages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!vessel) throw new ApiException('Vessel not found', 404);

    // All inventory points for this vessel, oldest first.
    const pins = await prisma.pins.findMany({
      where: { locationDiagram: { vesselId } },
      include: {
        inventory: true,
        subLocation: true,
        equipment: true,
        object: true,
        locationDiagram: { include: { location: true } },
        PinHazmat: { include: { hazmat: true, unit: true, object: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Inventory point numbers used throughout the report: IP-001, IP-002, ...
    const pointNo = new Map(pins.map((p, i) => [p.id, `IP-${String(i + 1).padStart(3, '0')}`]));
    const pointRef = (p: any) => `${p.inventory?.name || '-'} - ${pointNo.get(p.id)}`;

    const onBoard = pins.filter((p) => !p.isRemovedFromIHM && !p.isReplaced);
    // Installed during maintenance: points with an installation date.
    const installedPins = onBoard.filter((p) => !!p.installationDate);
    const removedPins = pins.filter((p) => p.isRemovedFromIHM || p.isReplaced);

    const groupBy = (list: any[], dateFor?: (p: any) => string | undefined) => {
      const rows = (name: string) =>
        list
          .filter((p) => p.inventory?.name === name)
          .flatMap((p) => pinToRows(p, pointNo.get(p.id) as string, dateFor?.(p)));
      return { i1: rows('i1'), i2: rows('i2'), i3: rows('i3') };
    };

    const inventory = groupBy(onBoard);
    const installed = groupBy(installedPins, (p) => fmtDate(p.installationDate));
    const removed = groupBy(removedPins, (p) => (p.removedDate ? fmtDate(p.removedDate) : fmtDate(p.updatedAt)));

    // ---- Section 2: diagrams that have points still on board ----
    const diagrams = await prisma.locationDiagram.findMany({
      where: { vesselId },
      include: { location: true, subLocation: true, LocationDiagramImage: true },
      orderBy: { createdAt: 'asc' },
    });

    const locationDiagrams: LocationDiagramSection[] = [];
    for (const d of diagrams) {
      const diagramPins = onBoard.filter((p) => p.locationDiagramId === d.id);
      if (diagramPins.length === 0) continue;
      const imageFile = d.LocationDiagramImage?.[0]?.url;
      const imageDataUri = imageFile
        ? await annotateDiagram(
            imageFile,
            diagramPins.map((p) => ({
              x: p.x,
              y: p.y,
              code: pointRef(p),
              label: clean(p.Description) || clean(p.equipment?.name) || clean(p.object?.name) || '-',
            })),
          )
        : null;
      locationDiagrams.push({
        location: d.subLocation?.name || d.location?.name || '-',
        pointLocations: [...new Set(diagramPins.map((p) => clean(p.subLocation?.name)).filter(Boolean))].join(', '),
        imageDataUri,
      });
    }

    // ---- Section 3.3-3.5: purchase orders for this vessel, by received date ----
    const pos = await prisma.purchaseOrder.findMany({
      where: { OR: [{ vesselId }, { shipImo: vessel.imoNumber }] },
      include: { items: true },
    });
    const receivedOf = (po: any) => parsePoDate(po.orderRcvDate) || parsePoDate(po.orderDate);
    pos.sort((a, b) => (receivedOf(a)?.getTime() ?? 0) - (receivedOf(b)?.getTime() ?? 0));
    const toPoRow = (po: any): PoRow => {
      const d = receivedOf(po);
      return { poNumber: po.poNumber, receivedDate: d ? fmtDate(d) : clean(po.orderRcvDate) || '-' };
    };
    const hasHazmat = (po: any) =>
      (po.items || []).some((it: any) => String(it.canContainHazmat).toUpperCase() === 'YES');
    const notReceived = (po: any) =>
      !po.docStatus || ['not_started', 'pending', ''].includes(String(po.docStatus));

    const purchaseOrders = {
      hazmat: pos.filter(hasHazmat).map(toPoRow),
      // Hazmat free means the supplier's declarations are in and show no hazmat;
      // POs still awaiting declarations belong to 3.5 only.
      hazmatFree: pos
        .filter((p) => (p.items || []).length > 0 && !hasHazmat(p) && !notReceived(p))
        .map(toPoRow),
      noDeclaration: pos.filter(notReceived).map(toPoRow),
    };

    // ---- Section 4: documents of this vessel's inventory points ----
    const pinAttachments = await prisma.pinAttachments.findMany({
      where: { pin: { locationDiagram: { vesselId } } },
      include: {
        documentType: true,
        pin: { include: { inventory: true } },
        PinAttachmentPivotLinks: { include: { pin: { include: { inventory: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const attachments: ReportAttachment[] = [];
    for (const a of pinAttachments) {
      const filePath = path.join(UPLOADS_DIR, a.url);
      if (!fs.existsSync(filePath)) continue;
      const ext = path.extname(a.url).toLowerCase();
      const kind = ext === '.pdf' ? 'pdf' : ['.png', '.jpg', '.jpeg'].includes(ext) ? 'image' : null;
      if (!kind) continue;
      let pageCount = 1;
      if (kind === 'pdf') {
        try {
          pageCount = (await PDFDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true })).getPageCount();
        } catch (e) {
          console.error('Unreadable attachment skipped:', a.url, e);
          continue;
        }
      }
      const linkedPins = [a.pin, ...a.PinAttachmentPivotLinks.map((l) => l.pin)].filter(Boolean);
      const typeName = a.documentType?.name || 'Document';
      // The same document is often attached to several points: list it once
      // with all of them.
      const sameDoc = attachments.find(
        (x) => x.title === a.fileName.replace(/\.[a-z0-9]+$/i, '') && fs.statSync(x.filePath).size === fs.statSync(filePath).size,
      );
      if (sameDoc) {
        sameDoc.linkedPoints = [...new Set([...sameDoc.linkedPoints, ...linkedPins.map(pointRef)])];
        continue;
      }
      attachments.push({
        group: `${GROUP_ORDER.includes(typeName) ? typeName : 'Other Document'}s`,
        title: a.fileName.replace(/\.[a-z0-9]+$/i, ''),
        documentType: typeName,
        linkedPoints: [...new Set(linkedPins.map(pointRef))],
        filePath,
        kind,
        pageCount,
      });
    }
    const groupRank = (g: string) => {
      const i = GROUP_ORDER.findIndex((t) => `${t}s` === g);
      return i === -1 ? GROUP_ORDER.length : i;
    };
    attachments.sort((a, b) => groupRank(a.group) - groupRank(b.group));

    const seq = (await prisma.iHMReport.count({ where: { vesselId } })) + 1;
    const issuedDate = new Date();

    const data: IHMReportData = {
      vessel: {
        vesselName: vessel.vesselName,
        imoNumber: vessel.imoNumber,
        callSign: vessel.callSign,
        vesselType: vessel.vesselType,
        flag: vessel.flag,
        portOfRegistry: vessel.portOfRegistry,
        classSociety: vessel.classSociety,
        keelLaidDate: vessel.keelLaidDate,
        deliveryDate: vessel.deliveryDate,
        owner: vessel.registeredOwner,
        manager: vessel.Manager?.companyName || '',
        auditDate: vessel.ihmSurveyStartDate,
        photoDataUri: await vesselPhoto(vessel.VesselImages?.[0]?.url),
      },
      reportMeta: {
        version: String(version),
        issuedDate,
        ihmReportNumber: `${vessel.imoNumber}/${String(seq).padStart(2, '0')}`,
        periodToDate: periodToDate ? new Date(periodToDate) : null,
      },
      dp: [
        {
          name: user.name || user.email,
          position: positionOf(user.roles),
          initials: initialsOf(user.name || user.email),
          startDate: vessel.maintenanceStartDate || user.createdAt,
          endDate: null,
        },
      ],
      inventory,
      installed,
      removed,
      locationDiagrams,
      purchaseOrders,
      attachments,
    };

    const mainBuffer = await renderIHMReportPdf(data);
    const pdfBuffer = await finalizeReport(mainBuffer, attachments);

    // Save to the served uploads directory
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const storedName = `${crypto.randomBytes(12).toString('hex')}.pdf`;
    fs.writeFileSync(path.join(uploadsDir, storedName), pdfBuffer);

    const displayName = `IHMReport_${vessel.vesselName.replace(/[^\w]+/g, '_')}_${fmtDate(
      issuedDate,
    )}.pdf`;

    const report = await prisma.iHMReport.create({
      data: {
        vesselId,
        version: String(version),
        periodToDate: periodToDate ? new Date(periodToDate) : null,
        ihmReportNumber: data.reportMeta.ihmReportNumber,
        fileName: displayName,
        fileUrl: storedName,
        createdBy: user.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'IHM Report generated',
      data: { report },
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, data: error.data });
    }
    return handleReportError(res, error, 'generate');
  }
}

export async function getIHMReports(req: Request, res: Response) {
  try {
    const { id: vesselId } = req.params;
    const reports = await prisma.iHMReport.findMany({
      where: { vesselId },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: { reports } });
  } catch (error) {
    if (error instanceof ApiException) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }
    return handleReportError(res, error, 'load');
  }
}

export async function updateIHMReport(req: Request, res: Response) {
  try {
    const { reportId } = req.params;
    const { approved, disabled } = req.body || {};
    const data: Record<string, unknown> = {};
    if (approved !== undefined) data.approved = !!approved;
    if (disabled !== undefined) data.disabled = !!disabled;

    const report = await prisma.iHMReport.update({
      where: { id: reportId },
      data,
    });
    return res.status(200).json({ success: true, data: { report } });
  } catch (error) {
    if (error instanceof ApiException) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }
    return handleReportError(res, error, 'update');
  }
}

export async function deleteIHMReport(req: Request, res: Response) {
  try {
    const { reportId } = req.params;
    const report = await prisma.iHMReport.findUnique({ where: { id: reportId } });
    if (report?.fileUrl) {
      const filePath = path.join(__dirname, '../../public/uploads', report.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.iHMReport.delete({ where: { id: reportId } });
    return res.status(200).json({ success: true, message: 'Report deleted' });
  } catch (error) {
    if (error instanceof ApiException) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }
    return handleReportError(res, error, 'delete');
  }
}

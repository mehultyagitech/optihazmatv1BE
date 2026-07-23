import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';
import {
  renderIHMReportPdf,
  finalizeReport,
  fmtDate,
  IHMReportData,
  InventoryRow,
  LocationDiagramSection,
  PoRow,
} from '../services/IHMReportService';

const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

// Draw numbered pin markers onto a location-diagram image (x/y are 0..1).
async function annotateDiagram(
  imageFile: string,
  pins: Array<{ x: number; y: number }>,
): Promise<string | null> {
  try {
    const imgPath = path.join(UPLOADS_DIR, imageFile);
    if (!fs.existsSync(imgPath)) return null;
    const meta = await sharp(imgPath).metadata();
    const W = meta.width || 800;
    const H = meta.height || 600;
    const r = Math.max(10, Math.round(W * 0.018));
    const fontSize = Math.round(r * 1.3);
    const markers = pins
      .map((p, i) => {
        // Pin x/y are stored as percentages (0..100)
        const cx = Math.round(((p.x ?? 0) / 100) * W);
        const cy = Math.round(((p.y ?? 0) / 100) * H);
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#d32f2f" fill-opacity="0.9" stroke="#fff" stroke-width="2"/><text x="${cx}" y="${cy + fontSize / 3}" font-size="${fontSize}" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">${i + 1}</text>`;
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

// Guard against fields saved as the literal strings "undefined"/"null".
const clean = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v);
  const t = s.trim();
  return t === 'undefined' || t === 'null' ? '' : s;
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
  roles === 'ADMIN' ? 'IHM Manager' : 'User';

const pinToRow = (pin: any, date?: string): InventoryRow => ({
  pointNo: clean(pin.referenceNo) || undefined,
  name: clean(pin.Description) || '-',
  application: clean(pin.object?.name) || clean(pin.equipment?.name) || '-',
  location: clean(pin.subLocation?.name) || '-',
  material:
    (pin.PinHazmat || [])
      .map((h: any) => h.hazmat?.name)
      .filter(Boolean)
      .join(', ') || '-',
  quantity:
    (pin.PinHazmat || [])
      .map((h: any) => `${h.totalMass ?? 0} ${h.unit?.name ?? ''}`.trim())
      .join(', ') || '-',
  date,
  remarks: clean(pin.remarks),
});

export async function generateIHMReport(req: Request, res: Response) {
  try {
    const { user } = res.locals;
    const { id: vesselId } = req.params;
    const { version = '1.0', periodToDate } = req.body || {};

    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      include: { Client: true, Manager: true },
    });
    if (!vessel) throw new ApiException('Vessel not found', 404);

    // All inventory points for this vessel
    const pins = await prisma.pins.findMany({
      where: { locationDiagram: { vesselId } },
      include: {
        inventory: true,
        subLocation: true,
        equipment: true,
        object: true,
        PinHazmat: { include: { hazmat: true, unit: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const contained = pins.filter((p) => !p.isRemovedFromIHM);
    const removedPins = pins.filter((p) => p.isRemovedFromIHM || p.isReplaced);

    const groupBy = (
      list: any[],
      dateFor?: (p: any) => string | undefined,
    ) => ({
      i1: list.filter((p) => p.inventory?.name === 'i1').map((p) => pinToRow(p, dateFor?.(p))),
      i2: list.filter((p) => p.inventory?.name === 'i2').map((p) => pinToRow(p, dateFor?.(p))),
      i3: list.filter((p) => p.inventory?.name === 'i3').map((p) => pinToRow(p, dateFor?.(p))),
    });

    const inventory = groupBy(contained);
    const installed = groupBy(contained, (p) =>
      fmtDate(p.installationDate || p.createdAt),
    );
    const removed = groupBy(removedPins, (p) =>
      p.removedDate ? fmtDate(p.removedDate) : '-',
    );

    // ---- Section 2: location diagrams (annotated) ----
    const diagrams = await prisma.locationDiagram.findMany({
      where: { vesselId },
      include: {
        location: true,
        subLocation: true,
        LocationDiagramImage: true,
        Pins: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const locationDiagrams: LocationDiagramSection[] = [];
    for (const d of diagrams) {
      const imageFile = d.LocationDiagramImage?.[0]?.url;
      const imageDataUri = imageFile
        ? await annotateDiagram(imageFile, d.Pins as any)
        : null;
      locationDiagrams.push({
        location: d.location?.name || '-',
        subLocation: d.subLocation?.name || '-',
        imageDataUri,
        points: (d.Pins as any[]).map((p, i) => ({
          no: i + 1,
          description: clean(p.Description) || '-',
          pointNo: clean(p.referenceNo) || undefined,
        })),
      });
    }

    // ---- Section 3.3-3.5: purchase orders for this vessel ----
    const pos = await prisma.purchaseOrder.findMany({
      where: { OR: [{ vesselId }, { shipImo: vessel.imoNumber }] },
      include: { items: true },
      orderBy: { orderRcvDate: 'asc' },
    });
    const toPoRow = (po: any): PoRow => ({
      poNumber: po.poNumber,
      receivedDate: po.orderRcvDate || po.orderDate || '-',
    });
    const hasHazmat = (po: any) =>
      (po.items || []).some((it: any) => String(it.canContainHazmat).toUpperCase() === 'YES');
    const notReceived = (po: any) =>
      !po.docStatus || ['not_started', 'pending', ''].includes(String(po.docStatus));

    const purchaseOrders = {
      hazmat: pos.filter(hasHazmat).map(toPoRow),
      hazmatFree: pos.filter((p) => (p.items || []).length > 0 && !hasHazmat(p)).map(toPoRow),
      noDeclaration: pos.filter(notReceived).map(toPoRow),
    };

    // ---- Section 4: PDF attachments of this vessel's inventory points ----
    const pinAttachments = await prisma.pinAttachments.findMany({
      where: { pin: { locationDiagram: { vesselId } } },
      orderBy: { createdAt: 'asc' },
    });
    const pdfAttachments = pinAttachments.filter((a) =>
      String(a.url).toLowerCase().endsWith('.pdf'),
    );
    const attachments = pdfAttachments.map((a, i) => ({
      title: a.fileName || `Attachment ${i + 1}`,
    }));
    const attachmentPaths = pdfAttachments.map((a) => path.join(UPLOADS_DIR, a.url));

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
        manager: vessel.Manager?.companyName || '-',
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
          startDate: user.createdAt,
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
    const pdfBuffer = await finalizeReport(mainBuffer, attachmentPaths);

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
    throw error;
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
    throw error;
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
    throw error;
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
    throw error;
  }
}

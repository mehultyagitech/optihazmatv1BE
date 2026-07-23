import { Request, Response } from 'express';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/**
 * Bulk-create purchase orders from uploaded rows (one row per item).
 * Rows are grouped by PO number; PO-level fields are taken from the first
 * row of each group. Re-uploading for a ship replaces that ship's POs.
 */
export async function createPurchaseOrdersBulk(req: Request, res: Response) {
  try {
    const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      throw new ApiException('No rows provided', 422);
    }

    // Group rows by PO number
    const groups: Record<string, any[]> = {};
    for (const row of rows) {
      const key = str(row.poNumber) || '(no PO)';
      (groups[key] = groups[key] || []).push(row);
    }

    // Replace existing POs for the ship IMOs present in this upload (idempotent re-upload)
    const imos = [
      ...new Set(rows.map((r) => str(r.shipImo)).filter((v) => v !== '')),
    ];
    if (imos.length > 0) {
      await prisma.purchaseOrder.deleteMany({
        where: { shipImo: { in: imos } },
      });
    }

    let poCreated = 0;
    let itemCreated = 0;

    for (const [poNumber, its] of Object.entries(groups)) {
      const first = its[0];
      const shipImo = str(first.shipImo);

      // Link to a vessel if one matches the ship IMO
      let vesselId: string | null = null;
      if (shipImo) {
        const vessel = await prisma.vessel.findFirst({
          where: { imoNumber: shipImo },
          select: { id: true },
        });
        vesselId = vessel?.id ?? null;
      }

      await prisma.purchaseOrder.create({
        data: {
          poNumber,
          shipName: str(first.shipName),
          shipImo,
          clientName: str(first.clientName),
          supplier: str(first.supplier),
          supplierEmail1: str(first.supplierEmail1),
          supplierEmail2: str(first.supplierEmail2),
          supplierEmail3: str(first.supplierEmail3),
          supplierPhone1: str(first.supplierPhone1),
          supplierPhone2: str(first.supplierPhone2),
          orderDate: str(first.orderDate),
          orderRcvDate: str(first.orderRcvDate),
          referenceNumber: str(first.referenceNumber),
          emailType: str(first.emailType),
          currencyCode: str(first.currencyCode),
          docStatus: str(first.docStatus) || 'not_started',
          vesselId,
          items: {
            create: its.map((it) => ({
              product: str(it.product),
              brand: str(it.brand),
              partDescription: str(it.partDescription),
              partExecution: str(it.partExecution),
              qtyRcv: str(it.qtyRcv ?? it.qty),
              unit: str(it.unit),
              remarks: str(it.remarks),
              itemDiscountPer: str(it.itemDiscountPer),
              priceUnit: str(it.priceUnit),
              canContainHazmat:
                str(it.canContainHazmat ?? it.canHazmat).toUpperCase() || 'NO',
            })),
          },
        },
      });
      poCreated += 1;
      itemCreated += its.length;
    }

    return res.status(201).json({
      success: true,
      message: 'Purchase orders imported',
      data: { poCreated, itemCreated },
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

/**
 * List purchase orders with their items. Optional filters:
 *   ?imo=<shipImo>  or  ?vesselId=<id>
 */
export async function getPurchaseOrders(req: Request, res: Response) {
  try {
    const { imo, vesselId } = req.query as { imo?: string; vesselId?: string };

    const where: Record<string, unknown> = {};
    if (imo) where.shipImo = imo;
    if (vesselId) where.vesselId = vesselId;

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return res
      .status(200)
      .json({ success: true, data: { purchaseOrders } });
  } catch (error) {
    if (error instanceof ApiException) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }
    throw error;
  }
}

/** Delete all purchase orders (optionally scoped to a ship IMO). */
export async function clearPurchaseOrders(req: Request, res: Response) {
  try {
    const { imo } = req.query as { imo?: string };
    const result = await prisma.purchaseOrder.deleteMany({
      where: imo ? { shipImo: imo } : {},
    });
    return res
      .status(200)
      .json({ success: true, data: { deleted: result.count } });
  } catch (error) {
    if (error instanceof ApiException) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }
    throw error;
  }
}

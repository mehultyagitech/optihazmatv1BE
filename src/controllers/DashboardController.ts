import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllDashboardData(req: Request, res: Response) {
    try {
      const { clientId, managerId, vesselId } = req.query as Record<string, string | undefined>;
      const filtered = !!(clientId || managerId || vesselId);

      // Filters from the dashboard's Client / Fleet Manager / Vessel selects.
      const vesselWhere: Prisma.VesselWhereInput = {
        ...(clientId && { clientName: Number(clientId) }),
        ...(managerId && { vesselManager: Number(managerId) }),
        ...(vesselId && { id: vesselId }),
      };

      const vessels = await prisma.vessel.findMany({
        where: vesselWhere,
        orderBy: { vesselName: 'asc' },
        select: {
          id: true,
          vesselName: true,
          imoNumber: true,
          vesselType: true,
          ihmClass: true,
          discontinued: true,
          readyForMaintenance: true,
          Client: { select: { companyName: true } },
          Manager: { select: { companyName: true } },
          _count: { select: { LocationDiagram: true, IHMReports: true } },
        },
      });

      // Uploaded POs are linked to a vessel by id or only by ship IMO.
      const poWhere: Prisma.PurchaseOrderWhereInput = filtered
        ? {
            OR: [
              { vesselId: { in: vessels.map((v) => v.id) } },
              { shipImo: { in: vessels.map((v) => String(v.imoNumber)).filter(Boolean) } },
            ],
          }
        : {};
      const pinWhere: Prisma.PinsWhereInput = { locationDiagram: { vessel: vesselWhere } };

      const [pins, pinHazmats, purchaseOrders, reports, allVessels, totalClients, totalManagers] =
        await Promise.all([
          prisma.pins.findMany({
            where: pinWhere,
            select: {
              isRemovedFromIHM: true,
              isReplaced: true,
              installationDate: true,
              isPCHM: true,
              inventory: { select: { name: true } },
              locationDiagram: { select: { vesselId: true } },
            },
          }),
          prisma.pinHazmat.findMany({
            where: { pin: { ...pinWhere, isRemovedFromIHM: false, isReplaced: false } },
            select: { hazmat: { select: { name: true } } },
          }),
          prisma.purchaseOrder.findMany({
            where: poWhere,
            select: { docStatus: true, items: { select: { canContainHazmat: true } } },
          }),
          prisma.iHMReport.findMany({
            where: { vessel: vesselWhere, disabled: false },
            select: { approved: true, createdAt: true },
          }),
          prisma.vessel.findMany({
            select: { id: true, vesselName: true },
            orderBy: { vesselName: 'asc' },
          }),
          prisma.clientManager.count({ where: { isClient: true } }),
          prisma.clientManager.count({ where: { isClient: false } }),
        ]);

      const isOnBoard = (p: { isRemovedFromIHM: boolean; isReplaced: boolean }) =>
        !p.isRemovedFromIHM && !p.isReplaced;
      const onBoard = pins.filter(isOnBoard);
      const inClass = (name: string) => onBoard.filter((p) => p.inventory?.name === name).length;
      const isYes = (value: string | null) => String(value ?? '').toUpperCase() === 'YES';

      const hazmatCounts = new Map<string, number>();
      pinHazmats.forEach(({ hazmat }) => {
        if (hazmat?.name) hazmatCounts.set(hazmat.name, (hazmatCounts.get(hazmat.name) ?? 0) + 1);
      });

      const perVessel = new Map<string, { points: number; onBoard: number; removedReplaced: number }>();
      pins.forEach((p) => {
        const counts = perVessel.get(p.locationDiagram.vesselId) ?? { points: 0, onBoard: 0, removedReplaced: 0 };
        counts.points += 1;
        if (isOnBoard(p)) counts.onBoard += 1;
        else counts.removedReplaced += 1;
        perVessel.set(p.locationDiagram.vesselId, counts);
      });

      const poItems = purchaseOrders.flatMap((po) => po.items);
      const pendingDoc = (status: string | null) => !status || status === 'not_started';
      const latestReport = reports.reduce<Date | null>(
        (latest, r) => (!latest || r.createdAt > latest ? r.createdAt : latest),
        null,
      );

      res.status(200).json({
        success: true,
        overview: {
          totalVessels: vessels.length,
          totalClients,
          totalManagers,
          i1InventoryPts: inClass('i1'),
          i2InventoryPts: inClass('i2'),
          i3InventoryPts: inClass('i3'),
          vessels: {
            total: vessels.length,
            active: vessels.filter((v) => !v.discontinued).length,
            discontinued: vessels.filter((v) => v.discontinued).length,
            readyForMaintenance: vessels.filter((v) => !v.discontinued && v.readyForMaintenance).length,
          },
          inventory: {
            total: pins.length,
            onBoard: onBoard.length,
            i1: inClass('i1'),
            i2: inClass('i2'),
            i3: inClass('i3'),
            // IHM audit (initial survey) points have no installation date;
            // points added later during maintenance have one.
            survey: pins.filter((p) => !p.installationDate).length,
            newInstalled: pins.filter((p) => !!p.installationDate).length,
            removed: pins.filter((p) => p.isRemovedFromIHM).length,
            replaced: pins.filter((p) => p.isReplaced).length,
            pchm: pins.filter((p) => p.isPCHM).length,
          },
          locationDiagrams: vessels.reduce((sum, v) => sum + v._count.LocationDiagram, 0),
          purchaseOrders: {
            total: purchaseOrders.length,
            withHazmat: purchaseOrders.filter((po) => po.items.some((i) => isYes(i.canContainHazmat))).length,
            docReceived: purchaseOrders.filter((po) => !pendingDoc(po.docStatus)).length,
            docPending: purchaseOrders.filter((po) => pendingDoc(po.docStatus)).length,
            items: poItems.length,
            hazmatItems: poItems.filter((i) => isYes(i.canContainHazmat)).length,
          },
          ihmReports: {
            total: reports.length,
            approved: reports.filter((r) => r.approved).length,
            pending: reports.filter((r) => !r.approved).length,
            latest: latestReport,
          },
          topHazmats: [...hazmatCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({ name, count })),
          vesselList: vessels.map((v) => ({
            id: v.id,
            vesselName: v.vesselName,
            imoNumber: v.imoNumber,
            vesselType: v.vesselType,
            ihmClass: v.ihmClass,
            client: v.Client?.companyName ?? null,
            manager: v.Manager?.companyName ?? null,
            status: v.discontinued
              ? 'Discontinued'
              : v.readyForMaintenance
                ? 'Ready for Maintenance'
                : 'Active',
            locationDiagrams: v._count.LocationDiagram,
            ihmReports: v._count.IHMReports,
            ...(perVessel.get(v.id) ?? { points: 0, onBoard: 0, removedReplaced: 0 }),
          })),
          filterOptions: {
            vessels: allVessels.map((v) => ({ id: v.id, name: v.vesselName })),
          },
        },
        message: 'Fleet and Inventory overview fetched successfully',
      });
    } catch (error) {
      if (error instanceof ApiException) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          data: error.data,
        });
      }
      // Rethrowing here would crash the API (unhandled rejection).
      console.error('Failed to load the fleet dashboard:', error);
      return res.status(500).json({
        success: false,
        message: 'Could not load the dashboard',
      });
    }
  }

  export async function getAllVesselDashboardData(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      if (!vesselId) {
        return res.status(400).json({
          success: false,
          message: 'vesselId is required',
        });
      }

      const vesselExists = await prisma.vessel.count({
        where: { id: vesselId as string },
      });

      if (!vesselExists) {
        return res.status(404).json({
          success: false,
          message: 'Vessel not found',
        });
      }

      // IHM Part 1 = Initial IHM Part 1 + Installed Items - Replaced Items -
      // Removed Items, so the class counts leave out replaced/removed points.
      const onVessel = { locationDiagram: { vesselId: vesselId as string } };
      const onBoardInClass = (name: string) =>
        prisma.pins.count({
          where: {
            ...onVessel,
            isRemovedFromIHM: false,
            isReplaced: false,
            inventory: { name },
          },
        });

      const [i1InventoryPts, i2InventoryPts, i3InventoryPts, replacedItems, removedItems] =
        await Promise.all([
          onBoardInClass('i1'),
          onBoardInClass('i2'),
          onBoardInClass('i3'),
          prisma.pins.count({ where: { ...onVessel, isReplaced: true } }),
          prisma.pins.count({ where: { ...onVessel, isRemovedFromIHM: true } }),
        ]);

      res.status(200).json({
        success: true,
        overview: {
          totalVessels: 1,
          i1InventoryPts,
          i2InventoryPts,
          i3InventoryPts,
          replacedItems,
          removedItems,
        },
        message: 'Vessel inventory summary fetched successfully',
      });
    } catch (error) {
      if (error instanceof ApiException) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          data: error.data,
        });
      }
      // Rethrowing here would crash the API (unhandled rejection).
      console.error('Failed to load vessel dashboard:', error);
      return res.status(500).json({
        success: false,
        message: 'Could not load the vessel dashboard',
      });
    }
  }

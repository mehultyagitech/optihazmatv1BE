import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllDashboardData(req: Request, res: Response) {
    try {
      const { vesselFilter, clientFilter } = req.query;
  
      // Optional filters
      const vesselWhere: any = {};
      if (vesselFilter) {
        vesselWhere.name = { contains: vesselFilter as string };
      }
  
      const clientWhere: any = {};
      if (clientFilter) {
        clientWhere.name = { contains: clientFilter as string };
      }
  
      const [totalVessels, totalManagers, totalFleetOwners] = await Promise.all([
        prisma.vessel.count({ where: vesselWhere }),
        prisma.clientManager.count({ where: { isClient: true, ...clientWhere } }),
        prisma.clientManager.count({ where: { isClient: false, ...clientWhere } }),
      ]);
  
      // Count inventory points by type
      const i1InventoryPts = await prisma.pins.count({
        where: {
          inventory: { name: 'i1' },
        },
      });
  
      const i2InventoryPts = await prisma.pins.count({
        where: {
          inventory: { name: 'i2' },
        },
      });
  
      const i3InventoryPts = await prisma.pins.count({
        where: {
          inventory: { name: 'i3' },
        },
      });
  
      // Final response
      res.status(200).json({
        success: true,
        overview: {
          totalVessels,
          totalManagers,
          totalFleetOwners,
          i1InventoryPts,
          i2InventoryPts,
          i3InventoryPts,
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
      throw error;
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
  
      const [i1InventoryPts, i2InventoryPts, i3InventoryPts] = await Promise.all([
        prisma.pins.count({
          where: {
            locationDiagram: {
              vesselId: vesselId as string,
            },
            inventory: {
              name: 'i1',
            },
          },
        }),
        prisma.pins.count({
          where: {
            locationDiagram: {
              vesselId: vesselId as string,
            },
            inventory: {
              name: 'i2',
            },
          },
        }),
        prisma.pins.count({
          where: {
            locationDiagram: {
              vesselId: vesselId as string,
            },
            inventory: {
              name: 'i3',
            },
          },
        }),
      ]);
  
      res.status(200).json({
        success: true,
        overview: {
          totalVessels: 1,
          i1InventoryPts,
          i2InventoryPts,
          i3InventoryPts,
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
      throw error;
    }
  }
  
  
  
  
  
  
  
  
  
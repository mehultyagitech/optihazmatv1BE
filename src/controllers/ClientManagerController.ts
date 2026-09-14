import { Request, Response } from 'express';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';
import { Prisma } from '@prisma/client';

/**
 * Answer a failed request instead of rethrowing: a rethrow from an async
 * handler is an unhandled rejection that takes the whole API down.
 */
const handleClientManagerError = (res: Response, error: unknown) => {
  if (error instanceof ApiException) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error('Client/Manager request failed:', error);
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(422).json({
      success: false,
      message: 'Some details are missing or in the wrong format.',
    });
  }
  return res.status(500).json({ success: false, message: 'An unexpected error occurred' });
};

/**
 * Get all Client/Managers
 */
export async function getClientManagers(req: Request, res: Response) {
  try {
    const clientManagers = await prisma.clientManager.findMany({
      include: { _count: { select: { ClientVessels: true, ManagedVessels: true } } },
      orderBy: { companyName: 'asc' },
    });

    // How many vessels each company is linked to, as client or as manager.
    const data = clientManagers.map(({ _count, ...company }) => ({
      ...company,
      vesselCount: _count.ClientVessels + _count.ManagedVessels,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleClientManagerError(res, error);
  }
}

/**
 * Get a single Client/Manager by ID
 */
export async function getClientManager(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const clientManager = await prisma.clientManager.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!clientManager) {
      throw new ApiException('Client/Manager not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: clientManager,
    });
  } catch (error) {
    return handleClientManagerError(res, error);
  }
}

/**
 * Create a new Client/Manager
 */
export async function createClientManager(req: Request, res: Response) {
  try {
    const { companyName, address, contactDetails, verifaviaId, isClient } = req.body;

    if (!String(companyName ?? '').trim() || !String(verifaviaId ?? '').trim()) {
      throw new ApiException('Company Name and OptiHazmat ID are required', 422);
    }

    const newClientManager = await prisma.clientManager.create({
      data: {
        companyName,
        address,
        contactDetails,
        verifaviaId,
        isClient,
      },
    });

    return res.status(201).json({
      success: true,
      data: newClientManager,
    });
  } catch (error) {
    return handleClientManagerError(res, error);
  }
}

/**
 * Update an existing Client/Manager
 */
export async function updateClientManager(req: Request, res: Response) {
  try {
    const { id,companyName, address, contactDetails, verifaviaId, isClient } = req.body;

    if (!String(companyName ?? '').trim() || !String(verifaviaId ?? '').trim()) {
      throw new ApiException('Company Name and OptiHazmat ID are required', 422);
    }

    const existingClientManager = await prisma.clientManager.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!existingClientManager) {
      throw new ApiException('Client/Manager not found', 404);
    }

    const updatedClientManager = await prisma.clientManager.update({
      where: {
        id: parseInt(id),
      },
      data: {
        companyName,
        address,
        contactDetails,
        verifaviaId,
        isClient,
      },
    });

    return res.status(200).json({
      success: true,
      data: updatedClientManager,
    });
  } catch (error) {
    return handleClientManagerError(res, error);
  }
}

/**
 * Get all sub-locations
 */
export async function getSubLocation(req: Request, res: Response) {
  try {
    const clientManagers = await prisma.subLocation.findMany();

    return res.status(200).json({
      success: true,
      data: clientManagers,
    });
  } catch (error) {
    return handleClientManagerError(res, error);
  }
}

/**
 * Delete (or soft-delete) an existing Client/Manager
 */
export async function deleteClientManager(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const clientId = parseInt(id);
    if (isNaN(clientId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const existingClientManager = await prisma.clientManager.findUnique({
      where: { id: clientId },
    });

    if (!existingClientManager) {
      return res.status(404).json({
        success: false,
        message: "Client/Manager not found",
      });
    }

    // Vessels cascade-delete with their client/manager, so deleting a company
    // that still has vessels would silently remove those vessels with their
    // diagrams, inventory points and reports. Only unused companies go.
    const linkedVessels = await prisma.vessel.count({
      where: { OR: [{ clientName: clientId }, { vesselManager: clientId }] },
    });
    if (linkedVessels > 0) {
      return res.status(409).json({
        success: false,
        message: `${existingClientManager.companyName} is linked to ${linkedVessels} vessel${linkedVessels === 1 ? '' : 's'}. Assign ${linkedVessels === 1 ? 'it' : 'them'} to another client/manager before deleting.`,
      });
    }

    // Hard delete (remove from DB)
    await prisma.clientManager.delete({
      where: { id: clientId },
    });

    // If you want to soft delete instead, use:
    // await prisma.clientManager.update({
    //   where: { id: clientId },
    //   data: { isDeleted: true } // assuming your schema has `isDeleted`
    // });

    return res.status(200).json({
      success: true,
      message: "Client/Manager deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Client/Manager:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
    });
  }
}


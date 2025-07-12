import { Request, Response } from 'express';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';

/**
 * Get all Client/Managers
 */
export async function getClientManagers(req: Request, res: Response) {
  try {
    const clientManagers = await prisma.clientManager.findMany();

    return res.status(200).json({
      success: true,
      data: clientManagers,
    });
  }  catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
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
  }  catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * Create a new Client/Manager
 */
export async function createClientManager(req: Request, res: Response) {
  try {
    const { companyName, address, contactDetails, verifaviaId, isClient } = req.body;

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
  }  catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * Update an existing Client/Manager
 */
export async function updateClientManager(req: Request, res: Response) {
  try {
    const { id,companyName, address, contactDetails, verifaviaId, isClient } = req.body;

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
  }  catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
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
  }  catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
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


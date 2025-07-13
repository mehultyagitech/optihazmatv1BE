import { Request, Response } from 'express';
import prisma from '../database/Prisma';

export default async function getGenericData(req: Request, res: Response) {
  try {
    const Compartments = await prisma.compartment.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    const DocumentTypes = await prisma.documentType.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    const Equipments = await prisma.equipment.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    const Locations = await prisma.location.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    const SubLocations = await prisma.subLocation.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    const Objects = await prisma.objects.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    const Inventory = await prisma.inventory.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    const Clients = await prisma.clientManager.findMany({
      where: {
        isClient: true,
      }
    });

    const Managers = await prisma.clientManager.findMany({
      where: {
        isClient: false,
      }
    });

    const Hazmats = await prisma.hazmat.findMany({
      where: {
        isDisabled: false,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Data retrieved successfully',
      data: {
        Compartments,
        DocumentTypes,
        Equipments,
        Locations,
        SubLocations,
        Objects,
        Inventory,
        Clients,
        Managers,
        Hazmats,
      },
    });
  } catch (error) {
    throw error;
  }
}

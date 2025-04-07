import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllSubLocations(req: Request, res: Response) {
  try {
    const { search } = req.query;
    const pagination = res.locals.pagination;
    const { page, limit, offset } = pagination;

    let where = {};
    if (!!search) {
      where = {
        OR: [
          { name: { contains: search as string } },
        ],
      };
    }

    const result = await prisma.subLocation.paginate({
      page: Number(page),
      limit: Number(limit),
      offset,
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isDisabled: true,
        locationId: true,
        Location: {
          select: {
            id: true,
            name: true
          }
        }
      },
    });

    res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        total: result.meta.total.items,
        page: result.meta.page,
        limit: result.meta.limit,
        pageCount: result.meta.total.pages,
      },
      message: 'Sub locations fetched successfully',
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

export async function createSubLocation(req: Request, res: Response) {
  try {
    const { name, isDisabled } = req.body;
    const location = await prisma.subLocation.create({
      data: {
        name,
        isDisabled,
      },
    });
    res.status(201).json({
      success: true,
      message: 'Sub location created successfully',
      data: location,
    });
  } catch (error) {
    throw error;
  }
}

export async function updateSubLocation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, isDisabled } = req.body;
    const location = await prisma.subLocation.update({
      where: { id },
      data: {
        name,
        isDisabled,
      },
    });
    res.status(200).json({
      success: true,
      message: 'Sub location updated successfully',
      data: location,
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteSubLocation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.subLocation.delete({
      where: { id },
    });
    res.status(204).send({
      success: true,
      message: 'Sub location deleted successfully',
    });
  } catch (error) {
    throw error;
  }
}
import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllLocations(req: Request, res: Response) {
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

    const result = await prisma.location.paginate({
      page: Number(page),
      limit: Number(limit),
      offset,
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isDisabled: true,
      },
    });

    res.json({
      success: true,
      data: result.data,
      meta: {
        total: result.meta.total.items,
        page: result.meta.page,
        limit: result.meta.limit,
        pageCount: result.meta.total.pages,
      },
      message: 'Locations fetched successfully',
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

export async function createLocation(req: Request, res: Response) {
  try {
    const { name, isDisabled } = req.body;
    const location = await prisma.location.create({
      data: {
        name,
        isDisabled,
      },
    });
    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: location,
    });
  } catch (error) {
    throw error;
  }
}

export async function updateLocation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, isDisabled } = req.body;
    const location = await prisma.location.update({
      where: { id },
      data: {
        name,
        isDisabled,
      },
    });
    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: location,
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteLocation(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.location.delete({
      where: { id },
    });
    res.status(204).send({
      success: true,
      message: 'Location deleted successfully',
    });
  } catch (error) {
    throw error;
  }
}
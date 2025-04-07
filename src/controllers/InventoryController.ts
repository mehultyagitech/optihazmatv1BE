import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllInventory(req: Request, res: Response) {
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

    const result = await prisma.inventory.paginate({
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

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        total: result.meta.total.items,
        page: result.meta.page,
        limit: result.meta.limit,
        pageCount: result.meta.total.pages,
      },
      message: 'Inventory fetched successfully',
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

export async function createInventory(req: Request, res: Response) {
  try {
    const { name, isDisabled } = req.body;
    const inventory = await prisma.inventory.create({
      data: {
        name,
        isDisabled,
      },
    });
    return res.status(201).json({
      success: true,
      message: 'Inventory created successfully',
      data: inventory,
    });
  } catch (error) {
    throw error;
  }
}

export async function updateInventory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, isDisabled } = req.body;
    const inventory = await prisma.inventory.update({
      where: {
        id: id,
      },
      data: {
        name,
        isDisabled,
      },
    });
    return res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      data: inventory,
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteInventory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.inventory.delete({
      where: {
        id: id,
      },
    });
    return res.status(200).json({
      success: true,
      message: 'Inventory deleted successfully',
    });
  } catch (error) {
    throw error;
  }
}
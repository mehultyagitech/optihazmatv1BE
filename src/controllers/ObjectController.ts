import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export default async function getAllObjects(req: Request, res: Response) {
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

    const result = await prisma.objects.paginate({
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
      message: 'Objects fetched successfully',
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

export async function createObject(req: Request, res: Response) {
  const { name, isDisabled } = req.body;
  try {
    const newObject = await prisma.objects.create({
      data: {
        name,
        isDisabled,
      },
    });
    return res.status(201).json({
      success: true,
      message: 'Object created successfully',
      data: newObject,
    });
  } catch (error) {
    throw error;
  }
}

export async function updateObject(req: Request, res: Response) {
  const { id } = req.params;
  const { name, isDisabled } = req.body;
  try {
    const updatedObject = await prisma.objects.update({
      where: { id },
      data: {
        name,
        isDisabled,
      },
    });
    return res.status(200).json({
      success: true,
      message: 'Object updated successfully',
      data: updatedObject,
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteObject(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await prisma.objects.delete({
      where: { id },
    });
    return res.status(204).json({
      success: true,
      message: 'Object deleted successfully',
    });
  } catch (error) {
    throw error;
  }
}

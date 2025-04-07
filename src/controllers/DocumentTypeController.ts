import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllDocumentTypes(req: Request, res: Response) {
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

    const result = await prisma.documentType.paginate({
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
      message: 'Document types fetched successfully',
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

export async function createDocumentType(req: Request, res: Response) {
  try {
    const { name } = req.body;
    const documentType = await prisma.documentType.create({
      data: {
        name,
      },
    });
    res.status(201).json({
      success: true,
      data: documentType,
      message: 'Document type created successfully',
    });
  } catch (error) {
    throw error;
  }
}

export async function updateDocumentType(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, isDisabled } = req.body;
    const documentType = await prisma.documentType.update({
      where: { id },
      data: {
        name,
        isDisabled,
      },
    });
    res.json({
      success: true,
      data: documentType,
      message: 'Document type updated successfully',
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteDocumentType(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.documentType.delete({
      where: { id },
    });
    res.status(204).send({
      success: true,
      message: 'Document type deleted successfully',
    });
  } catch (error) {
    throw error;
  }
}

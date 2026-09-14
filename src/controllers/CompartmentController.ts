import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';
import handleMasterDataError from '../utils/masterDataError';

export async function getAllCompartments(req: Request, res: Response) {
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

    const result = await prisma.compartment.paginate({
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

    res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        total: result.meta.total.items,
        page: result.meta.page,
        limit: result.meta.limit,
        pageCount: result.meta.total.pages,
      },
      message: 'Compartments fetched successfully',
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

export async function createCompartment(req: Request, res: Response) {
  const { name, isDisabled } = req.body;
  try {
    const compartment = await prisma.compartment.create({
      data: {
        name,
        isDisabled,
      },
    });
    res.status(201).json({
      success: true,
      message: 'Compartment created successfully',
      data: compartment,
    });
  } catch (error) {
    // Answer instead of rethrowing: a rethrow from an async handler is an
    // unhandled rejection that takes the whole API down. The name is unique,
    // so adding one that already exists (even disabled) lands here.
    if ((error as { code?: string })?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A Compartment with this name already exists (it may be disabled in master data)',
      });
    }
    console.error('Failed to create compartment:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not create the compartment',
    });
  }
}

export async function updateCompartment(req: Request, res: Response) {
  const { id } = req.params;
  const { name, isDisabled } = req.body;
  try {
    const compartment = await prisma.compartment.update({
      where: {
        id: id,
      },
      data: {
        name,
        isDisabled,
      },
    });
    res.status(200).json({
      success: true,
      message: 'Compartment updated successfully',
      data: compartment,
    });
  } catch (error) {
    return handleMasterDataError(res, error, 'compartment');
  }
}

export async function deleteCompartment(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const compartment = await prisma.compartment.delete({
      where: {
        id: id,
      },
    });
    res.status(204).json({
      success: true,
      message: 'Compartment deleted successfully',
      data: compartment,
    });
  } catch (error) {
    throw error;
  }
}
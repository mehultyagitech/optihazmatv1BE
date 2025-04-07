import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllEquipments(req: Request, res: Response) {
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

        const result = await prisma.equipment.paginate({
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
            message: 'Equipments fetched successfully',
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

export async function createEquipment(req: Request, res: Response) {
    try {
        const { name, isDisabled } = req.body;
        const equipment = await prisma.equipment.create({
            data: {
                name,
                isDisabled,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Equipment created successfully',
            data: equipment,
        });
    } catch (error) {
        throw error;
    }
}

export async function updateEquipment(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, isDisabled } = req.body;
        const equipment = await prisma.equipment.update({
            where: { id },
            data: {
                name,
                isDisabled,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Equipment updated successfully',
            data: equipment,
        });
    } catch (error) {
        throw error;
    }
}

export async function deleteEquipment(req: Request, res: Response) {
    try {
        const { id } = req.params;
        await prisma.equipment.delete({
            where: { id },
        });
        res.status(200).json({
            success: true,
            message: 'Equipment deleted successfully',
        });
    } catch (error) {
        throw error;
    }
}
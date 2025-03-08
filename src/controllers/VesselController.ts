import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import {
  vesselDataValidation,
  vesselUpdateValidation
} from '../validations/VesselValidation';
import ApiException from '../errors/ApiException';
import { validateAsync } from '../services/ValidationService';

export const getAllVessels = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = req.body.pagination;

    let where = {};
    if (!!search) {
      where = {
        OR: [
          { vesselName: { contains: search as string } },
          { imoNumber: { contains: search as string } },
          { classSociety: { contains: search as string } },
          { clientName: { contains: search as string } },
        ],
      };
    }

    const result = await prisma.vessel.withCount({
      where,
      skip: offset,
      take: Number(limit),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true, 
      data: result.data, 
      meta: {
        total: result.count,
        page: Number(page),
        limit: Number(limit),
        pageCount: Math.ceil(result.count / Number(limit))
      } 
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
};

export const getVesselById = async (req: Request, res: Response) => {
  try {
    const vessel = await prisma.vessel.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      }
    });
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' });
    res.json({ success: true, data: vessel });
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
};

export const createVessel = async (req: Request, res: Response) => {
  try {
    const { user, token, ...vesselData } = req.body;
    
    if (vesselData.ihmSurveyEndDateIsSame) {
      vesselData.ihmSurveyEndDate = vesselData.ihmSurveyStartDate;
      delete vesselData.ihmSurveyEndDateIsSame;
    }

    // Use validateAsync for schemas with external rules
    const { hasError: vesselDataError, errors: vesselDataErrors } = await validateAsync(
      vesselDataValidation,
      vesselData,
    );

    if (!!vesselDataError) {
        throw new ApiException('Validation error', 422, vesselDataErrors);
    }

    vesselData.createdBy = user.id;
    vesselData.clientId = user.clientId ?? null;

    // Create the vessel
    const vessel = await prisma.vessel.create({
      data: vesselData,
    });

    res.status(201).json(vessel);
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
};

export const updateVessel = async (req: Request, res: Response) => {
  try {
    const { user, token, ...vesselData } = req.body;

    if (vesselData.id !== req.params.id) {
      // If validation needed for update
      const joiObject = vesselUpdateValidation(req.params.id);

      const { hasError, errors } = await validateAsync(
        joiObject,
        vesselData
      );
      
      if (hasError) {
        throw new ApiException('Validation error', 422, errors);
      }
    }

    const vessel = await prisma.vessel.update({
      where: { id: req.params.id },
      data: vesselData,
    });

    res.json(vessel);
  } catch (error) {
    console.error('Error in updateVessel:', error);
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: error.data,
      });
    }
    throw error;
  }
};

export const deleteVessel = async (req: Request, res: Response) => {
  try {
    await prisma.vessel.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
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
};

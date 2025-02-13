import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import {
  vesselDataValidation,
  clientManagerValidation,
} from '../validations/VesselValidation';
import ApiException from '../errors/ApiException';
import validate from '../services/ValidationService';

export const getAllVessels = async (req: Request, res: Response) => {
  try {
    const vessels = await prisma.vessel.findMany();
    res.json(vessels);
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
    });
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' });
    res.json(vessel);
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
    const { vesselData, clientManager, user } = req.body;
    const { attachments, images } = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    vesselData.createdBy = user.id;
    vesselData.clientId = 1;

    const { hasError: vesselDataError, errors: vesselDataErrors } = validate(
      vesselDataValidation,
      vesselData,
    );

    if (!!vesselDataError) {
        throw new ApiException('Validation error', 422, {
            vesselData: vesselDataErrors
        });
    }

    const vessel = await prisma.vessel.create({
      data: {
        ...vesselData,
        VesselDetails: {
          create: vesselData,
        },
      },
    });

    if (attachments) {
      await prisma.vesselAttachments.createMany({
        data: attachments.map((file) => ({
          url: file.path,
          vesselId: vessel.id,
        })),
      });
    }

    if (images) {
      await prisma.vesselImages.createMany({
        data: images.map((file) => ({
          url: file.path,
          vesselId: vessel.id,
        })),
      });
    }

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
    const vessel = await prisma.vessel.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(vessel);
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

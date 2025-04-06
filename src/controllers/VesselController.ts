import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import {
  vesselDataValidation,
  vesselUpdateValidation,
} from '../validations/VesselValidation';
import ApiException from '../errors/ApiException';
import { validateAsync } from '../services/ValidationService';

export const getAllVessels = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const pagination = res.locals.pagination;
    const { page, limit, offset } = pagination;

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

    const result = await prisma.vessel.paginate({
      page: Number(page),
      limit: Number(limit),
      offset,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        imoNumber: true,
        clientName: true,
        clientManager: true,
        vesselType: true,
        vesselName: true,
        vesselManager: true,
        VesselImages: {
          select: {
            id: true,
            url: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
          },
        },
        VesselImages: true,
        VesselAttachments: true,
      },
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
    const { user } = res.locals;
    const vesselData = req.body;

    if (vesselData.ihmSurveyEndDateIsSame) {
      vesselData.ihmSurveyEndDate = vesselData.ihmSurveyStartDate;
      delete vesselData.ihmSurveyEndDateIsSame;
    }

    // Use validateAsync for schemas with external rules
    const { hasError: vesselDataError, errors: vesselDataErrors } =
      await validateAsync(vesselDataValidation, vesselData);

    if (!!vesselDataError) {
      throw new ApiException('Validation error', 422, vesselDataErrors);
    }

    vesselData.createdBy = user.id;
    vesselData.clientId = user.clientId ?? null;

    // Create the vessel
    const vessel = await prisma.vessel.create({
      data: vesselData,
    });

    if (!!req.files) {
      const { image, "attachments[]": attachments } = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!!image) {
        await prisma.vesselImages.create({
          data: {
            fileName: image[0].originalname,
            url: image[0].filename,
            vesselId: vessel.id,
          },
        });
      }

      if (!!attachments && attachments.length > 0) {
        for (const file of attachments) {
          await prisma.vesselAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              vesselId: vessel.id,
            },
          });
        }
      }
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
    const { data } = req.body;
    const vesselData = JSON.parse(data);

    if (vesselData.id !== req.params.id) {
      // If validation needed for update
      const joiObject = vesselUpdateValidation(req.params.id);

      const { hasError, errors } = await validateAsync(joiObject, vesselData);

      if (hasError) {
        throw new ApiException('Validation error', 422, errors);
      }
    }

    const vessel = await prisma.vessel.update({
      where: { id: req.params.id },
      data: vesselData,
    });

    if (!!req.files) {
      // @ts-expect-error
      const { image, "attachments[]": attachments } = req.files;
      
      if (!!image) {
        await prisma.vesselImages.deleteMany({
          where: {
            vesselId: vessel.id,
          }
        });

        await prisma.vesselImages.create({
          data: {
            fileName: image[0].originalname,
            url: image[0].filename,
            vesselId: vessel.id,
          },
        });
      }

      if (!!attachments && attachments.length > 0) {
        for (const file of attachments) {
          await prisma.vesselAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              vesselId: vessel.id,
            },
          });
        }
      }
    }

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

import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { basename } from 'path';
import prisma from '../database/Prisma';
import { convertPDFToImages } from '../utils/pdfToImage';
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
          },
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
        VesselAttachments: {
          include: {
            AttachmentImages: true,
          },
        },
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

    vesselData.grossTonnageMT = Number(vesselData.grossTonnageMT);
    vesselData.readyForMaintenance = !!vesselData.readyForMaintenance;

    if (vesselData.ihmSurveyEndDateIsSame) {
      vesselData.ihmSurveyEndDate = vesselData.ihmSurveyStartDate;
      delete vesselData.ihmSurveyEndDateIsSame;
    }

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
      const { image, 'attachments[]': attachments } = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

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
        const uniqueFolderName = crypto.randomBytes(16).toString('hex');
        for (const file of attachments) {
          const attachment = await prisma.vesselAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              vesselId: vessel.id,
            },
          });

          // Convert PDF to images if the file is a PDF
          if (file.mimetype === 'application/pdf') {
            const imagesPaths = await convertPDFToImages(file.path, uniqueFolderName);

            let counter = 1;
            for (const imagePath of imagesPaths) {
              await prisma.attachmentImages.create({
                data: {
                  fileName: file.originalname.split('.')[0] + `-page-${counter++}.png`,
                  url: imagePath,
                  attachmentId: attachment.id,
                },
              });
            }
          }
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
    const vesselData = typeof data === 'string' ? JSON.parse(data) : data;

    if (vesselData.id !== req.params.id) {
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
      const { image, 'attachments[]': attachments } = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      if (!!image) {
        await prisma.vesselImages.deleteMany({
          where: {
            vesselId: vessel.id,
          },
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
        const uniqueFolderName = crypto.randomBytes(16).toString('hex');
        for (const file of attachments) {
          const attachment = await prisma.vesselAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              vesselId: vessel.id,
            },
          });

          // Convert PDF to images if the file is a PDF
          if (file.mimetype === 'application/pdf') {
            const imagesPaths = await convertPDFToImages(file.path, uniqueFolderName);

            // Save each generated image
            let counter = 1; 
            for (const imagePath of imagesPaths) {
              await prisma.attachmentImages.create({
                data: {
                  fileName: file.originalname.split('.')[0] + `-page-${counter++}.`,
                  url: imagePath,
                  attachmentId: attachment.id,
                },
              });
            }
          }
        }
      }
    }

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

export const getAttachmentNamesByVesselId = async (req: Request, res: Response) => {
  try {
    const vesselId = req.params.id;
    const attachments = await prisma.vesselAttachments.findMany({
      where: { vesselId },
      select: {
        id: true,
        fileName: true,
      },
    });
    res.json(attachments);
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

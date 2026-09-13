import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../database/Prisma';
import { convertPDFToImages } from '../utils/pdfToImage';
import {
  vesselDataValidation,
  vesselUpdateValidation,
} from '../validations/VesselValidation';
import ApiException from '../errors/ApiException';
import { validateAsync } from '../services/ValidationService';

/**
 * Answer a failed write instead of letting the rejection escape the async
 * handler. Express 4 does not catch those, so a rethrow here becomes an
 * unhandled rejection and Node kills the whole API process.
 *
 * Prisma rejects the query when a column the schema marks as required is
 * missing or has the wrong type, which is a client mistake, not a server
 * fault -- report it as 422 so the UI can show something useful.
 */
// Form labels for Vessel columns, so a database-level "missing" error can
// name the field the way the form does.
const VESSEL_FIELD_LABELS: Record<string, string> = {
  vesselName: 'Vessel Name',
  imoNumber: 'IMO Number',
  callSign: 'Call Sign/Distinctive Number',
  vesselType: 'Vessel Type',
  flag: 'Flag',
  classSociety: 'Class Society',
  portOfRegistry: 'Port of Registry',
  grossTonnageMT: 'Gross Tonnage MT',
  lbd: 'L*B*D',
  registeredOwner: 'Registered Owner',
  registeredOwnerAddress: 'Registered Owner Address',
  vesselManager: 'Vessel Manager',
  clientName: 'Client Name',
  deliveryDate: 'Delivery Date',
  keelLaidDate: 'Keel Laid Date',
  shipYardName: 'Ship Yard Name',
  shipYardAddress: 'Ship Yard Address',
  ihmClass: 'IHM Class',
  ihmSurveyStartDate: 'IHM Survey Start Date',
  ihmSurveyEndDate: 'IHM Survey End Date',
  readyForMaintenanceDate: 'Ready For Maintenance Date',
  maintenanceStartDate: 'Maintenance Start Date',
};

const handleVesselWriteError = (
  res: Response,
  error: unknown,
  action: string,
) => {
  if (error instanceof ApiException) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: error.data,
    });
  }

  console.error(`Failed to ${action} vessel:`, error);

  if (error instanceof Prisma.PrismaClientValidationError) {
    // Name the column Prisma found missing ("Argument `shipYardAddress` is
    // missing."). The generic message below sent users hunting through a
    // form they believed was complete.
    const missing = /Argument `(\w+)` is missing/.exec(error.message)?.[1];
    if (missing) {
      const label = VESSEL_FIELD_LABELS[missing] ?? missing;
      return res.status(422).json({
        success: false,
        message: 'Validation error',
        data: { [missing]: `${label} is required` },
      });
    }
    return res.status(422).json({
      success: false,
      message: `Could not ${action} the vessel. Please check that every required field is filled in.`,
    });
  }

  return res.status(500).json({
    success: false,
    message: `Something went wrong while trying to ${action} the vessel.`,
  });
};

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
          {
            Manager: {
              companyName: {
                contains: search as string,
              },
            },
          },
          {
            Client: {
              companyName: {
                contains: search as string,
              },
            },
          },
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
        Client: true,
        Manager: true,
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
        updatedByUser: {
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
        VesselHistory: true,
        VesselInventoryImage: true,
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
    const { data: vesselDataStr } = req.body;
    const {
      attachments: dAtt,
      discontinueRemarks,
      ...vesselData
    } = JSON.parse(vesselDataStr);

    // Remarks are pulled out before Joi runs, so enforce the rule here:
    // mandatory only when the vessel is being saved as discontinued.
    if (vesselData.discontinued && !String(discontinueRemarks ?? '').trim()) {
      throw new ApiException('Validation error', 422, {
        discontinueRemarks:
          'Discontinue Remarks is required when the vessel is discontinued',
      });
    }

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
    vesselData.updatedBy = user.id;

    // Create the vessel
    const vessel = await prisma.vessel.create({
      data: vesselData,
    });

    // Back-link any purchase orders uploaded before this vessel existed.
    if (vessel.imoNumber) {
      await prisma.purchaseOrder.updateMany({
        where: { shipImo: vessel.imoNumber, vesselId: null },
        data: { vesselId: vessel.id },
      });
    }

    if (!!req.files) {
      const {
        image,
        'attachments[]': attachments,
        commonInventoryImage,
      } = req.files as {
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

      if (!!commonInventoryImage) {
        await prisma.vesselInventoryImage.create({
          data: {
            fileName: commonInventoryImage[0].originalname,
            url: commonInventoryImage[0].filename,
            vesselId: vessel.id,
          },
        });
      }

      if (!!attachments && attachments.length > 0) {
        let counter = 0;
        const uniqueFolderName = crypto.randomBytes(16).toString('hex');
        // dAtt lists every attachment in the form, already-uploaded ones
        // included, so only the not-yet-uploaded entries line up (in order)
        // with the files. Indexing dAtt directly gave a new file the Document
        // Type of an existing attachment.
        const newAttachmentMeta = (dAtt ?? []).filter(
          (a: { status?: string }) => a.status !== 'Uploaded',
        );
        for (const file of attachments) {
          const { docType, useInReport } = newAttachmentMeta[counter++] ?? {};
          if (!docType) {
            throw new ApiException(
              'Document type is required for each attachment',
              422,
            );
          }
          const attachment = await prisma.vesselAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              vesselId: vessel.id,
              documentTypeId: docType,
              useInReport: !!useInReport,
            },
          });

          console.log('Attachment created:', attachment, 'file:', file);

          // Convert PDF to images if the file is a PDF
          if (file.mimetype === 'application/pdf') {
            const imagesPaths = await convertPDFToImages(
              file.path,
              uniqueFolderName,
            );

            console.log('Generated images paths:', imagesPaths);

            let counter = 1;
            for (const imagePath of imagesPaths) {
              const ai = await prisma.attachmentImages.create({
                data: {
                  fileName:
                    file.originalname.split('.')[0] + `-page-${counter++}.png`,
                  url: imagePath,
                  attachmentId: attachment.id,
                },
              });

              console.log('Attachment image created:', ai);
            }
          }
        }
      }
    }

    if (!!discontinueRemarks) {
      await prisma.vesselHistory.create({
        data: {
          vesselId: vessel.id,
          clientName: vessel.clientName,
          activeDate: !vesselData.discontinued ? new Date() : null,
          activeRemarks: !vesselData.discontinued
            ? (discontinueRemarks ?? 'New Vessel Created')
            : '',
          discontinuedDate: vesselData.discontinued ? new Date() : null,
          discontinuedRemarks: vesselData.discontinued
            ? discontinueRemarks
            : '',
          entryDate: new Date(),
        },
      });
    }

    res.status(201).json(vessel);
  } catch (error) {
    return handleVesselWriteError(res, error, 'create');
  }
};

export const makeCommonInventoryImage = async (req: Request, res: Response) => {
  try {
    const { vesselId } = req.params;

    const { isMain } = req.body;

    const { commonInventoryImage } = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    if (!!commonInventoryImage && commonInventoryImage.length > 0) {
      await prisma.vesselInventoryImage.deleteMany({
        where: { vesselId },
      });

      await prisma.vesselInventoryImage.create({
        data: {
          fileName: commonInventoryImage[0].originalname,
          url: commonInventoryImage[0].filename,
          vesselId,
        },
      });
    }

    await prisma.vesselInventoryImage.updateMany({
      where: { vesselId },
      data: { isMain: !!isMain },
    });

    return res.json({
      success: true,
      message: 'Common inventory image updated successfully',
    });
  } catch (error) {
    throw new ApiException('Error updating common inventory image', 500, error);
  }
};

export const updateVessel = async (req: Request, res: Response) => {
  try {
    const { data: vesselDataStr } = req.body;
    const {
      attachments: dAtt,
      deletedAttachments,
      discontinueRemarks,
      clientName: clientId,
      vesselManager: vesselManagerId,
      ...vesselData
    } = JSON.parse(vesselDataStr);

    // Status before this save, so history records changes rather than
    // every save that happens to carry remarks.
    const previous = await prisma.vessel.findUnique({
      where: { id: req.params.id },
      select: { discontinued: true },
    });
    const wasDiscontinued = !!previous?.discontinued;

    // Remarks are pulled out before Joi runs. They are mandatory only when
    // the vessel is being discontinued now, not on every later edit of an
    // already-discontinued vessel.
    if (
      vesselData.discontinued &&
      !wasDiscontinued &&
      !String(discontinueRemarks ?? '').trim()
    ) {
      throw new ApiException('Validation error', 422, {
        discontinueRemarks:
          'Discontinue Remarks is required when the vessel is discontinued',
      });
    }

    vesselData.grossTonnageMT = Number(vesselData.grossTonnageMT);
    vesselData.readyForMaintenance = !!vesselData.readyForMaintenance;

    if (vesselData.ihmSurveyEndDateIsSame) {
      vesselData.ihmSurveyEndDate = vesselData.ihmSurveyStartDate;
      delete vesselData.ihmSurveyEndDateIsSame;
    }

    const joiObject = vesselUpdateValidation(req.params.id);
    const { hasError, errors } = await validateAsync(joiObject, vesselData);
    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    // Update the vessel
    const vessel = await prisma.vessel.update({
      where: { id: req.params.id },
      data: {
        ...vesselData,
        Client: { connect: { id: clientId } },
        Manager: { connect: { id: vesselManagerId } },
        // Who saved it: set server-side, never taken from the payload. A
        // relation connect rather than the raw updatedBy column, because this
        // update already connects Client/Manager and Prisma rejects mixing
        // the two input styles.
        updatedByUser: { connect: { id: res.locals.user.id } },
      },
    });

    // Keep purchase-order links in sync with the vessel's IMO number.
    if (vessel.imoNumber) {
      await prisma.purchaseOrder.updateMany({
        where: { shipImo: vessel.imoNumber, vesselId: null },
        data: { vesselId: vessel.id },
      });
    }

    if (!!req.files) {
      const {
        image,
        'attachments[]': attachments,
        commonInventoryImage,
      } = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      if (!!image) {
        await prisma.vesselImages.deleteMany({
          where: { vesselId: vessel.id },
        });

        await prisma.vesselImages.create({
          data: {
            fileName: image[0].originalname,
            url: image[0].filename,
            vesselId: vessel.id,
          },
        });
      }

      if (!!commonInventoryImage) {
        await prisma.vesselInventoryImage.deleteMany({
          where: { vesselId: vessel.id },
        });

        await prisma.vesselInventoryImage.create({
          data: {
            fileName: commonInventoryImage[0].originalname,
            url: commonInventoryImage[0].filename,
            vesselId: vessel.id,
          },
        });
      }

      if (!!attachments && attachments.length > 0) {
        let counter = 0;
        const uniqueFolderName = crypto.randomBytes(16).toString('hex');
        // dAtt lists every attachment in the form, already-uploaded ones
        // included, so only the not-yet-uploaded entries line up (in order)
        // with the files. Indexing dAtt directly gave a new file the Document
        // Type of an existing attachment.
        const newAttachmentMeta = (dAtt ?? []).filter(
          (a: { status?: string }) => a.status !== 'Uploaded',
        );
        for (const file of attachments) {
          const { docType, useInReport } = newAttachmentMeta[counter++] ?? {};
          if (!docType) {
            throw new ApiException(
              'Document type is required for each attachment',
              422,
            );
          }
          const attachment = await prisma.vesselAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              vesselId: vessel.id,
              documentTypeId: docType,
              useInReport: !!useInReport,
            },
          });

          console.log('Attachment created:', attachment, 'file:', file);

          // Convert PDF to images if the file is a PDF
          if (file.mimetype === 'application/pdf') {
            const imagesPaths = await convertPDFToImages(
              file.path,
              uniqueFolderName,
            );

            console.log('Generated images paths:', imagesPaths);

            // Save each generated image
            let imgCounter = 1;
            for (const imagePath of imagesPaths) {
              const ai = await prisma.attachmentImages.create({
                data: {
                  fileName:
                    file.originalname.split('.')[0] + `-page-${imgCounter++}.`,
                  url: imagePath,
                  attachmentId: attachment.id,
                },
              });

              console.log('Attachment image created:', ai);
            }
          }
        }
      }
    }

    type VesselAttachmentType = {
      id: string;
      name: string;
      filename: string;
      docType: string;
      status: 'New' | 'Uploaded';
      url: string;
    };

    // Save edits to attachments that were already uploaded. Update used to
    // only create new files and delete removed ones, so a changed Document
    // Type or "Use in Report" on an existing attachment was silently dropped.
    for (const a of (dAtt ?? []) as Array<{
      id?: string;
      status?: string;
      docType?: string;
      useInReport?: boolean;
    }>) {
      if (a.status !== 'Uploaded' || !a.id) continue;
      await prisma.vesselAttachments.updateMany({
        where: { id: a.id, vesselId: req.params.id },
        data: {
          useInReport: !!a.useInReport,
          ...(a.docType ? { documentTypeId: a.docType } : {}),
        },
      });
    }

    const attachmentsToDelete = !!deletedAttachments
      ? (JSON.parse(deletedAttachments) as VesselAttachmentType[])
      : [];

    for (const attachment of attachmentsToDelete) {
      await prisma.vesselAttachments.delete({
        where: { id: attachment.id },
      });
    }

    // One history row per status change. Unticking Discontinued writes an
    // Active row (the remarks, or a default), ticking it writes a
    // Discontinued row. A save that leaves the status as it was adds none.
    const isDiscontinued = !!vessel.discontinued;
    if (isDiscontinued !== wasDiscontinued) {
      const remarks = String(discontinueRemarks ?? '').trim();
      await prisma.vesselHistory.create({
        data: {
          vesselId: vessel.id,
          clientName: vessel.clientName,
          entryDate: new Date(),
          activeDate: isDiscontinued ? null : new Date(),
          activeRemarks: isDiscontinued ? '' : remarks || 'Vessel marked active',
          discontinuedDate: isDiscontinued ? new Date() : null,
          discontinuedRemarks: isDiscontinued ? remarks : '',
        },
      });
    }

    res.json({
      success: true,
      data: vessel,
    });
  } catch (error) {
    return handleVesselWriteError(res, error, 'update');
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

export const getAttachmentNamesByVesselId = async (
  req: Request,
  res: Response,
) => {
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
};

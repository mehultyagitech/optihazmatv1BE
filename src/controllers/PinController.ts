import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';
import { PinAttachments, PinImages, Pins } from '@prisma/client';

export const getAllPins = async (req: Request, res: Response) => {
  try {
    const { imageId: locationDiagramId } = req.query;

    if (!locationDiagramId) {
      throw new ApiException('Location Diagram ID is required', 400);
    }

    const pins = await prisma.pins.paginate<Pins>({
      where: {
        locationDiagramId: locationDiagramId as string,
      },
    });

    return res.json({
      success: true,
      message: 'Pins retrieved successfully',
      data: pins,
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

export const getPinById = async (req: Request, res: Response) => {
  try {
    const pin = await prisma.pins.findUnique({
      where: { id: req.params.id },
      include:{
        PinAttachments: true,
        PinImages: true,
      }
    });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    res.json({
      success: true,
      message: 'Pin retrieved successfully',
      data: pin,
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

export const createPin = async (req: Request, res: Response) => {
  try {
    const { user } = res.locals;
    const pinData = JSON.parse(JSON.stringify(req.body));
    const files = req.files;

    console.log('Data:', pinData);
    console.log('Files:', files);

    const pin = await prisma.pins.create({
      data: {
        x: parseFloat(pinData.x),
        y: parseFloat(pinData.y),
        locationDiagram: {
          connect: {
            id: pinData.locationDiagramId,
          },
        },
        subLocation: {
          connect: {
            id: pinData.subLocation,
          },
        },
        equipment: {
          connect: {
            id: pinData.equipment,
          },
        },
        compartment: {
          connect: {
            id: pinData.compartment,
          },
        },
        object: {
          connect: {
            id: pinData.object,
          },
        },
        inventory: {
          connect: {
            id: pinData.inventoryClass,
          },
        },
        Description: pinData.description,
        isPCHM: pinData.isPCHM === 'true',
        manufacturerBrand: pinData.manufacturerBrand,
        referenceNo: pinData.referenceNo,
        remarks: pinData.remarks,
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    if (files && files.length) {
      for (const file of files as Express.Multer.File[]) {
        const [type, _] = file.fieldname.split('[');
        if (type === 'images') {
          await prisma.pinImages.create({
            data: {
              fileName: file.filename,
              url: file.filename,
              pin: {
                connect: {
                  id: pin.id, 
                },
              },
            }
          });
        }
        if (type == 'attachments') {
          // field name = attachments[0].file
          const attachmentIndex = !!file.fieldname ? file.fieldname.match(/\d+/) : '';
          const index = attachmentIndex ? parseInt(attachmentIndex[0]) : 0;

          await prisma.pinAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              documentType: {
                connect: {
                  id: pinData[`attachments[${index}].documentType`],
                },
              },
              pin: {
                connect: {
                  id: pin.id, 
                },
              },
            }
          })
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Pin created successfully',
      data: {
        pin,
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

export const updatePin = async (req: Request, res: Response) => {
  try {
    const { user } = res.locals;
    const { id } = req.params;
    const pinData = JSON.parse(JSON.stringify(req.body));
    const files = req.files;

    console.log('Data:', pinData);
    console.log('Files:', files);

    const existingPin = await prisma.pins.findUnique({
      where: { id },
    });

    if (!existingPin) {
      throw new ApiException('Pin not found', 404);
    }

    const updatedPin = await prisma.pins.update({
      where: { id },
      data: {
        x: parseFloat(pinData.x),
        y: parseFloat(pinData.y),
        locationDiagram: {
          connect: {
            id: pinData.locationDiagramId,
          },
        },
        subLocation: {
          connect: {
            id: pinData.subLocation,
          },
        },
        equipment: {
          connect: {
            id: pinData.equipment,
          },
        },
        compartment: {
          connect: {
            id: pinData.compartment,
          },
        },
        object: {
          connect: {
            id: pinData.object,
          },
        },
        inventory: {
          connect: {
            id: pinData.inventory,
          },
        },
        Description: pinData.description,
        isPCHM: pinData.isPCHM === 'true',
        manufacturerBrand: pinData.manufacturerBrand,
        referenceNo: pinData.referenceNo,
        remarks: pinData.remarks,
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    type PinAttachmentType = {
      id: string,
      file: PinImages | PinAttachments,
      url: string,
      name: string,
      status: "New" | "Uploaded",
    }
    
    if (files && files.length) {
      for (const file of files as Express.Multer.File[]) {
        const [type, _] = file.fieldname.split('[');
        if (type === 'images') {
          await prisma.pinImages.create({
            data: {
              fileName: file.filename,
              url: file.filename,
              pin: {
                connect: {
                  id: updatedPin.id, 
                },
              },
            }
          });
        }

        if (type == 'attachments') {
          // field name = attachments[0].file
          const attachmentIndex = !!file.fieldname ? file.fieldname.match(/\d+/) : '';
          const index = attachmentIndex ? parseInt(attachmentIndex[0]) : 0;

          await prisma.pinAttachments.create({
            data: {
              fileName: file.originalname,
              url: file.filename,
              documentType: {
                connect: {
                  id: pinData[`attachments[${index}].documentType`],
                },
              },
              pin: {
                connect: {
                  id: updatedPin.id, 
                },
              },
            }
          })
        }

        const deletedAttachments = JSON.parse(pinData.deletedAttachments || '[]') as PinAttachmentType[];
        const deletedImages = JSON.parse(pinData.deletedImages || '[]') as PinAttachmentType[];

        console.log('Deleted Attachments:', deletedAttachments);
        console.log('Deleted Images:', deletedImages);

        deletedAttachments.forEach(async (pinAttachment: PinAttachmentType) => {
          await prisma.pinAttachments.delete({
            where: { id: pinAttachment.file.id },
          });
        });

        deletedImages.forEach(async (pinImage: PinAttachmentType) => {
          await prisma.pinImages.delete({
            where: { id: pinImage.file.id },
          });
        });
      }
    }
  
    return res.status(200).json({
      success: true,
      message: 'Pin updated successfully',
      data: {
        pin: updatedPin,
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

export const deletePin = async (req: Request, res: Response) => {
  try {
    await prisma.pins.delete({
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

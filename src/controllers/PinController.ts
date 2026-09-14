import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';
import { PinAttachments, PinImages, Pins, Prisma } from '@prisma/client';

type HazmatRow = {
  hazmatId: number;
  totalMass: number;
  hazInventMass: number;
  unitId: string;
  resultTypeId: string;
  remarks: string | null;
  objectId: string | null;
};

/** Object Source value meaning each hazmat row carries its own Object. */
const OBJECTS_IN_HAZMATS = 'hazmats';

/**
 * The form sends hazmat rows with the quantities as text ("12") and blank
 * selections as "". Prisma rejects those (Float/Int expected), and that error
 * used to crash the API after the pin itself was saved. Convert and check
 * every row up front, before anything is written.
 */
const parseHazmatRows = (raw: unknown, objectsInHazmats = false): HazmatRow[] => {
  if (!raw) return [];
  let rows: any[];
  try {
    rows = typeof raw === 'string' ? JSON.parse(raw) : (raw as any[]);
  } catch {
    throw new ApiException('Hazmat details could not be read', 422);
  }
  if (!Array.isArray(rows)) return [];

  const toNumber = (value: unknown) => {
    const n = Number(value);
    return value === '' || value === null || value === undefined || Number.isNaN(n) ? 0 : n;
  };

  return rows.map((row, index) => {
    const hazmatId = Number(row?.hazmatId);
    const unitId = row?.unitId ? String(row.unitId) : '';
    const resultTypeId = row?.resultTypeId ? String(row.resultTypeId) : '';
    const objectId = row?.objectId ? String(row.objectId) : '';
    const missing = [
      !Number.isInteger(hazmatId) || hazmatId <= 0 ? 'Hazmat' : null,
      !unitId ? 'Unit' : null,
      !resultTypeId ? 'Result Type' : null,
      objectsInHazmats && !objectId ? 'Object' : null,
    ].filter(Boolean);
    if (missing.length) {
      throw new ApiException(
        `Hazmat row ${index + 1}: please select ${missing.join(', ')}`,
        422,
      );
    }
    return {
      hazmatId,
      totalMass: toNumber(row?.totalMass),
      hazInventMass: toNumber(row?.hazInventMass),
      unitId,
      resultTypeId,
      remarks: row?.remarks ? String(row.remarks) : null,
      objectId: objectsInHazmats && objectId ? objectId : null,
    };
  });
};

/**
 * Answer a failed pin request instead of rethrowing. A rethrow from an async
 * handler is an unhandled rejection that kills the API; nginx then returns a
 * 502 without CORS headers, which the browser reports as a CORS error.
 */
const handlePinError = (res: Response, error: unknown, action: string) => {
  if (error instanceof ApiException) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: error.data,
    });
  }

  console.error(`Failed to ${action} inventory point:`, error);

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(422).json({
      success: false,
      message: `Could not ${action} the inventory point: some details are missing or in the wrong format.`,
    });
  }
  if ((error as { code?: string })?.code === 'P2025') {
    return res.status(422).json({
      success: false,
      message: `Could not ${action} the inventory point: a selected value no longer exists.`,
    });
  }

  return res.status(500).json({
    success: false,
    message: `Something went wrong while trying to ${action} the inventory point.`,
  });
};

export const getAllPins = async (req: Request, res: Response) => {
  try {
    const { vesselId } = req.params;
    const { search, inventoryType, status } = req.query;
    const pagination = res.locals.pagination;
    const { page, limit, offset } = pagination;

    if (!vesselId) {
      throw new ApiException('Location Diagram ID is required', 400);
    }

    let where: Prisma.PinsWhereInput = {
      locationDiagram: {
        vesselId: vesselId as string,
      },
    };

    // Filters from the Inventory Points page and the dashboard's Part 1 cards.
    if (inventoryType) {
      where.inventory = { name: String(inventoryType) };
    }
    if (status === 'Active') {
      where.isRemovedFromIHM = false;
      where.isReplaced = false;
    } else if (status === 'Removed') {
      where.isRemovedFromIHM = true;
    } else if (status === 'Replaced') {
      where.isReplaced = true;
    }

    if (search) {
      where.AND = [
        {
          OR: [
            {
              subLocation: {
                name: {
                  contains: search as string,
                },
              },
            },
          ],
        },
      ];
    }

    const pins = await prisma.pins.paginate<Pins>({
      page: Number(page),
      limit: Number(limit),
      offset,
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        inventory: true,
        PinImages: true,
        locationDiagram: {
          include: {
            location: { select: { id: true, name: true } },
            subLocation: { select: { id: true, name: true } },
          },
        },
        subLocation: true,
        equipment: { select: { id: true, name: true } },
        compartment: { select: { id: true, name: true } },
        object: { select: { id: true, name: true } },
        PinHazmat: {
          include: {
            hazmat: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
            object: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Card details the Inventory Points page shows: the point's number on its
    // diagram (oldest first, same as the diagram's Check Point Number), hazmat
    // names, inventory type (Inventory Class) and status.
    const diagramIds = [
      ...new Set((pins.data as any[]).map((pin) => pin.locationDiagramId)),
    ];
    const siblings = await prisma.pins.findMany({
      where: { locationDiagramId: { in: diagramIds } },
      select: { id: true, locationDiagramId: true },
      orderBy: { createdAt: 'asc' },
    });
    const numberById = new Map<string, number>();
    const countByDiagram = new Map<string, number>();
    for (const sibling of siblings) {
      const next = (countByDiagram.get(sibling.locationDiagramId) ?? 0) + 1;
      countByDiagram.set(sibling.locationDiagramId, next);
      numberById.set(sibling.id, next);
    }
    pins.data = (pins.data as any[]).map((pin) => ({
      ...pin,
      inventoryPointNumber: numberById.get(pin.id) ?? null,
      hazmats:
        (pin.PinHazmat ?? [])
          .map((row: any) => row.hazmat?.name)
          .filter(Boolean)
          .join(', ') || '-',
      inventoryType: pin.inventory?.name ?? '-',
      status: pin.isRemovedFromIHM ? 'Removed' : pin.isReplaced ? 'Replaced' : 'Active',
    })) as any;

    const VesselInventoryImage = await prisma.vesselInventoryImage.findFirst({
      where: {
        vesselId: vesselId as string,
      },
    });

    return res.json({
      success: true,
      message: 'Pins retrieved successfully',
      data: {
        ...pins,
        VesselInventoryImage
      },
    });
  } catch (error) {
    return handlePinError(res, error, 'list');
  }
};

export const getPinById = async (req: Request, res: Response) => {
  try {
    const pin = await prisma.pins.findUnique({
      where: { id: req.params.id },
      include: {
        PinAttachments: true,
        PinImages: true,
        locationDiagram: true,
        PinHazmat: true,
      },
    });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });

    const vesselId = pin.locationDiagram.vesselId;

    const PinAttachments = await prisma.pinAttachments.findMany({
      where: {
        pin: {
          is: {
            locationDiagram: {
              is: { vesselId },
            },
          },
        },
      },
    });

    const PinAttachmentLinkPivots =
      await prisma.pinAttachmentPivotLinks.findMany({
        where: {
          pinId: pin.id,
        },
      });

    const PinAttachmentLink: Record<string, boolean> = {};
    const PinAttachmentReport: Record<string, boolean> = {};
    PinAttachmentLinkPivots.forEach((pivot) => {
      PinAttachmentLink[pivot.attachmentId] = true;
      PinAttachmentReport[pivot.attachmentId] = pivot.useInReport;
    });

    res.json({
      success: true,
      message: 'Pin retrieved successfully',
      data: {
        ...pin,
        PinAttachments,
        PinAttachmentLink,
        PinAttachmentReport,
      },
    });
  } catch (error) {
    return handlePinError(res, error, 'load');
  }
};

export const createPin = async (req: Request, res: Response) => {
  try {
    const { user } = res.locals;
    const body = JSON.parse(JSON.stringify(req.body));
    const { hazmats: hazmatData, ...pinData } = body;
    const objectsInHazmats = pinData.objectSource === OBJECTS_IN_HAZMATS;
    const hazmats = parseHazmatRows(hazmatData, objectsInHazmats);
    if (objectsInHazmats && !hazmats.length) {
      throw new ApiException('Add at least one hazmat with its Object in the Hazmats tab', 422);
    }
    if (!objectsInHazmats && !pinData.object) {
      throw new ApiException('Please select an Object', 422);
    }
    const files = req.files;

    // All or nothing: a failure part-way (a bad hazmat row, a missing
    // document type) must not leave a saved pin that a retry duplicates.
    const pin = await prisma.$transaction(
      async (tx) => {
        const pin = await tx.pins.create({
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
          ...(objectsInHazmats
            ? {}
            : { object: { connect: { id: pinData.object } } }),
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
          isRemovedFromIHM: pinData.isRemovedFromIHM === 'true',
          isReplaced: pinData.isReplaced === 'true',
          removedDate:
            pinData.isRemovedFromIHM === 'true' && pinData.removedDate
              ? new Date(pinData.removedDate)
              : null,
          removedRemarks:
            (pinData.isRemovedFromIHM === 'true' && pinData.removedRemarks) ||
            null,
          useCommonImage: pinData.useCommonImage === 'true',
          installationDate: pinData.installationDate ? new Date(pinData.installationDate) : null,
          saveWithoutImage: pinData.saveWithoutImage === 'true',
          useBatteryImage: pinData.useBatteryImage === 'true',
          objectSource: objectsInHazmats ? OBJECTS_IN_HAZMATS : 'location',
        },
      });

      if (files && files.length) {
        for (const file of files as Express.Multer.File[]) {
          const [type, _] = file.fieldname.split('[');
          if (type === 'images') {
            await tx.pinImages.create({
              data: {
                fileName: file.filename,
                url: file.filename,
                pin: {
                  connect: {
                    id: pin.id,
                  },
                },
              },
            });
          }
          if (type == 'attachments') {
            // field name = attachments[0].file
            const attachmentIndex = !!file.fieldname
              ? file.fieldname.match(/\d+/)
              : '';
            const index = attachmentIndex ? parseInt(attachmentIndex[0]) : 0;

            await tx.pinAttachments.create({
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
              },
            });
          }
        }
      }

      if (pin.id && hazmats && hazmats.length) {
        for (const hazmat of hazmats) {
          await tx.pinHazmat.create({
            data: {
              ...hazmat,
              pinId: pin.id,
            },
          });
        }
      }

        return pin;
      },
      { timeout: 30000 },
    );

    res.status(201).json({
      success: true,
      message: 'Pin created successfully',
      data: {
        pin,
      },
    });
  } catch (error) {
    return handlePinError(res, error, 'create');
  }
};

export const updatePin = async (req: Request, res: Response) => {
  try {
    const { user } = res.locals;
    const { id } = req.params;
    const body = JSON.parse(JSON.stringify(req.body));
    const { hazmats: hazmatData, ...pinData } = body;
    const objectsInHazmats = pinData.objectSource === OBJECTS_IN_HAZMATS;
    const hazmats = parseHazmatRows(hazmatData, objectsInHazmats);
    if (objectsInHazmats && !hazmats.length) {
      throw new ApiException('Add at least one hazmat with its Object in the Hazmats tab', 422);
    }
    if (!objectsInHazmats && !pinData.object) {
      throw new ApiException('Please select an Object', 422);
    }
    const files = req.files;

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
        object: objectsInHazmats
          ? { disconnect: true }
          : { connect: { id: pinData.object } },
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
        isRemovedFromIHM: pinData.isRemovedFromIHM === 'true',
        isReplaced: pinData.isReplaced === 'true',
        removedDate:
          pinData.isRemovedFromIHM === 'true' && pinData.removedDate
            ? new Date(pinData.removedDate)
            : null,
        removedRemarks:
          (pinData.isRemovedFromIHM === 'true' && pinData.removedRemarks) ||
          null,
        useCommonImage: pinData.useCommonImage === 'true',
        installationDate: pinData.installationDate ? new Date(pinData.installationDate) : null,
        saveWithoutImage: pinData.saveWithoutImage === 'true',
        useBatteryImage: pinData.useBatteryImage === 'true',
        objectSource: objectsInHazmats ? OBJECTS_IN_HAZMATS : 'location',
      },
    });

    if (hazmats && hazmats.length) {
      await prisma.pinHazmat.deleteMany({
        where: { pinId: id },
      });

      await prisma.pinHazmat.createMany({
        // Rows are already converted and checked by parseHazmatRows.
        data: hazmats.map((h) => ({ ...h, pinId: id })),
      });
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
            },
          });
        }

        if (type == 'attachments') {
          // field name = attachments[0].file
          const attachmentIndex = !!file.fieldname
            ? file.fieldname.match(/\d+/)
            : '';
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
            },
          });
        }
      }
    }

    const { deletedAttachments, deletedImages } = pinData;

    type PinAttachmentType = {
      id: string;
      file: PinImages | PinAttachments;
      url: string;
      name: string;
      status: 'New' | 'Uploaded';
    };

    const attachmentsToDelete = !!deletedAttachments
      ? (JSON.parse(deletedAttachments) as PinAttachmentType[])
      : [];
    const imagesToDelete = !!deletedImages
      ? (JSON.parse(deletedImages) as PinAttachmentType[])
      : [];

    for (const pinAttachment of attachmentsToDelete) {
      await prisma.pinAttachments.delete({
        where: { id: pinAttachment.file.id },
      });
    }

    for (const pinImage of imagesToDelete) {
      await prisma.pinImages.delete({
        where: { id: pinImage.file.id },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pin updated successfully',
      data: {
        pin: updatedPin,
      },
    });
  } catch (error) {
    return handlePinError(res, error, 'update');
  }
};

export const pinAttachmentLink = async (req: Request, res: Response) => {
  try {
    const { pinId, attachmentId, linked, useInReport } = req.body;

    if (!pinId || !attachmentId) {
      throw new ApiException('Pin ID and Attachment ID are required', 400);
    }

    const pinAttachmentLink = await prisma.pinAttachmentPivotLinks.deleteMany({
      where: {
        pinId,
        attachmentId,
      },
    });

    if (!!linked) {
      await prisma.pinAttachmentPivotLinks.create({
        data: {
          pinId,
          attachmentId,
          // Only a linked document can be added to the report.
          useInReport: !!useInReport,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pin attachment link updated successfully',
      data: pinAttachmentLink,
    });
  } catch (error) {
    return handlePinError(res, error, 'link attachments for');
  }
};

/**
 * "Update Common Data" on the Inventory Points page: apply one of the vessel's
 * shared values to the selected points.
 */
export const updateCommonData = async (req: Request, res: Response) => {
  try {
    const { vesselId } = req.params;
    const { ids, action } = req.body ?? {};

    if (!Array.isArray(ids) || !ids.length) {
      throw new ApiException('Select at least one inventory point', 422);
    }

    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: {
        commonReferenceNo: true,
        VesselInventoryImage: { select: { id: true } },
      },
    });
    if (!vessel) {
      throw new ApiException('Vessel not found', 404);
    }

    let data: Prisma.PinsUpdateManyMutationInput;
    switch (action) {
      case 'commonImage':
        if (!vessel.VesselInventoryImage.length) {
          throw new ApiException(
            'This vessel has no Common Inventory Image yet. Add it in the vessel form first.',
            422,
          );
        }
        data = { useCommonImage: true, useBatteryImage: false };
        break;
      case 'commonReference':
        if (!vessel.commonReferenceNo?.trim()) {
          throw new ApiException(
            'This vessel has no Common Reference No yet. Add it in the vessel form first.',
            422,
          );
        }
        data = { referenceNo: vessel.commonReferenceNo };
        break;
      case 'batteryImage':
        data = { useBatteryImage: true, useCommonImage: false };
        break;
      default:
        throw new ApiException('Unknown common data option', 422);
    }

    const result = await prisma.pins.updateMany({
      where: { id: { in: ids.map(String) }, locationDiagram: { vesselId } },
      data,
    });

    return res.status(200).json({
      success: true,
      message: 'Common data applied',
      data: { updated: result.count },
    });
  } catch (error) {
    return handlePinError(res, error, 'update common data for');
  }
};

export const deletePin = async (req: Request, res: Response) => {
  try {
    await prisma.pins.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    return handlePinError(res, error, 'delete');
  }
};

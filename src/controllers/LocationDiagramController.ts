import { Request, Response } from 'express';
import { LocationDiagram, Prisma } from '@prisma/client';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

/**
 * Answer the request instead of rethrowing. A rethrow from an async handler
 * is invisible to Express 4, so it became an unhandled rejection and took the
 * whole API process down -- every "Image is required" click returned a 502
 * while the container restarted.
 */
const handleLocationDiagramError = (
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

  console.error(`Failed to ${action} location diagram:`, error);

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(422).json({
      success: false,
      message: `Could not ${action} the location diagram. Please check the details and try again.`,
    });
  }

  return res.status(500).json({
    success: false,
    message: `Something went wrong while trying to ${action} the location diagram.`,
  });
};

export async function getAllLocationDiagrams(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { search } = req.query;
    const pagination = res.locals.pagination;
    const { page, limit, offset } = pagination;

    if (!vesselId) {
      throw new ApiException(
        'Vessel ID is required',
        400,
      );
    }
    
    const where: Prisma.LocationDiagramWhereInput = {
      vesselId: vesselId as string,
      ...(search && {
        location: {
          name: {
            contains: String(search).toLowerCase(),
          },
        },
      }),
    };

    const response = await prisma.locationDiagram.paginate<LocationDiagram>({
      page: Number(page),
      limit: Number(limit),
      offset,
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        LocationDiagramImage: {
          select: {
            id: true,
            url: true,
            fileName: true,
          }
        },
        location: {
          select: {
            id: true,
            name: true,
          }
        },
        subLocation: {
          select: {
            id: true,
            name: true,
          }
        },
        vessel: {
          select: {
            id: true,
            Client: true,
            Manager: true,
            imoNumber: true,
            vesselType: true,
          }
        },
        // Only what the card counts need.
        Pins: {
          select: {
            installationDate: true,
            isRemovedFromIHM: true,
            isReplaced: true,
          }
        }
      }
    });

    // Card values: Survey = points from the initial survey (no installation
    // date), Maint = points added during maintenance (have one), Rem/Rep =
    // removed or replaced, Active = not removed.
    const locationDiagrams = response.data.map((diagram: any) => {
      const { Pins: pins = [], ...rest } = diagram;
      return {
        ...rest,
        pinCounts: {
          total: pins.length,
          survey: pins.filter((p: any) => !p.installationDate).length,
          maintenance: pins.filter((p: any) => !!p.installationDate).length,
          removedReplaced: pins.filter((p: any) => p.isRemovedFromIHM || p.isReplaced).length,
          active: pins.filter((p: any) => !p.isRemovedFromIHM).length,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        locationDiagrams,
        meta: {
          page: response.meta.page,
          limit: response.meta.limit,
          total: {
            items: response.meta.total.items,
            pages: response.meta.total.pages,
          },
        },
      },
      message: 'Location diagrams fetched successfully',
    });
  } catch (error) {
    return handleLocationDiagramError(res, error, 'list');
  }
}

export async function createLocationDiagram(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const user = res.locals.user;
    const { location: locationId, subLocationId, attachmentImageId: attachmentImageId } = req.body;
    const image = req.file;

    if (!vesselId) {
      throw new ApiException(
        'Vessel ID is required',
        400,
      );
    }

    if (!image) {
      throw new ApiException(
        'Image is required',
        400,
      );
    }

    const locationDiagram = await prisma.locationDiagram.create({
      data: {
        locationId,
        subLocationId,
        attachmentImageId,
        userId: user.id,
        vesselId
      }
    });

    const locationDiagramImage = await prisma.locationDiagramImage.create({
      data: {
        fileName: image.originalname,
        url: image.filename,
        locationDiagramId: locationDiagram.id,
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        locationDiagram,
        locationDiagramImage,
      }
    });
  } catch (error) {
    return handleLocationDiagramError(res, error, 'create');
  }
}

export async function getLocationDiagramById(req: Request, res: Response) {
  try {
    const { LocationDiagramId: id } = req.params;

    if (!id) {
      throw new ApiException(
        'Location diagram ID is required',
        400,
      );
    }

    const locationDiagram = await prisma.locationDiagram.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        LocationDiagramImage: {
          select: {
            id: true,
            url: true,
            fileName: true,
          }
        },
        location: {
          select: {
            id: true,
            name: true,
          }
        },
        subLocation: {
          select: {
            id: true,
            name: true,
          }
        },
        vessel: {
          select: {
            id: true,
            Client: true,
            Manager: true,
            imoNumber: true,
            vesselType: true,
          }
        },
        // Oldest first, so a point's position is its Check Point Number.
        Pins: {
          orderBy: { createdAt: 'asc' },
          include: {
            PinAttachments: true,
            PinImages: true,
            subLocation: { select: { id: true, name: true } },
            equipment: { select: { id: true, name: true } },
            compartment: { select: { id: true, name: true } },
            object: { select: { id: true, name: true } },
            PinHazmat: {
              include: {
                hazmat: { select: { id: true, name: true } },
                unit: { select: { id: true, name: true } },
              }
            },
          }
        }
      }
    });

    if (!locationDiagram) {
      throw new ApiException(
        'Location diagram not found',
        404,
      );
    }

    return res.status(200).json({
      success: true,
      data: locationDiagram,
      message: 'Location diagram fetched successfully',
    });
  } catch (error) {
    return handleLocationDiagramError(res, error, 'load');
  }
}

/**
 * "Update Existing" on Mark New Area: change a diagram's Location Category and
 * Location, and replace its image when a new crop is sent.
 */
export async function updateLocationDiagram(req: Request, res: Response) {
  try {
    const { vesselId, LocationDiagramId: id } = req.params;
    const { location: locationId, subLocationId, attachmentImageId } = req.body;
    const image = req.file;

    const existing = await prisma.locationDiagram.findFirst({
      where: { id, vesselId },
      select: { id: true },
    });
    if (!existing) {
      throw new ApiException('Location diagram not found', 404);
    }
    if (!locationId || !subLocationId) {
      throw new ApiException('Location Category and Location are required', 400);
    }

    const hasSourceImage =
      !!image && !!attachmentImageId && attachmentImageId !== 'undefined';

    const locationDiagram = await prisma.locationDiagram.update({
      where: { id },
      data: {
        locationId,
        subLocationId,
        ...(hasSourceImage ? { attachmentImageId } : {}),
      },
    });

    let locationDiagramImage = null;
    if (image) {
      locationDiagramImage = await prisma.locationDiagramImage.create({
        data: {
          fileName: image.originalname,
          url: image.filename,
          locationDiagramId: id,
        },
      });
      // The card and detail page read the first image, so keep only the new one.
      await prisma.locationDiagramImage.deleteMany({
        where: { locationDiagramId: id, NOT: { id: locationDiagramImage.id } },
      });
    }

    return res.status(200).json({
      success: true,
      data: { locationDiagram, locationDiagramImage },
      message: 'Location diagram updated successfully',
    });
  } catch (error) {
    return handleLocationDiagramError(res, error, 'update');
  }
}

/**
 * Delete one diagram. Its inventory points, their hazmat rows, images and
 * attachments are removed by the database cascade; the response says how many
 * points went with it.
 */
export async function deleteLocationDiagram(req: Request, res: Response) {
  try {
    const { vesselId, LocationDiagramId: id } = req.params;

    const existing = await prisma.locationDiagram.findFirst({
      where: { id, vesselId },
      select: { id: true, _count: { select: { Pins: true } } },
    });
    if (!existing) {
      throw new ApiException('Location diagram not found', 404);
    }

    await prisma.locationDiagram.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      data: { deleted: 1, inventoryPointsDeleted: existing._count.Pins },
      message: 'Location diagram deleted',
    });
  } catch (error) {
    return handleLocationDiagramError(res, error, 'delete');
  }
}

/**
 * "Delete Selected": delete several diagrams of one vessel at once.
 * Body: { ids: string[] }. Ids from another vessel are ignored.
 */
export async function bulkDeleteLocationDiagrams(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const ids: unknown = req.body?.ids;

    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      !ids.every((value) => typeof value === 'string')
    ) {
      throw new ApiException('Select at least one location diagram to delete', 400);
    }

    const where = { id: { in: ids as string[] }, vesselId };
    const inventoryPointsDeleted = await prisma.pins.count({
      where: { locationDiagram: where },
    });
    const { count } = await prisma.locationDiagram.deleteMany({ where });

    return res.status(200).json({
      success: true,
      data: { deleted: count, inventoryPointsDeleted },
      message: `${count} location diagram(s) deleted`,
    });
  } catch (error) {
    return handleLocationDiagramError(res, error, 'delete');
  }
}

import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

const PERIOD_PATTERN = /^(\d{4}-(0[1-9]|1[0-2])|ANNUAL)$/;

const handleError = (res: Response, error: unknown, action: string) => {
  if (error instanceof ApiException) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(`Failed to ${action} IHM certificates:`, error);
  return res.status(500).json({ success: false, message: `Could not ${action} the certificates` });
};

/** GET /vessels/:id/ihm-certificates — saved active/inactive states. */
export async function getIHMCertificateStates(req: Request, res: Response) {
  try {
    const states = await prisma.iHMCertificate.findMany({
      where: { vesselId: req.params.id },
      select: { period: true, isActive: true, updatedAt: true },
    });
    return res.status(200).json({ success: true, data: { states } });
  } catch (error) {
    return handleError(res, error, 'load');
  }
}

/** PATCH /vessels/:id/ihm-certificates/:period { isActive } — admins only. */
export async function setIHMCertificateState(req: Request, res: Response) {
  try {
    const { id: vesselId, period } = req.params;
    const { isActive } = req.body ?? {};
    if (!PERIOD_PATTERN.test(period)) {
      throw new ApiException('Invalid certificate period', 422);
    }
    if (typeof isActive !== 'boolean') {
      throw new ApiException('isActive must be true or false', 422);
    }
    const vessel = await prisma.vessel.count({ where: { id: vesselId } });
    if (!vessel) throw new ApiException('Vessel not found', 404);

    const state = await prisma.iHMCertificate.upsert({
      where: { vesselId_period: { vesselId, period } },
      create: { vesselId, period, isActive, updatedBy: res.locals.user?.id },
      update: { isActive, updatedBy: res.locals.user?.id },
      select: { period: true, isActive: true, updatedAt: true },
    });
    return res.status(200).json({ success: true, data: { state } });
  } catch (error) {
    return handleError(res, error, 'update');
  }
}

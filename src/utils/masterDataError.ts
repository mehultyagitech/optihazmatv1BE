import { Response } from 'express';
import { Prisma } from '@prisma/client';
import ApiException from '../errors/ApiException';

/**
 * Answer a failed master-data write (locations, sub-locations, equipment,
 * compartments, objects, document types) instead of rethrowing: a rethrow from
 * an async handler is an unhandled rejection that takes the whole API down.
 * Duplicate names are the usual cause, since every name is unique.
 */
export default function handleMasterDataError(res: Response, error: unknown, label: string) {
  if (error instanceof ApiException) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: error.data,
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: `${/^[aeiou]/i.test(label) ? 'An' : 'A'} ${label} with this name already exists`,
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: `This ${label} no longer exists`,
      });
    }
  }
  console.error(`Failed to save ${label}:`, error);
  return res.status(500).json({
    success: false,
    message: `Could not save the ${label}`,
  });
}

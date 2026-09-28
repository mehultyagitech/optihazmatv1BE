import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof ApiException) {
    return res.status(error.status).json({ success: false, message: error.message, data: error.data });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const parseDate = (value: unknown, label: string, required: boolean): Date | null => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ApiException(`${label} is required`, 400);
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ApiException(`${label} is not a valid date`, 400);
  return date;
};

const text = (value: unknown, label: string): string => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw new ApiException(`${label} is required`, 400);
  return trimmed;
};

// The signature comes in as a file, and the old one is removed when replaced.
const signatureFile = (req: Request) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return files?.signature?.[0] ?? (req.file as Express.Multer.File | undefined);
};

const removeUpload = (fileName?: string | null) => {
  if (!fileName) return;
  const file = path.join(UPLOADS_DIR, fileName);
  fs.promises.unlink(file).catch(() => undefined);
};

export async function getAllDesignatedPersons(req: Request, res: Response) {
  try {
    const { search } = req.query;
    const pagination = res.locals.pagination;
    const { page, limit, offset } = pagination;

    const where = search
      ? {
          OR: [
            { name: { contains: String(search) } },
            { position: { contains: String(search) } },
            { initials: { contains: String(search) } },
          ],
        }
      : {};

    const result = await prisma.designatedPerson.paginate({
      page: Number(page),
      limit: Number(limit),
      offset,
      where,
      // The person in charge now first.
      orderBy: { effectiveFrom: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        total: result.meta.total.items,
        page: result.meta.page,
        limit: result.meta.limit,
        pageCount: result.meta.total.pages,
      },
      message: 'Designated persons fetched successfully',
    });
  } catch (error) {
    return fail(res, error, 'Could not load the designated persons');
  }
}

export async function createDesignatedPerson(req: Request, res: Response) {
  try {
    const signature = signatureFile(req);
    const person = await prisma.designatedPerson.create({
      data: {
        name: text(req.body.name, 'DP Name'),
        position: text(req.body.position, 'Position'),
        initials: text(req.body.initials, 'Initials'),
        effectiveFrom: parseDate(req.body.effectiveFrom, 'Effective From Date', true) as Date,
        effectiveTo: parseDate(req.body.effectiveTo, 'Effective To Date', false),
        signatureUrl: signature?.filename ?? null,
        signatureName: signature?.originalname ?? null,
        createdBy: res.locals.user?.id ?? null,
      },
    });
    return res.status(201).json({ success: true, message: 'DP added successfully', data: person });
  } catch (error) {
    return fail(res, error, 'Could not add the designated person');
  }
}

export async function updateDesignatedPerson(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.designatedPerson.findUnique({ where: { id } });
    if (!existing) throw new ApiException('Designated person not found', 404);

    const signature = signatureFile(req);
    // "removeSignature" clears it without uploading a replacement.
    const clearing = String(req.body.removeSignature) === 'true';

    const person = await prisma.designatedPerson.update({
      where: { id },
      data: {
        name: text(req.body.name, 'DP Name'),
        position: text(req.body.position, 'Position'),
        initials: text(req.body.initials, 'Initials'),
        effectiveFrom: parseDate(req.body.effectiveFrom, 'Effective From Date', true) as Date,
        effectiveTo: parseDate(req.body.effectiveTo, 'Effective To Date', false),
        ...(signature
          ? { signatureUrl: signature.filename, signatureName: signature.originalname }
          : clearing
            ? { signatureUrl: null, signatureName: null }
            : {}),
      },
    });

    if (signature || clearing) removeUpload(existing.signatureUrl);

    return res.status(200).json({ success: true, message: 'DP updated successfully', data: person });
  } catch (error) {
    return fail(res, error, 'Could not update the designated person');
  }
}

export async function deleteDesignatedPerson(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const existing = await prisma.designatedPerson.findUnique({ where: { id } });
    if (!existing) throw new ApiException('Designated person not found', 404);

    await prisma.designatedPerson.delete({ where: { id } });
    removeUpload(existing.signatureUrl);

    return res.status(200).json({ success: true, message: 'DP deleted successfully' });
  } catch (error) {
    return fail(res, error, 'Could not delete the designated person');
  }
}

import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export const getAttachmentsByVesselId = async (req: Request, res: Response) => {
    try {
        const { vesselId } = req.params;

        const attachments = await prisma.vesselAttachments.findMany({
            where: { vesselId },
            select: {
                id: true,
                fileName: true,
                url: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    
        res.status(200).json({ success: true, data: attachments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export const getPinsByAttachmentId = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ApiException('Attachment ID is required', 400);
        }

        const pins = await prisma.pins.findMany({
            where: {attachmentId: id},
        })
    
        res.status(200).json({ success: true, data: pins });
    } catch (error) {
        console.error(error);
        if (error instanceof ApiException) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export const deleteAttachmentById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ApiException('Attachment ID is required', 400);
        }

        const attachment = await prisma.vesselAttachments.deleteMany({
            where: { id },
        });
    
        res.status(200).json({ success: true, data: attachment.count });
    } catch (error) {
        console.error(error);
        if (error instanceof ApiException) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
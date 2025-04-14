import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../database/Prisma";
import ApiException from "../errors/ApiException";

export async function getAllLocationDiagrams(req: Request, res: Response) {
    try {
        const { vesselId, documentTypeId } = req.query;
        const pagination = res.locals.pagination;
        const { page, limit, offset } = pagination;

        if (!vesselId || !documentTypeId) {
            throw new ApiException('Vessel ID and Document Type ID are required', 400);
        }
        
        return res.status(200).json({
            success: true,
            data: {},
            message: "Location diagrams fetched successfully",
        });

    } catch (error) {
        throw error;
    }
}
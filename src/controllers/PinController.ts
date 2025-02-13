import { Request, Response } from 'express';
import prisma from '../database/Prisma';
import { pinDataValidation, pinImageValidation } from '../validations/PinValidation';
import ApiException from '../errors/ApiException';
import validate from '../services/ValidationService';

export const getAllPins = async (req: Request, res: Response) => {
  try {
    const { imageId } = req.query;
    const pins = await prisma.pins.findMany({
        where: { imageId: imageId as string },
    });
    res.json(pins);
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
    });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    res.json(pin);
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
    const { pinData } = req.body;
    const { images } = req.files as { [fieldname: string]: Express.Multer.File[] };

    const { hasError: pinDataError, errors: pinDataErrors } = validate(pinDataValidation, pinData);

    if (pinDataError) {
      throw new ApiException('Validation error', 422, {
        pinData: pinDataErrors,
      });
    }

    const pin = await prisma.pins.create({
      data: pinData,
    });

    if (images) {
      await prisma.pinImages.createMany({
        data: images.map((file) => ({
          url: file.path,
          pinId: pin.id,
        })),
      });
    }

    res.status(201).json(pin);
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
    const pin = await prisma.pins.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(pin);
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

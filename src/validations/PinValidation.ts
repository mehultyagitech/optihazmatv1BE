import joi from 'joi';

export const pinDataValidation = joi.object({
  x: joi.number().required(),
  y: joi.number().required(),
  locationDiagramId: joi.string().required(),
  subLocation: joi.string().required(),
  equipment: joi.string().required(),
  compartment: joi.string().required(),
  object: joi.string().required(),
  inventoryClass: joi.string().required(),
  description: joi.string().required(),
  isPCHM: joi.boolean().required(),
  manufacturerBrand: joi.string().required(),
  referenceNo: joi.string().required(),
  remarks: joi.string().required(),
  attachmentId: joi.string().required()
});


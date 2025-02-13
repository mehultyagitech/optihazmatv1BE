import joi from 'joi';

export const pinDataValidation = joi.object({
  x: joi.number().required(),
  y: joi.number().required(),
  label: joi.string().required(),
  imageId: joi.string().required(),
});

export const pinImageValidation = joi.object({
  url: joi.string().required(),
  pinId: joi.string().required(),
});

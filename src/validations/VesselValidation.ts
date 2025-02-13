import joi from 'joi';

export const vesselDataValidation = joi.object({
  vesselName: joi.string().required(),
  imoNumber: joi.string().required(),
  vesselType: joi.string().optional(),
  flag: joi.string().optional(),
  classSociety: joi.string().optional(),
  portOfRegistry: joi.string().optional(),
  grossTonnageMT: joi.number().optional(),
  lbd: joi.string().optional(),
  registeredOwner: joi.string().optional(),
  registeredOwnerAddress: joi.string().optional(),
  vesselManager: joi.string().optional(),
  clientName: joi.string().optional(),
  deliveryDate: joi.date().optional(),
  keelLaidDate: joi.date().optional(),
  shipYardName: joi.string().optional(),
  shipYardAddress: joi.string().optional(),
  ihmClass: joi.string().optional(),
  ihmSurveyStartDate: joi.date().optional(),
  ihmSurveyEndDateIsSame: joi.boolean().optional(),
  ihmSurveyEndDate: joi.date().optional(),
  socIssueDate: joi.date().optional(),
  readyForMaintenance: joi.boolean().optional(),
  maintenanceStartDate: joi.date().optional(),
  vesselEmailId: joi.string().optional(),
});

export const clientManagerValidation = joi.object({
  id: joi.number().required(),
  companyName: joi.string().required(),
  address: joi.string().optional(),
  contactDetails: joi.string().optional(),
  verifaviaId: joi.string().required(),
  isClient: joi.boolean().optional(),
});

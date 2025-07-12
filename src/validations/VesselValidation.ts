import Joi from 'joi';
import prisma from '../database/Prisma';

export const vesselDataValidation = Joi.object({
  vesselName: Joi.string().required(),
  imoNumber: Joi.string()
    .required()
    .external(async (value, helpers) => {
      const vessel = await prisma.vessel.findFirst({
        where: { imoNumber: value },
      });
      if (vessel) {
        return helpers.error('any.custom', {
          message: 'IMO Number already exists',
        });
      }
      return value;
    }),
  vesselType: Joi.string().optional(),
  flag: Joi.string().optional(),
  classSociety: Joi.string().optional(),
  portOfRegistry: Joi.string().optional(),
  grossTonnageMT: Joi.number().optional(),
  lbd: Joi.string().optional(),
  registeredOwner: Joi.string().optional(),
  registeredOwnerAddress: Joi.string().optional(),
  vesselManager: Joi.number().required(),
  clientName: Joi.number().required(),
  deliveryDate: Joi.date().optional(),
  keelLaidDate: Joi.date().optional(),
  shipYardName: Joi.string().optional(),
  shipYardAddress: Joi.string().optional(),
  ihmClass: Joi.string().valid('Class A', 'Class B', 'Class C').optional(),
  ihmSurveyStartDate: Joi.date().optional(),
  ihmSurveyEndDate: Joi.date().optional(),
  socIssueDate: Joi.date().optional(),
  readyForMaintenance: Joi.boolean().optional(),
  maintenanceStartDate: Joi.date().optional(),
  vesselEmailId: Joi.string()
    .email({ tlds: { allow: false } })
    .optional()
    .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  headerFreeTextCaption: Joi.string().max(20).optional(),
  headerFreeTextValue: Joi.string().max(40).optional(),
  poDataGapDisclaimer: Joi.string().max(500).optional(),
  commonReferenceNo: Joi.string().optional(),
  createdBy: Joi.string().optional(),
  attachments: Joi.any().optional(),
  discontinued: Joi.boolean().optional(),
  discontinueRemarks: Joi.string().max(500).optional(),
});

export const vesselUpdateValidation = (id: string) =>
  Joi.object({
    vesselName: Joi.string().required(),
    imoNumber: Joi.string()
      .required()
      .external(async (value, helpers) => {
        const vessel = await prisma.vessel.findFirst({
          where: {
            imoNumber: value,
            NOT: { id: id },
          },
        });
        if (vessel) {
          return helpers.error('any.custom', {
            message: 'IMO Number already exists',
          });
        }
        return value;
      }),
    vesselType: Joi.string().optional(),
    flag: Joi.string().optional(),
    classSociety: Joi.string().optional(),
    portOfRegistry: Joi.string().optional(),
    grossTonnageMT: Joi.number().optional(),
    lbd: Joi.string().optional(),
    registeredOwner: Joi.string().optional(),
    registeredOwnerAddress: Joi.string().optional(),
    vesselManager: Joi.number().optional(),
    clientName: Joi.number().optional(),
    deliveryDate: Joi.date().optional(),
    keelLaidDate: Joi.date().optional(),
    shipYardName: Joi.string().optional(),
    shipYardAddress: Joi.string().optional(),
    ihmClass: Joi.string().valid('Class A', 'Class B', 'Class C').optional(),
    ihmSurveyStartDate: Joi.date().optional(),
    ihmSurveyEndDate: Joi.date().optional(),
    socIssueDate: Joi.date().optional(),
    readyForMaintenance: Joi.boolean().optional(),
    maintenanceStartDate: Joi.date().optional(),
    vesselEmailId: Joi.string()
      .email({ tlds: { allow: false } })
      .optional()
      .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
    headerFreeTextCaption: Joi.string().max(20).optional(),
    headerFreeTextValue: Joi.string().max(40).optional(),
    poDataGapDisclaimer: Joi.string().max(500).optional(),
    commonReferenceNo: Joi.string().optional(),
    createdBy: Joi.string().optional(),
    deletedAttachments: Joi.any().optional(),
    discontinued: Joi.boolean().optional(),
    discontinueRemarks: Joi.string().max(500).optional(),
  });

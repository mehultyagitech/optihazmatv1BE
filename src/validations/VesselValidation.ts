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
  vesselType: Joi.string().required().label('Vessel Type'),
  flag: Joi.string().required().label('Flag'),
  classSociety: Joi.string().required().label('Class Society'),
  portOfRegistry: Joi.string().required().label('Port of Registry'),
  grossTonnageMT: Joi.number().integer().required().label('Gross Tonnage MT'),
  lbd: Joi.string().required().label('L*B*D'),
  registeredOwner: Joi.string().required().label('Registered Owner'),
  registeredOwnerAddress: Joi.string().required().label('Registered Owner Address'),
  vesselManager: Joi.number().required(),
  clientName: Joi.number().required(),
  deliveryDate: Joi.date().required().label('Delivery Date'),
  keelLaidDate: Joi.date().required().label('Keel Laid Date'),
  shipYardName: Joi.string().required().label('Ship Yard Name'),
  shipYardAddress: Joi.string().required().label('Ship Yard Address'),
  ihmClass: Joi.string().valid('Class A', 'Class B', 'Class C').required().label('IHM Class'),
  ihmSurveyStartDate: Joi.date().required().label('IHM Survey Start Date'),
  ihmSurveyEndDate: Joi.date().required().label('IHM Survey End Date'),
  socIssueDate: Joi.date().optional(),
  readyForMaintenance: Joi.boolean().optional(),
  readyForMaintenanceDate: Joi.date().required(),
  maintenanceStartDate: Joi.date().required().label('Maintenance Start Date'),
  showVesselToOwnerManager: Joi.boolean().optional(),
  vesselEmailId: Joi.string()
    .email({ tlds: { allow: false } })
    .optional()
    .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  headerFreeTextCaption: Joi.string().max(20).optional(),
  headerFreeTextValue: Joi.string().max(40).optional(),
  poDataGapDisclaimer: Joi.string().max(500).optional(),
  commonReferenceNo: Joi.string().allow('', null).optional(),
  callSign: Joi.string()
    .pattern(/^[A-Za-z0-9]+$/)
    .required()
    .messages({
      'string.pattern.base':
        'Call Sign/Distinctive Number must contain only letters and numbers',
    }),
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
    vesselType: Joi.string().required().label('Vessel Type'),
    flag: Joi.string().required().label('Flag'),
    classSociety: Joi.string().required().label('Class Society'),
    portOfRegistry: Joi.string().required().label('Port of Registry'),
    grossTonnageMT: Joi.number().integer().required().label('Gross Tonnage MT'),
    lbd: Joi.string().required().label('L*B*D'),
    registeredOwner: Joi.string().required().label('Registered Owner'),
    registeredOwnerAddress: Joi.string().required().label('Registered Owner Address'),
    vesselManager: Joi.number().optional(),
    clientName: Joi.number().optional(),
    deliveryDate: Joi.date().required().label('Delivery Date'),
    keelLaidDate: Joi.date().required().label('Keel Laid Date'),
    shipYardName: Joi.string().required().label('Ship Yard Name'),
    shipYardAddress: Joi.string().required().label('Ship Yard Address'),
    ihmClass: Joi.string().valid('Class A', 'Class B', 'Class C').required().label('IHM Class'),
    ihmSurveyStartDate: Joi.date().required().label('IHM Survey Start Date'),
    ihmSurveyEndDate: Joi.date().required().label('IHM Survey End Date'),
    socIssueDate: Joi.date().optional(),
    readyForMaintenance: Joi.boolean().optional(),
    readyForMaintenanceDate: Joi.date().required(),
    maintenanceStartDate: Joi.date().required().label('Maintenance Start Date'),
    showVesselToOwnerManager: Joi.boolean().optional(),
    vesselEmailId: Joi.string()
      .email({ tlds: { allow: false } })
      .optional()
      .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
    headerFreeTextCaption: Joi.string().max(20).optional(),
    headerFreeTextValue: Joi.string().max(40).optional(),
    poDataGapDisclaimer: Joi.string().max(500).optional(),
    commonReferenceNo: Joi.string().allow('', null).optional(),
  callSign: Joi.string()
    .pattern(/^[A-Za-z0-9]+$/)
    .required()
    .messages({
      'string.pattern.base':
        'Call Sign/Distinctive Number must contain only letters and numbers',
    }),
    createdBy: Joi.string().optional(),
    deletedAttachments: Joi.any().optional(),
    discontinued: Joi.boolean().optional(),
    discontinueRemarks: Joi.string().max(500).optional(),
  });

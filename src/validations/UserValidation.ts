import joi from 'joi';

export const loginValidation = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required(),
});

export const createUserValidation = joi.object({
  name: joi.string().required(),
  email: joi.string().email().required(),
  password: joi.string().required(),
  confirmPassword: joi.string().required().valid(joi.ref('password')),
});

// Admin-created users: password is optional and defaults to `admin123`.
export const adminCreateUserValidation = joi.object({
  name: joi.string().required(),
  email: joi.string().email().required(),
  roles: joi.string().valid('USER', 'ADMIN').default('USER'),
  password: joi.string().min(6).optional(),
});

export const updateUserValidation = joi.object({
  name: joi.string().optional(),
  email: joi.string().email().optional(),
  roles: joi.string().valid('USER', 'ADMIN').optional(),
  disabled: joi.boolean().optional(),
  password: joi.string().min(6).optional().allow('', null),
});

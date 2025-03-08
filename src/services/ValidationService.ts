import Joi from 'joi';

type ValidationErrors = { [key: string]: any };

type ValidationResult = {
  hasError: boolean;
  errors: ValidationErrors;
};

export const validate = (schema: Joi.Schema, data: any): ValidationResult => {
  const { error } = schema.validate(data, { abortEarly: false });
  
  const errors: ValidationErrors = {};
  let hasError = false;

  if (error) {
    hasError = true;
    error.details.forEach(detail => {
      errors[detail.path[0]] = detail.message;
    });
  }

  return { hasError, errors };
};

export const validateAsync = async (
  schema: Joi.Schema, 
  data: any
): Promise<ValidationResult> => {
  try {
    await schema.validateAsync(data, { abortEarly: false });
    return { hasError: false, errors: {} };
  } catch (error) {
    const errors: ValidationErrors = {};
    
    if (error instanceof Joi.ValidationError) {
      error.details.forEach(detail => {
        errors[detail.path[0]] = detail.message;
      });
    }
    
    return { hasError: true, errors };
  }
};

export default validate;

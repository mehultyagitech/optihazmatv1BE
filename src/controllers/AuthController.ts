import { Request, Response } from 'express';
import { User, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';
import {
  createUserValidation,
  loginValidation,
} from '../validations/UserValidation';
import validate from '../services/ValidationService';
import TokenService from '../services/TokenService';
import logger from '../services/logger';

export async function createUser(req: Request, res: Response) {
  logger.info('Received request to create a new user');
  try {
    const { email, password, name } = req.body;

    logger.debug('Validating user input');
    const { hasError, errors } = validate(createUserValidation, req.body);

    if (hasError) {
      logger.warn('Validation error occurred during user creation', { errors });
      throw new ApiException('Validation error', 422, errors);
    }

    const checkUserExists = await prisma.user.findUnique({ where: { email } });
    logger.debug('Checked if user already exists');

    if (checkUserExists) {
      logger.warn('Attempt to create a user that already exists', { email });
      throw new ApiException('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    logger.debug('Password hashed successfully');

    const user: User = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: Role.USER,
      },
    });

    logger.info('User created successfully', { email });

    const token = await TokenService.generateUserToken(user);

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24,
    });

    logger.info('Access token generated and sent');
    return res.status(201).json({
      success: true,
      message: 'User created',
      data: {
        user: {
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    logger.error('Error occurred in createUser', { error });
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: error.data,
      });
    }
    throw error;
  }
}

export async function loginUser(req: Request, res: Response) {
  logger.info('Received request to log in user');
  try {
    const { email, password } = req.body;

    logger.debug('Validating login input');
    const { hasError, errors } = validate(loginValidation, { email, password });

    if (hasError) {
      logger.warn('Validation error during login', { errors });
      throw new ApiException('Validation error', 422, errors);
    }

    const user: User | null = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      logger.warn('User not found during login attempt', { email });
      throw new ApiException('User not found', 404);
    }

    const verifyPassword = await bcrypt.compare(password, user.password);

    if (!verifyPassword) {
      logger.warn('Invalid password attempt', { email });
      throw new ApiException('Invalid password', 401);
    }

    const token = await TokenService.generateUserToken(user);

    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: (process.env.NODE_ENV as string) === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24,
    });

    logger.info('User logged in successfully', { email });
    return res.status(200).json({
      success: true,
      message: 'User logged in',
      data: {
        user: {
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    logger.error('Error occurred in loginUser', { error });
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        data: error.data,
      });
    }
    throw error;
  }
}

export async function logoutUser(req: Request, res: Response) {
  logger.info('Received request to log out user');
  try {
    const { token } = req.body;

    await TokenService.logoutUser(token);

    res.clearCookie('accessToken');

    logger.info('User logged out successfully');
    return res.status(200).json({
      success: true,
      message: 'User logged out',
    });
  } catch (error) {
    logger.error('Error occurred in logoutUser', { error });
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function logoutFromAllDevices(req: Request, res: Response) {
  logger.info('Received request to log out user from all devices');
  try {
    const { user } = req.body;

    await TokenService.logoutFromAllDevices(user);

    res.clearCookie('accessToken');

    logger.info('User logged out from all devices successfully', { user });
    return res.status(200).json({
      success: true,
      message: 'User logged out from all devices',
    });
  } catch (error) {
    logger.error('Error occurred in logoutFromAllDevices', { error });
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

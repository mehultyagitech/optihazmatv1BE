import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import ApiException from '../errors/ApiException';
import prisma from '../database/Prisma';
import validate from '../services/ValidationService';
import {
  adminCreateUserValidation,
  updateUserValidation,
} from '../validations/UserValidation';

// Default password assigned to admin-created users.
const DEFAULT_PASSWORD = 'admin123';

function sanitizeUser<T extends { password?: string }>(user: T) {
  const { password, ...rest } = user;
  return rest;
}

export async function getUsers(req: Request, res: Response) {
  try {
    const { page, limit, offset } = res.locals.pagination;

    const usersCount = await prisma.user.count();

    const usersPaginated = await prisma.user.findMany({
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: {
        users: usersPaginated.map(sanitizeUser),
        meta: {
          page,
          limit,
          total: {
            items: usersCount,
            pages: Math.ceil(usersCount / limit),
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      throw new ApiException('User not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { hasError, errors } = validate(adminCreateUserValidation, req.body);
    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const { name, email, roles, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiException('User with this email already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(
      password || DEFAULT_PASSWORD,
      10,
    );

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: roles === 'ADMIN' ? Role.ADMIN : Role.USER,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'User created',
      data: { user: sanitizeUser(user) },
    });
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
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const { hasError, errors } = validate(updateUserValidation, req.body);
    if (hasError) {
      throw new ApiException('Validation error', 422, errors);
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiException('User not found', 404);
    }

    const { name, email, roles, disabled, password } = req.body;

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        throw new ApiException('User with this email already exists', 400);
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (roles !== undefined) data.roles = roles === 'ADMIN' ? Role.ADMIN : Role.USER;
    if (disabled !== undefined) data.disabled = disabled;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      success: true,
      message: 'User updated',
      data: { user: sanitizeUser(user) },
    });
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
}

export async function disableUser(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: {
        id,
      },
      data: {
        disabled: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'User disabled',
      data: {
        user,
      },
    });
  } catch (error) {
    if (error instanceof ApiException) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    throw error;
  }
}

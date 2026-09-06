import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const userRole = req.user.role;
    const effectiveRoles = [userRole];
    if (userRole === 'field_officer') effectiveRoles.push('field_agent');
    if (userRole === 'field_agent') effectiveRoles.push('field_officer');

    const hasRole = allowedRoles.some((r) => effectiveRoles.includes(r as any));

    if (!hasRole) {
      return sendError(
        res,
        `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
        403
      );
    }

    return next();
  };
};

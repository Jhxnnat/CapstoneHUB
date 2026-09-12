import { UserRole } from '../generated/prisma/client';

export type AuthenticatedUser = {
  id: number;
  fullName: string;
  email: string;
  roles: UserRole[];
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user: AuthenticatedUser;
};

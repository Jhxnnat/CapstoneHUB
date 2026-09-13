import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { LoginUserDto } from './dto/login-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthenticatedUser } from './auth.types';
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24;

const authUserSelect = {
  id: true,
  fullName: true,
  email: true,
  isActive: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roleAssignments: {
    select: { role: true },
  },
} as const satisfies Prisma.UserSelect;

type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

type AuthResponse = {
  user: AuthenticatedUser;
  accessToken: string;
};

type UserSummary = {
  id: number;
  fullName: string;
  email: string;
  roles: UserRole[];
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly tokenSecret = this.getTokenSecret();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const userCount = await this.prisma.user.count();
    const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.trim();
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const initialName = process.env.INITIAL_ADMIN_NAME?.trim();

    if (userCount > 0) {
      return;
    }

    if (!initialEmail && !initialPassword && !initialName) {
      return;
    }

    if (!initialEmail || !initialPassword || !initialName) {
      throw new Error(
        'INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, and INITIAL_ADMIN_NAME must be set together',
      );
    }

    if (initialPassword.length < 8) {
      throw new Error('INITIAL_ADMIN_PASSWORD must be at least 8 characters');
    }

    await this.prisma.user.create({
      data: {
        fullName: initialName,
        email: this.normalizeEmail(initialEmail),
        passwordHash: await this.hashPassword(initialPassword),
        isActive: true,
        roleAssignments: { create: [{ role: UserRole.admin }] },
      },
    });
  }

  async login(payload: LoginUserDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(payload.email);

    const userRecord = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!userRecord || !userRecord.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.verifyPassword(
      payload.password,
      userRecord.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRecordWithRoles = await this.prisma.user.update({
      where: { id: userRecord.id },
      data: { lastLoginAt: new Date() },
      select: authUserSelect,
    });
    const user = this.toAuthenticatedUser(userRecordWithRoles);

    return {
      user,
      accessToken: this.createAccessToken(user),
    };
  }

  async users(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        roleAssignments: { select: { role: true } },
      },
    });

    return users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roleAssignments.map(({ role }) => role),
    }));
  }

  async createUser(payload: CreateUserDto): Promise<UserSummary> {
    const email = this.normalizeEmail(payload.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        fullName: payload.fullName.trim(),
        email,
        passwordHash: await this.hashPassword(payload.password),
        isActive: true,
        roleAssignments: {
          create: [...new Set(payload.roles)].map((role) => ({ role })),
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        roleAssignments: { select: { role: true } },
      },
    });

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roleAssignments.map(({ role }) => role),
    };
  }

  async replaceUserRoles(
    userId: number,
    roles: UserRole[],
  ): Promise<UserSummary> {
    const uniqueRoles = [...new Set(roles)];
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException(`User ${userId} not found`);
    }

    if (!uniqueRoles.includes(UserRole.admin)) {
      const adminCount = await this.prisma.userRoleAssignment.count({
        where: { role: UserRole.admin },
      });
      const userIsAdmin = await this.prisma.userRoleAssignment.count({
        where: { userId, role: UserRole.admin },
      });

      if (userIsAdmin > 0 && adminCount <= 1) {
        throw new BadRequestException(
          'The system must retain at least one admin',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.userRoleAssignment.deleteMany({ where: { userId } }),
      this.prisma.userRoleAssignment.createMany({
        data: uniqueRoles.map((role) => ({ userId, role })),
      }),
    ]);

    return (await this.users()).find((summary) => summary.id === userId)!;
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid access token');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const expectedSignature = createHmac('sha256', this.tokenSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    const actual = Buffer.from(encodedSignature);
    const expected = Buffer.from(expectedSignature);

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    let payload: { sub?: number; exp?: number };
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as { sub?: number; exp?: number };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (
      !payload.sub ||
      !payload.exp ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Access token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: authUserSelect,
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('User is inactive or does not exist');
    }

    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: AuthUser): AuthenticatedUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roleAssignments.map(({ role }) => role),
    };
  }

  private getTokenSecret(): string {
    const secret = process.env.AUTH_SECRET?.trim();
    if (!secret || secret.length < 32) {
      throw new Error(
        'AUTH_SECRET must be configured with at least 32 characters',
      );
    }

    return secret;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    const [scheme, salt, storedKey] = storedHash.split('$');

    if (scheme !== 'scrypt' || !salt || !storedKey) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    const storedKeyBuffer = Buffer.from(storedKey, 'hex');

    if (storedKeyBuffer.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(storedKeyBuffer, derivedKey);
  }

  private createAccessToken(
    user: Pick<AuthenticatedUser, 'id' | 'email' | 'fullName'>,
  ): string {
    const header = this.base64UrlEncode(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    );
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = this.base64UrlEncode(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
        iat: issuedAt,
        exp: issuedAt + AUTH_TOKEN_TTL_SECONDS,
      }),
    );

    const signature = createHmac('sha256', this.tokenSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value).toString('base64url');
  }
}

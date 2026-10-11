import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthenticatedUser } from './auth.types';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'util';
import { JwtService } from '@nestjs/jwt';
import { AUTH_TOKEN_RENEW_AFTER_SECONDS } from './auth.token';

const scrypt = promisify(scryptCallback);

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    let userCount: number;

    try {
      userCount = await this.prisma.user.count();
    } catch (error) {
      // Si la base de datos está caída al arrancar, el servicio debe levantarse
      // igualmente y responder 503 en las rutas que dependen de ella.
      this.logger.warn(
        'No se pudo verificar la base de datos al iniciar; se omite la creación del admin inicial',
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

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

  async register(payload: RegisterUserDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(payload.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    let userRecord: AuthUser;

    try {
      userRecord = await this.prisma.user.create({
        data: {
          fullName: payload.fullName.trim(),
          email,
          passwordHash: await this.hashPassword(payload.password),
          isActive: true,
          lastLoginAt: new Date(),
          roleAssignments: {
            create: [{ role: UserRole.proposer }],
          },
        },
        select: authUserSelect,
      });
    } catch (error) {
      // La verificación previa no cubre una carrera entre dos registros con el
      // mismo correo; la restricción única de la tabla sí lo hace.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Email is already registered');
      }

      throw error;
    }

    const user = this.toAuthenticatedUser(userRecord);

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

  /**
   * Cambia la contraseña del usuario autenticado. La contraseña actual se
   * valida con scrypt y la nueva debe ser distinta. Responde 400 (nunca 401)
   * cuando la actual no coincide, para no disparar el cierre de sesión global
   * del frontend.
   */
  async changePassword(
    userId: number,
    payload: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, passwordHash: true },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('User is inactive or does not exist');
    }

    const currentMatches = await this.verifyPassword(
      payload.currentPassword,
      user.passwordHash,
    );

    if (!currentMatches) {
      throw new BadRequestException('Current password is incorrect');
    }

    const repeatsCurrent = await this.verifyPassword(
      payload.newPassword,
      user.passwordHash,
    );

    if (repeatsCurrent) {
      throw new BadRequestException(
        'The new password must be different from the current one',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.hashPassword(payload.newPassword) },
    });

    return { message: 'Password updated' };
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    let payload: { sub?: number };

    try {
      payload = await this.jwt.verifyAsync<{ sub?: number }>(token, {
        algorithms: ['HS256'],
      });
    } catch (error) {
      const expired =
        error instanceof Error && error.name === 'TokenExpiredError';

      throw new UnauthorizedException(
        expired ? 'Access token expired' : 'Invalid access token',
      );
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid access token');
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

  /**
   * Reemite el token cuando al actual ya le pasó el umbral de renovación, para
   * que las sesiones activas no se corten de golpe. Devuelve `null` si el token
   * todavía es reciente. El guard lo llama tras verificar la firma.
   */
  renewAccessTokenIfStale(
    token: string,
    user: Pick<AuthenticatedUser, 'id' | 'email' | 'fullName'>,
  ): string | null {
    const payload = this.jwt.decode<{ iat?: number } | null>(token);

    if (!payload?.iat) {
      return null;
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - payload.iat;

    if (ageSeconds < AUTH_TOKEN_RENEW_AFTER_SECONDS) {
      return null;
    }

    return this.createAccessToken(user);
  }

  private toAuthenticatedUser(user: AuthUser): AuthenticatedUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roleAssignments.map(({ role }) => role),
    };
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
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    });
  }
}

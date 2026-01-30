import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password, rememberMe } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true, jobCategory: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('שם משתמש או סיסמה שגויים');
    }

    if (!user.isApproved) {
      throw new UnauthorizedException('החשבון שלך ממתין לאישור מנהל');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('שם משתמש או סיסמה שגויים');
    }

    const tokens = await this.generateTokens(user, rememberMe);
    await this.saveRefreshToken(user.id, tokens.refreshToken, rememberMe);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async signupRequest(signupDto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException('כתובת האימייל כבר קיימת במערכת');
    }

    // Find organization by name (case-insensitive)
    const organization = await this.prisma.organization.findFirst({
      where: { 
        name: {
          equals: signupDto.organizationName,
          mode: 'insensitive' as any,
        }
      },
    });

    if (!organization) {
      throw new UnauthorizedException('ארגון לא נמצא. אנא בדוק את שם הארגון ונסה שוב.');
    }

    const passwordHash = await bcrypt.hash(signupDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: signupDto.email,
        passwordHash,
        firstName: signupDto.firstName,
        lastName: signupDto.lastName,
        role: 'EMPLOYEE' as any,
        employmentType: 'FULL_TIME' as any,
        organizationId: organization.id,
        isApproved: false, // Requires admin approval
      },
    });

    // Notify all admins of the new signup request
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId: organization.id,
        role: 'ADMIN',
        isActive: true,
      },
    });

    // Create notifications for all admins
    await Promise.all(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'בקשת הרשמה חדשה',
            message: `${signupDto.firstName} ${signupDto.lastName} ביקש להצטרף לארגון`,
            type: 'RULE_VIOLATION' as any, // Using RULE_VIOLATION as general notification type
          },
        })
      )
    );

    return {
      message: 'בקשת ההרשמה נשלחה בהצלחה. ממתין לאישור מנהל.',
      userId: user.id,
    };
  }

  async register(registerDto: RegisterDto & { jobCategoryId?: string; hourlyWage?: number }, creatorId: string) {
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!creator || (creator.role !== 'ADMIN' && creator.role !== 'MANAGER')) {
      throw new UnauthorizedException('אין לך הרשאה ליצור משתמשים');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('כתובת האימייל כבר קיימת במערכת');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: registerDto.role as any,
        employmentType: registerDto.employmentType as any,
        organizationId: creator.organizationId,
        jobCategoryId: registerDto.jobCategoryId,
        hourlyWage: registerDto.hourlyWage || 0,
        isApproved: true, // Created by admin/manager = auto-approved
      },
      include: { organization: true, jobCategory: true },
    });

    return {
      message: 'המשתמש נוצר בהצלחה',
      user: this.sanitizeUser(user),
    };
  }

  async refreshTokens(refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('טוקן לא תקין או פג תוקף');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('משתמש לא נמצא או לא פעיל');
    }

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    const tokens = await this.generateTokens(user, false);
    await this.saveRefreshToken(user.id, tokens.refreshToken, false);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return { message: 'התנתקת בהצלחה' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, jobCategory: true },
    });

    if (!user) {
      throw new UnauthorizedException('משתמש לא נמצא');
    }

    return this.sanitizeUser(user);
  }

  async getOrganizations() {
    // Return list of organizations for signup form
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      },
    });
  }

  async getOrganizationJobCategories(organizationId: string) {
    return this.prisma.jobCategory.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        nameHe: true,
      },
    });
  }

  private async generateTokens(user: any, rememberMe?: boolean) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = this.jwtService.sign(payload);
    
    const refreshTokenExpiry = rememberMe ? '30d' : '7d';
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTokenExpiry,
    });

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string, rememberMe?: boolean) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

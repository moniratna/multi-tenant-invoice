import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import { users } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      tenantId: user.tenantId,
      isSuperAdmin: user.isSuperAdmin === 1,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        isSuperAdmin: user.isSuperAdmin === 1,
      },
    };
  }

  async register(
    email: string,
    password: string,
    tenantId?: string,
    isSuperAdmin: boolean = false,
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await this.databaseService.db
      .insert(users)
      .values({
        email,
        passwordHash: hashedPassword,
        tenantId,
        isSuperAdmin: isSuperAdmin ? 1 : 0,
      })
      .returning();

    const { passwordHash, ...result } = user;
    return result;
  }
}

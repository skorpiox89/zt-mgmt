import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../common/crypto/password';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { HiddenNetworkDto } from './dto/update-hidden-networks.dto';
import type { AuthSessionUser, HiddenNetworkItem, PublicUser } from './users.types';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.ensureDefaultAdmin();
  }

  async listUsers() {
    const items = await this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
      select: {
        _count: {
          select: {
            hiddenNetworks: true,
          },
        },
        createdAt: true,
        id: true,
        role: true,
        username: true,
      },
    });

    return items.map((item) => ({
      createdAt: item.createdAt,
      hiddenNetworkCount: item._count.hiddenNetworks,
      id: item.id,
      role: item.role,
      username: item.username,
    }));
  }

  async createUser(dto: CreateUserDto) {
    const username = dto.username.trim();
    if (!username) {
      throw new BadRequestException('用户名不能为空');
    }

    const existingUser = await this.prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        username,
      },
    });
    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    const createdUser = await this.prisma.user.create({
      data: {
        passwordHash: await hashPassword(dto.password),
        role: UserRole.USER,
        username,
      },
      select: {
        createdAt: true,
        id: true,
        role: true,
        username: true,
      },
    });

    return {
      ...createdUser,
      hiddenNetworkCount: 0,
    } satisfies PublicUser;
  }

  async validateCredentials(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
        passwordHash: true,
        role: true,
        updatedAt: true,
        username: true,
      },
      where: {
        username,
      },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return this.toSessionUser(user);
  }

  async findSessionUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
        role: true,
        updatedAt: true,
        username: true,
      },
      where: {
        id,
      },
    });

    if (!user) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    return this.toSessionUser(user);
  }

  toAuthenticatedUser(user: Pick<AuthSessionUser, 'id' | 'role' | 'username'>): AuthenticatedUser {
    return {
      id: user.id,
      role: user.role,
      username: user.username,
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
        passwordHash: true,
        role: true,
        updatedAt: true,
        username: true,
      },
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (!(await verifyPassword(oldPassword, user.passwordHash))) {
      throw new UnauthorizedException('原密码错误');
    }

    const updatedUser = await this.prisma.user.update({
      data: {
        passwordHash: await hashPassword(newPassword),
      },
      select: {
        id: true,
        role: true,
        updatedAt: true,
        username: true,
      },
      where: {
        id: userId,
      },
    });

    return this.toSessionUser(updatedUser);
  }

  async resetPassword(operatorId: number, userId: number, newPassword: string) {
    if (operatorId === userId) {
      throw new ConflictException('当前账号请使用修改密码功能');
    }

    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
        role: true,
      },
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ConflictException('管理员密码请通过个人修改密码功能更新');
    }

    await this.prisma.user.update({
      data: {
        passwordHash: await hashPassword(newPassword),
      },
      where: {
        id: userId,
      },
    });

    return {
      success: true,
    };
  }

  async getCurrentUserHiddenNetworks(userId: number) {
    const currentUser = await this.findSessionUserById(userId);
    if (currentUser.role === UserRole.ADMIN) {
      return [];
    }

    return this.listHiddenNetworks(userId);
  }

  async getHiddenNetworks(userId: number) {
    await this.ensureNonAdminUser(userId);
    return this.listHiddenNetworks(userId);
  }

  async updateHiddenNetworks(userId: number, items: HiddenNetworkDto[]) {
    await this.ensureNonAdminUser(userId);

    const normalizedItems = this.normalizeHiddenNetworks(items);
    const operations = [
      this.prisma.userHiddenNetwork.deleteMany({
        where: {
          userId,
        },
      }),
    ];

    if (normalizedItems.length > 0) {
      operations.push(
        this.prisma.userHiddenNetwork.createMany({
          data: normalizedItems.map((item) => ({
            controllerId: item.controllerId,
            networkId: item.networkId,
            userId,
          })),
        }),
      );
    }

    await this.prisma.$transaction(operations);

    return normalizedItems;
  }

  private async ensureDefaultAdmin() {
    const adminUser = await this.prisma.user.findFirst({
      select: {
        id: true,
      },
      where: {
        role: UserRole.ADMIN,
      },
    });
    if (adminUser) {
      return;
    }

    const namedAdminUser = await this.prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        username: 'admin',
      },
    });

    if (namedAdminUser) {
      await this.prisma.user.update({
        data: {
          role: UserRole.ADMIN,
        },
        where: {
          id: namedAdminUser.id,
        },
      });
      return;
    }

    await this.prisma.user.create({
      data: {
        passwordHash: await hashPassword('admin'),
        role: UserRole.ADMIN,
        username: 'admin',
      },
    });
  }

  private async ensureNonAdminUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
        role: true,
      },
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ConflictException('管理员不支持隐藏网络配置');
    }

    return user;
  }

  private async listHiddenNetworks(userId: number) {
    const items = await this.prisma.userHiddenNetwork.findMany({
      orderBy: [{ controllerId: 'asc' }, { networkId: 'asc' }],
      select: {
        controllerId: true,
        networkId: true,
      },
      where: {
        userId,
      },
    });

    return items;
  }

  private normalizeHiddenNetworks(items: HiddenNetworkItem[]) {
    const deduped = new Map<string, HiddenNetworkItem>();
    for (const item of items) {
      const networkId = item.networkId.trim();
      if (!networkId) {
        continue;
      }

      const key = `${item.controllerId}:${networkId}`;
      deduped.set(key, {
        controllerId: item.controllerId,
        networkId,
      });
    }

    return Array.from(deduped.values()).sort((left, right) => {
      if (left.controllerId !== right.controllerId) {
        return left.controllerId - right.controllerId;
      }

      return left.networkId.localeCompare(right.networkId);
    });
  }

  private toSessionUser(
    user: Pick<AuthSessionUser, 'id' | 'role' | 'updatedAt' | 'username'>,
  ): AuthSessionUser {
    return {
      id: user.id,
      role: user.role,
      updatedAt: user.updatedAt,
      username: user.username,
    };
  }
}

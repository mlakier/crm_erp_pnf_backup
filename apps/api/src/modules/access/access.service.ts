import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { CreatePermissionDto } from "./dto/create-permission.dto.js";
import { CreateRoleDto } from "./dto/create-role.dto.js";

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        userRoles: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        code: "asc"
      }
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: {
        code: "asc"
      }
    });
  }

  async createPermission(input: CreatePermissionDto) {
    return this.prisma.permission.create({
      data: {
        code: input.code,
        name: input.name
      }
    });
  }

  async createRole(input: CreateRoleDto) {
    const permissions = input.permissionCodes?.length
      ? await this.prisma.permission.findMany({
          where: {
            code: {
              in: input.permissionCodes
            }
          }
        })
      : [];

    return this.prisma.role.create({
      data: {
        code: input.code,
        name: input.name,
        permissions: permissions.length
          ? {
              create: permissions.map((permission) => ({
                permissionId: permission.id
              }))
            }
          : undefined
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  async assignPermissions(roleId: string, permissionCodes: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role ${roleId} was not found.`);
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        code: {
          in: permissionCodes
        }
      }
    });

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });

    await this.prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId,
        permissionId: permission.id
      })),
      skipDuplicates: true
    });

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }
}

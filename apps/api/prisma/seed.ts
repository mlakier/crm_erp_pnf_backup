import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const permissions = [
    { code: "users.read", name: "Read users" },
    { code: "users.write", name: "Create and update users" },
    { code: "roles.read", name: "Read roles" },
    { code: "roles.write", name: "Create and update roles" },
    { code: "platform.admin", name: "Platform administration" }
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name },
      create: permission
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { code: "platform-admin" },
    update: { name: "Platform Admin" },
    create: { code: "platform-admin", name: "Platform Admin" }
  });

  const financeRole = await prisma.role.upsert({
    where: { code: "finance-manager" },
    update: { name: "Finance Manager" },
    create: { code: "finance-manager", name: "Finance Manager" }
  });

  const allPermissions = await prisma.permission.findMany();

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: {
        in: [adminRole.id, financeRole.id]
      }
    }
  });

  await prisma.rolePermission.createMany({
    data: [
      ...allPermissions.map((permission) => ({
        roleId: adminRole.id,
        permissionId: permission.id
      })),
      ...allPermissions
        .filter((permission) => ["users.read", "roles.read"].includes(permission.code))
        .map((permission) => ({
          roleId: financeRole.id,
          permissionId: permission.id
        }))
    ],
    skipDuplicates: true
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@crm-erp-pnf.local" },
    update: { firstName: "System", lastName: "Admin" },
    create: {
      email: "admin@crm-erp-pnf.local",
      firstName: "System",
      lastName: "Admin"
    }
  });

  await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: adminRole.id
    }
  });

  console.log("Seeded access control baseline.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

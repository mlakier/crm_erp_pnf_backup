import { Module } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { AccessController } from "./access.controller.js";
import { AccessService } from "./access.service.js";

@Module({
  controllers: [AccessController],
  providers: [AccessService, PrismaService],
  exports: [AccessService]
})
export class AccessModule {}

import { Controller, Get } from "@nestjs/common";
import { APP_MODULES, SYSTEM_NAME } from "@crm-erp-pnf/domain";

@Controller("platform")
export class PlatformController {
  @Get("summary")
  getSummary() {
    return {
      name: SYSTEM_NAME,
      modules: APP_MODULES,
      status: "scaffold"
    };
  }
}

import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Health check" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  getHealth() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  @ApiResponse({ status: 200, description: "Service is alive" })
  getLiveness() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  @ApiResponse({ status: 200, description: "Service is ready" })
  getReadiness() {
    return { status: "ok" };
  }
}

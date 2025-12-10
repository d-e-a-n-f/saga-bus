import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

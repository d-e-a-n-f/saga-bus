import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { OrdersService, type OrderResponse } from "./orders.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: "Submit a new order" })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: "Order submitted successfully",
    schema: {
      type: "object",
      properties: {
        orderId: { type: "string", example: "order-abc-123" },
        message: { type: "string", example: "Order submitted successfully" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request body" })
  async createOrder(@Body() dto: CreateOrderDto): Promise<OrderResponse> {
    return this.ordersService.createOrder(dto);
  }
}

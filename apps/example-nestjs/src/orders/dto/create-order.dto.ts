import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

export class OrderItemDto {
  @ApiProperty({ example: "WIDGET-001", description: "Product SKU" })
  @IsString()
  sku!: string;

  @ApiProperty({ example: 2, description: "Quantity to order" })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 29.99, description: "Price per unit" })
  @IsNumber()
  @Min(0)
  price!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: "customer-123", description: "Customer ID" })
  @IsString()
  customerId!: string;

  @ApiProperty({
    type: [OrderItemDto],
    description: "Order items",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

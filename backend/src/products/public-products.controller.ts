import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PublicProductQueryDto } from './dto/public-product-query.dto.js';
import { PublicProductsService } from './public-products.service.js';

@ApiTags('Public Products')
@Controller('products')
export class PublicProductsController {
  constructor(private readonly publicProductsService: PublicProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List published products' })
  list(@Query() query: PublicProductQueryDto) {
    return this.publicProductsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a published product' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.publicProductsService.getById(id);
  }
}

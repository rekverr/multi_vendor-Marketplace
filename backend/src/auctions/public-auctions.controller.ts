import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuctionsService } from './auctions.service.js';

@ApiTags('auctions')
@Controller('auctions')
export class PublicAuctionsController {
  constructor(private readonly auctions: AuctionsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Read public Auction detail and recent bid history',
  })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.auctions.getPublic(id);
  }
}

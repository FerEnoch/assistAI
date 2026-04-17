import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/guards';
import { TemplateService } from './template.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';

function getWorkspaceId(req: Request): string {
  const wsId = req.session?.workspaceId;
  if (!wsId) throw new BadRequestException('No workspace in session');
  return wsId;
}

@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  @UseGuards(SessionGuard)
  async findAll(@Req() req: Request) {
    return this.templateService.findAll(getWorkspaceId(req));
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.templateService.findOne(id, getWorkspaceId(req));
  }

  @Post()
  @UseGuards(SessionGuard)
  async create(@Body() dto: CreateTemplateDto, @Req() req: Request) {
    return this.templateService.create(getWorkspaceId(req), dto);
  }

  @Put(':id')
  @UseGuards(SessionGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: Request,
  ) {
    return this.templateService.update(id, getWorkspaceId(req), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    await this.templateService.remove(id, getWorkspaceId(req));
  }
}

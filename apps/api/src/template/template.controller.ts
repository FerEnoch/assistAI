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
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SessionGuard } from '../auth/guards';
import { TemplateService } from './template.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  AddTemplateDocumentDto,
  CreateTemplateFromDriveDto,
  CreateTemplateFromUploadDto,
} from './dto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_UPLOAD_SIZE_MB = 20;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

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

  /* ─── Corpus endpoints ─── */

  @Get(':id/documents')
  @UseGuards(SessionGuard)
  async getDocuments(@Param('id') id: string, @Req() req: Request) {
    return this.templateService.getTemplateDocuments(id, getWorkspaceId(req));
  }

  @Post(':id/documents')
  @HttpCode(201)
  @UseGuards(SessionGuard)
  async addDocument(
    @Param('id') id: string,
    @Body() dto: AddTemplateDocumentDto,
    @Req() req: Request,
  ) {
    await this.templateService.addDocumentToTemplate(
      id,
      dto.documentId,
      getWorkspaceId(req),
    );
    return { ok: true };
  }

  @Delete(':id/documents/:docId')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async removeDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    await this.templateService.removeDocumentFromTemplate(
      id,
      docId,
      getWorkspaceId(req),
    );
  }

  /* ─── Create from local upload ─── */

  @Post('from-upload')
  @UseGuards(SessionGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined, // use memory storage (buffer)
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    }),
  )
  async createFromUpload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateTemplateFromUploadDto,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('El campo "file" es requerido');

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `El archivo supera el límite de ${MAX_UPLOAD_SIZE_MB}MB`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Formato no soportado. Usá PDF, DOCX o TXT',
      );
    }

    return this.templateService.createFromUpload(
      getWorkspaceId(req),
      dto,
      file,
    );
  }

  /* ─── Create from Drive ─── */

  @Post('from-drive')
  @UseGuards(SessionGuard)
  async createFromDrive(
    @Body() dto: CreateTemplateFromDriveDto,
    @Req() req: Request,
  ) {
    return this.templateService.createFromDrive(getWorkspaceId(req), dto);
  }
}

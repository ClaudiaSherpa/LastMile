import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as path from 'path';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import { Document } from '../database/entities';
import { StorageService } from '../storage/storage.service';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};
const mimeFor = (ref: string) => MIME[path.extname(ref).toLowerCase()] ?? 'application/octet-stream';

/**
 * Serves the raw file behind a submitted Document so Ops staff can review it.
 * Role-gated to admin/dispatcher/security — the same roles that review applications.
 */
@Controller('documents')
export class DocumentsController {
  constructor(
    @InjectRepository(Document) private readonly documents: Repository<Document>,
    private readonly storage: StorageService,
  ) {}

  @Get(':id/file')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  async file(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.documents.findOne({ where: { id } });
    if (!doc || !doc.fileRef) throw new NotFoundException('Document file not found');
    let buffer: Buffer;
    try {
      buffer = this.storage.read(doc.fileRef);
    } catch {
      throw new NotFoundException('File missing from storage');
    }
    res.setHeader('Content-Type', mimeFor(doc.fileRef));
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(doc.fileRef)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}

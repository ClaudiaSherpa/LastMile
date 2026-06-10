import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { env } from '../config/env';

export interface StoredFile {
  fileRef: string;
  mimeType: string;
  size: number;
}

/**
 * File storage behind a single interface. Default driver is local disk so the
 * platform runs with no cloud account; swap STORAGE_DRIVER to add S3 later.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage');
  private readonly root = path.resolve(env.storage.localDir);

  constructor() {
    fs.mkdirSync(this.root, { recursive: true });
  }

  async save(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    const ext = path.extname(originalName) || '.bin';
    const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${ext}`;
    const dest = path.join(this.root, key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, buffer);
    this.logger.log(`stored ${key} (${buffer.length} bytes)`);
    return { fileRef: key, mimeType, size: buffer.length };
  }

  read(fileRef: string): Buffer {
    return fs.readFileSync(path.join(this.root, fileRef));
  }
}

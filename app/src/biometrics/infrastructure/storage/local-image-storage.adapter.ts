import fs from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { ImageStoragePort } from '../../application/ports/image-storage.port';

@Injectable()
export class LocalImageStorageAdapter implements ImageStoragePort {
  private readonly baseDir = path.join(process.cwd(), 'media');

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const targetPath = path.join(this.baseDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, buffer);
    return `media/${relativePath.replace(/\\/g, '/')}`;
  }

  async delete(storedPath: string): Promise<void> {
    const targetPath = path.join(process.cwd(), storedPath);
    await fs.rm(targetPath, { force: true });
  }

  getUrl(storedPath: string): Promise<string> {
    return Promise.resolve(`/${storedPath.replace(/^\/+/, '')}`);
  }
}

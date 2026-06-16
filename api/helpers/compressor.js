import fs from 'fs';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';

/**
 * Compresses one source file into a gzip target file.
 */
export async function gzipFile(sourcePath, targetPath) {
    await pipeline(
        fs.createReadStream(sourcePath),
        zlib.createGzip(),
        fs.createWriteStream(targetPath),
    );

    return targetPath;
}

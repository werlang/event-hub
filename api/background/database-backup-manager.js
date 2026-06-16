import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import { Mysql } from '../helpers/mysql.js';
import { gzipFile } from '../helpers/compressor.js';
import { CloudStorage } from '../helpers/cloud-storage.js';
import config from '../config/database-backup.config.js';

/**
 * Formats a date for stable backup object names.
 */
function formatBackupTimestamp(date) {
    return date
        .toISOString()
        .replace(/[:]/g, '-')
        .replace('T', '_')
        .split('.')[0];
}

/**
 * Removes one temporary file and ignores missing-file cleanup races.
 */
async function unlinkIfPresent(fileSystem, filePath) {
    if (!filePath) {
        return;
    }

    try {
        await fileSystem.unlink(filePath);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
}

/**
 * Builds and uploads compressed MySQL database backups.
 */
export class DatabaseBackupManager {

    #config;
    #mysql;
    #compress;
    #storageFactory;
    #fileSystem;
    #fileChecks;
    #tempDir;
    #now;
    #logger;

    /**
     * Creates one backup manager with injectable side effects for tests.
     */
    constructor({
        backupConfig = config,
        mysql = Mysql,
        compress = gzipFile,
        storageFactory = options => new CloudStorage(options),
        fileSystem = fsPromises,
        fileChecks = fs,
        tempDir = os.tmpdir,
        now = () => new Date(),
        logger = console,
    } = {}) {
        this.#config = backupConfig;
        this.#mysql = mysql;
        this.#compress = compress;
        this.#storageFactory = storageFactory;
        this.#fileSystem = fileSystem;
        this.#fileChecks = fileChecks;
        this.#tempDir = tempDir;
        this.#now = now;
        this.#logger = logger;
    }

    /**
     * Validates the cloud backup settings needed before creating a dump.
     */
    #validateConfig() {
        const missingFields = [
            ['DATABASE_BACKUP_GCLOUD_PROJECT_ID', this.#config.projectId],
            ['DATABASE_BACKUP_GCLOUD_BUCKET', this.#config.bucket],
            ['DATABASE_BACKUP_GCLOUD_ACCOUNT_FILE', this.#config.accountFile],
        ]
            .filter(([, value]) => !String(value || '').trim())
            .map(([name]) => name);

        if (missingFields.length > 0) {
            throw new Error(`Database backup is missing required configuration: ${missingFields.join(', ')}`);
        }

        this.#config.credentialsPath = path.resolve(process.cwd(), 'config', this.#config.accountFile);
        if (!this.#fileChecks.existsSync(this.#config.credentialsPath)) {
            throw new Error(`Database backup credentials file not found at ${this.#config.credentialsPath}`);
        }
    }

    /**
     * Runs one database backup and uploads the compressed result to GCS.
     */
    async run({ referenceDate = this.#now() } = {}) {
        if (!this.#config.enabled) {
            this.#logger.info('Database backup is disabled, skipping execution.');
            return {
                skipped: true,
                reason: 'disabled',
            };
        }

        this.#logger.info('Starting database backup process.');

        this.#validateConfig();

        this.#logger.info('Creating database dump.');
        const timestamp = formatBackupTimestamp(referenceDate);
        const dumpFileName = `event_hub_backup_${timestamp}.sql`;
        const fileName = `${dumpFileName}.gz`;
        const tempDirectory = this.#tempDir();
        const dumpPath = path.join(tempDirectory, dumpFileName);
        const compressedPath = path.join(tempDirectory, fileName);

        this.#logger.info('Dump created, now compressing.');
        try {
            await this.#mysql.dump(dumpPath);
            await this.#compress(dumpPath, compressedPath);

            const storage = this.#storageFactory({
                projectId: this.#config.projectId,
                keyFilename: this.#config.credentialsPath,
            });
            this.#logger.info('Compressed, now uploading to cloud storage.');
            const mediaLink = await storage.upload({
                srcFilePath: compressedPath,
                bucket: this.#config.bucket,
                storageDir: this.#config.storageDir,
                fileName,
            });
            this.#logger.info('Upload complete.');

            return {
                skipped: false,
                fileName,
                mediaLink,
            };
        } finally {
            await unlinkIfPresent(this.#fileSystem, dumpPath);
            await unlinkIfPresent(this.#fileSystem, compressedPath);
        }
    }
}

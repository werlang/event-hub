import { Storage } from '@google-cloud/storage';

/**
 * Uploads files to Google Cloud Storage.
 */
export class CloudStorage {

    #storage;

    /**
     * Creates one Google Cloud Storage helper.
     */
    constructor({ projectId, keyFilename, storageClient } = {}) {
        this.#storage = storageClient || new Storage({ projectId, keyFilename });
    }

    /**
     * Uploads one local file to the configured bucket and storage directory.
     */
    async upload({ srcFilePath, bucket, storageDir = '', fileName }) {
        const destination = [storageDir, fileName]
            .map(value => String(value || '').trim().replace(/^\/+|\/+$/g, ''))
            .filter(Boolean)
            .join('/');

        const [file] = await this.#storage.bucket(bucket).upload(srcFilePath, {
            destination,
        });

        return file?.metadata?.mediaLink || null;
    }
}

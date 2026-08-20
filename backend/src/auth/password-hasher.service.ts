import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await this.deriveKey(password, salt);

    return [
      'scrypt',
      SCRYPT_COST,
      SCRYPT_BLOCK_SIZE,
      SCRYPT_PARALLELIZATION,
      salt.toString('base64url'),
      derivedKey.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, salt, hash] =
      encodedHash.split('$');

    if (
      algorithm !== 'scrypt' ||
      Number(cost) !== SCRYPT_COST ||
      Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
      Number(parallelization) !== SCRYPT_PARALLELIZATION ||
      !salt ||
      !hash
    ) {
      return false;
    }

    try {
      const expectedHash = Buffer.from(hash, 'base64url');
      const actualHash = await this.deriveKey(
        password,
        Buffer.from(salt, 'base64url'),
      );

      return (
        expectedHash.length === actualHash.length &&
        timingSafeEqual(expectedHash, actualHash)
      );
    } catch {
      return false;
    }
  }

  private deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        KEY_LENGTH,
        {
          N: SCRYPT_COST,
          r: SCRYPT_BLOCK_SIZE,
          p: SCRYPT_PARALLELIZATION,
          maxmem: SCRYPT_MAX_MEMORY,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(derivedKey);
        },
      );
    });
  }
}

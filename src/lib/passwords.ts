import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scryptAsync = promisify(scrypt);
const keyLength = 64;
const bcryptCost = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, bcryptCost);
}

async function verifyScryptPassword(password: string, passwordHash: string): Promise<boolean> {
  const [, storedSalt, storedKey] = passwordHash.split(":");

  if (!storedSalt || !storedKey) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, storedSalt, keyLength)) as Buffer;
  const storedBuffer = Buffer.from(storedKey, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (passwordHash.startsWith("scrypt:")) {
    return verifyScryptPassword(password, passwordHash);
  }

  return bcrypt.compare(password, passwordHash);
}

import { hash, compare } from "bcryptjs";

export async function hashPassword(plain: string) {
  return hash(plain, 10);
}

export async function verifyPassword(plain: string, hashValue: string) {
  return compare(plain, hashValue);
}

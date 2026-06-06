import { AsyncLocalStorage } from "node:async_hooks";

import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

export type StorageContext = {
  ownerUserId: string;
};

const storageContext = new AsyncLocalStorage<StorageContext>();

export function getStorageOwnerUserId() {
  return storageContext.getStore()?.ownerUserId;
}

export function runWithStorageOwner<T>(ownerUserId: string, fn: () => Promise<T>) {
  return storageContext.run({ ownerUserId: toDatabaseOwnerUserId(ownerUserId) }, fn);
}

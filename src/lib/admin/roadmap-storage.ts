import type { DocumentData } from "firebase-admin/firestore";

import { roadmapSeedAsInputs } from "@/lib/admin/roadmap-seed";
import {
  isRoadmapSection,
  isRoadmapStatus,
  isRoadmapValidated,
  type RoadmapTask,
  type RoadmapTaskInput,
} from "@/lib/admin/roadmap-types";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

function nowIso() {
  return new Date().toISOString();
}

function mapDoc(id: string, data: DocumentData | undefined): RoadmapTask | null {
  if (!data) {
    return null;
  }

  const status = isRoadmapStatus(data.status) ? data.status : "todo";
  const validatedByThiago = isRoadmapValidated(data.validatedByThiago)
    ? data.validatedByThiago
    : "pendente";
  const section = isRoadmapSection(data.section) ? data.section : "sistema-agora";

  return {
    id,
    title: String(data.title ?? "").trim() || "Sem título",
    status,
    validatedByThiago,
    observation: String(data.observation ?? ""),
    section,
    sortOrder: Number(data.sortOrder ?? 0),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

export async function listRoadmapTasks(): Promise<RoadmapTask[]> {
  const snap = await col(COLLECTIONS.adminRoadmapTasks).orderBy("sortOrder", "asc").get();
  const tasks = snap.docs
    .map((doc) => mapDoc(doc.id, doc.data()))
    .filter((task): task is RoadmapTask => Boolean(task));

  if (tasks.length === 0) {
    return seedRoadmapTasks();
  }

  return tasks;
}

export async function seedRoadmapTasks(): Promise<RoadmapTask[]> {
  const seed = roadmapSeedAsInputs();
  const createdAt = nowIso();
  const batch = col(COLLECTIONS.adminRoadmapTasks).firestore.batch();
  const tasks: RoadmapTask[] = [];

  for (const row of seed) {
    const ref = col(COLLECTIONS.adminRoadmapTasks).doc();
    const task: RoadmapTask = {
      id: ref.id,
      title: row.title,
      status: row.status ?? "todo",
      validatedByThiago: row.validatedByThiago ?? "pendente",
      observation: row.observation ?? "",
      section: row.section ?? "sistema-agora",
      sortOrder: row.sortOrder ?? 0,
      createdAt,
      updatedAt: createdAt,
    };
    batch.set(ref, {
      title: task.title,
      status: task.status,
      validatedByThiago: task.validatedByThiago,
      observation: task.observation,
      section: task.section,
      sortOrder: task.sortOrder,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
    tasks.push(task);
  }

  await batch.commit();
  return tasks;
}

export async function createRoadmapTask(input: RoadmapTaskInput): Promise<RoadmapTask> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Título obrigatório.");
  }

  const existing = await col(COLLECTIONS.adminRoadmapTasks).orderBy("sortOrder", "desc").limit(1).get();
  const maxSort = existing.empty ? 0 : Number(existing.docs[0]?.data()?.sortOrder ?? 0);
  const now = nowIso();
  const ref = col(COLLECTIONS.adminRoadmapTasks).doc();

  const task: RoadmapTask = {
    id: ref.id,
    title,
    status: input.status && isRoadmapStatus(input.status) ? input.status : "todo",
    validatedByThiago:
      input.validatedByThiago && isRoadmapValidated(input.validatedByThiago)
        ? input.validatedByThiago
        : "pendente",
    observation: (input.observation ?? "").trim(),
    section:
      input.section && isRoadmapSection(input.section) ? input.section : "sistema-agora",
    sortOrder: input.sortOrder ?? maxSort + 1,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set({
    title: task.title,
    status: task.status,
    validatedByThiago: task.validatedByThiago,
    observation: task.observation,
    section: task.section,
    sortOrder: task.sortOrder,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  });

  return task;
}

export async function updateRoadmapTask(
  id: string,
  patch: Partial<RoadmapTaskInput>,
): Promise<RoadmapTask> {
  const ref = col(COLLECTIONS.adminRoadmapTasks).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Task não encontrada.");
  }

  const current = mapDoc(id, snap.data());
  if (!current) {
    throw new Error("Task inválida.");
  }

  const next: RoadmapTask = {
    ...current,
    title: patch.title !== undefined ? patch.title.trim() || current.title : current.title,
    status:
      patch.status !== undefined && isRoadmapStatus(patch.status) ? patch.status : current.status,
    validatedByThiago:
      patch.validatedByThiago !== undefined && isRoadmapValidated(patch.validatedByThiago)
        ? patch.validatedByThiago
        : current.validatedByThiago,
    observation:
      patch.observation !== undefined ? patch.observation.trim() : current.observation,
    section:
      patch.section !== undefined && isRoadmapSection(patch.section)
        ? patch.section
        : current.section,
    sortOrder:
      patch.sortOrder !== undefined ? Number(patch.sortOrder) : current.sortOrder,
    updatedAt: nowIso(),
  };

  await ref.set(
    {
      title: next.title,
      status: next.status,
      validatedByThiago: next.validatedByThiago,
      observation: next.observation,
      section: next.section,
      sortOrder: next.sortOrder,
      updatedAt: next.updatedAt,
    },
    { merge: true },
  );

  return next;
}

export async function deleteRoadmapTask(id: string): Promise<void> {
  const ref = col(COLLECTIONS.adminRoadmapTasks).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Task não encontrada.");
  }
  await ref.delete();
}

export async function countRoadmapByStatus(): Promise<Record<string, number>> {
  const tasks = await listRoadmapTasks();
  const counts = { todo: 0, inprogress: 0, done: 0, total: tasks.length };
  for (const task of tasks) {
    counts[task.status] += 1;
  }
  return counts;
}

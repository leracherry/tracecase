export type Row = {
  kind: "step" | "event" | "visual" | "network" | "screenshot";
  value: unknown;
};
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tracecase-capture", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("rows", { autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function clearRows() {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("rows", "readwrite");
    tx.objectStore("rows").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}
export async function appendRows(rows: Row[]) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("rows", "readwrite");
    for (const row of rows) tx.objectStore("rows").add(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}
export async function getRows(): Promise<Row[]> {
  const database = await db();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction("rows").objectStore("rows").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

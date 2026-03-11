/**
 * Platform abstraction for file system operations.
 * Electron implementation lives in src/main/platform/.
 */
export interface IFileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, data: string): Promise<void>
  writeFileAtomic(path: string, data: string): Promise<void> // temp file + rename for safety
  exists(path: string): Promise<boolean>
  mkdir(path: string, recursive?: boolean): Promise<void>
  readDir(path: string): Promise<string[]>
  remove(path: string): Promise<void>
  copyFile(src: string, dest: string): Promise<void>
  saveAttachment(taskId: string, fileName: string, data: ArrayBuffer): Promise<string>
}

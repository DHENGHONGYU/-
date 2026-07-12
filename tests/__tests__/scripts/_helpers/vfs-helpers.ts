import * as path from 'node:path'

export type VirtualFile = {
  path: string
  content: string
}

export type VirtualDirectory = {
  path: string
  files: string[]
}

let fileContents = new Map<string, string>()
let dirMap = new Map<string, Set<string>>()

export function setupVirtualFS(files: VirtualFile[]): void {
  fileContents.clear()
  dirMap.clear()

  const srcDir = path.resolve(__dirname, '../../../../src').replace(/\\/g, '/')

  for (const { path: relPath, content } of files) {
    const fullPath = path.join(srcDir, relPath).replace(/\\/g, '/')
    fileContents.set(fullPath, content)

    const parts = fullPath.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/')
      const entry = parts[i]!
      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, new Set())
      }
      dirMap.get(dirPath)!.add(entry)
    }
  }
}

export function setupVirtualDirectory(dir: VirtualDirectory): void {
  const srcDir = path.resolve(__dirname, '../../../../src').replace(/\\/g, '/')
  const fullPath = path.join(srcDir, dir.path).replace(/\\/g, '/')

  if (!dirMap.has(fullPath)) {
    dirMap.set(fullPath, new Set())
  }

  for (const file of dir.files) {
    dirMap.get(fullPath)!.add(file)
  }
}

export function clearVirtualFS(): void {
  fileContents.clear()
  dirMap.clear()
}

export function getVirtualFileContents(): Map<string, string> {
  return fileContents
}

export function getVirtualDirMap(): Map<string, Set<string>> {
  return dirMap
}

export function createFsMock() {
  return {
    readFileSync: (filePath: string) => {
      const key = String(filePath).replace(/\\/g, '/')
      if (fileContents.has(key)) {
        return fileContents.get(key)!
      }
      const err = new Error(`ENOENT: ${filePath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    },
    readdirSync: (dirPath: string, options?: { withFileTypes?: boolean }) => {
      const key = String(dirPath).replace(/\\/g, '/')
      if (dirMap.has(key)) {
        const entries = Array.from(dirMap.get(key)!)
        if (options?.withFileTypes) {
          return entries.map(name => ({
            isDirectory: () => !name.includes('.'),
            isFile: () => name.includes('.'),
            name,
          }))
        }
        return entries
      }
      const err = new Error(`ENOENT: ${dirPath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    },
    existsSync: (filePath: string) => {
      const key = String(filePath).replace(/\\/g, '/')
      return fileContents.has(key) || dirMap.has(key)
    },
    statSync: (filePath: string) => {
      const key = String(filePath).replace(/\\/g, '/')
      if (fileContents.has(key)) {
        return { isDirectory: () => false, isFile: () => true }
      }
      if (dirMap.has(key)) {
        return { isDirectory: () => true, isFile: () => false }
      }
      const err = new Error(`ENOENT: ${filePath}`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    },
    writeFileSync: () => {},
  }
}

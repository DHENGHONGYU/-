import { useState, useEffect } from 'react'
import { Shield, ShieldCheck, ShieldAlert, Lock, Key, Database, FileKey } from 'lucide-react'
import { createStorage } from '@/lib/localStorageManager'
import { COLOR_TOKENS, twText, twBg } from '@/constants/theme.tokens'

export interface SecurityStatusProps {
  className?: string
}

interface SecurityInfo {
  encryptedStorage: boolean
  cryptoAvailable: boolean
  storageMethod: 'localStorage' | 'indexedDB' | 'memory'
  encryptionType: string
}

export function SecurityStatus({ className = '' }: SecurityStatusProps): React.JSX.Element {
  const [status, setStatus] = useState<SecurityInfo>({
    encryptedStorage: false,
    cryptoAvailable: false,
    storageMethod: 'memory',
    encryptionType: 'AES-GCM 256',
  })

  useEffect(() => {
    void checkSecurity()
  }, [])

  async function checkSecurity(): Promise<void> {
    const cryptoAvailable = typeof window !== 'undefined' && typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
    
    const storage = createStorage('security-test')
    try {
      await storage.setEncrypted('test-key', { test: 'data' })
      const result = await storage.getEncrypted('test-key')
      storage.remove('test-key')
      setStatus({
        encryptedStorage: result !== null,
        cryptoAvailable,
        storageMethod: 'localStorage',
        encryptionType: 'AES-GCM 256',
      })
    } catch {
      setStatus({
        encryptedStorage: false,
        cryptoAvailable,
        storageMethod: 'localStorage',
        encryptionType: 'AES-GCM 256',
      })
    }
  }

  const isSecure = status.cryptoAvailable && status.encryptedStorage

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${className}`}>
      {isSecure ? (
        <>
          <ShieldCheck className={`h-3.5 w-3.5 ${COLOR_TOKENS.emerald.tailwind}`} />
          <span className={twText('emerald', 600)}>本地加密存储</span>
          <Lock className={`h-3 w-3 ${twText('emerald', 400)}`} />
        </>
      ) : status.cryptoAvailable ? (
        <>
          <Shield className={`h-3.5 w-3.5 ${COLOR_TOKENS.warning.tailwind}`} />
          <span className={twText('amber', 600)}>加密可用</span>
        </>
      ) : (
        <>
          <ShieldAlert className={`h-3.5 w-3.5 ${COLOR_TOKENS.danger.tailwind}`} />
          <span className={twText('red', 600)}>加密不可用</span>
        </>
      )}
    </div>
  )
}

export interface SecurityBadgeProps {
  variant?: 'icon' | 'compact' | 'full'
}

export function SecurityBadge({ variant = 'icon' }: SecurityBadgeProps): React.JSX.Element {
  const [info, setInfo] = useState<SecurityInfo>({
    encryptedStorage: false,
    cryptoAvailable: false,
    storageMethod: 'memory',
    encryptionType: 'AES-GCM 256',
  })

  useEffect(() => {
    void checkSecurity()
  }, [])

  async function checkSecurity(): Promise<void> {
    const cryptoAvailable = typeof window !== 'undefined' && typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
    
    const storage = createStorage('badge-test')
    try {
      await storage.setEncrypted('badge-check', { ok: true })
      const result = await storage.getEncrypted('badge-check')
      storage.remove('badge-check')
      setInfo({
        encryptedStorage: result !== null,
        cryptoAvailable,
        storageMethod: 'localStorage',
        encryptionType: 'AES-GCM 256',
      })
    } catch {
      setInfo({
        encryptedStorage: false,
        cryptoAvailable,
        storageMethod: 'localStorage',
        encryptionType: 'AES-GCM 256',
      })
    }
  }

  const isSecure = info.cryptoAvailable && info.encryptedStorage

  const iconVariantClasses = isSecure
    ? `${twBg('emerald', 50)} ${twText('emerald', 600)}`
    : `${twBg('amber', 50)} ${twText('amber', 600)}`
  const compactVariantClasses = isSecure
    ? `${twBg('emerald', 50)} ${twText('emerald', 700)}`
    : `${twBg('amber', 50)} ${twText('amber', 700)}`

  if (variant === 'icon') {
    return (
      <div className={`p-1.5 rounded-lg transition-colors ${iconVariantClasses}`}>
        {isSecure ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${compactVariantClasses}`}>
        {isSecure ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
        <span>{isSecure ? '安全' : '检查中'}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/50 text-xs">
      <div className="flex items-center gap-2">
        {isSecure ? <ShieldCheck className={`h-4 w-4 ${COLOR_TOKENS.emerald.tailwind}`} /> : <ShieldAlert className={`h-4 w-4 ${COLOR_TOKENS.warning.tailwind}`} />}
        <span className="font-medium">{isSecure ? '本地数据已加密' : '加密状态检测中'}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
        <div className="flex items-center gap-1">
          <Key className="h-3 w-3" />
          <span>算法: {info.encryptionType}</span>
        </div>
        <div className="flex items-center gap-1">
          <Database className="h-3 w-3" />
          <span>存储: {info.storageMethod}</span>
        </div>
        <div className="flex items-center gap-1">
          <FileKey className="h-3 w-3" />
          <span>Web Crypto: {info.cryptoAvailable ? '可用' : '不可用'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          <span>加密存储: {info.encryptedStorage ? '启用' : '未启用'}</span>
        </div>
      </div>
    </div>
  )
}
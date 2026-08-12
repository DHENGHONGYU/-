/**
 * @doc [V9-DOC-PROJ-239]
 */
import { useState, useEffect } from 'react'

/**
 * useDebounce
 * @param value
 * @param delayMs
 * @returns T
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debouncedValue
}

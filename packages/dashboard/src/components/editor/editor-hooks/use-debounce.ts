import { useMemo, useRef } from "react"

type DebouncedFunction<T extends (...args: any[]) => void> = T & {
  cancel(): void
}

function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
  options: { maxWait?: number } = {}
): DebouncedFunction<T> {
  let timeoutId: NodeJS.Timeout | undefined
  let maxTimeoutId: NodeJS.Timeout | undefined
  let lastCallTime: number | undefined

  const debounced = function (this: any, ...args: Parameters<T>) {
    const currentTime = Date.now()
    
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    if (options.maxWait && !maxTimeoutId && lastCallTime) {
      maxTimeoutId = setTimeout(() => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        maxTimeoutId = undefined
        func.apply(this, args)
      }, options.maxWait)
    }
    
    lastCallTime = currentTime
    
    timeoutId = setTimeout(() => {
      if (maxTimeoutId) {
        clearTimeout(maxTimeoutId)
        maxTimeoutId = undefined
      }
      timeoutId = undefined
      func.apply(this, args)
    }, wait)
  }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId)
      maxTimeoutId = undefined
    }
    lastCallTime = undefined
  }
  
  return debounced as DebouncedFunction<T>
}

export function useDebounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
  maxWait?: number
) {
  const funcRef = useRef<T | null>(null)
  funcRef.current = fn

  return useMemo(
    () =>
      debounce(
        (...args: Parameters<T>) => {
          if (funcRef.current) {
            funcRef.current(...args)
          }
        },
        ms,
        { maxWait }
      ),
    [ms, maxWait]
  )
}

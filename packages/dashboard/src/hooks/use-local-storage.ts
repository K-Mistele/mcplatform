import { useEffect, useState } from 'react'

const isServer = typeof window === 'undefined'

export default function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, boolean] {
    // State to store our value
    // Pass initial state function to useState so logic is only executed once
    const [storedValue, setStoredValue] = useState(() => initialValue)
    // State to track if we've checked localStorage yet
    const [checked, setChecked] = useState(false)

    const initialize = () => {
        if (isServer) {
            return initialValue
        }
        try {
            // Get from local storage by key
            const item = window.localStorage.getItem(key)
            // Parse stored json or if none return initialValue
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            // If error also return initialValue
            console.log(error)
            return initialValue
        }
    }

    /* prevents hydration error so that state is only initialized after server is defined */
    useEffect(() => {
        if (!isServer) {
            setStoredValue(initialize())
            setChecked(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Return a wrapped version of useState's setter function that ...
    // ... persists the new value to localStorage.
    const setValue = (value: T | ((val: T) => T)) => {
        try {
            // Allow value to be a function so we have same API as useState
            const valueToStore = value instanceof Function ? value(storedValue) : value
            // Save state
            setStoredValue(valueToStore)
            // Save to local storage
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore))
            }
        } catch (error) {
            // A more advanced implementation would handle the error case
            console.log(error)
        }
    }
    return [storedValue, setValue, checked]
}

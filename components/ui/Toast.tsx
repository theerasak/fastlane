'use client'

import { useEffect, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id: number
  type: ToastType
  message: string
}

let toastIdCounter = 0
const listeners: Array<(msg: ToastMessage) => void> = []

export function showToast(message: string, type: ToastType = 'info') {
  const msg: ToastMessage = { id: ++toastIdCounter, type, message }
  listeners.forEach((fn) => fn(msg))
}

const typeClasses: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const listener = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id))
      }, 4000)
    }
    listeners.push(listener)
    return () => {
      const idx = listeners.indexOf(listener)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${typeClasses[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}

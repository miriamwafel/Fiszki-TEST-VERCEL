import { toast } from 'sonner'

/**
 * Hook do wyświetlania powiadomień toast
 *
 * Lokalizacja: lib/hooks/useToast.ts
 * Zależności: sonner
 * Logika: Wrapper na sonner z predefiniowanymi metodami
 * Gdzie użyte: Wszędzie gdzie potrzebne są powiadomienia (formularze, akcje CRUD)
 */
export function useToast() {
  return {
    success: (message: string, description?: string) => {
      toast.success(message, { description })
    },
    error: (message: string, description?: string) => {
      toast.error(message, { description })
    },
    info: (message: string, description?: string) => {
      toast.info(message, { description })
    },
    warning: (message: string, description?: string) => {
      toast.warning(message, { description })
    },
    loading: (message: string) => {
      return toast.loading(message)
    },
    dismiss: (toastId?: string | number) => {
      toast.dismiss(toastId)
    },
    promise: <T>(
      promise: Promise<T>,
      messages: {
        loading: string
        success: string
        error: string
      }
    ) => {
      return toast.promise(promise, messages)
    },
  }
}

// Eksport bezpośredni dla użycia bez hooka (w funkcjach nie-komponentach)
export { toast }

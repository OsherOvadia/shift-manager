'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { useThemeStore, applyTheme } from '@/lib/theme'

function ThemeInitializer() {
  const { theme } = useThemeStore();
  
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - keep data fresh longer
            gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache
            refetchOnWindowFocus: false, // Don't refetch on window focus
            refetchOnMount: false, // Don't refetch on component mount if data exists
            retry: 1, // Only retry failed requests once
            retryDelay: 1000, // Wait 1 second before retry
          },
          mutations: {
            retry: 1, // Only retry failed mutations once
            retryDelay: 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}

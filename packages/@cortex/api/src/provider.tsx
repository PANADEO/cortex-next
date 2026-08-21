"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { setForbiddenHandler } from "./client"
import { queryKeys } from "./query-keys"

interface ApiProviderProps {
  children: ReactNode
  devtools?: boolean
}

export function ApiProvider({ children, devtools = false }: ApiProviderProps) {
  const { t } = useTranslation("ui")
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  useEffect(() => {
    setForbiddenHandler(() => {
      client.invalidateQueries({ queryKey: queryKeys.user() })
      client.invalidateQueries({ queryKey: queryKeys.authorizedApps() })
      toast.error(t("api.forbidden"))
    })
    return () => setForbiddenHandler(null)
    // `t` w zależnościach: po zmianie języka handler musi zostać przerejestrowany,
    // inaczej toast 403 zostałby na języku sprzed przełączenia.
  }, [client, t])

  return (
    <QueryClientProvider client={client}>
      {children}
      {devtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}

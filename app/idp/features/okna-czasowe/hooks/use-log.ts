"use client"

import { useQuery } from "@tanstack/react-query"
import { endpoints, queryKeys } from "../queries"

export function useScanLog() {
  return useQuery({
    queryKey: queryKeys.log(),
    queryFn: endpoints.log.list,
  })
}

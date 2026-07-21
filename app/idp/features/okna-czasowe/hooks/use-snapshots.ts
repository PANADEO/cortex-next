"use client"

import { useQuery } from "@tanstack/react-query"
import { endpoints, queryKeys } from "../queries"

export function useSnapshots() {
  return useQuery({
    queryKey: queryKeys.snapshots(),
    queryFn: endpoints.data.snapshots,
  })
}

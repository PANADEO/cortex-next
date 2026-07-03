"use client"

import { useQuery } from "@tanstack/react-query"
import { coworkApi, coworkQueryKeys } from "../queries"

export function useCoworkSkillCatalog() {
  return useQuery({
    queryKey: coworkQueryKeys.catalog(),
    queryFn: coworkApi.listSkillCatalog,
    staleTime: 60_000,
  })
}

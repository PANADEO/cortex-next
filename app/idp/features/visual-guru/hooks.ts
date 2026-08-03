"use client"

import { useMutation } from "@tanstack/react-query"
import { endpoints } from "./queries"
import type { GenerateRequestDto } from "./types"

export function useGenerate() {
  return useMutation({ mutationFn: (body: GenerateRequestDto) => endpoints.generate(body) })
}

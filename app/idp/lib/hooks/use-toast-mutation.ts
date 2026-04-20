import { toastApiError } from "@cortex/api"
import type { UseMutationResult } from "@tanstack/react-query"
import { toast } from "sonner"

type AnyMutation = UseMutationResult<unknown, unknown, unknown, unknown>

export function wrapMutation<Vars>(
  mutation: Pick<UseMutationResult<unknown, unknown, Vars, unknown>, "mutateAsync">,
  successMessage: string,
): (vars: Vars) => Promise<void> {
  return async (vars) => {
    try {
      await mutation.mutateAsync(vars)
      toast.success(successMessage)
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }
}

export type { AnyMutation }

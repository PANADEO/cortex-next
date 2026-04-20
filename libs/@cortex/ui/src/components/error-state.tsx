import { cn } from "@cortex/utils"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { Button } from "./ui/button"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={cn("flex items-start gap-3", className)}>
      <AlertTriangle className="h-4 w-4" />
      <div className="flex-1 space-y-1">
        <AlertTitle>{title}</AlertTitle>
        {message ? <AlertDescription>{message}</AlertDescription> : null}
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            Retry
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}

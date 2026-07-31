export { Alert, AlertDescription, AlertTitle } from "./components/ui/alert"
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/ui/alert-dialog"
export { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar"
export { Badge, badgeVariants } from "./components/ui/badge"
export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb"
export { Button, buttonVariants } from "./components/ui/button"
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card"
export { Checkbox } from "./components/ui/checkbox"
export { ColorInput } from "./components/ui/color-input"
export { Combobox } from "./components/ui/combobox"
export type { ComboboxProps } from "./components/ui/combobox"
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog"
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu"
// IconPicker intentionally NOT reexported — its module has a top-level
// `import * as Icons from "lucide-react"` (whole catalog, needed for the
// picker's search grid). Reexporting it here would pull that catalog into
// EVERY page that imports anything from this barrel, regardless of whether
// the page uses IconPicker — defeating the `next/dynamic` code-split at the
// one call site that does (`aplikacje/[code]/page.tsx`). Confirmed by real
// `next build` measurement (31.07.2026): with this reexport present, First
// Load JS grew by ~183-187 kB on EVERY route in the app, not just the one
// that uses the picker. Same precedent as `DocumentViewer` below.
// Import via subpath: "@cortex/ui/components/ui/icon-picker" + next/dynamic.
export type { IconPickerProps } from "./components/ui/icon-picker"
export { Input } from "./components/ui/input"
export { Label } from "./components/ui/label"
export { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover"
export { RadioGroup, RadioGroupItem } from "./components/ui/radio-group"
export { ScrollArea, ScrollBar } from "./components/ui/scroll-area"
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select"
export { Separator } from "./components/ui/separator"
export { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./components/ui/sheet"
export { Skeleton } from "./components/ui/skeleton"
export { Slider } from "./components/ui/slider"
export { Switch } from "./components/ui/switch"
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
export { Textarea } from "./components/ui/textarea"
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip"

// Compositions
export {
  PackageStatusBadges,
  ProcessingStateBadge,
  VerificationStateBadge,
  getProcessingStateLabel,
  getVerificationStateLabel,
} from "./components/status-badge"
export { Pagination } from "./components/pagination"
export { DataCard } from "./components/data-card"
export { PageHeader } from "./components/page-header"
export { DataTable } from "./components/data-table"
export { EmptyState } from "./components/empty-state"
export { AppShell } from "./components/app-shell"
export { TileMenu } from "./components/tile-menu"
export type { TileMenuItem, TileMenuSection } from "./components/tile-menu"
export { UserMenu } from "./components/user-menu"
export { ThemeToggle } from "./components/theme-toggle"
export type { ThemeMode } from "./components/theme-toggle"
export { SkinToggle } from "./components/skin-toggle"
export type { SkinOption } from "./components/skin-toggle"
export { JsonViewer } from "./components/json-viewer"
export { JsonEditor } from "./components/json-editor"
// DocumentViewer intentionally NOT reexported — pdfjs-dist breaks SSR.
// Import via subpath: "@cortex/ui/components/document-viewer" + next/dynamic.
export { ActionLogTimeline } from "./components/action-log-timeline"
export { FileUploader } from "./components/file-uploader"
export { AutoRefreshIndicator } from "./components/auto-refresh-indicator"
export { LoadingState } from "./components/loading-state"
export { ErrorState } from "./components/error-state"
export { BarList } from "./components/bar-list"
export type { BarListItem } from "./components/bar-list"

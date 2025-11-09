// app/components/ui/sidebar.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { twMerge } from "tailwind-merge"
import clsx, { type ClassValue } from "clsx"

/* -----------------------------------------------------------
   Util: cn (clase condicional + merge de Tailwind)
----------------------------------------------------------- */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* -----------------------------------------------------------
   Contexto y Provider
----------------------------------------------------------- */
type SidebarContextValue = {
  open: boolean
  setOpen: (v: boolean | ((p: boolean) => boolean)) => void
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return ctx
}

type SidebarProviderProps = {
  children: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (v: boolean) => void
  style?: React.CSSProperties
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  style,
}: SidebarProviderProps) {
  const [uncontrolledOpen, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen

  const setOpen = React.useCallback(
    (value: boolean | ((p: boolean) => boolean)) => {
      const next = typeof value === "function" ? (value as any)(open) : value
      if (onOpenChange) onOpenChange(next)
      else _setOpen(next)
      // cookie opcional (persistencia)
      document.cookie = `sidebar_state=${String(next)}; path=/; max-age=${60 * 60 * 24 * 365}`
    },
    [open, onOpenChange]
  )

  const toggleSidebar = React.useCallback(() => setOpen((p) => !p), [setOpen])

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      <div
        style={{
          // puedes sobreescribir estas variables desde el prop "style"
          // p.ej. {"--sidebar-width":"18rem"} as React.CSSProperties
          "--sidebar-width": "16rem",
          "--sidebar-width-mobile": "18rem",
          ...style,
        } as React.CSSProperties}
        className="relative flex min-h-dvh bg-background text-foreground"
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

/* -----------------------------------------------------------
   Sidebar contenedor
----------------------------------------------------------- */
type SidebarProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "left" | "right"
  collapsible?: "icon" | "none"
  variant?: "sidebar" | "floating" | "inset"
}

export function Sidebar({
  className,
  side = "left",
  collapsible = "icon",
  variant = "sidebar",
  ...props
}: SidebarProps) {
  const { open } = useSidebar()

  // ancho: expandido vs colapsado (icon)
  const expandedWidth = "var(--sidebar-width)"
  const collapsedWidth = "3.5rem"

  return (
    <aside
      data-side={side}
      data-variant={variant}
      data-collapsible={collapsible}
      data-state={open ? "expanded" : "collapsed"}
      className={cn(
        "z-30 flex flex-col border-r bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 ease-out",
        side === "left" ? "order-none" : "order-last border-l",
        variant === "floating" && "m-2 rounded-xl shadow-lg",
        variant === "inset" && "my-2 ml-2 mr-0 rounded-xl",
        className
      )}
      style={{
        width: collapsible === "icon" ? (open ? expandedWidth : collapsedWidth) : expandedWidth,
      }}
      {...props}
    />
  )
}

/* -----------------------------------------------------------
   Partes internas
----------------------------------------------------------- */
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "sticky top-0 z-10 border-b bg-sidebar/80 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60",
        "px-3 py-2"
      )}
      {...props}
    />
  )
})

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "sticky bottom-0 z-10 border-t bg-sidebar/80 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60",
        "px-3 py-2"
      )}
      {...props}
    />
  )
})

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarContent({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto px-2 py-2", className)}
      {...props}
    />
  )
})

/* -----------------------------------------------------------
   Groups
----------------------------------------------------------- */
export const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarGroup({ className, ...props }, ref) {
  return <div ref={ref} className={cn("mb-2", className)} {...props} />
})

export const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarGroupLabel({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        "transition-opacity group-data-[collapsible=icon]:hidden"
      )}
      {...props}
    />
  )
})

export const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarGroupContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("space-y-1", className)} {...props} />
})

/* -----------------------------------------------------------
   Menu
----------------------------------------------------------- */
export function SidebarMenu({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("space-y-1", className)} {...props} />
}

export function SidebarMenuItem({
  className,
  ...props
}: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("", className)} {...props} />
}

type SidebarMenuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  isActive?: boolean
}

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(function SidebarMenuButton(
  { className, asChild, isActive, ...props },
  ref
) {
  const Comp: any = asChild ? Slot : "button"
  return (
    <Comp
      ref={ref}
      data-active={isActive ? "true" : "false"}
      className={cn(
        "group/menu-button inline-flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
        "text-muted-foreground hover:text-foreground transition-colors",
        "hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        // icon-only (colapsado) -> centra icono
        "data-[collapsible=icon]/sidebar:justify-center",
        isActive && "bg-sidebar-accent text-foreground",
        className
      )}
      {...props}
    />
  )
})

export function SidebarMenuBadge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground",
        "transition-opacity group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

/* -----------------------------------------------------------
   Separador, Trigger, Rail
----------------------------------------------------------- */
export function SidebarSeparator() {
  return <div className="my-2 h-px bg-sidebar-border" />
}

export function SidebarTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm",
        "border-border bg-background hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children ?? <span className="font-medium">Toggle</span>}
    </button>
  )
}

export function SidebarRail({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { toggleSidebar } = useSidebar()
  return (
    <div
      role="button"
      aria-label="Toggle sidebar"
      onClick={toggleSidebar}
      className={cn(
        "absolute inset-y-0 -right-2 z-40 hidden w-2 cursor-ew-resize md:block",
        className
      )}
      {...props}
    />
  )
}

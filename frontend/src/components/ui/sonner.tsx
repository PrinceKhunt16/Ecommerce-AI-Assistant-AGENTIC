"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, CircleX, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <CircleX className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          fontFamily: "var(--font-sans)",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Square corners to match the theme (--radius is 0rem).
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Crisp white surface, square corners, thin border — matches the theme.
          toast:
            "cn-toast font-sans !rounded-none border border-border bg-popover text-popover-foreground shadow-sm",
          // Sonner rounds these inner elements by default; flatten them too.
          closeButton: "!rounded-none",
          actionButton: "!rounded-none",
          cancelButton: "!rounded-none",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

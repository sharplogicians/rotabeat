import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

export interface RotaBeatLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "horizontal" | "icon" | "stacked" | "monochrome"
  size?: "sm" | "md" | "lg" | "xl" | "custom"
  width?: number
  height?: number
  showText?: boolean
  priority?: boolean
}

/**
 * RotaBeat Icon mark (The 4 rounded vertical bars)
 */
export function RotaBeatIcon({
  className,
  size = 32,
  ...props
}: {
  className?: string
  size?: number
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/rotabeat-icon-trimmed.png"
      alt="RotaBeat"
      width={size}
      height={Math.round(size * (612 / 861))}
      className={cn("inline-block object-contain select-none", className)}
      {...props}
    />
  )
}

/**
 * Official RotaBeat Horizontal & Stacked Logo Component
 */
export function RotaBeatLogo({
  variant = "horizontal",
  size = "md",
  className,
  priority = false,
  ...props
}: RotaBeatLogoProps) {
  // Dimension presets
  const sizeMap = {
    sm: { h: 24, w: 130 },
    md: { h: 32, w: 174 },
    lg: { h: 42, w: 228 },
    xl: { h: 54, w: 294 },
    custom: { h: 32, w: 174 },
  }

  const dims = sizeMap[size]

  if (variant === "icon") {
    const iconSize = size === "sm" ? 24 : size === "md" ? 32 : size === "lg" ? 44 : 56
    return (
      <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
        <RotaBeatIcon size={iconSize} />
      </div>
    )
  }

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2", className)} {...props}>
        <RotaBeatIcon size={size === "lg" ? 56 : 42} />
        <div className="font-heading font-extrabold tracking-tight text-xl text-slate-900 dark:text-white">
          Rota<span className="text-primary">Beat</span>
        </div>
      </div>
    )
  }

  // Horizontal logo (default)
  return (
    <div className={cn("inline-flex items-center shrink-0 select-none", className)} {...props}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/rotabeat-logo-trimmed.png"
        alt="RotaBeat"
        width={dims.w}
        height={dims.h}
        style={{ height: dims.h, width: "auto" }}
        className="object-contain"
        loading={priority ? "eager" : "lazy"}
      />
    </div>
  )
}

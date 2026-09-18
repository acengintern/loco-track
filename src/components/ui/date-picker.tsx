"use client"

import * as React from "react"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { cn } from "cn"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"

export interface DatePickerProps {
  value?: string | null
  onChange?: (val: string) => void
  placeholder?: string
  disabled?: boolean
  min?: string | Date
  max?: string | Date
  className?: string
  id?: string
  clearable?: boolean
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return ""
  // Handle ISO string or YYYY-MM-DD
  const parts = dateStr.split("T")[0].split("-")
  if (parts.length !== 3) return dateStr
  const year = parseInt(parts[0], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)

  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agt",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ]

  if (isNaN(year) || isNaN(monthIdx) || isNaN(day)) return dateStr
  return `${day} ${MONTHS[monthIdx] || ""} ${year}`
}

function toISODateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  disabled = false,
  min,
  max,
  className,
  id,
  clearable = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (selectedDate: Date) => {
    const str = toISODateString(selectedDate)
    if (onChange) {
      onChange(str)
    }
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onChange) {
      onChange("")
    }
  }

  const display = formatDateDisplay(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-2xs transition-colors outline-none",
              "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{display || placeholder}</span>
        </span>
        {clearable && value && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Hapus tanggal"
          >
            <X className="size-3" />
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border" align="start">
        <Calendar
          selected={value ? new Date(value.includes("T") ? value : `${value}T00:00:00`) : null}
          onSelect={handleSelect}
          minDate={min}
          maxDate={max}
        />
      </PopoverContent>
    </Popover>
  )
}

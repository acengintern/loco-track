"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { cn } from "cn"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export interface DateTimePickerProps {
  value?: string | null
  onChange?: (val: string) => void
  placeholder?: string
  disabled?: boolean
  min?: string | Date
  max?: string | Date
  className?: string
  id?: string
}

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

function formatDateTimeDisplay(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return ""
  try {
    const [datePart, timePart] = dateTimeStr.split("T")
    if (!datePart) return dateTimeStr
    const parts = datePart.split("-")
    if (parts.length !== 3) return dateTimeStr
    const year = parseInt(parts[0], 10)
    const monthIdx = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)

    const time = timePart ? timePart.slice(0, 5) : "00:00"
    return `${day} ${MONTHS[monthIdx] || ""} ${year}, ${time} WIB`
  } catch {
    return dateTimeStr || ""
  }
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pilih batas waktu",
  disabled = false,
  min,
  max,
  className,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Derive current date and time from value
  const selectedDate = React.useMemo(() => {
    if (!value) return null
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }, [value])

  const time = React.useMemo(() => {
    if (!value) return "18:00"
    const t = value.includes("T") ? value.split("T")[1]?.slice(0, 5) : "18:00"
    return t || "18:00"
  }, [value])

  const emitChange = (date: Date | null, timeStr: string) => {
    if (!date) return
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    const combined = `${y}-${m}-${d}T${timeStr}:00`
    if (onChange) {
      onChange(combined)
    }
  }

  const handleDateSelect = (d: Date) => {
    emitChange(d, time)
  }

  const handleTimeChange = (newTime: string) => {
    const baseDate = selectedDate || new Date()
    emitChange(baseDate, newTime)
  }

  const display = formatDateTimeDisplay(value)

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
        <Clock className="size-3.5 text-muted-foreground/60 shrink-0" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border" align="start">
        <div className="flex flex-col">
          <Calendar
            selected={selectedDate}
            onSelect={handleDateSelect}
            minDate={min}
            maxDate={max}
          />
          <div className="border-t border-border p-3 bg-muted/20 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="text-[11px] font-medium">Jam:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="h-7 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-7 text-[11px]"
              >
                Pilih
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

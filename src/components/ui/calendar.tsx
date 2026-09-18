"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

export interface CalendarProps {
  selected?: Date | string | null
  onSelect?: (date: Date) => void
  minDate?: Date | string | null
  maxDate?: Date | string | null
  disabled?: (date: Date) => boolean
  className?: string
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

function parseDateInput(val: Date | string | null | undefined): Date | null {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

export function Calendar({
  selected,
  onSelect,
  minDate,
  maxDate,
  disabled,
  className,
}: CalendarProps) {
  const selectedDate = React.useMemo(() => parseDateInput(selected), [selected])
  const parsedMin = React.useMemo(() => parseDateInput(minDate), [minDate])
  const parsedMax = React.useMemo(() => parseDateInput(maxDate), [maxDate])

  const [viewDate, setViewDate] = React.useState<Date>(() => {
    return selectedDate || new Date()
  })
  const [prevSelected, setPrevSelected] = React.useState(selectedDate)

  if (selectedDate !== prevSelected) {
    setPrevSelected(selectedDate)
    if (selectedDate) {
      setViewDate(selectedDate)
    }
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Generate grid cells (prev month spill, current month, next month fill)
  const days = React.useMemo(() => {
    const today = new Date()
    const items: Array<{
      date: Date
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
      isDisabled: boolean
    }> = []

    // Previous month padding
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i)
      const isDisabled =
        (parsedMin ? d < new Date(parsedMin.getFullYear(), parsedMin.getMonth(), parsedMin.getDate()) : false) ||
        (parsedMax ? d > new Date(parsedMax.getFullYear(), parsedMax.getMonth(), parsedMax.getDate()) : false) ||
        (disabled ? disabled(d) : false)

      items.push({
        date: d,
        isCurrentMonth: false,
        isToday: isSameDay(d, today),
        isSelected: selectedDate ? isSameDay(d, selectedDate) : false,
        isDisabled,
      })
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum)
      const isDisabled =
        (parsedMin ? d < new Date(parsedMin.getFullYear(), parsedMin.getMonth(), parsedMin.getDate()) : false) ||
        (parsedMax ? d > new Date(parsedMax.getFullYear(), parsedMax.getMonth(), parsedMax.getDate()) : false) ||
        (disabled ? disabled(d) : false)

      items.push({
        date: d,
        isCurrentMonth: true,
        isToday: isSameDay(d, today),
        isSelected: selectedDate ? isSameDay(d, selectedDate) : false,
        isDisabled,
      })
    }

    // Next month padding to fill out 35 or 42 cells
    const remaining = (7 - (items.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      const isDisabled =
        (parsedMin ? d < new Date(parsedMin.getFullYear(), parsedMin.getMonth(), parsedMin.getDate()) : false) ||
        (parsedMax ? d > new Date(parsedMax.getFullYear(), parsedMax.getMonth(), parsedMax.getDate()) : false) ||
        (disabled ? disabled(d) : false)

      items.push({
        date: d,
        isCurrentMonth: false,
        isToday: isSameDay(d, today),
        isSelected: selectedDate ? isSameDay(d, selectedDate) : false,
        isDisabled,
      })
    }

    return items
  }, [year, month, daysInMonth, firstDayOfWeek, daysInPrevMonth, selectedDate, parsedMin, parsedMax, disabled])

  return (
    <div className={cn("p-2 text-xs select-none w-64", className)}>
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
        <span className="font-semibold text-foreground text-xs pl-1">
          {MONTH_NAMES[month]} {year}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={prevMonth}
            aria-label="Bulan sebelumnya"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={nextMonth}
            aria-label="Bulan berikutnya"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center font-medium text-muted-foreground text-[10px] mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((item, idx) => {
          return (
            <button
              key={idx}
              type="button"
              disabled={item.isDisabled}
              onClick={() => onSelect && onSelect(item.date)}
              className={cn(
                "h-8 w-8 rounded-md text-xs font-normal transition-colors flex items-center justify-center mx-auto",
                !item.isCurrentMonth && "text-muted-foreground/40",
                item.isCurrentMonth && !item.isSelected && "text-foreground hover:bg-accent hover:text-accent-foreground",
                item.isToday && !item.isSelected && "ring-1 ring-primary/40 font-semibold text-primary",
                item.isSelected && "bg-primary text-primary-foreground font-semibold shadow-2xs hover:bg-primary/90",
                item.isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
              )}
            >
              {item.date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type {
  DataTableFilterableColumn,
  DataTableSearchableColumn,
} from "@/types"
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"

import { useDebounce } from "@/hooks/use-debounce"

interface UseDataTableProps<TData, TValue> {
  /**
   * The data for the table
   * @default []
   * @type TData[]
   */
  data: TData[]

  /**
   * The columns of the table
   * @default []
   * @type ColumnDef<TData, TValue>[]
   */
  columns: ColumnDef<TData, TValue>[]

  /**
   * The number of pages in the table
   * @type number
   */
  pageCount: number

  /**
   * The searchable columns of the table
   * @default []
   * @type {id: keyof TData, title: string}[]
   * @example searchableColumns={[{ id: "title", title: "titles" }]}
   */
  searchableColumns?: DataTableSearchableColumn<TData>[]

  /**
   * The filterable columns of the table. When provided, renders dynamic faceted filters, and the advancedFilter prop is ignored.
   * @default []
   * @type {id: keyof TData, title: string, options: { label: string, value: string, icon?: React.ComponentType<{ className?: string }> }[]
   * @example filterableColumns={[{ id: "status", title: "Status", options: ["todo", "in-progress", "done", "canceled"]}]}
   */
  filterableColumns?: DataTableFilterableColumn<TData>[]
  initialColumnFilters?: ColumnFiltersState
}

export function useDataTable<TData, TValue>({
  data,
  columns,
  pageCount,
  searchableColumns = [],
  filterableColumns = [],
  initialColumnFilters = [],
}: UseDataTableProps<TData, TValue>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Search params
  const page = searchParams?.get("page") ?? "1"
  const pageAsNumber = Number(page)
  const fallbackPage =
    isNaN(pageAsNumber) || pageAsNumber < 1 ? 1 : pageAsNumber
  const per_page = searchParams?.get("per_page") ?? "10"
  const perPageAsNumber = Number(per_page)
  const fallbackPerPage = isNaN(perPageAsNumber) ? 10 : perPageAsNumber
  const sort = searchParams?.get("sort")
  const [column, order] = sort?.split(".") ?? []

  // Create query string
  const createQueryString = React.useCallback(
    (params: Record<string, string | number | null>) => {
      const newSearchParams = new URLSearchParams(searchParams?.toString())

      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          newSearchParams.delete(key)
        } else {
          newSearchParams.set(key, String(value))
        }
      }

      return newSearchParams.toString()
    },
    [searchParams]
  )

  // Table states
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters)

  // Handle server-side pagination
  const [{ pageIndex, pageSize }, setPagination] =
    React.useState<PaginationState>({
      pageIndex: fallbackPage - 1,
      pageSize: fallbackPerPage,
    })

  const pagination = React.useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize]
  )

  React.useEffect(() => {
    setPagination({
      pageIndex: fallbackPage - 1,
      pageSize: fallbackPerPage,
    })
  }, [fallbackPage, fallbackPerPage])

  React.useEffect(() => {
    router.push(
      `${pathname}?${createQueryString({
        page: pageIndex + 1,
        per_page: pageSize,
      })}`,
      {
        scroll: false,
      }
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageSize])

  // Handle server-side sorting
  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: column ?? "",
      desc: order === "desc",
    },
  ])

  React.useEffect(() => {
    router.push(
      `${pathname}?${createQueryString({
        page,
        sort: sorting[0]?.id
          ? `${sorting[0]?.id}.${sorting[0]?.desc ? "desc" : "asc"}`
          : null,
      })}`
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting])

  // Handle server-side filtering
  const debouncedSearchableColumnFilters = JSON.parse(
    useDebounce(
      JSON.stringify(
        columnFilters.filter((filter) => {
          return searchableColumns.find((column) => column.id === filter.id)
        })
      ),
      500
    )
  ) as ColumnFiltersState

  const filterableColumnFilters = columnFilters.filter((filter) => {
    return filterableColumns.find((column) => column.id === filter.id)
  })

  React.useEffect(() => {
    // Initialize new params
    const newParamsObject = {
      page: 1,
    }

    // Get all values
    for (const column of debouncedSearchableColumnFilters) {
      if (typeof column.value === "string") {
        Object.assign(newParamsObject, {
          [column.id]: typeof column.value === "string" ? column.value : null,
        })
      }
    }

    // Remove deleted values
    for (const key of searchParams.keys()) {
      if (
        searchableColumns.find((column) => column.id === key) &&
        !debouncedSearchableColumnFilters.find((column) => column.id === key)
      ) {
        Object.assign(newParamsObject, { [key]: null })
      }
    }

    // After cumulate all the changes, push new params
    router.push(`${pathname}?${createQueryString(newParamsObject)}`)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedSearchableColumnFilters)])

  React.useEffect(() => {
    // Initialize new params
    const newParamsObject = {
      page: 1,
    }

    for (const column of filterableColumnFilters) {
      if (typeof column.value === "object" && Array.isArray(column.value)) {
        Object.assign(newParamsObject, { [column.id]: column.value.join(".") })
      }
    }

    for (const key of searchParams.keys()) {
      if (
        filterableColumns.find((column) => column.id === key) &&
        !filterableColumnFilters.find((column) => column.id === key)
      ) {
        Object.assign(newParamsObject, { [key]: null })
      }
    }

    // After cumulate all the changes, push new params
    router.push(`${pathname}?${createQueryString(newParamsObject)}`)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filterableColumnFilters)])

  const dataTable = useReactTable({
    data,
    columns,
    pageCount: pageCount ?? -1,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  return { dataTable }
}

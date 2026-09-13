"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTable,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { columns } from "./columns";
import {
  features,
  type ProjectTableFeatures,
} from "./projects-table-features";
import { ProjectItem } from "../services/schemas";

type ProjectsTableProps = {
  projects: ProjectItem[];
};

export default function ProjectsTable({ projects }: ProjectsTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useTable<ProjectTableFeatures, ProjectItem>({
    features,
    data: projects,
    columns,
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
    },
  });
  const nameColumn = table.getColumn("name");
  const filterValue = (nameColumn?.getFilterValue() as string) ?? "";

  return (
    <div>
      <div className="flex items-center py-4">
        <label htmlFor="project-search" className="sr-only">
          Filtrar por nombre del proyecto
        </label>
        <Input
          id="project-search"
          type="search"
          placeholder="Filtrar por nombre..."
          value={filterValue}
          onChange={(event) => nameColumn?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {projects.length > 0 ? (
        <div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      No se encontraron proyectos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
"use client"

import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { type ProjectItem } from "../services/schemas";
import { formatStatus } from "../services/utils";
import { type ProjectTableFeatures } from "./projects-table-features";

const columnHelper = createColumnHelper<ProjectTableFeatures, ProjectItem>();

export const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Nombre",
    filterFn: "includesString",
    cell: ({ row }) => (
      <Link
        href={`/projects/${row.original.id}`}
      >
        {row.original.name}
      </Link>
    ),
  }),
  columnHelper.accessor((project) => project.location || project.context || "Sin información", {
    id: "location",
    header: "Lugar",
  }),
  columnHelper.accessor(
    (project) =>
      project.proposer?.type === "natural_person"
        ? project.proposer.fullName
        : project.proposer?.type === "legal_person"
          ? project.proposer.legalName
          : "Sin información",
    {
      id: "proposer",
      header: "Proponente",
    },
  ),
  columnHelper.accessor("status", {
    header: "Estado",
    cell: ({ getValue }) => (
      <span>{formatStatus(getValue())}</span>
    ),
  }),
]);

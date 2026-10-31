"use client";

import { useSearchParams } from "next/navigation";
import { getProjects } from "../services/projects";
import { ProjectItem } from "../services/schemas";
import ProjectsList from "./projects-list";
import ServiceUnavailable from "../components/service-unavailable";
import AccessNotice from "../components/access-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { isServiceUnavailableStatus } from "@/lib/http";
import { useApiResource } from "@/lib/use-api-resource";

export default function ProjectsExplorer() {
  const searchParams = useSearchParams();
  const proposedByMe = searchParams.get("propuestos") === "1";
  const {
    data: projectsResult,
    loading,
    error: loadError,
    reload,
  } = useApiResource(() => getProjects({ proposedByMe }), [proposedByMe]);

  const projects: ProjectItem[] = projectsResult?.projects ?? [];
  const error = projectsResult?.error ?? loadError ?? null;
  const status = projectsResult?.status;

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isServiceUnavailableStatus(status)) {
    return (
      <ServiceUnavailable
        className="mb-6"
        message={error}
        onRetry={reload}
      />
    );
  }

  if (status === 401) {
    return (
      <AccessNotice
        className="rounded-2xl"
        title="Inicia sesión para ver los proyectos"
        message="Solo los proyectos finalizados y públicos se pueden consultar sin cuenta. Inicia sesión para ver los proyectos aprobados, los tuyos y tus intereses."
      />
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (projects.length === 0) {
    return (
      <Empty className="rounded-2xl bg-card shadow-sm ring-1 ring-utb-blue/10">
        <EmptyHeader>
          <EmptyTitle>No hay proyectos</EmptyTitle>
          <EmptyDescription>
            {proposedByMe
              ? "Todavía no se encontraron propuestas registradas por tu cuenta."
              : "No se encontraron proyectos visibles para tu cuenta. Explora los proyectos aprobados o propón uno nuevo."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <ProjectsList projects={projects} />;
}

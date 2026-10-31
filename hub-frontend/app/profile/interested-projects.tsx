"use client";

import { type ReactNode, useState, useTransition } from "react";
import Link from "next/link";
import {
  getMyProjectInterests,
  withdrawProjectInterest,
} from "../services/projects";
import { MyProjectInterest } from "../services/schemas";
import { formatStatus } from "../services/utils";
import ServiceUnavailable from "../components/service-unavailable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SERVICE_UNAVAILABLE_MESSAGE } from "@/lib/http";
import { useApiResource } from "@/lib/use-api-resource";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export default function InterestedProjects() {
  const {
    data: projectsResult,
    loading,
    error: loadError,
    reload,
  } = useApiResource(() => getMyProjectInterests());
  const [selected, setSelected] = useState<MyProjectInterest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const projects: MyProjectInterest[] = projectsResult?.projects ?? [];
  const error = projectsResult?.error ?? loadError ?? null;

  let description: string;

  if (loading) {
    description = "Cargando proyectos de interés...";
  } else if (projects.length === 0) {
    description = "Aún no has marcado ningún proyecto como interesante.";
  } else {
    description = `${projects.length} proyecto(s) marcado(s) como interesante(s).`;
  }

  function handleWithdraw() {
    if (!selected) {
      return;
    }

    const project = selected;
    setActionError(null);

    startTransition(async () => {
      try {
        await withdrawProjectInterest(project.id);
        setSelected(null);
        reload();
      } catch (withdrawError) {
        setActionError(
          withdrawError instanceof Error
            ? withdrawError.message
            : "No se pudo retirar el interés.",
        );
      }
    });
  }

  let content: ReactNode;

  if (loading) {
    content = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  } else if (error === SERVICE_UNAVAILABLE_MESSAGE) {
    content = <ServiceUnavailable message={error} onRetry={reload} />;
  } else if (error) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  } else if (projects.length === 0) {
    content = (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Sin proyectos de interés</EmptyTitle>
          <EmptyDescription>
            Explora los proyectos aprobados y marca los que te interesen.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          nativeButton={false}
          render={
            <Link href="/projects?estado=approved">Ver proyectos aprobados</Link>
          }
        />
      </Empty>
    );
  } else {
    content = (
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Proyecto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Interés</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow
              key={project.id}
              className="transition-colors hover:bg-utb-blue/[0.04]"
            >
              <TableCell className="font-medium">
                <Button
                  variant="link"
                  className="h-auto justify-start p-0 font-medium"
                  nativeButton={false}
                  render={
                    <Link href={`/projects/${project.id}`}>
                      {project.name}
                    </Link>
                  }
                />
                {project.interestMessage ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {project.interestMessage}
                  </p>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {formatStatus(project.status)}
                  </Badge>
                  {project.isPrivate ? (
                    <Badge variant="outline">Privado</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(project.interestedAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionError(null);
                    setSelected(project);
                  }}
                >
                  Retirar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proyectos de interés</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {actionError ? (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        {content}
      </CardContent>

      <AlertDialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar interés</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará tu interés en {selected?.name}. Podrás volver a
              interesarte mientras el proyecto siga aprobado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw} disabled={isPending}>
              {isPending ? "Retirando..." : "Retirar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

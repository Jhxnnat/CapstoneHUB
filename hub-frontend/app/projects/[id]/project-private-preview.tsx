"use client";

import { type ReactNode } from "react";
import { ProjectDetails } from "../../services/schemas";
import ProjectDetailsBadges from "./project-details-badges";
import ProjectInterestCard from "./project-interest-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProjectPrivatePreviewProps = {
  readonly project: ProjectDetails;
  readonly onProjectChange: () => Promise<void>;
};

function InfoBlock({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
        {title}
      </p>
      <div className="text-sm whitespace-pre-line text-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * Vista previa de un proyecto privado para estudiantes: solo la información
 * mínima para decidir si les interesa y la tarjeta para expresar el interés.
 */
export default function ProjectPrivatePreview({
  project,
  onProjectChange,
}: ProjectPrivatePreviewProps) {
  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <AlertDescription>
          Este proyecto es privado. Mientras esté aprobado mostramos solo la
          información básica para que puedas decidir si te interesa. El equipo,
          los documentos y el historial quedan reservados a sus miembros.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Información del proyecto</CardTitle>
          <CardDescription>
            Datos generales compartidos por el proponente.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <ProjectDetailsBadges project={project} />

          <InfoBlock title="Descripción">{project.description}</InfoBlock>

          {project.location ? (
            <InfoBlock title="Ubicación">{project.location}</InfoBlock>
          ) : null}

          {project.teamRequirements ? (
            <InfoBlock title="Requisitos del equipo">
              {project.teamRequirements}
            </InfoBlock>
          ) : null}

          {project.expectedOutcomes ? (
            <InfoBlock title="Resultados esperados">
              {project.expectedOutcomes}
            </InfoBlock>
          ) : null}
        </CardContent>
      </Card>

      <ProjectInterestCard
        project={project}
        onProjectChange={onProjectChange}
      />
    </div>
  );
}

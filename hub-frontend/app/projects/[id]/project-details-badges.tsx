import ProjectAssignmentBadge from "./project-assignment-badge";
import ProjectLegalizationBadge from "./project-legalization-badge";
import ProjectSourceBadge from "./project-source-badge";
import { ProjectDetails } from "../../services/schemas";
import { formatPhase, formatStatus } from "@/app/services/utils";
import { Badge } from "@/components/ui/badge";

type ProjectDetailsBadgesProps = {
  readonly project: ProjectDetails;
};

/** Fila de insignias de estado, fase, asignación, legalización y fuente. */
export default function ProjectDetailsBadges({
  project,
}: ProjectDetailsBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="secondary">Estado: {formatStatus(project.status)}</Badge>
      {project.phase ? (
        <Badge variant="outline">{formatPhase(project.phase)}</Badge>
      ) : null}
      {project.isPrivate ? <Badge variant="outline">Privado</Badge> : null}
      {project.viewerInterest ? (
        <Badge variant="secondary">Interesado</Badge>
      ) : null}
      <ProjectAssignmentBadge assignments={project.actorAssignments ?? []} />
      <ProjectLegalizationBadge
        requiresLegalization={project.requiresLegalization}
      />
      <ProjectSourceBadge source={project.source} />
    </div>
  );
}

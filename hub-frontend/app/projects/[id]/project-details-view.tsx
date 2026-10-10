"use client";

import Link from "next/link";
import { RiEditLine } from "@remixicon/react";
import ProjectStatusDialog from "../../components/project-status-dialog";
import ProjectCategoriesPanel from "./project-categories-panel";
import ProjectDetailsBadges from "./project-details-badges";
import ProjectDetailsHeader from "./project-details-header";
import ProjectDetailsSkeleton from "./project-details-skeleton";
import ProjectGeneralTab from "./project-general-tab";
import ProjectMemberTabs from "./project-member-tabs";
import ProjectMissingState from "./project-missing-state";
import ProjectPhaseActions from "./project-phase-actions";
import ProjectPhaseApprovals from "./project-phase-approvals";
import ProjectTabs from "./project-tabs";
import { visibleProjectTabs } from "./project-tabs-config";
import { useCanEditProject } from "./use-can-edit-project";
import { useIsProjectMember } from "./use-is-project-member";
import { useProjectDetails } from "./use-project-details";
import ServiceUnavailable from "../../components/service-unavailable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isServiceUnavailableStatus } from "@/lib/http";

function ProjectTabsList({ isMember }: { readonly isMember: boolean }) {
  return (
    <TabsList className="w-full sm:w-fit">
      {visibleProjectTabs(isMember).map(({ value, label, Icon }) => (
        <TabsTrigger key={value} value={value}>
          <Icon data-icon="inline-start" />
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export default function ProjectDetailsView({ id }: { readonly id: string }) {
  const { project, loading, status, error, reload, refresh } =
    useProjectDetails(id);
  const isMember = useIsProjectMember(project);
  const canEdit = useCanEditProject(project);

  if (loading) {
    return <ProjectDetailsSkeleton />;
  }

  if (!project) {
    if (isServiceUnavailableStatus(status)) {
      return (
        <main className="flex-1 text-foreground">
          <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <ServiceUnavailable message={error} onRetry={reload} />
          </section>
        </main>
      );
    }

    return <ProjectMissingState status={status} />;
  }

  const assignments = project.actorAssignments ?? [];

  return (
    <main className="flex-1 text-foreground">
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProjectDetailsHeader project={project} isMember={isMember} />

        <Card>
          <CardContent>
            <ProjectDetailsBadges project={project} />

            <ProjectTabs
              defaultTab="general"
              validTabs={visibleProjectTabs(isMember).map((tab) => tab.value)}
              className="mt-6 w-full"
            >
              <ProjectTabsList isMember={isMember} />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <ProjectPhaseActions
                  project={project}
                  assignments={assignments}
                  onProjectChange={refresh}
                />

                <div className="flex flex-wrap items-center gap-2">
                  {isMember ? (
                    <ProjectStatusDialog
                      projectId={project.id}
                      currentStatus={project.status}
                      assignments={assignments}
                      milestones={project.milestones ?? []}
                      onProjectChange={refresh}
                    />
                  ) : null}

                  {canEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link href={`/projects/${project.id}/edit`}>
                          <RiEditLine data-icon="inline-start" />
                          Editar proyecto
                        </Link>
                      }
                    />
                  ) : null}
                </div>
              </div>

              <ProjectPhaseApprovals
                project={project}
                onProjectChange={refresh}
              />

              <TabsContent value="general" className="mt-6 flex flex-col gap-6">
                <ProjectGeneralTab project={project} />
              </TabsContent>

              <TabsContent value="categorias" className="mt-6">
                <ProjectCategoriesPanel categories={project.categories} />
              </TabsContent>

              {isMember ? (
                <ProjectMemberTabs
                  project={project}
                  assignments={assignments}
                  onProjectChange={refresh}
                />
              ) : null}
            </ProjectTabs>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

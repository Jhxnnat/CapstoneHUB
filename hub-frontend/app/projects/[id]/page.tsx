import { notFound } from "next/navigation";
import { getProjectById } from "../../services/projects";
import ProjectStatusEditForm from "../../components/project-status-edit-form";
import ProjectObservationsPanel from "./project-observations-panel";
import ProjectActorAssignmentPanel from "./project-actor-assignment-panel";
import { formatStatus } from "@/app/services/utils";

export const dynamic = "force-dynamic";

function formatDate(dateValue: string | null): string {
  if (!dateValue) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function formatCurrency(value: string | null): string {
  if (!value) {
    return "No definido";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { project, error } = await getProjectById(id);

  if (!project || error) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Proyecto #{project.id}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {project.name}
            </h1>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <article className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex w-fit bg-blue-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-800">
                {formatStatus(project.status)}
              </span>
              <span className="text-sm text-slate-500">
                Creado el {formatDate(project.createdAt)}
              </span>
            </div>

            <div className="mt-6 space-y-6">
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Descripción
                </h2>
                <p className="mt-3 whitespace-pre-line text-slate-700">
                  {project.description}
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Contexto
                </h2>
                <p className="mt-3 whitespace-pre-line text-slate-700">
                  {project.context}
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Proponente
                </h2>
                {project.proposer ? (
                  <dl className="mt-3 space-y-3 text-sm text-slate-700">
                    {project.proposer.type === "natural_person" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">Nombre completo</dt>
                          <dd className="text-right">
                            {project.proposer.fullName}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">Cédula</dt>
                          <dd className="text-right">
                            {project.proposer.idNumber}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">Correo</dt>
                          <dd className="text-right">
                            {project.proposer.email}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">Razón social</dt>
                          <dd className="text-right">
                            {project.proposer.legalName}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">NIT</dt>
                          <dd className="text-right">{project.proposer.nit}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">Correo</dt>
                          <dd className="text-right">
                            {project.proposer.email}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">Teléfono</dt>
                          <dd className="text-right">
                            {project.proposer.phone}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-slate-500">Contacto</dt>
                          <dd className="text-right">
                            {project.proposer.contactUrl ?? "Sin enlace"}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Sin información del proponente.
                  </p>
                )}
              </section>
            </div>
          </article>

          <aside className="space-y-4 border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Fechas
              </h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Inicio</dt>
                  <dd className="text-right">
                    {formatDate(project.startDate)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Fin</dt>
                  <dd className="text-right">{formatDate(project.endDate)}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Costo estimado</dt>
                  <dd className="text-right">
                    {formatCurrency(project.estimatedCost)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Trazabilidad
              </h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Actualizado</dt>
                  <dd className="text-right">
                    {formatDate(project.updatedAt)}
                  </dd>
                </div>
              </dl>
            </div>

            <ProjectActorAssignmentPanel
              projectId={project.id}
              assignments={project.actorAssignments ?? []}
            />
          </aside>
        </div>

        <ProjectObservationsPanel
          projectId={project.id}
          observations={project.observations ?? []}
        />

        <div className="mt-6 flex w-full justify-end">
          <ProjectStatusEditForm
            projectId={project.id}
            currentStatus={project.status}
          />
        </div>
      </section>
    </main>
  );
}

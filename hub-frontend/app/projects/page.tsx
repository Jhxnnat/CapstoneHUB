import { getProjects } from "../services/projects";
import ProjectsTable from "@/app/projects/projects-table";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { projects, error } = await getProjects();

  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <section className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Lista de proyectos
            </h1>
          </div>
        </div>

        {error ? (
          <div className="mb-6 border border-amber-200 bg-amber-50 p-5 text-amber-900">
            {error}
          </div>
        ) : null}

        {!error && projects.length === 0 ? (
          <div className="border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            No se encontraron proyectos aún.
          </div>
        ) : null}

        {!error && projects.length > 0 ? (
          <ProjectsTable projects={projects} />
        ) : null}
      </section>
    </main>
  );
}

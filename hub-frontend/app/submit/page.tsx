import SubmitCard from "../components/submit-card";

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <section className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Proponer un proyecto
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SubmitCard
            title="Persona Natural"
            description="Dirigido a estudiantes, docentes o personas independientes que deseen postular proyectos Capstone de manera individual."
            href="/submit/natural"
          />
          <SubmitCard
            title="Persona Jurídica"
            description="Dirigido a empresas, organizaciones o instituciones que deseen proponer proyectos Capstone para colaboración académica. (No disponible)"
            disabled
          />
        </div>
      </section>
    </main>
  );
}

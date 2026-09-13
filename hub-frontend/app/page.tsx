import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 sm:px-10 lg:px-12">
        <div className="max-w-2xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Gestion de proyectos Capstone
            </h1>
          </div>

          <p>
            CapstoneHUB es un servicio diseñado para apoyar la gestión integral de proyectos que permiten
             a los estudiantes aplicar conocimientos académicos a situaciones del mundo real, 
             a menudo en colaboración con empresas en entornos de ingeniería aplicada.
          </p>

          <p>
            Su propósito es facilitar la administración, seguimiento y evaluación de los proyectos de 
             titulación, permitiendo optimizar los recursos disponibles y mejorar la coordinación entre 
             los distintos actores involucrados.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="default">
              <Link href="/projects"> Ver lista de proyectos </Link>
            </Button>
            <Button variant="outline">
              <Link href="/submit">
                Proponer un Proyecto
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

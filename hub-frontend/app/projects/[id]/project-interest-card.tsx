"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProjectDetails } from "../../services/schemas";
import {
  expressProjectInterest,
  withdrawProjectInterest,
} from "../../services/projects";
import { formatDate } from "./project-formatters";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type ProjectInterestCardProps = {
  readonly project: ProjectDetails;
  readonly onProjectChange: () => Promise<void>;
};

/**
 * Tarjeta para que un estudiante exprese o retire su interés en un proyecto
 * aprobado. La visibilidad y la elegibilidad las decide el backend.
 */
export default function ProjectInterestCard({
  project,
  onProjectChange,
}: ProjectInterestCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const interest = project.viewerInterest ?? null;
  const canExpressInterest = project.canExpressInterest === true;
  const isApproved = project.status === "approved";

  if (!interest && !canExpressInterest) {
    return null;
  }

  function handleOpenDialog() {
    setErrorMessage(null);
    setDialogOpen(true);
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await expressProjectInterest(project.id, message);
        setDialogOpen(false);
        setMessage("");
        await onProjectChange();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo registrar el interés.",
        );
      }
    });
  }

  function handleWithdraw() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await withdrawProjectInterest(project.id);
        setConfirmOpen(false);

        // Si el privado ya no está aprobado, al retirar el interés se pierde
        // el acceso a la vista previa; volvemos al perfil para evitar un 404.
        if (project.isPrivate && !isApproved) {
          router.push("/profile");
          return;
        }

        await onProjectChange();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo retirar el interés.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {interest ? "Tu interés está registrado" : "¿Te interesa este proyecto?"}
        </CardTitle>
        <CardDescription>
          {interest
            ? `Expresaste interés el ${formatDate(interest.createdAt)}.`
            : "Avisa a los docentes del proyecto de que quieres participar. Tu interés será visible para ellos."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {interest?.message ? (
          <blockquote className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm whitespace-pre-line text-muted-foreground">
            {interest.message}
          </blockquote>
        ) : null}

        {!isApproved ? (
          <Alert>
            <AlertDescription>
              {interest
                ? "El proyecto ya no está aprobado, así que no se aceptan nuevos intereses. Puedes retirar el tuyo si lo deseas."
                : "Este proyecto ya no está aprobado y no acepta nuevos intereses."}
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {interest ? (
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
            >
              Retirar interés
            </Button>
          ) : null}

          {canExpressInterest ? (
            <Button onClick={handleOpenDialog} disabled={isPending}>
              Me interesa
            </Button>
          ) : null}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expresar interés</DialogTitle>
            <DialogDescription>
              Puedes dejar una motivación breve. Tu interés será visible para los
              docentes y directivos del proyecto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1000}
              placeholder="Cuéntales brevemente por qué te interesa (opcional)"
              aria-label="Motivación (opcional)"
              disabled={isPending}
            />

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner data-icon="inline-start" /> : null}
                Enviar interés
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar interés</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará tu interés en {project.name}. Podrás volver a
              interesarte mientras el proyecto siga aprobado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw} disabled={isPending}>
              Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

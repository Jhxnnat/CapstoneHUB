"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { createProject } from "../services/projects";
import { type ProjectSource } from "../services/schemas";
import { useAuth } from "./auth-provider";
import AccessNotice from "./access-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RiAddLine, RiDeleteBinLine } from "@remixicon/react";

const MAX_NAME_LENGTH = 100;
const MAX_TEXT_LENGTH = 250;


const projectSources: ReadonlyArray<{
  value: ProjectSource;
  label: string;
}> = [
  { value: "external_entity", label: "Entidad externa" },
  { value: "research", label: "Investigación" },
  { value: "internal_need", label: "Necesidad interna" },
  { value: "social_impact", label: "Impacto social" },
];

const steps = [
  {
    number: 1,
    title: "Proponente y origen",
    description: "Responsable y fuente",
  },
  {
    number: 2,
    title: "Información del proyecto",
    description: "Descripción y justificación",
  },
  {
    number: 3,
    title: "Equipo y condiciones",
    description: "Estudiantes y expectativas",
  },
] as const;

type DeliverableFormItem = {
  id: string;
  value: string;
};

type FormState = {
  name: string;
  source: ProjectSource;
  sourceDetails: string;
  namep: string;
  description: string;
  context: string;
  hasFacultyAdvisor: boolean;
  facultyAdvisor: string;
  teamRequirements: string;
  expectedOutcomes: string;
  deliverables: DeliverableFormItem[];
  requiresLegalization: boolean;
  isPrivate: boolean;
};

function createDeliverable(): DeliverableFormItem {
  return {
    id: crypto.randomUUID(),
    value: "",
  };
}

const initialForm: FormState = {
  name: "",
  source: "external_entity",
  sourceDetails: "",
  namep: "",
  description: "",
  context: "",
  hasFacultyAdvisor: false,
  facultyAdvisor: "",
  teamRequirements: "",
  expectedOutcomes: "",
  deliverables: [createDeliverable()],
  requiresLegalization: false,
  isPrivate: true,
};

type Status = "idle" | "saving" | "success" | "error";

type StepValidator = (form: FormState) => string | null;

function CharacterCounter({
  value,
  maxLength,
}: {
  readonly value: string;
  readonly maxLength: number;
}) {
  return (
    <p className="text-right text-xs text-muted-foreground">
      {value.length}/{maxLength}
    </p>
  );
}

function validateStepOne(form: FormState): string | null {
  if (!form.namep.trim()) {
    return "Ingresa el nombre del responsable.";
  }

  if (
    form.source === "external_entity" &&
    !form.sourceDetails.trim()
  ) {
    return "Describe la entidad externa de la que proviene el proyecto.";
  }

  return null;
}

function validateStepTwo(form: FormState): string | null {
  if (!form.name.trim()) {
    return "Ingresa el nombre del proyecto.";
  }

  if (!form.description.trim()) {
    return "Ingresa la descripción del proyecto.";
  }

  if (!form.context.trim()) {
    return "Ingresa la justificación del proyecto.";
  }

  return null;
}

function validateStepThree(form: FormState): string | null {
  if (form.hasFacultyAdvisor && !form.facultyAdvisor.trim()) {
    return "Ingresa el nombre o contacto UTB del asesor.";
  }

  if (!form.teamRequirements.trim()) {
    return "Describe el tipo de estudiantes o perfiles requeridos.";
  }

  return null;
}

const stepValidators: Record<number, StepValidator> = {
  1: validateStepOne,
  2: validateStepTwo,
  3: validateStepThree,
};

export default function SubmitProjectForm() {
  const { session, isAuthenticated, ready } = useAuth();
  const userEmail = session?.user?.email ?? "";

  const [form, setForm] = useState<FormState>(initialForm);
  const [currentStep, setCurrentStep] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const [showDurationNotice, setShowDurationNotice] = useState(true);
  const [submissionConsentAt, setSubmissionConsentAt] = useState<
    string | null
  >(null);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setStepError(null);
  }

  function handleSourceChange(value: string) {
    const source = value as ProjectSource;

    setForm((prev) => ({
      ...prev,
      source,
      sourceDetails:
        source === "external_entity" ? prev.sourceDetails : "",
    }));

    setStepError(null);
  }

  function handleAdvisorChange(value: boolean) {
    setForm((prev) => ({
      ...prev,
      hasFacultyAdvisor: value,
      facultyAdvisor: value ? prev.facultyAdvisor : "",
    }));

    setStepError(null);
  }

  function handleDeliverableChange(id: string, value: string) {
    setForm((prev) => ({
      ...prev,
      deliverables: prev.deliverables.map((deliverable) =>
        deliverable.id === id
          ? { ...deliverable, value }
          : deliverable,
      ),
    }));

    setStepError(null);
  }

  function addDeliverable() {
    setForm((prev) => ({
      ...prev,
      deliverables: [...prev.deliverables, createDeliverable()],
    }));
  }

  function removeDeliverable(id: string) {
    setForm((prev) => {
      const deliverables = prev.deliverables.filter(
        (deliverable) => deliverable.id !== id,
      );

      return {
        ...prev,
        deliverables:
          deliverables.length > 0 ? deliverables : [createDeliverable()],
      };
    });
  }

  function acceptDurationNotice() {
    const acceptedAt = new Date().toISOString();

    setSubmissionConsentAt(acceptedAt);
    setShowDurationNotice(false);
  }

  function validateCurrentStep(): boolean {
    setStepError(null);

    const validator = stepValidators[currentStep];
    const validationError = validator ? validator(form) : null;

    if (validationError) {
      setStepError(validationError);
      return false;
    }

    return true;
  }

  function goToNextStep() {
    if (!validateCurrentStep()) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, steps.length));
  }

  function goToPreviousStep() {
    setStepError(null);
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  function goToStep(step: number) {
    if (step < currentStep) {
      setStepError(null);
      setCurrentStep(step);
      return;
    }

    if (step === currentStep + 1 && validateCurrentStep()) {
      setCurrentStep(step);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submissionConsentAt) {
      setShowDurationNotice(true);
      return;
    }

    if (currentStep !== steps.length) {
      goToNextStep();
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    if (!userEmail.trim()) {
      setStatus("error");
      setErrorMessage(
        "No se pudo obtener el correo electrónico de la cuenta.",
      );
      return;
    }

    setStatus("saving");
    setErrorMessage(null);
    setStepError(null);

    try {
      await createProject({
        name: form.name.trim(),
        namep: form.namep.trim(),
        correo: userEmail.trim(),
        description: form.description.trim(),
        context: form.context.trim(),
        source: form.source,
        sourceDetails:
          form.source === "external_entity"
            ? form.sourceDetails.trim()
            : undefined,
        requiresLegalization: form.requiresLegalization,
        isPrivate: form.isPrivate,
        facultyAdvisor: form.hasFacultyAdvisor
          ? form.facultyAdvisor.trim()
          : undefined,
        teamRequirements: form.teamRequirements.trim(),
        expectedOutcomes: form.expectedOutcomes.trim() || undefined,
        deliverables: form.deliverables
          .map((deliverable) => deliverable.value.trim())
          .filter(Boolean),
        submissionConsentAt,
      });

      setStatus("success");
      setForm(initialForm);
      setCurrentStep(1);
      setSubmissionConsentAt(null);
      setShowDurationNotice(true);
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear el proyecto.",
      );
    }
  }

  if (!ready) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cargando acceso...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <AccessNotice
        title="Acceso requerido"
        message="Inicia sesión para proponer nuevos proyectos."
      />
    );
  }

  return (
    <>
      <Dialog
        open={showDurationNotice}
        onOpenChange={(open) => {
          if (!open && !submissionConsentAt) {
            setShowDurationNotice(true);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>
              Información importante sobre la duración
            </DialogTitle>

            <DialogDescription>
              Antes de comenzar debes conocer y aceptar la duración
              establecida para este tipo de proyectos.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm leading-6">
              Los proyectos propuestos mediante esta plataforma se
              ejecutan durante{" "}
              <strong>
                2 semestres académicos, aproximadamente 1 año
              </strong>
              .
            </p>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Al seleccionar &quot;Aceptar y continuar&quot;, dejas
              constancia de que conoces y aceptas esta condición antes
              de registrar la propuesta.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={acceptDurationNotice}>
              Aceptar y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <div className="mb-6">
            <div className="grid gap-2 md:grid-cols-3">
              {steps.map((step) => {
                const isActive = currentStep === step.number;
                const isCompleted = currentStep > step.number;
                const stepClassName = isActive
                  ? "border-primary bg-primary/10"
                  : isCompleted
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-muted/30";

                return (
                  <button
                    key={step.number}
                    type="button"
                    onClick={() => goToStep(step.number)}
                    disabled={step.number > currentStep + 1}
                    className={`rounded-lg border p-3 text-left transition-colors ${stepClassName} disabled:cursor-default disabled:opacity-70`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isActive || isCompleted
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.number}
                      </span>

                      <span className="font-medium">
                        {step.title}
                      </span>
                    </div>

                    <p className="mt-1 pl-9 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${(currentStep / steps.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* PASO 1 */}
          {currentStep === 1 && (
            <FieldSet>
              <FieldLegend>
                Información del proponente y origen
              </FieldLegend>

              <Field>
                <FieldLabel htmlFor="namep">
                  Nombre del responsable
                </FieldLabel>

                <Input
                  id="namep"
                  name="namep"
                  value={form.namep}
                  onChange={handleChange}
                  maxLength={MAX_NAME_LENGTH}
                  required
                />

                <CharacterCounter
                  value={form.namep}
                  maxLength={MAX_NAME_LENGTH}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="correo">
                  Correo electrónico
                </FieldLabel>

                <Input
                  type="email"
                  id="correo"
                  value={userEmail}
                  readOnly
                  aria-readonly="true"
                  maxLength={MAX_TEXT_LENGTH}
                />

                <FieldDescription>
                  Este correo se obtiene automáticamente de la cuenta con la que
                  iniciaste sesión.
                </FieldDescription>

                <CharacterCounter
                  value={userEmail}
                  maxLength={MAX_TEXT_LENGTH}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="source">
                  Fuente del proyecto
                </FieldLabel>

                <Select
                  value={form.source}
                  onValueChange={(value) => {
                    if (value !== null) {
                      handleSourceChange(value);
                    }
                  }}
                >
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue>
                      {projectSources.find(
                        (option) => option.value === form.source,
                      )?.label ?? "Selecciona una fuente"}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    {projectSources.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {form.source === "external_entity" && (
                <Field>
                  <FieldLabel htmlFor="sourceDetails">
                    ¿De qué entidad externa proviene?
                  </FieldLabel>

                  <Textarea
                    id="sourceDetails"
                    name="sourceDetails"
                    value={form.sourceDetails}
                    onChange={handleChange}
                    maxLength={MAX_TEXT_LENGTH}
                    rows={3}
                    placeholder="Indica el nombre de la empresa, organización o entidad y una breve descripción."
                    required
                  />

                  <CharacterCounter
                    value={form.sourceDetails}
                    maxLength={MAX_TEXT_LENGTH}
                  />
                </Field>
              )}
            </FieldSet>
          )}

          {/* PASO 2 */}
          {currentStep === 2 && (
            <FieldSet>
              <FieldLegend>
                Descripción y propósito del proyecto
              </FieldLegend>

              <Field>
                <FieldLabel htmlFor="name">
                  Nombre del proyecto
                </FieldLabel>

                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={MAX_NAME_LENGTH}
                  required
                />

                <CharacterCounter
                  value={form.name}
                  maxLength={MAX_NAME_LENGTH}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="description">
                  ¿Qué se propone realizar?
                </FieldLabel>

                <Textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  maxLength={MAX_TEXT_LENGTH}
                  rows={4}
                  placeholder="Describe de forma concreta qué se desarrollará en el proyecto."
                  required
                />

                <CharacterCounter
                  value={form.description}
                  maxLength={MAX_TEXT_LENGTH}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="context">
                  Problema y justificación
                </FieldLabel>

                <Textarea
                  id="context"
                  name="context"
                  value={form.context}
                  onChange={handleChange}
                  maxLength={MAX_TEXT_LENGTH}
                  rows={4}
                  placeholder="Explica qué problema se busca solucionar y por qué el proyecto es necesario."
                  required
                />

                <CharacterCounter
                  value={form.context}
                  maxLength={MAX_TEXT_LENGTH}
                />
              </Field>

              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="font-medium">Duración estimada</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Los proyectos se ejecutan durante{" "}
                  <strong>
                    2 semestres académicos (aproximadamente 1 año)
                  </strong>
                  .
                </p>
              </div>
            </FieldSet>
          )}

          {/* PASO 3 */}
          {currentStep === 3 && (
            <FieldSet>
              <FieldLegend>
                Equipo, resultados y condiciones
              </FieldLegend>

              <Field>
                <FieldLabel>
                  ¿Cuenta con un contacto o asesor de la UTB?
                </FieldLabel>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={
                      form.hasFacultyAdvisor
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleAdvisorChange(true)}
                  >
                    Sí
                  </Button>

                  <Button
                    type="button"
                    variant={
                      !form.hasFacultyAdvisor
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleAdvisorChange(false)}
                  >
                    No
                  </Button>
                </div>
              </Field>

              {form.hasFacultyAdvisor && (
                <Field>
                  <FieldLabel htmlFor="facultyAdvisor">
                    Nombre o contacto UTB
                  </FieldLabel>

                  <Input
                    id="facultyAdvisor"
                    name="facultyAdvisor"
                    value={form.facultyAdvisor}
                    onChange={handleChange}
                    maxLength={MAX_TEXT_LENGTH}
                    placeholder="Nombre del docente o contacto de la UTB"
                    required
                  />

                  <CharacterCounter
                    value={form.facultyAdvisor}
                    maxLength={MAX_TEXT_LENGTH}
                  />
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="teamRequirements">
                  Estudiantes requeridos
                </FieldLabel>

                <FieldDescription>
                  El proyecto requiere un mínimo de{" "}
                  <strong>3 estudiantes</strong>. Indica qué tipo de
                  estudiantes, carreras, conocimientos o perfiles se
                  necesitan.
                </FieldDescription>

                <Textarea
                  id="teamRequirements"
                  name="teamRequirements"
                  value={form.teamRequirements}
                  onChange={handleChange}
                  maxLength={MAX_TEXT_LENGTH}
                  rows={4}
                  placeholder="Ejemplo: mínimo 3 estudiantes de Ingeniería de Sistemas con conocimientos en desarrollo web."
                  required
                />

                <CharacterCounter
                  value={form.teamRequirements}
                  maxLength={MAX_TEXT_LENGTH}
                />
              </Field>

              <Field>
                <FieldLabel>Entregables esperados</FieldLabel>

                <FieldDescription>
                  Indica los productos, documentos, resultados o componentes que
                  deberán entregarse al finalizar el proyecto.
                </FieldDescription>

                <div className="flex flex-col gap-2">
                  {form.deliverables.map((deliverable, index) => (
                    <div
                      key={deliverable.id}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={deliverable.value}
                        onChange={(event) =>
                          handleDeliverableChange(
                            deliverable.id,
                            event.target.value,
                          )
                        }
                        maxLength={MAX_TEXT_LENGTH}
                        placeholder={`Entregable ${index + 1}`}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          removeDeliverable(deliverable.id)
                        }
                        aria-label="Eliminar entregable"
                      >
                        <RiDeleteBinLine />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-fit"
                  onClick={addDeliverable}
                >
                  <RiAddLine data-icon="inline-start" />
                  Agregar entregable
                </Button>
              </Field>

              <Field>
                <FieldLabel htmlFor="expectedOutcomes">
                  Resultados esperados
                </FieldLabel>

                <Textarea
                  id="expectedOutcomes"
                  name="expectedOutcomes"
                  value={form.expectedOutcomes}
                  onChange={handleChange}
                  maxLength={MAX_TEXT_LENGTH}
                  rows={3}
                  placeholder="Describe qué se espera obtener al finalizar el proyecto."
                />

                <CharacterCounter
                  value={form.expectedOutcomes}
                  maxLength={MAX_TEXT_LENGTH}
                />
              </Field>

              <Field orientation="horizontal">
                <Checkbox
                  id="requiresLegalization"
                  checked={form.requiresLegalization}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      requiresLegalization: checked === true,
                    }))
                  }
                />

                <FieldContent>
                  <FieldLabel
                    htmlFor="requiresLegalization"
                    className="font-normal"
                  >
                    Requiere proceso de legalización
                  </FieldLabel>

                  <FieldDescription>
                    Marca esta opción si se requieren convenios,
                    contratos u otros trámites legales.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <Checkbox
                  id="isPrivate"
                  checked={form.isPrivate}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      isPrivate: checked === true,
                    }))
                  }
                />

                <FieldContent>
                  <FieldLabel
                    htmlFor="isPrivate"
                    className="font-normal"
                  >
                    Proyecto privado
                  </FieldLabel>

                  <FieldDescription>
                    Si está marcado, el proyecto permanecerá privado
                    según las reglas de visibilidad de la plataforma.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldSet>
          )}

          {stepError && (
            <Alert variant="destructive">
              <AlertDescription>{stepError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={goToPreviousStep}
              disabled={
                currentStep === 1 || status === "saving"
              }
            >
              Anterior
            </Button>

            {currentStep < steps.length ? (
              <Button type="button" onClick={goToNextStep}>
                Siguiente
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={status === "saving"}
              >
                {status === "saving" && (
                  <Spinner data-icon="inline-start" />
                )}

                {status === "saving"
                  ? "Guardando..."
                  : "Proponer proyecto"}
              </Button>
            )}
          </div>

          {status === "success" && (
            <Alert>
              <AlertDescription>
                Proyecto creado correctamente.
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </form>
    </>
  );
}
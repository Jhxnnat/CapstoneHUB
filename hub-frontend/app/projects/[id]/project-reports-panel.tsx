"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  confirmReportContentFile,
  createReportContent,
  deleteReportContent,
  presignReportContentFile,
  updateReportContent,
  uploadFileToStorage,
} from "../../services/report-contents";
import {
  createProjectReport,
  deleteProjectReport,
  getProjectReports,
  reviewProjectReport,
  submitProjectReport,
  updateProjectReport,
} from "../../services/reports";
import { downloadProjectAttachment } from "../../services/attachments";
import {
  ProjectAttachmentItem,
  ProjectReportContentItem,
  ProjectReportContentKind,
  ProjectReportItem,
} from "../../services/schemas";
import { useAuth } from "../../components/auth-provider";
import AccessNotice from "../../components/access-notice";
import {
  REPORT_FILE_MIME_OPTIONS,
  REPORT_TEXT_MAX_LENGTH,
  toDateTimeLocal,
  validateReportLink,
} from "../../services/utils";
import FormActions from "@/app/components/form-actions";
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RiAddLine } from "@remixicon/react";
import { ContentPayload, ErrorBanner } from "./reports/report-content";
import { ReportCard } from "./reports/report-card";

type ProjectReportsPanelProps = {
  readonly projectId: number;
  readonly reports: ProjectReportItem[];
  readonly actorAssignments: {
    readonly id: number;
    readonly userId: number;
    readonly role: string;
  }[];
  readonly onProjectChange: () => Promise<void>;
};

type ReportFormState = {
  title: string;
  description: string;
  dueDate: string;
  type: ProjectReportContentKind;
  allowedMimeTypes: string[];
  maxFiles: string;
};

const emptyForm: ReportFormState = {
  title: "",
  description: "",
  dueDate: "",
  type: "file",
  allowedMimeTypes: [],
  maxFiles: "",
};

const REPORT_TYPE_OPTIONS: {
  value: ProjectReportContentKind;
  label: string;
}[] = [
  { value: "text", label: "Texto" },
  { value: "link", label: "Enlace" },
  { value: "file", label: "Archivo" },
];

function FormField({
  htmlFor,
  label,
  children,
}: {
  readonly htmlFor: string;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
    </Field>
  );
}

function FormError({ message }: { readonly message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

type ReportDialogFormProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly errorMessage: string | null;
  readonly loading: boolean;
  readonly submitText: string;
  readonly onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
  readonly onCancel: () => void;
  readonly children: React.ReactNode;
};

function ReportDialogForm({
  open,
  onOpenChange,
  title,
  description,
  errorMessage,
  loading,
  submitText,
  onSubmit,
  onCancel,
  children,
}: ReportDialogFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {children}

          {errorMessage ? <FormError message={errorMessage} /> : null}

          <FormActions
            loading={loading}
            loadingText="Guardando..."
            submitText={submitText}
            onCancel={onCancel}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportsAccessNotice({
  ready,
  isAuthenticated,
}: {
  readonly ready: boolean;
  readonly isAuthenticated: boolean;
}) {
  if (!ready) {
    return (
      <Alert>
        <AlertDescription>Cargando acceso...</AlertDescription>
      </Alert>
    );
  }

  if (!isAuthenticated) {
    return (
      <AccessNotice
        variant="alert"
        message="Inicia sesión para enviar entregas."
      />
    );
  }

  return null;
}

type ReportDeleteDialogProps = {
  readonly report: ProjectReportItem | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
};

function ReportDeleteDialog({
  report,
  open,
  onOpenChange,
  onConfirm,
}: ReportDeleteDialogProps) {
  const milestoneTitles = (report?.milestones ?? [])
    .map((milestone) => milestone.title)
    .join(", ");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar entrega</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar la entrega &quot;{report?.title}&quot;? Esta acción no se
            puede deshacer.
            {milestoneTitles ? (
              <span className="mt-2 block text-destructive">
                Está vinculada a los hitos: {milestoneTitles}. Se desvinculará
                de ellos.
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ProjectReportsPanel({
  projectId,
  reports: initialReports,
  actorAssignments,
  onProjectChange,
}: ProjectReportsPanelProps) {
  const { session, isAuthenticated, ready } = useAuth();
  const [reports, setReports] = useState<ProjectReportItem[]>(initialReports);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] =
    useState<ProjectReportItem | null>(null);
  const [form, setForm] = useState<ReportFormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    report: ProjectReportItem;
    decision: "accepted" | "rejected";
  } | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isReviewPending, startReviewTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] =
    useState<ProjectReportItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contentEdit, setContentEdit] = useState<{
    reportId: number;
    content: ProjectReportContentItem;
  } | null>(null);
  const [editText, setEditText] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditPending, startEditTransition] = useTransition();

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  const currentUserId = session?.user.id ?? null;

  const canManage = useMemo(() => {
    if (!session) {
      return false;
    }

    const roles = session.user.roles;
    if (roles.includes("admin")) {
      return true;
    }

    return actorAssignments.some(
      (assignment) =>
        assignment.userId === session.user.id &&
        ((roles.includes("coordinator") && assignment.role === "coordinator") ||
          (roles.includes("evaluator") && assignment.role === "evaluator") ||
          (roles.includes("advisor") && assignment.role === "advisor")),
    );
  }, [session, actorAssignments]);

  const canSubmit = useMemo(() => {
    if (!session) {
      return false;
    }

    const roles = session.user.roles;
    if (roles.includes("admin")) {
      return true;
    }

    return actorAssignments.some(
      (assignment) => assignment.userId === session.user.id,
    );
  }, [session, actorAssignments]);

  const sortedReports = useMemo(
    () =>
      [...reports].sort(
        (left, right) =>
          new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime() ||
          left.id - right.id,
      ),
    [reports],
  );

  const acceptedCount = useMemo(
    () => reports.filter((report) => report.status === "accepted").length,
    [reports],
  );

  async function reloadReports(): Promise<void> {
    const nextReports = await getProjectReports(String(projectId));
    setReports(nextReports);
  }

  function openCreateDialog() {
    setEditingReport(null);
    setForm(emptyForm);
    setErrorMessage(null);
    setDialogOpen(true);
  }

  function openEditDialog(report: ProjectReportItem) {
    setEditingReport(report);
    setForm({
      title: report.title,
      description: report.description ?? "",
      dueDate: toDateTimeLocal(report.dueDate),
      type: report.type,
      allowedMimeTypes: report.allowedMimeTypes,
      maxFiles: report.maxFiles !== null ? String(report.maxFiles) : "",
    });
    setErrorMessage(null);
    setDialogOpen(true);
  }

  function runTransition(action: () => Promise<void>, fallbackError: string) {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : fallbackError);
      }
    });
  }

  function handleFormSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();
    const dueDate = form.dueDate;

    if (!title) {
      setErrorMessage("El título es obligatorio.");
      return;
    }

    if (!dueDate) {
      setErrorMessage("La fecha de entrega es obligatoria.");
      return;
    }

    const isFile = form.type === "file";
    const maxFiles = Number(form.maxFiles);

    if (isFile) {
      if (form.allowedMimeTypes.length === 0) {
        setErrorMessage("Selecciona al menos un tipo de archivo permitido.");
        return;
      }

      if (!Number.isInteger(maxFiles) || maxFiles < 1) {
        setErrorMessage("El máximo de archivos debe ser un número mayor a 0.");
        return;
      }
    }

    const payload = {
      title,
      description: form.description.trim() || null,
      dueDate: new Date(dueDate).toISOString(),
      type: form.type,
      ...(isFile
        ? { allowedMimeTypes: form.allowedMimeTypes, maxFiles }
        : {}),
    };

    runTransition(async () => {
      if (editingReport) {
        await updateProjectReport(String(projectId), editingReport.id, payload);
      } else {
        await createProjectReport(String(projectId), payload);
      }
      setDialogOpen(false);
      await reloadReports();
      await onProjectChange();
    }, "No se pudo guardar la entrega");
  }

  function handleDelete(report: ProjectReportItem) {
    setDeleteTarget(report);
    setDeleteOpen(true);
  }

  function confirmDeleteReport() {
    const report = deleteTarget;

    if (!report) {
      return;
    }

    setDeleteOpen(false);
    setDeleteTarget(null);

    runTransition(async () => {
      await deleteProjectReport(String(projectId), report.id);
      await reloadReports();
      await onProjectChange();
    }, "No se pudo eliminar la entrega");
  }

  function openReviewDialog(
    report: ProjectReportItem,
    decision: "accepted" | "rejected",
  ) {
    setReviewTarget({ report, decision });
    setReviewComment("");
    setReviewError(null);
    setReviewOpen(true);
  }

  function handleReviewSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reviewTarget) {
      return;
    }

    setReviewError(null);

    startReviewTransition(async () => {
      try {
        await reviewProjectReport(
          String(projectId),
          reviewTarget.report.id,
          reviewTarget.decision,
          reviewComment.trim() || undefined,
        );
        setReviewOpen(false);
        setReviewTarget(null);
        await reloadReports();
        await onProjectChange();
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "No se pudo revisar la entrega",
        );
      }
    });
  }

  async function handleCreateContent(
    reportId: number,
    payload: ContentPayload,
  ): Promise<void> {
    await createReportContent(String(projectId), reportId, payload);
    await reloadReports();
  }

  async function handleUploadContent(
    reportId: number,
    file: File,
    onProgress: (fraction: number) => void,
  ): Promise<void> {
    const metadata = {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    };

    const target = await presignReportContentFile(
      String(projectId),
      reportId,
      metadata,
    );

    await uploadFileToStorage(target.uploadUrl, file, onProgress);

    await confirmReportContentFile(String(projectId), reportId, {
      ...metadata,
      storageKey: target.storageKey,
    });

    await reloadReports();
  }

  async function handleDeleteContent(
    reportId: number,
    contentId: number,
  ): Promise<void> {
    await deleteReportContent(String(projectId), reportId, contentId);
    await reloadReports();
  }

  async function handleSubmitReport(report: ProjectReportItem) {
    await submitProjectReport(String(projectId), report.id);
    await reloadReports();
  }

  async function handleDownload(attachment: ProjectAttachmentItem) {
    await downloadProjectAttachment(
      String(projectId),
      attachment.id,
      attachment.originalName,
    );
  }

  function openContentEdit(
    report: ProjectReportItem,
    content: ProjectReportContentItem,
  ) {
    setContentEdit({ reportId: report.id, content });
    setEditText(content.textContent ?? "");
    setEditUrl(content.url ?? "");
    setEditLabel(content.label ?? "");
    setEditError(null);
  }

  function handleContentEditSubmit(
    event: React.SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!contentEdit) {
      return;
    }

    const isText = contentEdit.content.kind === "text";
    const textContent = editText.trim();
    const url = editUrl.trim();
    const label = editLabel.trim() || null;

    if (isText && !textContent) {
      setEditError("El texto no puede estar vacío.");
      return;
    }

    if (!isText) {
      const linkError = validateReportLink(url);

      if (linkError) {
        setEditError(linkError);
        return;
      }
    }

    setEditError(null);

    startEditTransition(async () => {
      try {
        await updateReportContent(
          String(projectId),
          contentEdit.reportId,
          contentEdit.content.id,
          isText ? { textContent } : { url, label },
        );
        setContentEdit(null);
        await reloadReports();
        await onProjectChange();
      } catch (error) {
        setEditError(
          error instanceof Error ? error.message : "No se pudo guardar",
        );
      }
    });
  }

  const reviewDecision = reviewTarget?.decision;
  const reviewDialogTitle =
    reviewDecision === "accepted" ? "Aceptar entrega" : "No aceptar entrega";
  const editingTextContent = contentEdit?.content.kind === "text";
  const configLocked = isPending || Boolean(editingReport?.contents.length);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Entregas</CardTitle>
        <CardDescription>
          {reports.length === 0
            ? "Los asesores, evaluadores y coordinadores crean las entregas para que los estudiantes las envíen."
            : `${acceptedCount} de ${reports.length} aceptadas`}
        </CardDescription>

        {ready && canManage ? (
          <CardAction>
            <Button onClick={openCreateDialog}>
              <RiAddLine data-icon="inline-start" />
              Nueva entrega
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {errorMessage && !dialogOpen ? (
          <ErrorBanner message={errorMessage} />
        ) : null}

        {sortedReports.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Sin entregas</EmptyTitle>
              <EmptyDescription>
                No hay entregas registradas todavía.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {sortedReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                currentUserId={currentUserId}
                canManage={canManage}
                canSubmit={canSubmit}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                onSubmit={handleSubmitReport}
                onReview={openReviewDialog}
                onEditContent={openContentEdit}
                onCreateContent={handleCreateContent}
                onUploadContent={handleUploadContent}
                onDeleteContent={handleDeleteContent}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}

        <ReportsAccessNotice
          ready={ready}
          isAuthenticated={isAuthenticated}
        />
      </CardContent>

      <ReportDialogForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingReport ? "Editar entrega" : "Nueva entrega"}
        description={
          editingReport
            ? "Actualiza los detalles de la entrega."
            : "Crea una entrega para que los estudiantes la envíen."
        }
        errorMessage={errorMessage}
        loading={isPending}
        submitText={editingReport ? "Guardar cambios" : "Crear entrega"}
        onSubmit={handleFormSubmit}
        onCancel={() => setDialogOpen(false)}
      >
        <FormField htmlFor="report-title" label="Título">
          <Input
            id="report-title"
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Nombre de la entrega"
            disabled={isPending}
          />
        </FormField>

        <FormField htmlFor="report-description" label="Descripción">
          <Textarea
            id="report-description"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            rows={3}
            disabled={isPending}
            placeholder="Descripción opcional de la entrega"
          />
        </FormField>

        <FormField htmlFor="report-due-date" label="Fecha de entrega">
          <Input
            id="report-due-date"
            type="datetime-local"
            value={form.dueDate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, dueDate: event.target.value }))
            }
            disabled={isPending}
          />
        </FormField>

        <FormField htmlFor="report-type" label="Tipo de entrega">
          <Select
            value={form.type}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                type: value as ProjectReportContentKind,
                allowedMimeTypes: [],
                maxFiles: "",
              }))
            }
            disabled={configLocked}
          >
            <SelectTrigger id="report-type" className="w-full">
              <SelectValue>
                {REPORT_TYPE_OPTIONS.find(
                  (option) => option.value === form.type,
                )?.label ?? "Tipo"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {form.type === "file" ? (
          <>
            <FormField
              htmlFor="report-mime-types"
              label="Tipos de archivo permitidos"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {REPORT_FILE_MIME_OPTIONS.map((option) => (
                    <label
                      key={option.label}
                      htmlFor={`mime-${option.label}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`mime-${option.label}`}
                        checked={option.values.some((value) =>
                          form.allowedMimeTypes.includes(value),
                        )}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            allowedMimeTypes:
                              checked === true
                                ? [
                                    ...new Set([
                                      ...prev.allowedMimeTypes,
                                      ...option.values,
                                    ]),
                                  ]
                                : prev.allowedMimeTypes.filter(
                                    (value) => !option.values.includes(value),
                                  ),
                          }))
                        }
                        disabled={configLocked}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={configLocked}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      allowedMimeTypes: REPORT_FILE_MIME_OPTIONS.flatMap(
                        (option) => option.values,
                      ),
                    }))
                  }
                >
                  Seleccionar todos
                </Button>
              </div>
            </FormField>

            <FormField htmlFor="report-max-files" label="Máximo de archivos">
              <Input
                id="report-max-files"
                type="number"
                min={1}
                value={form.maxFiles}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, maxFiles: event.target.value }))
                }
                disabled={configLocked}
                placeholder="1"
              />
            </FormField>
          </>
        ) : null}
      </ReportDialogForm>

      <ReportDialogForm
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title={reviewDialogTitle}
        description={
          reviewTarget ? `Entrega "${reviewTarget.report.title}".` : ""
        }
        errorMessage={reviewError}
        loading={isReviewPending}
        submitText={reviewDialogTitle}
        onSubmit={handleReviewSubmit}
        onCancel={() => setReviewOpen(false)}
      >
        <FormField
          htmlFor="review-comment"
          label={`Comentario ${reviewDecision === "rejected" ? "" : "(opcional)"}`}
        >
          <Textarea
            id="review-comment"
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
            rows={3}
            disabled={isReviewPending}
            placeholder="Explica brevemente tu decisión"
          />
        </FormField>
      </ReportDialogForm>

      <ReportDialogForm
        open={contentEdit !== null}
        onOpenChange={(open) => {
          if (!open) {
            setContentEdit(null);
          }
        }}
        title="Editar contenido"
        description={
          editingTextContent
            ? "Actualiza el texto de la entrega."
            : "Actualiza el enlace de la entrega."
        }
        errorMessage={editError}
        loading={isEditPending}
        submitText="Guardar cambios"
        onSubmit={handleContentEditSubmit}
        onCancel={() => setContentEdit(null)}
      >
        {editingTextContent ? (
          <FormField htmlFor="content-edit-text" label="Texto">
            <Textarea
              id="content-edit-text"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              rows={4}
              maxLength={REPORT_TEXT_MAX_LENGTH}
              disabled={isEditPending}
            />
          </FormField>
        ) : (
          <>
            <FormField htmlFor="content-edit-url" label="URL">
              <Input
                id="content-edit-url"
                type="url"
                value={editUrl}
                onChange={(event) => setEditUrl(event.target.value)}
                disabled={isEditPending}
              />
            </FormField>
            <FormField htmlFor="content-edit-label" label="Título (opcional)">
              <Input
                id="content-edit-label"
                value={editLabel}
                onChange={(event) => setEditLabel(event.target.value)}
                disabled={isEditPending}
              />
            </FormField>
          </>
        )}
      </ReportDialogForm>

      <ReportDeleteDialog
        report={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDeleteReport}
      />
    </Card>
  );
}

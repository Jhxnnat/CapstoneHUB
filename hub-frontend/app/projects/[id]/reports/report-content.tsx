"use client";

import { useState } from "react";
import { getReportContentStreamUrl } from "../../../services/report-contents";
import {
  ProjectAttachmentItem,
  ProjectReportContentItem,
  ProjectReportContentKind,
  ProjectReportItem,
} from "../../../services/schemas";
import {
  REPORT_TEXT_MAX_LENGTH,
  formatBytes,
  formatDate,
  validateReportFile,
  validateReportLink,
} from "../../../services/utils";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  RiAttachmentLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiFileTextLine,
  RiImageLine,
  RiLinkM,
  RiPencilLine,
  RiVideoLine,
} from "@remixicon/react";

export type ContentPayload =
  | { kind: "text"; textContent: string }
  | { kind: "link"; url: string; label?: string | null };

export const CONTENT_KIND_LABELS: Record<ProjectReportContentKind, string> = {
  text: "Texto",
  link: "Enlace",
  image: "Imagen",
  video: "Video",
  file: "Archivo",
};

export function ContentKindIcon({
  kind,
  mimeType,
  className,
}: {
  readonly kind: ProjectReportContentKind;
  readonly mimeType?: string;
  readonly className?: string;
}) {
  if (kind === "file" && mimeType) {
    if (mimeType.startsWith("image/")) {
      return <RiImageLine className={className} />;
    }

    if (mimeType.startsWith("video/")) {
      return <RiVideoLine className={className} />;
    }

    return <RiAttachmentLine className={className} />;
  }

  switch (kind) {
    case "text":
      return <RiFileTextLine className={className} />;
    case "link":
      return <RiLinkM className={className} />;
    case "image":
      return <RiImageLine className={className} />;
    case "video":
      return <RiVideoLine className={className} />;
    default:
      return <RiAttachmentLine className={className} />;
  }
}

function contentMediaLabel(
  kind: ProjectReportContentKind,
  mimeType: string,
): string {
  if (kind === "file" && mimeType) {
    if (mimeType.startsWith("image/")) {
      return "Imagen";
    }

    if (mimeType.startsWith("video/")) {
      return "Video";
    }

    return "Archivo";
  }

  return CONTENT_KIND_LABELS[kind];
}

export function ErrorBanner({
  message,
  className,
}: {
  readonly message: string;
  readonly className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

type ReportContentRowProps = {
  readonly content: ProjectReportContentItem;
  readonly streamUrl: string | null;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly busy: boolean;
  readonly onEdit: (content: ProjectReportContentItem) => void;
  readonly onDelete: (content: ProjectReportContentItem) => void;
  readonly onDownload: (attachment: ProjectAttachmentItem) => void;
};

function ReportContentRow({
  content,
  streamUrl,
  canEdit,
  canDelete,
  busy,
  onEdit,
  onDelete,
  onDownload,
}: ReportContentRowProps) {
  const attachment = content.attachment;
  const mimeType = attachment?.mimeType ?? "";
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const canEditContent =
    canEdit && (content.kind === "text" || content.kind === "link");

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ContentKindIcon
            kind={content.kind}
            mimeType={mimeType}
            className="size-4 shrink-0"
          />
          {contentMediaLabel(content.kind, mimeType)}
          {content.createdBy ? (
            <span className="font-normal">
              · {content.createdBy.fullName}
            </span>
          ) : null}
          <span className="font-normal">· {formatDate(content.createdAt)}</span>
        </div>

        <div className="flex justify-end gap-1">
          {canEditContent ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Editar contenido"
              onClick={() => onEdit(content)}
              disabled={busy}
            >
              <RiPencilLine />
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Eliminar contenido"
              className="text-destructive"
              onClick={() => onDelete(content)}
              disabled={busy}
            >
              <RiDeleteBinLine />
            </Button>
          ) : null}
        </div>
      </div>

      {content.kind === "text" ? (
        <p className="whitespace-pre-line text-sm text-foreground">
          {content.textContent}
        </p>
      ) : null}

      {content.kind === "link" ? (
        <div className="flex flex-col gap-1">
          <a
            href={content.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all text-sm font-medium text-utb-blue hover:underline"
          >
            <RiExternalLinkLine className="size-4 shrink-0" />
            {content.label ?? content.url}
          </a>
          {content.label && content.url ? (
            <p className="break-all text-xs text-muted-foreground">
              {content.url}
            </p>
          ) : null}
        </div>
      ) : null}

      {isImage && attachment && streamUrl ? (
        <div className="flex flex-col gap-1">
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={streamUrl}
              alt={attachment.originalName}
              className="max-h-80 w-auto rounded-lg border"
            />
          </a>
          <p className="text-xs text-muted-foreground">
            {attachment.originalName} · {formatBytes(attachment.sizeBytes)}
          </p>
        </div>
      ) : null}

      {isVideo && attachment && streamUrl ? (
        <div className="flex flex-col gap-1">
          <video
            controls
            preload="metadata"
            src={streamUrl}
            className="w-full max-w-xl rounded-lg border"
          >
            {/* S4084: los videos son subidos por el usuario; se declara la
                pista de subtítulos para cumplir accesibilidad. */}
            <track kind="captions" label="Subtítulos" />
          </video>
          <p className="text-xs text-muted-foreground">
            {attachment.originalName} · {formatBytes(attachment.sizeBytes)}
          </p>
        </div>
      ) : null}

      {content.kind === "file" && !isImage && !isVideo && attachment ? (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="link"
            onClick={() => onDownload(attachment)}
            className="h-auto w-fit justify-start p-0 font-medium"
          >
            <RiAttachmentLine className="size-4 shrink-0" />
            {attachment.originalName}
          </Button>
          <p className="text-xs text-muted-foreground">
            {formatBytes(attachment.sizeBytes)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>, fallbackError: string) {
    setErrorMessage(null);
    setBusy(true);

    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : fallbackError);
    } finally {
      setBusy(false);
    }
  }

  return { busy, errorMessage, setBusy, setErrorMessage, run };
}

type ReportContentComposerProps = {
  readonly reportType: ProjectReportContentKind;
  readonly allowedMimeTypes: string[];
  readonly fileCount: number;
  readonly maxFiles: number | null;
  readonly onCreateContent: (payload: ContentPayload) => Promise<void>;
  readonly onUploadContent: (
    file: File,
    onProgress: (fraction: number) => void,
  ) => Promise<void>;
};

export function ReportContentComposer({
  reportType,
  allowedMimeTypes,
  fileCount,
  maxFiles,
  onCreateContent,
  onUploadContent,
}: ReportContentComposerProps) {
  const [textValue, setTextValue] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [labelValue, setLabelValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const { busy, errorMessage, setBusy, setErrorMessage, run } = useAsyncAction();

  function resetComposer(form?: HTMLFormElement) {
    setTextValue("");
    setUrlValue("");
    setLabelValue("");
    setSelectedFile(null);
    form?.reset();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    const file = event.target.files?.[0] ?? null;

    if (!file || reportType !== "file") {
      setSelectedFile(null);
      return;
    }

    const validationError = validateReportFile(file, allowedMimeTypes);

    if (validationError) {
      setErrorMessage(validationError);
      setSelectedFile(null);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (reportType === "text") {
      const text = textValue.trim();

      if (!text) {
        setErrorMessage("Escribe el texto de la entrega.");
        return;
      }

      await run(async () => {
        await onCreateContent({ kind: "text", textContent: text });
        resetComposer(form);
      }, "No se pudo agregar el texto");
      return;
    }

    if (reportType === "link") {
      const linkError = validateReportLink(urlValue);

      if (linkError) {
        setErrorMessage(linkError);
        return;
      }

      await run(async () => {
        await onCreateContent({
          kind: "link",
          url: urlValue.trim(),
          label: labelValue.trim() || null,
        });
        resetComposer(form);
      }, "No se pudo agregar el enlace");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Selecciona un archivo antes de subirlo.");
      return;
    }

    const file = selectedFile;

    setErrorMessage(null);
    setBusy(true);
    setUploadProgress(0);

    try {
      await onUploadContent(file, (fraction) => setUploadProgress(fraction));
      resetComposer(form);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo subir el archivo",
      );
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  }

  return (
    <>
      <Separator />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        {reportType === "text" ? (
          <Textarea
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            rows={4}
            maxLength={REPORT_TEXT_MAX_LENGTH}
            disabled={busy}
            placeholder="Escribe el contenido de la entrega"
          />
        ) : null}

        {reportType === "link" ? (
          <div className="flex flex-col gap-3">
            <Input
              type="url"
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
              disabled={busy}
              placeholder="https://ejemplo.com/recurso"
            />
            <Input
              value={labelValue}
              onChange={(event) => setLabelValue(event.target.value)}
              disabled={busy}
              placeholder="Título del enlace (opcional)"
            />
          </div>
        ) : null}

        {reportType === "file" ? (
          <Input
            type="file"
            onChange={handleFileChange}
            disabled={busy}
            accept={allowedMimeTypes.join(",")}
          />
        ) : null}

        {uploadProgress !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-utb-blue transition-[width]"
                style={{ width: `${Math.round(uploadProgress * 100)}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs text-muted-foreground">
              {Math.round(uploadProgress * 100)}%
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {reportType === "file" && maxFiles !== null
              ? `${fileCount} de ${maxFiles} archivos. `
              : ""}
            {getComposerHint(reportType, selectedFile)}
          </span>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando..." : "Agregar contenido"}
          </Button>
        </div>

        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
      </form>
    </>
  );
}

type ReportContentsProps = {
  readonly report: ProjectReportItem;
  readonly canEditContent: boolean;
  readonly canDeleteContent: (content: ProjectReportContentItem) => boolean;
  readonly onEditContent: (
    report: ProjectReportItem,
    content: ProjectReportContentItem,
  ) => void;
  readonly onDeleteContent: (reportId: number, contentId: number) => Promise<void>;
  readonly onDownload: (attachment: ProjectAttachmentItem) => void;
};

export function ReportContents({
  report,
  canEditContent,
  canDeleteContent,
  onEditContent,
  onDeleteContent,
  onDownload,
}: ReportContentsProps) {
  const { busy, errorMessage, run } = useAsyncAction();
  const [deleteTarget, setDeleteTarget] =
    useState<ProjectReportContentItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    const content = deleteTarget;

    if (!content) {
      return;
    }

    setDeleteOpen(false);
    setDeleteTarget(null);

    void run(
      () => onDeleteContent(report.id, content.id),
      "No se pudo eliminar el contenido",
    );
  }

  return (
    <>
      {report.contents.length > 0 ? (
        <div className="flex flex-col gap-3">
          {report.contents.map((content) => (
            <ReportContentRow
              key={content.id}
              content={content}
              streamUrl={
                content.kind === "text" || content.kind === "link"
                  ? null
                  : getReportContentStreamUrl(
                      String(report.projectId),
                      report.id,
                      content.id,
                    )
              }
              canEdit={canEditContent}
              canDelete={canDeleteContent(content)}
              busy={busy}
              onEdit={(target) => onEditContent(report, target)}
              onDelete={(target) => {
                setDeleteTarget(target);
                setDeleteOpen(true);
              }}
              onDownload={onDownload}
            />
          ))}
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Sin contenido</EmptyTitle>
            <EmptyDescription>
              Esta entrega todavía no tiene texto, enlaces ni archivos.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contenido</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar este contenido de la entrega? Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirmDelete()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getComposerHint(
  kind: ProjectReportContentKind,
  selectedFile: File | null,
): string {
  if (kind === "text") {
    return "El texto se guarda como contenido de la entrega.";
  }

  if (kind === "link") {
    return "Comparte una URL (sitio, video externo, repositorio).";
  }

  if (selectedFile) {
    return `${selectedFile.name} · ${formatBytes(selectedFile.size)}`;
  }

  return "Documentos, imágenes o videos. Máximo 100 MB.";
}

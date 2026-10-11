"use client";

import { useState } from "react";
import { changePassword } from "../services/auth";
import PasswordInput from "../components/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

/** Errores conocidos del backend, traducidos para el formulario. */
const BACKEND_ERRORS: Record<string, string> = {
  "Current password is incorrect": "La contraseña actual no es correcta.",
  "The new password must be different from the current one":
    "La nueva contraseña debe ser diferente a la actual.",
};

/**
 * Cambio de contraseña del usuario autenticado. Valida en cliente y traduce los
 * errores esperados del backend; el 400 por contraseña actual incorrecta no
 * cierra la sesión (a diferencia de un 401).
 */
export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage("Ingresa tu contraseña actual.");
      return;
    }

    if (!newPassword) {
      setErrorMessage("Ingresa la nueva contraseña.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage("La nueva contraseña debe ser diferente a la actual.");
      return;
    }

    if (!confirmPassword) {
      setErrorMessage("Confirma la nueva contraseña.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Contraseña actualizada.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la contraseña.";
      setErrorMessage(BACKEND_ERRORS[message] ?? message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Confirma tu contraseña actual y define una nueva de al menos 8
          caracteres.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="currentPassword">
                Contraseña actual
              </FieldLabel>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="newPassword">Nueva contraseña</FieldLabel>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSubmitting}
              />
              <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmNewPassword">
                Confirmar nueva contraseña
              </FieldLabel>
              <PasswordInput
                id="confirmNewPassword"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </Field>

            <Button type="submit" disabled={isSubmitting} className="w-fit">
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? "Guardando..." : "Cambiar contraseña"}
            </Button>

            {successMessage ? (
              <Alert>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            ) : null}

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

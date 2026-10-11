"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../components/auth-provider";
import PasswordInput from "../components/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { isValidEmail } from "@/lib/validation";

export default function RegisterForm() {
  const router = useRouter();
  const { register, ready, isAuthenticated } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const redirectChecked = useRef(false);

  // Si ya hay sesión al abrir /register, se envía al perfil. La comprobación se
  // hace una sola vez para no competir con el alta y su redirección a /submit.
  useEffect(() => {
    if (!ready || redirectChecked.current) {
      return;
    }

    redirectChecked.current = true;

    if (isAuthenticated) {
      setRedirecting(true);
      router.replace("/profile");
    }
  }, [ready, isAuthenticated, router]);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage("Ingresa tu nombre completo.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Ingresa tu correo electrónico.");
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage("Ingresa un correo electrónico válido.");
      return;
    }

    if (!password) {
      setErrorMessage("Ingresa una contraseña.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (!confirmPassword) {
      setErrorMessage("Confirma tu contraseña.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      router.push("/submit");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear la cuenta",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (redirecting) {
    return <div className="utb-skeleton h-72 w-full rounded-2xl" />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="fullName">Nombre completo</FieldLabel>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            placeholder="Nombre y apellido"
            disabled={isSubmitting}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="usuario@correo.com"
            disabled={isSubmitting}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <PasswordInput
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            placeholder="Tu contraseña"
            disabled={isSubmitting}
          />
          <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword">
            Confirmar contraseña
          </FieldLabel>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            placeholder="Repite tu contraseña"
            disabled={isSubmitting}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </Button>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-utb-blue hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}

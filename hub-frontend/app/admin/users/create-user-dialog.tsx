"use client";

import FormActions from "@/app/components/form-actions";
import PasswordInput from "@/app/components/password-input";
import { useState } from "react";
import { createUser, AuthUser } from "../../services/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/lib/validation";

const roles = [
  { value: "student", label: "Estudiante" },
  { value: "advisor", label: "Asesor" },
  { value: "coordinator", label: "Coordinador" },
  { value: "evaluator", label: "Evaluador" },
  { value: "proposer", label: "Proponente" },
  { value: "admin", label: "Administrador" },
];

type CreateUserDialogProps = {
  onUserCreated: (user: AuthUser) => void;
};

export default function CreateUserDialog({
  onUserCreated,
}: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("student");
    setError(null);
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Todos los campos son obligatorios.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const user = await createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        roles: [role],
      });

      onUserCreated(user);

      resetForm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo crear el usuario.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);

        if (!value) {
          resetForm();
        }
      }}
    >
      <DialogTrigger render={<Button />}>Crear usuario</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>

          <DialogDescription>
            Crea un usuario para realizar pruebas en CapstoneHUB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fullName">Nombre completo</FieldLabel>

              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nombre del usuario"
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>

              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@ejemplo.com"
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>

              <PasswordInput
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="role">Rol</FieldLabel>

              <Select
                value={role}
                onValueChange={(value) => {
                  if (value) {
                    setRole(value);
                  }
                }}
                disabled={loading}
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue>
                    {roles.find((item) => item.value === role)?.label ??
                      "Selecciona un rol"}
                  </SelectValue>
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    {roles.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <FormActions
              loading={loading}
              loadingText="Creando..."
              submitText="Crear usuario"
              onCancel={() => setOpen(false)}
            />
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

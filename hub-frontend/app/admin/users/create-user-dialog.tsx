"use client";

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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const roles = [
  { value: "student", label: "Estudiante" },
  { value: "advisor", label: "Asesor" },
  { value: "coordinator", label: "Coordinador" },
  { value: "evaluator", label: "Evaluador" },
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Todos los campos son obligatorios.");
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
        <DialogTrigger>
        Crear usuario
        </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>

          <DialogDescription>
            Crea un usuario para realizar pruebas en CapstoneHUB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre completo</Label>

            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nombre del usuario"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>

            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@ejemplo.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>

            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>

            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={loading}
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
            >
              {roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>

            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
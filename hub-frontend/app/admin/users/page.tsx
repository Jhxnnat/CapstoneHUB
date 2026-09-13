"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-provider";
import { getUsers, AuthUser } from "../../services/auth";
import CreateUserDialog from "./create-user-dialog";
import EditUserRolesDialog from "./edit-user-roles-dialog";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  evaluator: "Evaluador",
  coordinator: "Coordinador",
  advisor: "Asesor",
  student: "Estudiante",
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { session, ready, isAuthenticated } = useAuth();

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    const isAdmin = session?.user.roles.includes("admin");

    if (!isAdmin) {
      router.replace("/");
      return;
    }

    async function loadUsers() {
      try {
        setLoading(true);
        setError(null);

        const data = await getUsers();
        setUsers(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los usuarios.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [ready, isAuthenticated, session, router]);

  if (!ready || loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <p className="text-sm text-muted-foreground">
          Cargando usuarios...
        </p>
      </main>
    );
  }

  if (!isAuthenticated || !session?.user.roles.includes("admin")) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Panel del administrador
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Gestión de usuarios y roles del sistema.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
            <h2 className="font-semibold">Usuarios</h2>
            <p className="text-sm text-muted-foreground">
            Usuarios registrados en CapstoneHUB.
            </p>
        </div>

        <CreateUserDialog
            onUserCreated={(user) => {
            setUsers((currentUsers) => [...currentUsers, user]);
            }}
        />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-6 py-3 text-left font-medium">
                  Nombre
                </th>

                <th className="px-6 py-3 text-left font-medium">
                  Correo
                </th>

                <th className="px-6 py-3 text-left font-medium">
                  Roles
                </th>

                <th className="px-6 py-3 text-left font-medium">
                    Acciones
                </th>

              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-muted-foreground"
                  >
                    No hay usuarios registrados.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0"
                  >
                    <td className="px-6 py-4 font-medium">
                      {user.fullName}
                    </td>

                    <td className="px-6 py-4">
                      {user.email}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full border px-2.5 py-1 text-xs"
                          >
                            {roleLabels[role] ?? role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                    <EditUserRolesDialog
                        user={user}
                        onUserUpdated={(updatedUser) => {
                        setUsers((currentUsers) =>
                            currentUsers.map((currentUser) =>
                            currentUser.id === updatedUser.id
                                ? updatedUser
                                : currentUser,
                            ),
                        );
                        }}
                    />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
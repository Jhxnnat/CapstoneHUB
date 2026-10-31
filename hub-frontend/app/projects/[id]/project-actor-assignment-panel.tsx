"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  addProjectActorAssignment,
  getAssignableUsers,
} from "../../services/projects";
import { UserSummary } from "../../services/schemas";
import {
  ActorRole,
  assignableActorRoles,
  isActorRole,
} from "../../services/roles";
import { canAssignActors } from "../../services/project-permissions";
import { formatRole, getInitials } from "../../services/utils";
import { useAuth } from "../../components/auth-provider";
import AccessNotice from "../../components/access-notice";
import InterestedStudentsList from "./interested-students-list";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

type ProjectActorAssignment = {
  id: number;
  projectId: number;
  userId: number;
  role: string;
  assignedAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
};

type ProjectActorAssignmentPanelProps = {
  projectId: number;
  assignments: ProjectActorAssignment[];
  onProjectChange: () => Promise<void>;
};

function getRoleLabel(role: string | null): string {
  if (!role) {
    return "Sin rol asignable";
  }

  return formatRole(role);
}

function getAssignableRoleLabel(user: UserSummary): string {
  const roles = assignableActorRoles(user.roles);

  if (roles.length === 0) {
    return "Sin rol asignable";
  }

  return roles.map((role) => formatRole(role)).join(" / ");
}

function formatDate(dateValue: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function useProjectUsers(
  projectId: number,
  ready: boolean,
  isAuthenticated: boolean,
  canAssign: boolean,
) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !isAuthenticated || !canAssign || users.length > 0) {
      return;
    }

    void getAssignableUsers(projectId).then(({ users: nextUsers, error }) => {
      if (error) {
        setErrorMessage(error);
        return;
      }

      setUsers(nextUsers);
    });
  }, [canAssign, isAuthenticated, projectId, ready, users.length]);

  return {
    users,
    errorMessage,
    setErrorMessage,
  };
}

function AccessMessage() {
  return (
    <Card>
      <CardContent className="pt-6 text-sm text-muted-foreground">
        Cargando acceso...
      </CardContent>
    </Card>
  );
}

function LoginMessage() {
  return (
    <AccessNotice
      title="Equipo del proyecto"
      message="Inicia sesión para gestionar el equipo del proyecto."
    />
  );
}

type AssignmentFormProps = {
  projectId: number;
  users: UserSummary[];
  initialError: string | null;
  onErrorChange: (message: string | null) => void;
  onProjectChange: () => Promise<void>;
  onAssigned: () => void;
};

function AssignmentForm({
  projectId,
  users,
  initialError,
  onErrorChange,
  onProjectChange,
  onAssigned,
}: Readonly<AssignmentFormProps>) {
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [selectedRole, setSelectedRole] = useState<ActorRole | null>(null);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      const fullName = user.fullName.toLowerCase();
      const email = user.email.toLowerCase();

      return (
        fullName.includes(normalizedSearch) ||
        email.includes(normalizedSearch)
      );
    });
  }, [search, users]);

  const selectedRoles = selectedUser
    ? assignableActorRoles(selectedUser.roles)
    : [];

  function handleSelectUser(user: UserSummary) {
    setSelectedUser(user);
    setSelectedRole(assignableActorRoles(user.roles)[0] ?? null);
    setSearch("");
    onErrorChange(null);
  }

  function handleSearchChange(value: string) {
    setSelectedUser(null);
    setSelectedRole(null);
    setSearch(value);
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onErrorChange(null);

    if (!selectedUser) {
      onErrorChange("Selecciona un usuario.");
      return;
    }

    if (!selectedRole) {
      onErrorChange(
        "El usuario seleccionado no tiene un rol válido para este proyecto.",
      );
      return;
    }

    startTransition(async () => {
      try {
        await addProjectActorAssignment(projectId, {
          userId: selectedUser.id,
          role: selectedRole,
        });

        setSelectedUser(null);
        setSelectedRole(null);
        setSearch("");
        onAssigned();
        await onProjectChange();
      } catch (error) {
        onErrorChange(
          error instanceof Error
            ? error.message
            : "No se pudo asignar el usuario",
        );
      }
    });
  }

  const errorMessage = initialError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignar usuario</CardTitle>
        <CardDescription>
          Busca una persona y asígnala a este proyecto.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <UserSearch
              users={filteredUsers}
              selectedUser={selectedUser}
              search={search}
              isPending={isPending}
              onSearchChange={handleSearchChange}
              onSelectUser={handleSelectUser}
            />

            <RoleField
              roles={selectedRoles}
              value={selectedRole}
              onChange={setSelectedRole}
            />

            <Button
              type="submit"
              disabled={isPending || !selectedUser || !selectedRole}
            >
              {isPending ? "Asignando..." : "Asignar"}
            </Button>
          </div>

          {selectedUser ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Se asignará</span>
              <Badge variant="outline">{selectedUser.fullName}</Badge>
              <span>como</span>
              <Badge variant="secondary">{getRoleLabel(selectedRole)}</Badge>
            </div>
          ) : null}

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

type UserSearchProps = {
  users: UserSummary[];
  selectedUser: UserSummary | null;
  search: string;
  isPending: boolean;
  onSearchChange: (value: string) => void;
  onSelectUser: (user: UserSummary) => void;
};

function UserSearch({
  users,
  selectedUser,
  search,
  isPending,
  onSearchChange,
  onSelectUser,
}: Readonly<UserSearchProps>) {
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && !selectedUser && search.trim().length > 0;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setDismissed(true);
        }
      }}
    >
      <Field className="relative">
        <FieldLabel htmlFor="project-user-search">Usuario</FieldLabel>

        <PopoverTrigger
          nativeButton={false}
          render={
            <Input
              id="project-user-search"
              value={
                selectedUser
                  ? `${selectedUser.fullName} — ${selectedUser.email}`
                  : search
              }
              onChange={(event) => {
                setDismissed(false);
                onSearchChange(event.target.value);
              }}
              placeholder="Buscar por nombre o correo..."
              autoComplete="off"
              disabled={isPending}
            />
          }
        />

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          initialFocus={false}
          className="max-h-60 w-(--anchor-width) overflow-y-auto p-1"
        >
          <UserSearchResults users={users} onSelectUser={onSelectUser} />
        </PopoverContent>
      </Field>
    </Popover>
  );
}

function UserSearchResults({
  users,
  onSelectUser,
}: Readonly<{
  users: UserSummary[];
  onSelectUser: (user: UserSummary) => void;
}>) {
  if (users.length === 0) {
    return (
      <div className="px-3 py-3 text-sm text-muted-foreground">
        No se encontraron usuarios.
      </div>
    );
  }

  return (
    <div className="flex flex-col text-popover-foreground">
      {users.map((user) => (
        <Item
          key={user.id}
          render={
            <button type="button" onClick={() => onSelectUser(user)} />
          }
          className="rounded-none border-b border-border last:border-b-0"
        >
          <ItemMedia>
            <Avatar>
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
          </ItemMedia>

          <ItemContent>
            <ItemTitle>{user.fullName}</ItemTitle>
            <ItemDescription>{user.email}</ItemDescription>
          </ItemContent>

          <Badge variant="outline">{getAssignableRoleLabel(user)}</Badge>
        </Item>
      ))}
    </div>
  );
}

function RoleField({
  roles,
  value,
  onChange,
}: Readonly<{
  roles: ActorRole[];
  value: ActorRole | null;
  onChange: (role: ActorRole) => void;
}>) {
  return (
    <Field>
      <FieldLabel htmlFor="project-role">Rol</FieldLabel>

      {roles.length > 1 ? (
        <Select
          value={value ?? undefined}
          onValueChange={(nextValue) => {
            if (nextValue && isActorRole(nextValue)) {
              onChange(nextValue);
            }
          }}
        >
          <SelectTrigger id="project-role" className="w-full">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {getRoleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id="project-role"
          value={
            roles.length === 1
              ? getRoleLabel(roles[0])
              : "Selecciona un usuario"
          }
          readOnly
          disabled
        />
      )}
    </Field>
  );
}

function AssignedUsersList({
  assignments,
}: Readonly<{
  assignments: ProjectActorAssignment[];
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios asignados</CardTitle>
        <CardDescription>
          {assignments.length === 0
            ? "No hay usuarios asignados todavía."
            : `${assignments.length} usuario(s) en el equipo.`}
        </CardDescription>
      </CardHeader>

      {assignments.length > 0 ? (
        <CardContent className="flex flex-col gap-3">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4"
            >
              <Avatar>
                <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                  {getInitials(assignment.user.fullName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {assignment.user.fullName}
                  </p>

                  <Badge variant="secondary">
                    {getRoleLabel(assignment.role)}
                  </Badge>
                </div>

                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {assignment.user.email}
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  Asignado el {formatDate(assignment.assignedAt)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}

export default function ProjectActorAssignmentPanel({
  projectId,
  assignments,
  onProjectChange,
}: ProjectActorAssignmentPanelProps) {
  const { session, isAuthenticated, ready } = useAuth();
  const [interestsVersion, setInterestsVersion] = useState(0);

  const currentUser = session?.user;

  const canAssign = currentUser
    ? canAssignActors(currentUser, assignments)
    : false;

  const { users, errorMessage, setErrorMessage } = useProjectUsers(
    projectId,
    ready,
    isAuthenticated,
    canAssign,
  );

  if (!ready) {
    return <AccessMessage />;
  }

  if (!isAuthenticated) {
    return <LoginMessage />;
  }

  return (
    <div className="flex flex-col gap-6">
      {canAssign ? (
        <>
          <AssignmentForm
            projectId={projectId}
            users={users}
            initialError={errorMessage}
            onErrorChange={setErrorMessage}
            onProjectChange={onProjectChange}
            onAssigned={() => setInterestsVersion((version) => version + 1)}
          />

          <InterestedStudentsList
            projectId={projectId}
            refreshKey={interestsVersion}
            onProjectChange={onProjectChange}
          />
        </>
      ) : null}

      <AssignedUsersList assignments={assignments} />
    </div>
  );
}

-- Interés de un estudiante por un proyecto aprobado. Un estudiante puede
-- interesarse en varios proyectos, pero solo una vez por proyecto; el mensaje
-- es opcional y el registro se elimina en cascada con el proyecto o el usuario.

CREATE TABLE "project_interest" (
  "id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_interest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uk_project_interest" ON "project_interest"("project_id", "user_id");
CREATE INDEX "idx_project_interest_project_id" ON "project_interest"("project_id");
CREATE INDEX "idx_project_interest_user_id" ON "project_interest"("user_id");

ALTER TABLE "project_interest"
  ADD CONSTRAINT "project_interest_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_interest"
  ADD CONSTRAINT "project_interest_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

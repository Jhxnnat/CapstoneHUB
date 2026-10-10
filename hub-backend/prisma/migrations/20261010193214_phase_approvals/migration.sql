-- CreateTable
CREATE TABLE "project_phase_approval" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "phase" "ProjectPhase" NOT NULL,
    "approver_user_id" INTEGER NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_phase_approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_project_phase_approval_project_id" ON "project_phase_approval"("project_id");

-- CreateIndex
CREATE INDEX "idx_project_phase_approval_approver_user_id" ON "project_phase_approval"("approver_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uk_project_phase_approval" ON "project_phase_approval"("project_id", "phase", "approver_user_id");

-- AddForeignKey
ALTER TABLE "project_phase_approval" ADD CONSTRAINT "project_phase_approval_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_phase_approval" ADD CONSTRAINT "project_phase_approval_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

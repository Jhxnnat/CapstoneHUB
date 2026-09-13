import { Button } from "@/components/ui/button";

type FormActionsProps = {
  loading: boolean;
  loadingText: string;
  submitText: string;
  onCancel: () => void;
};

export default function FormActions({
  loading,
  loadingText,
  submitText,
  onCancel,
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={loading}
      >
        Cancelar
      </Button>

      <Button type="submit" disabled={loading}>
        {loading ? loadingText : submitText}
      </Button>
    </div>
  );
}
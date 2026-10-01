"use client";

import { useFormStatus } from "react-dom";

type Props = React.ComponentProps<"button"> & { pendingText?: string };

export function SubmitButton({ children, pendingText, className = "btn btn-primary", disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className} {...rest}>
      {pending ? (pendingText ?? "Saving...") : children}
    </button>
  );
}

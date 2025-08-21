import Link from "next/link";
import { useLoadingState } from "@/hooks/useLoadingState";
import { ComponentProps } from "react";

type LoadingLinkProps = ComponentProps<typeof Link>;

export function LoadingLink({ children, ...props }: LoadingLinkProps) {
  const { handleLinkClick } = useLoadingState();

  return (
    <Link {...props} onClick={handleLinkClick}>
      {children}
    </Link>
  );
}

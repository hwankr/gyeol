"use client";

import { LoginScreen } from "@/components/LoginScreen";
import { PageTransition } from "@/components/PageTransition";
import { useLogin } from "@/hooks/useLogin";

export default function LoginPage() {
  const login = useLogin();
  return (
    <PageTransition cover>
      <LoginScreen {...login} />
    </PageTransition>
  );
}

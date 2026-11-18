"use client";

import { LoginScreen } from "@/components/LoginScreen";
import { useLogin } from "@/hooks/useLogin";

export default function LoginPage() {
  const login = useLogin();
  return <LoginScreen {...login} />;
}

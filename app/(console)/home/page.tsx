"use client";

import { HomeScreen } from "@/components/HomeScreen";
import { PageTransition } from "@/components/PageTransition";
import { useHome } from "@/hooks/useHome";

export default function HomePage() {
  const home = useHome();
  return (
    <PageTransition>
      <HomeScreen {...home} />
    </PageTransition>
  );
}

"use client";
import { useEffect, useState } from "react";
export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div style={{ padding: 24 }}>{mounted ? "hydrated ✅" : "SSR placeholder ⏳"}</div>;
}
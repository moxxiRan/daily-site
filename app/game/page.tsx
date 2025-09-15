"use client";
import { useEffect } from "react";
import ElegantDaily from "../ElegantDaily";

export default function GameDailyPage() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("cat") !== "game") {
        url.searchParams.set("cat", "game");
        window.history.replaceState(null, "", url.toString());
      }
    } catch {}
  }, []);

  return <ElegantDaily />;
}
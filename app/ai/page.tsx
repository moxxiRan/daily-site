"use client";
import { useEffect } from "react";
import ElegantDaily from "../ElegantDaily";

export default function AIDailyPage() {
  // 规范默认分类为 ai，避免受上一次访问或其他页面注入的 cat 影响
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("cat") !== "ai") {
        url.searchParams.set("cat", "ai");
        window.history.replaceState(null, "", url.toString());
      }
    } catch {}
  }, []);

  return <ElegantDaily />;
}
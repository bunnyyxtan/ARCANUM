"use client";

import { useEffect, useRef, useState } from "react";

interface NoticeState {
  notice: string;
  showNotice: (message: string) => void;
}

export function useNotice(): NoticeState {
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2800);
  };

  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  return { notice, showNotice };
}

"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAccount, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/format/address";
import { motionDurations, motionOpacity, motionTransforms, motionTransition } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function ConnectWalletButton() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const reducedMotion = useReducedMotion();
  const hasSeenInitialState = useRef(false);
  const wasConnected = useRef(isConnected);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!hasSeenInitialState.current) {
      hasSeenInitialState.current = true;
      wasConnected.current = isConnected;
      return;
    }

    if (isConnected && !wasConnected.current) {
      toast("Welcome / opening dashboard...");
      redirectTimer.current = setTimeout(() => {
        router.push("/dashboard");
      }, motionDurations.landingRedirect);
    }

    if (!isConnected && redirectTimer.current !== undefined) {
      clearTimeout(redirectTimer.current);
      redirectTimer.current = undefined;
    }

    wasConnected.current = isConnected;

    return () => {
      if (redirectTimer.current !== undefined) {
        clearTimeout(redirectTimer.current);
        redirectTimer.current = undefined;
      }
    };
  }, [isConnected, router]);

  function enterApp() {
    if (redirectTimer.current !== undefined) {
      clearTimeout(redirectTimer.current);
      redirectTimer.current = undefined;
    }

    router.push("/dashboard");
  }

  function disconnectWallet() {
    if (redirectTimer.current !== undefined) {
      clearTimeout(redirectTimer.current);
      redirectTimer.current = undefined;
    }

    disconnect();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        size="xl"
        variant="gradient"
        className="w-56 overflow-hidden font-mono-arcanum uppercase"
        onClick={() => {
          if (isConnected) {
            enterApp();
            return;
          }

          openConnectModal?.();
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isConnected ? "connected" : "disconnected"}
            initial={
              reducedMotion ? false : { opacity: motionOpacity.hidden, y: motionTransforms.fadeUpY }
            }
            animate={{ opacity: motionOpacity.full, y: 0 }}
            exit={{ opacity: motionOpacity.hidden, y: motionTransforms.fadeDownY }}
            transition={motionTransition("short", "standard")}
          >
            LAUNCH DASHBOARD
          </motion.span>
        </AnimatePresence>
      </Button>

      {isConnected && address !== undefined ? (
        <p className="font-mono-arcanum text-ash-muted text-xs">
          Connected as {shortAddress(address)}{" "}
          <button
            type="button"
            className="text-ash-soft underline-offset-4 hover:text-ash-bright hover:underline"
            onClick={disconnectWallet}
          >
            Disconnect
          </button>
        </p>
      ) : null}
    </div>
  );
}

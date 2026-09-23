let pendingWalletLaunch = false;

/**
 * This intent deliberately lives outside the identity-scoped provider tree.
 * Connecting a wallet changes that tree's key, so component state inside the
 * landing page can be unmounted before a connect promise's continuation runs.
 */
export function requestWalletLaunch() {
  pendingWalletLaunch = true;
}

export function clearWalletLaunch() {
  pendingWalletLaunch = false;
}

export function consumeWalletLaunch(isConnected: boolean) {
  if (!isConnected || !pendingWalletLaunch) {
    return false;
  }

  pendingWalletLaunch = false;
  return true;
}

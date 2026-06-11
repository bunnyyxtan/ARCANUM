export function shouldSimulateFailure() {
  return process.env.NODE_ENV === "development" && Math.floor(Math.random() * 20) === 0;
}

export function mockNetworkDelay() {
  return 420;
}

export type NimiqHostState = {
  available: boolean;
  network: "mainnet" | "testnet" | "unknown";
};

export function getNimiqHostState(): NimiqHostState {
  if (typeof window === "undefined") return { available: false, network: "unknown" };
  const host = (window as Window & { nimiqPay?: { network?: "mainnet" | "testnet" } }).nimiqPay;
  return { available: Boolean(host), network: host?.network ?? "unknown" };
}

export async function connectNimiq() {
  const { init } = await import("@nimiq/mini-app-sdk");
  const provider = await init();
  const [accounts, consensus, blockNumber] = await Promise.all([
    provider.listAccounts(),
    provider.isConsensusEstablished(),
    provider.getBlockNumber(),
  ]);
  return { accounts, consensus, blockNumber };
}

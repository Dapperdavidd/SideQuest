import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as Nimiq from "@nimiq/core";

function normalized(address) {
  return address.replaceAll(/\s/g, "").toUpperCase();
}

export function derivePrivateKeyForAddress(secret, expectedAddress, maxAccounts = 20) {
  const input = secret.trim();
  const expected = normalized(expectedAddress);
  if (/^[0-9a-fA-F]{64}$/.test(input)) {
    const privateKey = Nimiq.PrivateKey.fromHex(input);
    const address = Nimiq.KeyPair.derive(privateKey).toAddress().toUserFriendlyAddress();
    if (normalized(address) === expected) return privateKey.toHex();
    throw new Error(`That private key derives ${address}, not the configured treasury.`);
  }

  Nimiq.MnemonicUtils.getMnemonicType(input);
  const candidates = [Nimiq.MnemonicUtils.mnemonicToExtendedPrivateKey(input)];
  const seed = Nimiq.MnemonicUtils.mnemonicToSeed(input);
  for (let account = 0; account < maxAccounts; account += 1) {
    candidates.push(
      Nimiq.ExtendedPrivateKey.derivePathFromSeed(`m/44'/242'/${account}'/0'`, seed),
    );
  }
  for (const candidate of candidates) {
    if (normalized(candidate.toAddress().toUserFriendlyAddress()) === expected) {
      return candidate.privateKey.toHex();
    }
  }
  throw new Error(`The recovery phrase did not derive ${expectedAddress} in the first ${maxAccounts} accounts.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const expectedAddress = process.argv[2];
    const secret = await readFile(0, "utf8");
    process.stdout.write(derivePrivateKeyForAddress(secret, expectedAddress));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Unable to derive treasury key."}\n`);
    process.exitCode = 1;
  }
}

import { formatSystemMap } from "../reporting/console.js";

export async function runMapCommand(): Promise<void> {
  console.log(formatSystemMap());
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function getFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    return undefined;
  }

  return value;
}

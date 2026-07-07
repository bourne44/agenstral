import type { Policy } from "../domain/types.js";

export const DEFAULT_POLICY: Policy = {
  version: 1,
  defaultAction: "ask",
  rules: [
    {
      id: "block-secret-values",
      description: "Block tool calls carrying secret-looking values.",
      action: "deny",
      match: {
        server: "*",
        tool: "*"
      },
      conditions: {
        hasSecret: true
      }
    },
    {
      id: "block-cloud-metadata-access",
      description: "Block common cloud metadata service access patterns.",
      action: "deny",
      match: {
        server: "*",
        tool: "*"
      },
      conditions: {
        anyArgumentValueMatches: [
          "169\\.254\\.169\\.254",
          "metadata\\.google\\.internal",
          "100\\.100\\.100\\.200"
        ]
      }
    },
    {
      id: "ask-shell-commands",
      description: "Require approval for shell execution.",
      action: "ask",
      match: {
        server: [
          "shell",
          "terminal",
          "command"
        ],
        tool: "*"
      }
    },
    {
      id: "allow-readonly-filesystem",
      description: "Allow common read-only filesystem operations.",
      action: "allow",
      match: {
        server: "filesystem",
        tool: [
          "read_file",
          "list_directory",
          "search_files",
          "get_file_info"
        ]
      }
    }
  ]
};

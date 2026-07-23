const STYLE_COMMANDS = new Set([
  "SetCaption",
  "SetColor",
  "SetFilling",
  "SetFixed",
  "SetLabelMode",
  "SetLabelStyle",
  "SetLayer",
  "SetLineStyle",
  "SetLineThickness",
  "SetPointSize",
  "SetPointStyle",
  "SetVisible",
  "ShowLabel"
]);

const ANONYMOUS_STYLE_TARGETS = new Set([
  "Angle",
  "Circle",
  "Line",
  "Locus",
  "OrthogonalLine",
  "ParallelLine",
  "PerpendicularLine",
  "Plane",
  "Polygon",
  "Ray",
  "Segment",
  "Tangent"
]);

const BUILTIN_IDENTIFIERS = new Set([
  "x",
  "y",
  "z",
  "pi",
  "e",
  "true",
  "false",
  "sqrt",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "abs",
  "ln",
  "log",
  "exp",
  "floor",
  "ceil",
  "round"
]);

function normalizeOuterBrackets(command) {
  const text = String(command ?? "").trim();
  const opening = text.indexOf("[");
  if (opening < 0 || !text.endsWith("]")) return text;
  const prefix = text.slice(0, opening);
  if (!/^\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?[A-Za-z][A-Za-z0-9_]*\s*$/.test(prefix)) {
    return text;
  }
  return `${prefix}(${text.slice(opening + 1, -1)})`;
}

export function splitGgbArguments(source) {
  const args = [];
  let depth = 0;
  let quote = "";
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (character === quote && previous !== "\\") quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") depth -= 1;
    if (depth < 0) return null;
    if (character === "," && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (depth !== 0 || quote) return null;
  args.push(source.slice(start).trim());
  return args;
}

function extractDependencies(expression, ownLabel, commandName) {
  const dependencies = new Set();
  const stripped = String(expression)
    .replace(/(["']).*?\1/g, " ")
    .replaceAll("π", "pi");
  for (const match of stripped.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\b/g)) {
    const identifier = match[1];
    const lower = identifier.toLowerCase();
    if (identifier === ownLabel || identifier === commandName || BUILTIN_IDENTIFIERS.has(lower)) continue;
    if (/^[A-Za-z]+$/.test(identifier) && identifier === commandName) continue;
    dependencies.add(identifier);
  }
  return [...dependencies];
}

export function parseGgbCommand(rawCommand) {
  const command = normalizeOuterBrackets(rawCommand);
  if (!command) return { raw: command, kind: "empty", validSyntax: false };

  const assignment = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*([\s\S]+?)\s*$/);
  const label = assignment?.[1] || "";
  const expression = assignment?.[2] || command;
  const call = expression.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*$/);
  const labeledEquation = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*([\s\S]+)$/);
  const functionAssignment = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*\(\s*x\s*\)\s*=\s*([\s\S]+)$/);
  const pointAssignment = assignment && expression.match(/^\s*\(([\s\S]*)\)\s*$/);

  if (labeledEquation) {
    return {
      raw: command,
      kind: "equation",
      label: labeledEquation[1],
      commandName: "Equation",
      args: [labeledEquation[2]],
      dependencies: extractDependencies(labeledEquation[2], labeledEquation[1], "Equation"),
      validSyntax: true
    };
  }

  if (functionAssignment) {
    return {
      raw: command,
      kind: "function",
      label: functionAssignment[1],
      commandName: "Function",
      args: [functionAssignment[2]],
      dependencies: extractDependencies(functionAssignment[2], functionAssignment[1], "Function"),
      validSyntax: true
    };
  }

  if (pointAssignment) {
    const args = splitGgbArguments(pointAssignment[1]);
    return {
      raw: command,
      kind: "point",
      label,
      commandName: "Point",
      args: args || [],
      dependencies: extractDependencies(pointAssignment[1], label, "Point"),
      validSyntax: Boolean(args && [2, 3].includes(args.length))
    };
  }

  if (call) {
    const commandName = call[1];
    const args = splitGgbArguments(call[2]);
    return {
      raw: command,
      kind: STYLE_COMMANDS.has(commandName) ? "style" : (label ? "construction" : "command"),
      label,
      commandName,
      args: args || [],
      target: STYLE_COMMANDS.has(commandName) ? args?.[0] || "" : "",
      dependencies: extractDependencies(call[2], label, commandName),
      validSyntax: Boolean(args)
    };
  }

  if (assignment) {
    return {
      raw: command,
      kind: "value",
      label,
      commandName: "Value",
      args: [expression],
      dependencies: extractDependencies(expression, label, "Value"),
      validSyntax: true
    };
  }

  return { raw: command, kind: "unknown", label: "", commandName: "", args: [], dependencies: [], validSyntax: false };
}

function createAnonymousLabel(commandName, index) {
  const prefix = {
    Polygon: "region",
    Segment: "segment",
    Plane: "plane",
    Circle: "circle",
    Angle: "angle",
    Locus: "path"
  }[commandName] || "helper";
  return `${prefix}${index}`;
}

export function normalizeAnonymousStyleTargets(commands) {
  const output = [];
  const used = new Set();
  let generatedIndex = 1;

  for (const command of commands || []) {
    const parsed = parseGgbCommand(command);
    if (parsed.label) used.add(parsed.label);
  }

  for (const command of commands || []) {
    const parsed = parseGgbCommand(command);
    if (parsed.kind !== "style" || !parsed.args.length) {
      output.push(parsed.raw);
      continue;
    }

    const nested = parseGgbCommand(`temp=${parsed.args[0]}`);
    if (nested.kind !== "construction" || !ANONYMOUS_STYLE_TARGETS.has(nested.commandName)) {
      output.push(parsed.raw);
      continue;
    }

    let label;
    do {
      label = createAnonymousLabel(nested.commandName, generatedIndex);
      generatedIndex += 1;
    } while (used.has(label));
    used.add(label);
    output.push(`${label}=${parsed.args[0]}`);
    output.push(`${parsed.commandName}(${[label, ...parsed.args.slice(1)].join(",")})`);
  }

  return output.filter(Boolean);
}

export function labelAnonymousConstructions(commands) {
  const used = new Set((commands || []).map(parseGgbCommand).map((entry) => entry.label).filter(Boolean));
  const counters = new Map();
  return (commands || []).map((command) => {
    const parsed = parseGgbCommand(command);
    if (parsed.kind !== "command" || !ANONYMOUS_STYLE_TARGETS.has(parsed.commandName)) return parsed.raw;
    let index = (counters.get(parsed.commandName) || 0) + 1;
    let label;
    do {
      label = createAnonymousLabel(parsed.commandName, index);
      index += 1;
    } while (used.has(label));
    counters.set(parsed.commandName, index - 1);
    used.add(label);
    return `${label}=${parsed.raw}`;
  }).filter(Boolean);
}

export function analyzeGgbCommands(commands) {
  const parsed = (commands || []).map(parseGgbCommand).filter((entry) => entry.kind !== "empty");
  const definitions = new Map();
  const duplicateLabels = [];
  const syntaxErrors = [];

  for (const entry of parsed) {
    if (!entry.validSyntax) syntaxErrors.push(entry.raw);
    if (!entry.label) continue;
    if (definitions.has(entry.label)) duplicateLabels.push(entry.label);
    definitions.set(entry.label, entry);
  }

  const known = new Set();
  const unresolved = [];
  for (const entry of parsed) {
    if (entry.kind === "style") {
      const target = entry.target;
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(target) && !known.has(target)) {
        unresolved.push({ command: entry.raw, label: target });
      }
      continue;
    }
    for (const dependency of entry.dependencies) {
      if (!known.has(dependency) && definitions.has(dependency)) {
        unresolved.push({ command: entry.raw, label: dependency });
      }
    }
    if (entry.label) known.add(entry.label);
  }

  return {
    parsed,
    definitions,
    duplicateLabels: [...new Set(duplicateLabels)],
    syntaxErrors,
    unresolved,
    ok: !duplicateLabels.length && !syntaxErrors.length && !unresolved.length
  };
}

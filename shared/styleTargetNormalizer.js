const STYLE_COMMAND_PATTERN = /^\s*(Set(?:Caption|Color|Filling|Fixed|LabelMode|LabelStyle|Layer|LineStyle|LineThickness|PointSize|PointStyle|Visible)|ShowLabel)\s*\(([\s\S]*)\)\s*$/i;
const CONSTRUCTION_TARGET_PATTERN = /^\s*(Segment|Line|Ray|Polygon|Circle|Tangent|OrthogonalLine|PerpendicularLine|ParallelLine)\s*\(([\s\S]*)\)\s*$/i;

function normalizeOuterCommandBrackets(command) {
  const trimmed = String(command ?? "").trim();
  const match = trimmed.match(/^(\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*)?[A-Za-z][A-Za-z0-9_]*)\s*\[([\s\S]*)\]\s*$/);
  return match ? `${match[1]}(${match[2]})` : trimmed;
}

function normalizeNestedConstructionBrackets(expression) {
  return String(expression ?? "").replace(
    /^\s*(Segment|Line|Ray|Polygon|Circle|Tangent|OrthogonalLine|PerpendicularLine|ParallelLine)\s*\[([\s\S]*)\]\s*$/i,
    "$1($2)"
  );
}

function splitTopLevelArguments(source) {
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

    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
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

function normalizeConstructionExpression(expression) {
  return String(expression ?? "").replace(/\s+/g, "");
}

function getAssignedConstruction(command) {
  const match = normalizeOuterCommandBrackets(command).match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*([A-Za-z][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*$/);
  if (!match) return null;

  const [, label, commandName, args] = match;
  if (!CONSTRUCTION_TARGET_PATTERN.test(`${commandName}(${args})`)) return null;

  return {
    label,
    expression: normalizeConstructionExpression(`${commandName}(${args})`)
  };
}

function createGeneratedLabel(commandName, index) {
  const prefix = {
    Circle: "styleCircle",
    Line: "styleLine",
    OrthogonalLine: "styleLine",
    ParallelLine: "styleLine",
    PerpendicularLine: "styleLine",
    Polygon: "stylePolygon",
    Ray: "styleRay",
    Segment: "styleSegment",
    Tangent: "styleLine"
  }[commandName] || "styleObject";

  return `${prefix}${index}`;
}

export function normalizeStyleCommandTargets(commands) {
  if (!Array.isArray(commands)) return [];

  const expressionToLabel = new Map();
  const usedLabels = new Set(commands.flatMap((rawCommand) => {
    const command = normalizeOuterCommandBrackets(rawCommand);
    const match = command.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=/);
    return match ? [match[1]] : [];
  }));
  const normalized = [];
  let generatedIndex = 1;

  for (const rawCommand of commands) {
    const command = normalizeOuterCommandBrackets(rawCommand);
    if (!command) continue;

    const assigned = getAssignedConstruction(command);
    if (assigned) {
      expressionToLabel.set(assigned.expression, assigned.label);
      usedLabels.add(assigned.label);
      normalized.push(command);
      continue;
    }

    const styleMatch = command.match(STYLE_COMMAND_PATTERN);
    if (!styleMatch) {
      normalized.push(command);
      continue;
    }

    const [, styleCommandName, argumentSource] = styleMatch;
    const args = splitTopLevelArguments(argumentSource);
    if (!args?.length) {
      normalized.push(command);
      continue;
    }

    const targetExpression = normalizeNestedConstructionBrackets(args[0]);
    const targetMatch = targetExpression.match(CONSTRUCTION_TARGET_PATTERN);
    if (!targetMatch) {
      normalized.push(command);
      continue;
    }

    const [, constructionCommandName] = targetMatch;
    const expression = normalizeConstructionExpression(targetExpression);
    let targetLabel = expressionToLabel.get(expression);
    if (!targetLabel) {
      do {
        targetLabel = createGeneratedLabel(constructionCommandName, generatedIndex);
        generatedIndex += 1;
      } while (usedLabels.has(targetLabel));
      usedLabels.add(targetLabel);
      expressionToLabel.set(expression, targetLabel);
      normalized.push(`${targetLabel}=${targetExpression}`);
    }

    normalized.push(`${styleCommandName}(${[targetLabel, ...args.slice(1)].join(",")})`);
  }

  return normalized;
}

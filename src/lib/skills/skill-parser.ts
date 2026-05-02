export type ParsedSkillMarkdown = {
  title: string;
  description: string;
  bodyMarkdown: string;
};

function trimLeadingBlankLines(lines: string[]) {
  while (lines[0]?.trim() === "") {
    lines.shift();
  }

  return lines;
}

function trimTrailingBlankLines(lines: string[]) {
  while (lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  return lines;
}

export function parseSkillMarkdown(
  rawMarkdown: string,
  fallbackTitle: string,
): ParsedSkillMarkdown {
  const lines = trimLeadingBlankLines(rawMarkdown.split(/\r?\n/));
  let title = fallbackTitle;
  let description = "";

  if (lines[0]?.startsWith("# ")) {
    title = lines.shift()!.replace(/^#\s+/, "").trim() || fallbackTitle;
  }

  trimLeadingBlankLines(lines);

  if (lines[0] && !lines[0].startsWith("#")) {
    description = lines.shift()!.trim();
    trimLeadingBlankLines(lines);
  }

  trimTrailingBlankLines(lines);

  return {
    title,
    description,
    bodyMarkdown: lines.join("\n"),
  };
}

export function buildSkillMarkdown(input: {
  title: string;
  description: string;
  bodyMarkdown: string;
}) {
  const sections = [`# ${input.title.trim()}`];

  if (input.description.trim()) {
    sections.push(input.description.trim());
  }

  if (input.bodyMarkdown.trim()) {
    sections.push(input.bodyMarkdown.trim());
  }

  return `${sections.join("\n\n")}\n`;
}

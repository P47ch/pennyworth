const translatableAttributePattern = /\b(title|aria-label|data-label|placeholder)="([^"<>]*[A-Za-z][^"<>]*)"/g;
const staticTextPattern = />([^<>]+)</g;

function translatorExpression(value: string) {
  return `<%= t(${JSON.stringify(value)}) %>`;
}

function localizeHtmlFragment(fragment: string) {
  const withAttributes = fragment.replace(
    translatableAttributePattern,
    (_match, attribute: string, value: string) => `${attribute}="${translatorExpression(value)}"`
  );

  return withAttributes.replace(staticTextPattern, (match, text: string) => {
    const value = text.trim();

    if (!/[A-Za-z]/.test(value)) {
      return match;
    }

    const leadingWhitespace = text.slice(0, text.indexOf(value));
    const trailingWhitespace = text.slice(text.indexOf(value) + value.length);
    return `>${leadingWhitespace}${translatorExpression(value)}${trailingWhitespace}<`;
  });
}

export function localizeEjsTemplate(template: string) {
  const ejsBlockPattern = /<%[\s\S]*?%>/g;
  let result = "";
  let cursor = 0;

  for (const match of template.matchAll(ejsBlockPattern)) {
    const index = match.index ?? 0;
    result += localizeHtmlFragment(template.slice(cursor, index));
    result += match[0];
    cursor = index + match[0].length;
  }

  return result + localizeHtmlFragment(template.slice(cursor));
}

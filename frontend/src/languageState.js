export const nextTranslatedValue = (previous, current, mode, translate) => {
  const original = previous && current === previous.rendered ? previous.original : current;
  return { original, rendered: mode === 'en' ? translate(original) : original };
};

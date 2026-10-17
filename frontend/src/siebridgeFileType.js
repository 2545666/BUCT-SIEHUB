const extension = file => String(file.extension || (file.filename || file.name || file.originalName || '').match(/\.[^.]+$/)?.[0] || '').toLowerCase();
export const isMarkdownFile = (file = {}) => ['.md', '.markdown'].includes(extension(file)) || /markdown/i.test(file.mimetype || '');
export const isPlainTextFile = (file = {}) => !isMarkdownFile(file) && (extension(file) === '.txt' || /^text\/plain(?:;|$)/i.test(file.mimetype || ''));

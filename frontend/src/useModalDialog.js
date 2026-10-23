import { useEffect, useRef } from 'react';

export default function useModalDialog(open) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    const containFocus = event => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
        .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', containFocus);
    return () => {
      dialog.removeEventListener('keydown', containFocus);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  return ref;
}

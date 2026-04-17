import { FONT_SIZE_ATTR, FONT_SIZE_STORAGE_KEY } from "@/lib/preferences";

export function PreferencesScript() {
  // Keep this inline IIFE tiny. It runs before hydration; any error is swallowed.
  // Duplicates the validation from parseFontSize() on purpose — cannot import
  // helpers here because this code is serialized as a raw string.
  const code = `(function(){try{var s=localStorage.getItem("${FONT_SIZE_STORAGE_KEY}");if(s==="sm"||s==="base"||s==="lg"||s==="xl"){document.documentElement.setAttribute("${FONT_SIZE_ATTR}",s);}else{document.documentElement.setAttribute("${FONT_SIZE_ATTR}","base");}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

// Datos de la empresa que se capturan en el registro y se corrigen desde
// «Mi empresa». Los valores de `size` son los que acepta la base
// (companies.size); el texto visible sale de las traducciones.
export const COMPANY_SIZES = [
  { value: "1-10", labelKey: "companySize1" },
  { value: "11-50", labelKey: "companySize2" },
  { value: "51-250", labelKey: "companySize3" },
  { value: "251+", labelKey: "companySize4" },
];

// Texto del tamaño de la empresa ("" si no se capturó).
export function companySizeLabel(value, t) {
  const size = COMPANY_SIZES.find((s) => s.value === value);
  return size ? t(size.labelKey) : "";
}

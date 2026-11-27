import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import PropTypes from "prop-types";

// Área de texto que crece con lo que se escribe (sin barra de desplazamiento
// propia), para capturar cómodo desde el celular.
const AutoTextarea = forwardRef(function AutoTextarea({ value, onChange, className = "", minRows = 2, ...rest }, ref) {
  const inner = useRef(null);
  useImperativeHandle(ref, () => inner.current);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={inner}
      rows={minRows}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={`resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
});

AutoTextarea.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  minRows: PropTypes.number,
};

export default AutoTextarea;

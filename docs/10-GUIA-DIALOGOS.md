# 🎨 Guía de Diálogos de Confirmación (AlertDialog)

## Problema

La clase `glass` que se usa en toda la app genera un fondo semi-transparente oscuro. Los colores de texto por defecto de los componentes Radix UI (`text-foreground`, `text-muted`) **no son visibles** sobre este fondo en tema oscuro.

## Regla Principal

> **No usar `glass` ni clases CSS de color en los `AlertDialog`.** Usar `style={{}}` con colores explícitos para garantizar contraste.

---

## Plantilla Base

```jsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogContent
    className="border border-white/10 rounded-xl"
    style={{ backgroundColor: "#1a1a2e" }}
  >
    <AlertDialogHeader>
      <AlertDialogTitle className="text-lg" style={{ color: "#f0f0f0" }}>
        Título del diálogo
      </AlertDialogTitle>
      <AlertDialogDescription style={{ color: "#a0a0b0" }}>
        Texto descriptivo explicando la acción.
        <span
          className="block mt-2 font-mono text-sm"
          style={{ color: "#f0c060" }}
        >
          dato-destacado@ejemplo.com
        </span>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel
        className="border border-white/20 hover:bg-white/10"
        style={{ color: "#d0d0d0", backgroundColor: "transparent" }}
      >
        Cancelar
      </AlertDialogCancel>
      <AlertDialogAction className="bg-red-500 text-white hover:bg-red-600">
        Confirmar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>;
```

---

## Paleta de Colores

| Elemento           | Color      | Uso                                |
| ------------------ | ---------- | ---------------------------------- |
| **Fondo**          | `#1a1a2e`  | `AlertDialogContent` background    |
| **Borde**          | `white/10` | Borde sutil del contenedor         |
| **Título**         | `#f0f0f0`  | Texto principal, alto contraste    |
| **Descripción**    | `#a0a0b0`  | Texto secundario, gris claro       |
| **Dato destacado** | `#f0c060`  | Emails, códigos, datos importantes |
| **Cancelar texto** | `#d0d0d0`  | Botón cancelar, fondo transparente |
| **Cancelar borde** | `white/20` | Borde visible del botón cancelar   |

## Colores de Botones de Acción

| Tipo de acción  | Clase CSS                                             |
| --------------- | ----------------------------------------------------- |
| **Destructiva** | `bg-red-500 text-white hover:bg-red-600`              |
| **Positiva**    | `bg-green-500 text-white hover:bg-green-600`          |
| **Neutral**     | `bg-accent text-accent-foreground hover:bg-accent/80` |

---

## ❌ No Hacer

```jsx
// ❌ glass hace el texto invisible
<AlertDialogContent className="glass bg-background border-border">

// ❌ text-foreground y text-muted no funcionan con glass
<AlertDialogTitle className="text-foreground">

// ❌ glass en botón cancelar lo hace ilegible
<AlertDialogCancel className="glass">
```

## ✅ Hacer

```jsx
// ✅ Fondo sólido con inline styles
<AlertDialogContent
  className="border border-white/10 rounded-xl"
  style={{ backgroundColor: '#1a1a2e' }}
>

// ✅ Colores explícitos
<AlertDialogTitle style={{ color: '#f0f0f0' }}>

// ✅ Botón cancelar visible
<AlertDialogCancel
  className="border border-white/20 hover:bg-white/10"
  style={{ color: '#d0d0d0', backgroundColor: 'transparent' }}
>
```

---

## Ejemplo Real

Referencia: [UserManagement.jsx](../src/pages/UserManagement.jsx) — diálogos de suspender/reactivar usuario.

---

## Checklist para Nuevos Diálogos

- [ ] `AlertDialogContent` usa `style={{ backgroundColor: '#1a1a2e' }}` (no `glass`)
- [ ] Título usa `style={{ color: '#f0f0f0' }}`
- [ ] Descripción usa `style={{ color: '#a0a0b0' }}`
- [ ] Datos destacados usan `style={{ color: '#f0c060' }}`
- [ ] Botón cancelar tiene `border-white/20` y `color: '#d0d0d0'`
- [ ] Botón de acción usa color sólido (`bg-red-500`, `bg-green-500`, etc.)
- [ ] Verificar visualmente en tema oscuro antes de entregar

import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import StagingBadge from "@/components/StagingBadge"

function App() {
  return (
    <>
      <Pages />
      <Toaster />
      {/* Avisos de `toast` de sonner (administración, Mi empresa). */}
      <SonnerToaster position="top-center" richColors closeButton />
      <StagingBadge />
    </>
  )
}

export default App

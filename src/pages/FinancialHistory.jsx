import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  BarChart3,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Printer,
  FileText,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from '@/components/LanguageContext';

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const FAKE_SALES = {
  lines: [
    { name: "Producto A", values: [120000, 135000, 128000, 142000, 150000, 138000, 155000, 160000, 148000, 170000, 165000, 180000] },
    { name: "Producto B", values: [85000, 90000, 78000, 95000, 88000, 92000, 100000, 105000, 98000, 110000, 108000, 115000] },
    { name: "Servicio C", values: [45000, 48000, 42000, 50000, 52000, 47000, 55000, 58000, 53000, 60000, 57000, 62000] },
  ],
  returns: [
    { name: "Producto A", values: [2400, 2700, 2560, 2840, 3000, 2760, 3100, 3200, 2960, 3400, 3300, 3600] },
    { name: "Producto B", values: [1700, 1800, 1560, 1900, 1760, 1840, 2000, 2100, 1960, 2200, 2160, 2300] },
  ]
};

const FAKE_INCOME_STATEMENT = [
  { label: "Ventas/Ingresos netos", value: 2450000, pct: 100, bold: true },
  { label: "  Otros ingresos", value: 35000, pct: 1.4, indent: true },
  { label: "  Devoluciones", value: -45200, pct: -1.8, indent: true, negative: true },
  { label: "Costo de ventas", value: -1617000, pct: -66.0, bold: true, negative: true },
  { label: "Utilidad bruta", value: 833000, pct: 34.0, bold: true, accent: true },
  { label: "Gastos de administración", value: -245000, pct: -10.0 },
  { label: "Gastos de venta", value: -183750, pct: -7.5 },
  { label: "Depreciación", value: -49000, pct: -2.0 },
  { label: "Total gastos de operación", value: -477750, pct: -19.5, bold: true, negative: true },
  { label: "Utilidad de operación", value: 355250, pct: 14.5, bold: true, accent: true },
  { label: "Gastos financieros", value: -73500, pct: -3.0 },
  { label: "Utilidad antes de impuestos", value: 281750, pct: 11.5, bold: true },
  { label: "ISR (30%)", value: -84525, pct: -3.5, negative: true },
  { label: "Utilidad neta", value: 197225, pct: 8.1, bold: true, accent: true },
];

const FAKE_CASH_FLOW = {
  operations: [
    { label: "Cobro a clientes", values: [205000, 218000, 210000, 235000, 242000, 230000, 258000, 268000, 248000, 283000, 275000, 297000] },
    { label: "Pagos a proveedores", values: [-135000, -143000, -138000, -155000, -160000, -152000, -170000, -177000, -164000, -187000, -182000, -196000] },
    { label: "Pagos por gastos", values: [-40000, -42000, -38000, -45000, -43000, -41000, -47000, -48000, -44000, -50000, -49000, -52000] },
    { label: "Pagos impuestos", values: [-7000, -7500, -7000, -8000, -8200, -7800, -8700, -9000, -8400, -9500, -9200, -10000] },
  ],
  investing: [
    { label: "Equipo de oficina", values: [0, 0, -15000, 0, 0, 0, 0, 0, -12000, 0, 0, 0] },
    { label: "Equipo de cómputo", values: [-25000, 0, 0, 0, 0, 0, -18000, 0, 0, 0, 0, 0] },
  ]
};

const fmt = (n) => {
  if (n === 0) return "-";
  const prefix = n < 0 ? "-$" : "$";
  return prefix + Math.abs(n).toLocaleString("en-US");
};

export default function FinancialHistory() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("sales");
  const [salesSubTab, setSalesSubTab] = useState("historical");

  const mainTabs = [
    { id: "sales", label: t('finSalesData'), icon: BarChart3 },
    { id: "income", label: t('finIncomeStatement'), icon: FileText },
    { id: "cashflow", label: t('finCashFlow'), icon: DollarSign },
  ];

  const salesSubTabs = [
    { id: "historical", label: t('finHistSales') },
    { id: "returns", label: t('finReturns') },
    { id: "totals", label: t('finNetTotals') },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl("FinanceDashboard")}>
          <Button variant="ghost" size="icon" className="glass">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-title">{t('finHistorical')}</h1>
          <p className="text-muted">{t('finHistoricalPageDesc')}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="grid grid-cols-3 gap-4">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all ${
              activeTab === tab.id ? "nav-glass active" : "glass glass-hover"
            }`}
          >
            <tab.icon className="w-7 h-7" />
            <span className="font-subtitle text-sm text-center">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sales Data */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            {salesSubTabs.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSalesSubTab(sub.id)}
                className={`px-5 py-2.5 rounded-xl font-subtitle text-sm transition-all ${
                  salesSubTab === sub.id ? "bg-accent text-accent-foreground" : "glass hover:border-accent"
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-subtitle flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  {salesSubTab === "returns" ? t('finReturns') : salesSubTab === "totals" ? t('finNetTotals') : t('finHistSales')}
                </CardTitle>
                <Button variant="outline" size="sm" className="glass hover:border-accent">
                  <Printer className="w-4 h-4 mr-2" /> {t('finPrint')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)]">
                      <th className="text-left py-3 px-3 font-subtitle text-muted sticky left-0 bg-transparent">{t('finProductLine')}</th>
                      {MONTHS.map((m) => (
                        <th key={m} className="text-right py-3 px-3 font-subtitle text-muted">{m}</th>
                      ))}
                      <th className="text-right py-3 px-3 font-subtitle text-accent">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesSubTab === "returns" ? FAKE_SALES.returns : FAKE_SALES.lines).map((line, i) => (
                      <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                        <td className="py-3 px-3 font-subtitle sticky left-0">{line.name}</td>
                        {line.values.map((v, j) => (
                          <td key={j} className={`py-3 px-3 text-right ${salesSubTab === "returns" ? "text-red-400" : ""}`}>
                            {fmt(salesSubTab === "returns" ? -v : v)}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-right font-subtitle text-accent">
                          {fmt(salesSubTab === "returns" ? -line.values.reduce((a, b) => a + b, 0) : line.values.reduce((a, b) => a + b, 0))}
                        </td>
                      </tr>
                    ))}
                    {salesSubTab === "totals" && (
                      <>
                        {FAKE_SALES.lines.map((line, i) => (
                          <tr key={`net-${i}`} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                            <td className="py-3 px-3 font-subtitle sticky left-0">{line.name} (Neto)</td>
                            {line.values.map((v, j) => {
                              const ret = FAKE_SALES.returns[i]?.values[j] || 0;
                              return <td key={j} className="py-3 px-3 text-right">{fmt(v - ret)}</td>;
                            })}
                            <td className="py-3 px-3 text-right font-subtitle text-accent">
                              {fmt(line.values.reduce((a, b) => a + b, 0) - (FAKE_SALES.returns[i]?.values.reduce((a, b) => a + b, 0) || 0))}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Income Statement */}
      {activeTab === "income" && (
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-subtitle flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent" />
                  {t('finIncomeStatement')} — 2025
                </CardTitle>
                <p className="text-sm text-muted mt-1">Tenryu Corp.</p>
              </div>
              <Button variant="outline" size="sm" className="glass hover:border-accent">
                <Printer className="w-4 h-4 mr-2" /> {t('finPrint')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-4 font-subtitle text-sm text-muted">{t('finConcept')}</th>
                    <th className="text-right py-3 px-4 font-subtitle text-sm text-muted">Total 2025</th>
                    <th className="text-right py-3 px-4 font-subtitle text-sm text-muted">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {FAKE_INCOME_STATEMENT.map((row, i) => (
                    <tr key={i} className={`border-b border-[var(--card-border)] ${row.accent ? "bg-accent/10" : ""} hover:bg-[var(--table-row-hover)]`}>
                      <td className={`py-3 px-4 text-sm ${row.bold ? "font-subtitle" : ""} ${row.indent ? "pl-8 text-muted" : ""}`}>
                        {row.label}
                      </td>
                      <td className={`py-3 px-4 text-sm text-right ${row.bold ? "font-subtitle" : ""} ${row.negative ? "text-red-400" : ""} ${row.accent ? "text-accent" : ""}`}>
                        {fmt(row.value)}
                      </td>
                      <td className={`py-3 px-4 text-sm text-right ${row.negative ? "text-red-400" : ""} ${row.accent ? "text-accent font-subtitle" : "text-muted"}`}>
                        {row.pct > 0 ? "+" : ""}{row.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Flow */}
      {activeTab === "cashflow" && (
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-subtitle flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-accent" />
                {t('finCashFlow')} — 2025
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="glass hover:border-accent">
                  <Filter className="w-4 h-4 mr-2" /> {t('finAll')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    <th className="text-left py-3 px-3 font-subtitle text-muted sticky left-0 bg-transparent">{t('finConcept')}</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="text-right py-3 px-2 font-subtitle text-muted">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-accent/10">
                    <td colSpan={13} className="py-2 px-3 font-subtitle text-accent text-xs">{t('finOperationActivities')}</td>
                  </tr>
                  {FAKE_CASH_FLOW.operations.map((row, i) => (
                    <tr key={`op-${i}`} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                      <td className="py-2 px-3 sticky left-0">{row.label}</td>
                      {row.values.map((v, j) => (
                        <td key={j} className={`py-2 px-2 text-right ${v < 0 ? "text-red-400" : ""}`}>{fmt(v)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-b-2 border-accent/30">
                    <td className="py-2 px-3 font-subtitle text-accent sticky left-0">{t('finOperationFlow')}</td>
                    {MONTHS.map((_, j) => {
                      const total = FAKE_CASH_FLOW.operations.reduce((sum, r) => sum + r.values[j], 0);
                      return <td key={j} className="py-2 px-2 text-right font-subtitle text-accent">{fmt(total)}</td>;
                    })}
                  </tr>
                  <tr className="bg-accent/10">
                    <td colSpan={13} className="py-2 px-3 font-subtitle text-accent text-xs">{t('finInvestActivities')}</td>
                  </tr>
                  {FAKE_CASH_FLOW.investing.map((row, i) => (
                    <tr key={`inv-${i}`} className="border-b border-[var(--card-border)] hover:bg-[var(--table-row-hover)]">
                      <td className="py-2 px-3 sticky left-0">{row.label}</td>
                      {row.values.map((v, j) => (
                        <td key={j} className={`py-2 px-2 text-right ${v < 0 ? "text-red-400" : ""}`}>{fmt(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Link to={createPageUrl("SwotAnalysis")}>
          <Button variant="outline" className="glass hover:border-accent font-subtitle">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('finSwot')}
          </Button>
        </Link>
        <Link to={createPageUrl("FinancialProjection")}>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-subtitle">
            {t('finProjection')} <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

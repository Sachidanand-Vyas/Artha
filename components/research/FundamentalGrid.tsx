import type { Stock } from "@/lib/types";
import { inrCompact, marketCapLabel, num2 } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/Tooltip";

const FUND = {
  revenue: {
    explain:
      "Total money the company earned from selling its products or services in the last financial year. Growth here is the engine of everything else.",
  },
  netProfit: {
    explain:
      "What remains after all costs, interest and taxes — the earnings that belong to shareholders. This is the 'E' in P/E.",
  },
  eps: {
    explain:
      "Net profit divided by the number of shares. It lets you compare earnings across companies of any size.",
  },
  pe: {
    explain:
      "Shows how much investors are paying for each unit of the company's earnings. A higher P/E usually means the market expects faster future growth — or that the stock is expensive.",
  },
  pb: {
    explain:
      "Price divided by book value (assets minus liabilities). Compares what the market pays with the accounting value of the company's net assets.",
  },
  roe: {
    explain:
      "Return on Equity — net profit as a percentage of shareholder money. High, stable ROE suggests the business generates profit efficiently from the capital you (as owner) have put in.",
  },
  roce: {
    explain:
      "Return on Capital Employed — how well the business earns on all its capital, including debt. Especially useful for companies with large fixed assets. Not meaningful for banks.",
  },
  de: {
    explain:
      "Debt-to-Equity — how much the company borrows relative to owner funds. Higher leverage can amplify returns but also amplifies losses and interest risk.",
  },
  dividendYield: {
    explain:
      "Annual dividend per share as a percentage of the price. Income you receive without selling shares. Very high yields sometimes signal that the market doubts the dividend is sustainable.",
  },
  marketCap: {
    explain:
      "Share price × number of shares — the total market value of the company. Large caps are generally less volatile; small caps carry more risk but more growth potential.",
  },
};

function Metric({
  label,
  value,
  explain,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  explain: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface2/40 px-4 py-3">
      <InfoTooltip label={<span className="text-[11px] font-medium">{label}</span>} text={explain} />
      <p className={`mt-1 text-[15px] font-bold tnum ${highlight ? "text-gold" : "text-ink"}`}>{value}</p>
    </div>
  );
}

export function FundamentalGrid({ stock }: { stock: Stock }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Metric label="Market Cap" value={marketCapLabel(stock.marketCap, stock.currency)} explain={FUND.marketCap.explain} highlight />
      <Metric label="Revenue" value={inrCompact(stock.revenue)} explain={FUND.revenue.explain} />
      <Metric label="Net Profit" value={inrCompact(stock.netProfit)} explain={FUND.netProfit.explain} />
      <Metric label="EPS" value={num2(stock.eps)} explain={FUND.eps.explain} />
      <Metric label="P/E" value={stock.pe ? num2(stock.pe) : "—"} explain={FUND.pe.explain} highlight />
      <Metric label="P/B" value={num2(stock.pb)} explain={FUND.pb.explain} />
      <Metric label="ROE" value={`${stock.roe.toFixed(1)}%`} explain={FUND.roe.explain} />
      <Metric label="ROCE" value={stock.roce ? `${stock.roce.toFixed(1)}%` : "—"} explain={FUND.roce.explain} />
      <Metric label="D/E" value={stock.debtToEquity ? num2(stock.debtToEquity) : "—"} explain={FUND.de.explain} />
      <Metric label="Dividend Yield" value={`${stock.dividendYield.toFixed(2)}%`} explain={FUND.dividendYield.explain} />
    </div>
  );
}

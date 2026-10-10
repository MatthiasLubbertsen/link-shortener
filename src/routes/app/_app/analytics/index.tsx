import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo } from "react";
import { getAnalyticsQuery } from "#/actions/analytics/queries";

export const Route = createFileRoute("/app/_app/analytics/")({
  head: () => ({
    meta: [
      {
        title: "analytics - link shortener",
      },
    ],
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(getAnalyticsQuery());
  },
  component: App,
});

function App() {
  const { data } = useSuspenseQuery(getAnalyticsQuery());
  const maxDaily = useMemo(
    () => Math.max(1, ...data.daily.map((d) => d.clicks)),
    [data.daily],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="total clicks" value={data.totalClicks} />
        <Stat label="clicks, last 30 days" value={data.clicksLast30Days} />
        <Stat label="links" value={data.totalLinks} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-600">
          clicks per day, last 30 days
        </h2>
        <div className="flex h-40 items-end gap-1 rounded border border-neutral-200 p-3">
          {data.daily.map((day) => (
            <div
              key={day.date}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t bg-cyan-400/80"
                style={{ height: `${(day.clicks / maxDaily) * 100}%`, minHeight: day.clicks > 0 ? "2px" : "0" }}
              />
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-2 py-0.5 text-xs text-white group-hover:block">
                {dayjs(day.date).format("MMM D")}: {day.clicks}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-600">top links</h2>
        {data.topLinks.length === 0 ? (
          <p className="text-sm text-neutral-600">no links yet</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
            {data.topLinks.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{link.label}</p>
                  <p className="truncate text-xs text-neutral-500">{link.url}</p>
                </div>
                <span className="shrink-0 text-sm tabular-nums">
                  {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

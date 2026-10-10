import { queryOptions } from "@tanstack/react-query";
import { getAnalytics } from ".";

export const getAnalyticsQuery = () =>
  queryOptions({
    queryKey: ["analytics", "getAnalytics"],
    queryFn: ({ signal }) => getAnalytics({ signal }),
  });
